import { Injectable, Logger } from '@nestjs/common';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { RoutingDecision } from '@llm/centralized-routing.service';
import { AgentRecord } from '@agent-platform/interfaces/agent-record.interface';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { AgentRuntimePromptService, PromptPayload } from '@agent-platform/services/agent-runtime-prompt.service';
import { AgentRuntimeDispatchService } from '@agent-platform/services/agent-runtime-dispatch.service';
import { AgentRuntimeStreamService } from '@agent-platform/services/agent-runtime-stream.service';
import { AgentRuntimeLifecycleService } from '@agent-platform/services/agent-runtime-lifecycle.service';
import { AgentRuntimeDispatchResult } from '@agent-platform/services/agent-runtime-dispatch.service';
import { AgentRuntimeNormalizationService } from '@agent-platform/services/agent-runtime-normalization.service';
import { AgentRuntimeRedactionService } from '@agent-platform/services/agent-runtime-redaction.service';
import { FunctionAgentRunnerService } from './function-agent-runner.service';
import { AgentRuntimeDeliverablesAdapter } from '@agent-platform/services/agent-runtime-deliverables.adapter';
import { AgentRuntimePlansAdapter } from '@agent-platform/services/agent-runtime-plans.adapter';
import { PlansService } from '@/agent2agent/plans/services/plans.service';

export interface AgentExecutionContext {
  organizationSlug?: string | null;
  agentSlug?: string;
  agent?: AgentRecord;
  definition?: AgentRuntimeDefinition;
  request: TaskRequestDto;
  routingMetadata?: Record<string, any>;
}

type HydratedExecutionContext = AgentExecutionContext & {
  organizationSlug: string | null;
  agentSlug: string;
  agent: AgentRecord;
  definition: AgentRuntimeDefinition;
};

@Injectable()
export class AgentModeRouterService {
  private readonly logger = new Logger(AgentModeRouterService.name);

  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly runtimeDefinitions: AgentRuntimeDefinitionService,
    private readonly promptBuilder: AgentRuntimePromptService,
    private readonly dispatcher: AgentRuntimeDispatchService,
    private readonly streamService: AgentRuntimeStreamService,
    private readonly lifecycle: AgentRuntimeLifecycleService,
    private readonly deliverables: AgentRuntimeDeliverablesAdapter,
    private readonly plans: AgentRuntimePlansAdapter,
    private readonly plansService: PlansService,
    private readonly normalization: AgentRuntimeNormalizationService,
    private readonly redaction: AgentRuntimeRedactionService,
    private readonly functionRunner: FunctionAgentRunnerService,
  ) {}

  async execute(context: AgentExecutionContext): Promise<TaskResponseDto> {
    const hydrated = await this.hydrateContext(context);

    if (!hydrated) {
      return TaskResponseDto.failure(
        context.request.mode,
        'Agent record unavailable for execution',
      );
    }

    switch (hydrated.request.mode) {
      case AgentTaskMode.CONVERSE:
        return this.handleConverse(hydrated);
      case AgentTaskMode.PLAN:
        return this.handlePlan(hydrated);
      case AgentTaskMode.BUILD:
        return this.handleBuild(hydrated);
      case AgentTaskMode.HUMAN_RESPONSE:
        return TaskResponseDto.human('Manual confirmation required');
      default:
        return TaskResponseDto.failure(
          hydrated.request.mode,
          'Unsupported mode',
        );
    }
  }

  private async handleConverse(context: HydratedExecutionContext) {
    const decision = this.extractDecision(context.routingMetadata);
    if (!decision) {
      return TaskResponseDto.failure(
        AgentTaskMode.CONVERSE,
        'Routing decision unavailable for conversation request',
      );
    }
    // Normalize content before building prompt
    const norm = this.normalization.normalize(context.definition, context.request, AgentTaskMode.CONVERSE);
    if (!norm.ok && norm.strict) {
      return TaskResponseDto.failure(AgentTaskMode.CONVERSE, norm.reason || 'invalid_input_format');
    }
    const normRequest = norm.request || context.request;
    const redactedRequest = await this.redaction.redact(
      context.definition,
      normRequest,
      { isLocal: Boolean(decision.isLocal), organizationSlug: context.organizationSlug, agentSlug: context.agent.slug },
    );
    const prompt = this.promptBuilder.buildPromptPayload({
      definition: context.definition,
      request: redactedRequest,
      mode: 'converse',
    });

    try {
      this.lifecycle.progress(this.toLifecycleCtx(context), {
        step: 'prompt_prepared',
        message: 'Prompt prepared for converse',
        percent: 10,
      });
      this.lifecycle.progress(this.toLifecycleCtx(context), {
        step: 'dispatch_started',
        message: 'Dispatching LLM/API call',
        percent: 20,
      });
      this.lifecycle.start(this.toLifecycleCtx(context));
      const { response, streamId } = await this.generateLlmResponse(
        context,
        decision,
        prompt,
        AgentTaskMode.CONVERSE,
      );
      this.lifecycle.progress(this.toLifecycleCtx(context), {
        step: 'response_received',
        message: 'Response received',
        percent: 80,
      });
      this.lifecycle.complete(this.toLifecycleCtx(context), { message: response.content });
      if (this.isErrorResponse(response)) {
        return TaskResponseDto.failure(
          AgentTaskMode.CONVERSE,
          this.extractErrorMessage(response) || 'External service error',
        );
      }
      return TaskResponseDto.success(AgentTaskMode.CONVERSE, {
        content: {
          message: response.content,
        },
        metadata: {
          provider: response.metadata.provider,
          model: response.metadata.model,
          usage: response.metadata.usage,
          routingDecision: decision,
          metadata: this.mergeMetadata(prompt.metadata, streamId),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate converse response for agent ${context.agent.slug}: ${String(error)}`,
      );
      this.lifecycle.fail(
        this.toLifecycleCtx(context),
        error instanceof Error ? error.message : String(error),
      );
      return TaskResponseDto.failure(
        AgentTaskMode.CONVERSE,
        'Failed to generate response',
      );
    }
  }

  /**
   * Handle PLAN mode with action-based routing
   * Routes to PlansService.executeAction() based on action parameter
   */
  private async handlePlan(context: HydratedExecutionContext) {
    try {
      // Extract action from request (default to 'create')
      const action = (context.request.payload as any)?.action || 'create';
      const userId = this.resolveUserId(context.request);
      const conversationId = context.request.conversationId;

      if (!userId || !conversationId) {
        return TaskResponseDto.failure(
          AgentTaskMode.PLAN,
          'Missing required userId or conversationId',
        );
      }

      this.logger.debug(
        `Handling PLAN mode with action: ${action} for conversation ${conversationId}`,
      );

      // Route based on action
      if (action === 'create') {
        // For 'create' action, we need to generate plan content using LLM
        return this.handlePlanCreate(context, userId, conversationId);
      } else {
        // For other actions (read, list, edit, etc.), skip LLM and route directly to service
        return this.handlePlanAction(context, userId, conversationId, action);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle plan mode: ${error instanceof Error ? error.message : String(error)}`,
      );
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'Failed to handle plan operation',
      );
    }
  }

  /**
   * Handle plan 'create' action - requires LLM to generate plan content
   */
  private async handlePlanCreate(
    context: HydratedExecutionContext,
    userId: string,
    conversationId: string,
  ) {
    const decision = this.extractDecision(context.routingMetadata);
    if (!decision) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'Routing decision unavailable for plan creation',
      );
    }

    // Build prompt for plan generation
    const prompt = this.promptBuilder.buildPromptPayload({
      definition: context.definition,
      request: context.request,
      mode: 'plan',
    });

    try {
      this.lifecycle.start(this.toLifecycleCtx(context));
      this.lifecycle.progress(this.toLifecycleCtx(context), {
        step: 'generating_plan',
        message: 'Generating plan content',
        percent: 20,
      });

      // Generate plan content with LLM
      const { response } = await this.generateLlmResponse(
        context,
        decision,
        prompt,
        AgentTaskMode.PLAN,
      );

      this.lifecycle.progress(this.toLifecycleCtx(context), {
        step: 'saving_plan',
        message: 'Saving plan to database',
        percent: 80,
      });

      // Extract title and content from LLM response
      const planContent = response.content;
      const title =
        (context.request.payload as any)?.title ||
        `Plan from ${context.agent.slug}`;

      // Create/refine plan using PlansService
      const result = await this.plansService.executeAction(
        'create',
        {
          title,
          content: planContent,
          format: 'markdown',
          agentName: context.agent.slug,
          namespace: context.organizationSlug || 'default',
          taskId: (context.request as any).taskId,
          metadata: {
            llmProvider: response.metadata.provider,
            llmModel: response.metadata.model,
            usage: response.metadata.usage,
          },
        },
        {
          conversationId,
          userId,
          agentSlug: context.agent.slug,
          taskId: (context.request as any).taskId,
        },
      );

      this.lifecycle.complete(this.toLifecycleCtx(context), {
        planId: result.data?.plan?.id,
      });

      if (!result.success) {
        return TaskResponseDto.failure(
          AgentTaskMode.PLAN,
          result.error?.message || 'Failed to create plan',
        );
      }

      return TaskResponseDto.success(AgentTaskMode.PLAN, {
        content: {
          plan: result.data.plan,
          version: result.data.version,
          isNew: result.data.isNew,
        },
        metadata: {
          provider: response.metadata.provider,
          model: response.metadata.model,
          usage: response.metadata.usage,
          routingDecision: decision,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create plan: ${String(error)}`);
      this.lifecycle.fail(
        this.toLifecycleCtx(context),
        error instanceof Error ? error.message : String(error),
      );
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'Failed to create plan',
      );
    }
  }

  /**
   * Handle non-create plan actions - route directly to PlansService without LLM
   */
  private async handlePlanAction(
    context: HydratedExecutionContext,
    userId: string,
    conversationId: string,
    action: string,
  ) {
    this.logger.debug(`Executing plan action: ${action}`);

    // Extract params from request payload
    const params = (context.request.payload as any)?.params || {};

    // Route to PlansService.executeAction()
    const result = await this.plansService.executeAction(
      action,
      params,
      {
        conversationId,
        userId,
        agentSlug: context.agent.slug,
      },
    );

    if (!result.success) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        result.error?.message || `Failed to execute plan action: ${action}`,
      );
    }

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: result.data,
      metadata: {
        action,
        executedAt: new Date().toISOString(),
      },
    });
  }

  private resolveUserId(request: TaskRequestDto): string | null {
    const fromTop = request.metadata?.userId || request.metadata?.createdBy;
    const fromPayload =
      request.payload?.metadata?.userId ||
      request.payload?.metadata?.createdBy;
    return (fromTop as string) || (fromPayload as string) || null;
  }

  private async handleBuild(context: HydratedExecutionContext) {
    // Function agent short-circuit
    const agentType = context.definition.agentType;
    const fnConfig = (context.definition.config as any)?.configuration?.function || (context.definition.config as any)?.function;
    if (agentType === 'function' && fnConfig && typeof fnConfig.code === 'string') {
      return this.functionRunner.execute(context.definition, context.request, context.organizationSlug);
    }
    const decision = this.extractDecision(context.routingMetadata);
    if (!decision) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'Routing decision unavailable for build request',
      );
    }
    // Normalize content before dispatch
    const norm = this.normalization.normalize(context.definition, context.request, AgentTaskMode.BUILD);
    if (!norm.ok && norm.strict) {
      return TaskResponseDto.failure(AgentTaskMode.BUILD, norm.reason || 'invalid_input_format');
    }
    const normRequest = norm.request || context.request;
    const redactedRequest = await this.redaction.redact(
      context.definition,
      normRequest,
      { isLocal: Boolean(decision.isLocal), organizationSlug: context.organizationSlug, agentSlug: context.agent.slug },
    );
    const prompt = this.promptBuilder.buildPromptPayload({
      definition: context.definition,
      request: redactedRequest,
      mode: 'build',
    });

    try {
      this.lifecycle.progress(this.toLifecycleCtx(context), {
        step: 'prompt_prepared',
        message: 'Prompt prepared for build',
        percent: 10,
      });
      this.lifecycle.progress(this.toLifecycleCtx(context), {
        step: 'dispatch_started',
        message: 'Dispatching build LLM/API call',
        percent: 20,
      });
      this.lifecycle.start(this.toLifecycleCtx(context));
      const { response, streamId } = await this.generateLlmResponse(
        context,
        decision,
        prompt,
        AgentTaskMode.BUILD,
      );
      this.lifecycle.progress(this.toLifecycleCtx(context), {
        step: 'response_received',
        message: 'Build response received',
        percent: 80,
      });
      this.lifecycle.complete(this.toLifecycleCtx(context), { output: response.content });
      // Attempt auto-deliverable creation when possible
      const created = await this.deliverables.maybeCreateFromBuild(
        {
          organizationSlug: context.organizationSlug,
          agentSlug: context.agent.slug,
          mode: context.request.mode,
          conversationId: context.request.conversationId,
          content: response.content,
          title: context.definition.displayName ?? context.agent.slug,
          titleTemplate: this.resolveDeliverableTitleTemplate(context),
          deliverableType: this.resolveDeliverableType(context),
          deliverableFormat: this.resolveDeliverableFormat(context),
        },
        context.request,
      );
      if (this.isErrorResponse(response)) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          this.extractErrorMessage(response) || 'External service error',
        );
      }
      const successPayload: any = {
        content: {
          status: 'build_completed',
          output: response.content,
        },
        metadata: {
          provider: response.metadata.provider,
          model: response.metadata.model,
          usage: response.metadata.usage,
          routingDecision: decision,
          metadata: this.mergeMetadata(prompt.metadata, streamId),
        },
      };

      if (created?.kind === 'deliverable' && created.deliverable) {
        successPayload.deliverables = [created.deliverable];
        successPayload.metadata.deliverableId = created.deliverable.id;
      } else if (created?.kind === 'version' && created.version) {
        successPayload.metadata.deliverableId = created.deliverableId;
        successPayload.metadata.newVersionId = created.version.id;
        if (typeof created.version.version_number === 'number') {
          successPayload.metadata.versionNumber = created.version.version_number;
        }
      }

      return TaskResponseDto.success(AgentTaskMode.BUILD, successPayload);
    } catch (error) {
      this.logger.error(
        `Failed to generate build response for agent ${context.agent.slug}: ${String(error)}`,
      );
      this.lifecycle.fail(
        this.toLifecycleCtx(context),
        error instanceof Error ? error.message : String(error),
      );
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'Failed to execute build request',
      );
    }
  }

  private extractDecision(
    metadata: Record<string, any> | undefined,
  ): RoutingDecision | null {
    if (!metadata) {
      return null;
    }
    const candidate = metadata as RoutingDecision;
    if (!candidate.provider || !candidate.model) {
      return null;
    }
    return candidate;
  }

  private async generateLlmResponse(
    context: HydratedExecutionContext,
    decision: RoutingDecision,
    prompt: PromptPayload,
    mode: AgentTaskMode,
  ): Promise<{ response: AgentRuntimeDispatchResult['response']; streamId?: string }> {
    if (this.shouldStream(context.request)) {
      return this.generateStreamingResponse(context, decision, prompt, mode);
    }

    const maxComplexity = this.promptBuilder.mapComplexity(
      decision.complexityScore,
    );
    const { response } = await this.dispatcher.dispatch({
      definition: context.definition,
      routingDecision: decision,
      prompt,
      request: context.request,
      overrides: {
        options: {
          callerName:
            context.definition.displayName ?? context.agent.slug,
          maxComplexity,
        },
      },
    });

    return { response };
  }

  private async generateStreamingResponse(
    context: HydratedExecutionContext,
    decision: RoutingDecision,
    prompt: PromptPayload,
    mode: AgentTaskMode,
  ): Promise<{ response: AgentRuntimeDispatchResult['response']; streamId: string }> {
    this.lifecycle.progress(this.toLifecycleCtx(context), {
      step: 'stream_started',
      message: 'Streaming session started',
      percent: 30,
    });
    const providedStreamId =
      context.request.metadata?.streamId ||
      (context.request.payload as any)?.metadata?.streamId ||
      undefined;
    const streamSession = this.streamService.start({
      conversationId: context.request.conversationId,
      sessionId: context.request.sessionId,
      orchestrationRunId: context.request.orchestrationRunId,
      organizationSlug: context.organizationSlug,
      agentSlug: context.agent.slug,
      mode,
    }, providedStreamId);

    const maxComplexity = this.promptBuilder.mapComplexity(
      decision.complexityScore,
    );

    const streaming = this.dispatcher.dispatchStream({
      definition: context.definition,
      routingDecision: decision,
      prompt,
      request: context.request,
      overrides: {
        options: {
          callerName: context.definition.displayName ?? context.agent.slug,
          maxComplexity,
        },
      },
      onStreamChunk: (chunk) => {
        streamSession.publishChunk(chunk);
      },
    });

    try {
      const result = await streaming.response;
      streamSession.complete();
      this.lifecycle.progress(this.toLifecycleCtx(context), {
        step: 'stream_complete',
        message: 'Streaming session complete',
        percent: 90,
      });
      return { response: result.response, streamId: streamSession.streamId };
    } catch (error) {
      streamSession.error(error);
      throw error;
    }
  }

  private shouldStream(request: TaskRequestDto): boolean {
    const payloadStream = Boolean(request.payload?.options?.stream);
    const metadataStream = Boolean(request.metadata?.stream);
    return payloadStream || metadataStream;
  }

  private mergeMetadata(
    promptMetadata: Record<string, any> | undefined,
    streamId?: string,
  ): Record<string, any> | undefined {
    if (!streamId) {
      return promptMetadata;
    }
    return {
      ...(promptMetadata ?? {}),
      streamId,
    };
  }

  private isErrorResponse(response: AgentRuntimeDispatchResult['response']): boolean {
    try {
      const status = (response?.metadata as any)?.status;
      return status === 'error';
    } catch {
      return false;
    }
  }

  private extractErrorMessage(response: AgentRuntimeDispatchResult['response']): string | null {
    try {
      const meta = response?.metadata as any;
      if (typeof meta?.errorMessage === 'string' && meta.errorMessage.trim()) {
        return meta.errorMessage;
      }
      const providerStatus = meta?.providerSpecific?.status;
      if (providerStatus) {
        return `External service error (status ${providerStatus})`;
      }
    } catch {}
    return null;
  }

  private async hydrateContext(
    context: AgentExecutionContext,
  ): Promise<HydratedExecutionContext | null> {
    const existingAgent = context.agent;
    const agentSlug = context.agentSlug ?? existingAgent?.slug;
    const organizationSlug =
      context.organizationSlug ?? existingAgent?.organization_slug ?? null;

    if (!agentSlug) {
      this.logger.warn('Agent slug missing from execution context');
      return null;
    }

    let agentRecord: AgentRecord | null = existingAgent ?? null;
    if (!agentRecord) {
      agentRecord = await this.agentRegistry.getAgent(
        organizationSlug,
        agentSlug,
      );
    }

    if (!agentRecord) {
      this.logger.warn(
        `Agent ${agentSlug} not found for organization ${organizationSlug ?? 'global'}`,
      );
      return null;
    }

    const definition =
      context.definition ??
      this.runtimeDefinitions.buildDefinition(agentRecord);

    return {
      ...context,
      organizationSlug,
      agentSlug,
      agent: agentRecord,
      definition,
    };
  }

  private toLifecycleCtx(context: HydratedExecutionContext) {
    return {
      conversationId: context.request.conversationId,
      sessionId: context.request.sessionId,
      organizationSlug: context.organizationSlug,
      agentSlug: context.agent.slug,
      mode: context.request.mode,
    } as const;
  }

  private resolveDeliverableTitleTemplate(context: HydratedExecutionContext): string | null {
    const cfg = context.definition.config || {};
    // Support both snake_case and camelCase
    const fromDeliverables =
      (cfg as any)?.deliverables?.title_template ||
      (cfg as any)?.deliverables?.titleTemplate || null;
    return (fromDeliverables && String(fromDeliverables)) || null;
  }

  private resolveDeliverableType(context: HydratedExecutionContext): string | null {
    const cfg = context.definition.config || {};
    const from = (cfg as any)?.deliverables?.type || (cfg as any)?.deliverables?.deliverable_type || null;
    return from ? String(from) : null;
  }

  private resolveDeliverableFormat(context: HydratedExecutionContext): string | null {
    const cfg = context.definition.config || {};
    const from = (cfg as any)?.deliverables?.format || (cfg as any)?.deliverables?.deliverable_format || null;
    return from ? String(from) : null;
  }
}
