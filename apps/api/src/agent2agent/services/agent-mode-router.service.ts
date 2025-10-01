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
import { AgentRuntimeDeliverablesAdapter } from '@agent-platform/services/agent-runtime-deliverables.adapter';

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
        // Plan creation is handled at the gateway layer to maintain single source of truth
        return TaskResponseDto.failure(
          AgentTaskMode.PLAN,
          'Plan mode is handled by the gateway',
        );
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
    const prompt = this.promptBuilder.buildPromptPayload({
      definition: context.definition,
      request: context.request,
      mode: 'converse',
    });

    try {
      this.lifecycle.start(this.toLifecycleCtx(context));
      const { response, streamId } = await this.generateLlmResponse(
        context,
        decision,
        prompt,
        AgentTaskMode.CONVERSE,
      );
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

  // Plan mode intentionally not implemented here – handled by AgentExecutionGateway

  private async handleBuild(context: HydratedExecutionContext) {
    const decision = this.extractDecision(context.routingMetadata);
    if (!decision) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'Routing decision unavailable for build request',
      );
    }
    const prompt = this.promptBuilder.buildPromptPayload({
      definition: context.definition,
      request: context.request,
      mode: 'build',
    });

    try {
      this.lifecycle.start(this.toLifecycleCtx(context));
      const { response, streamId } = await this.generateLlmResponse(
        context,
        decision,
        prompt,
        AgentTaskMode.BUILD,
      );
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
        },
        context.request,
      );
      if (this.isErrorResponse(response)) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          this.extractErrorMessage(response) || 'External service error',
        );
      }
      return TaskResponseDto.success(AgentTaskMode.BUILD, {
        content: {
          status: 'build_completed',
          output: response.content,
        },
        ...(created && { deliverables: [created] }),
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
    const streamSession = this.streamService.start({
      conversationId: context.request.conversationId,
      sessionId: context.request.sessionId,
      orchestrationRunId: context.request.orchestrationRunId,
      organizationSlug: context.organizationSlug,
      agentSlug: context.agent.slug,
      mode,
    });

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
}
