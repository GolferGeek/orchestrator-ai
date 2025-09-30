import { Injectable, Logger } from '@nestjs/common';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { LLMServiceFactory } from '@llm/services/llm-service-factory';
import {
  LLMServiceConfig,
  GenerateResponseParams,
} from '@llm/services/llm-interfaces';
import { RoutingDecision } from '@llm/centralized-routing.service';
import { AgentRecord } from '@agent-platform/interfaces/agent-record.interface';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';

export interface AgentExecutionContext {
  organizationSlug?: string | null;
  agentSlug?: string;
  agent?: AgentRecord;
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
    private readonly llmFactory: LLMServiceFactory,
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

    const metadata = this.collectMetadata(context);

    try {
      const response = await this.generateLlmResponse(context, decision);
      return TaskResponseDto.success(AgentTaskMode.CONVERSE, {
        content: {
          message: response.content,
        },
        metadata: {
          provider: response.metadata.provider,
          model: response.metadata.model,
          usage: response.metadata.usage,
          routingDecision: decision,
          metadata,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate converse response for agent ${context.agent.slug}: ${String(error)}`,
      );
      return TaskResponseDto.failure(
        AgentTaskMode.CONVERSE,
        'Failed to generate response',
      );
    }
  }

  private async handlePlan(context: HydratedExecutionContext) {
    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        planDraft: {
          summary: 'Plan generation placeholder',
          agent: context.agent.slug,
        },
      },
    });
  }

  private async handleBuild(context: HydratedExecutionContext) {
    const decision = this.extractDecision(context.routingMetadata);
    if (!decision) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'Routing decision unavailable for build request',
      );
    }

    const metadata = this.collectMetadata(context);

    try {
      const response = await this.generateLlmResponse(context, decision, {
        mode: 'build',
      });
      return TaskResponseDto.success(AgentTaskMode.BUILD, {
        content: {
          status: 'build_completed',
          output: response.content,
        },
        metadata: {
          provider: response.metadata.provider,
          model: response.metadata.model,
          usage: response.metadata.usage,
          routingDecision: decision,
          metadata,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate build response for agent ${context.agent.slug}: ${String(error)}`,
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
    options: { mode?: 'build' | 'converse' } = { mode: 'converse' },
  ) {
    const config = this.buildLlmConfig(decision, context.definition);
    const params = this.buildGenerateParams(context, decision, config, options);
    return this.llmFactory.generateResponse(config, params);
  }

  private buildLlmConfig(
    decision: RoutingDecision,
    definition: AgentRuntimeDefinition,
  ): LLMServiceConfig {
    return {
      provider: decision.provider ?? definition.llm?.provider ?? 'openai',
      model: decision.model ?? definition.llm?.model ?? 'gpt-4o-mini',
      temperature:
        (decision as any).temperature ??
        definition.llm?.temperature ??
        undefined,
    };
  }

  private buildGenerateParams(
    context: HydratedExecutionContext,
    decision: RoutingDecision,
    config: LLMServiceConfig,
    opts: { mode?: 'build' | 'converse' },
  ): GenerateResponseParams {
    const systemPrompt = this.resolveSystemPrompt(
      context.definition,
      opts.mode,
    );
    const userMessage = this.composeUserMessage(context, opts.mode);
    const payload = context.request.payload ?? {};
    const metadata = this.collectMetadata(context);
    const optionMetadata = {
      ...(payload.options?.metadata ?? {}),
      ...metadata,
    };

    return {
      systemPrompt,
      userMessage,
      config,
      conversationId: context.request.conversationId,
      sessionId: context.request.sessionId,
      userId: metadata.userId ?? payload.userId ?? null,
      options: {
        callerType: 'agent',
        callerName: context.definition.displayName ?? context.agent.slug,
        temperature: config.temperature,
        piiMetadata: decision.piiMetadata,
        routingDecision: decision,
        preferLocal: decision.isLocal,
        maxComplexity: this.mapComplexity(decision.complexityScore),
        ...(payload.options ?? {}),
        metadata: optionMetadata,
      },
    };
  }

  private resolveSystemPrompt(
    definition: AgentRuntimeDefinition,
    mode: 'build' | 'converse' = 'converse',
  ): string {
    const promptCandidate =
      definition.prompts.system ??
      definition.context?.system_prompt ??
      definition.context?.systemPrompt ??
      definition.config?.system_prompt ??
      definition.config?.systemPrompt ??
      definition.description;

    if (typeof promptCandidate === 'string' && promptCandidate.trim()) {
      return promptCandidate;
    }

    return mode === 'build'
      ? `You are ${definition.displayName}. Fulfill build requests by producing actionable output and deliverables.`
      : `You are ${definition.displayName}. Respond helpfully to the user while respecting organizational policies.`;
  }

  private composeUserMessage(
    context: HydratedExecutionContext,
    mode: 'build' | 'converse' = 'converse',
  ): string {
    const { request, definition } = context;
    const payload = request.payload ?? {};

    const pieces: string[] = [];

    if (
      definition.config?.prompt_prefix &&
      typeof definition.config.prompt_prefix === 'string'
    ) {
      pieces.push(definition.config.prompt_prefix);
    }

    if (Array.isArray(request.messages) && request.messages.length) {
      const recent = request.messages.slice(-6);
      const conversation = recent
        .map((msg) => {
          const content = this.stringify(msg.content ?? '');
          return `[${msg.role}] ${content}`;
        })
        .join('\n');
      pieces.push(`Recent conversation history:\n${conversation}`);
    }

    if (typeof request.userMessage === 'string' && request.userMessage.trim()) {
      pieces.push(request.userMessage.trim());
    }

    if (typeof payload.prompt === 'string' && payload.prompt.trim()) {
      pieces.push(payload.prompt.trim());
    }

    if (payload.instructions && mode === 'build') {
      pieces.push(`Instructions: ${this.stringify(payload.instructions)}`);
    }

    if (Array.isArray(payload.requirements)) {
      pieces.push(`Requirements: ${this.stringify(payload.requirements)}`);
    }

    if (!pieces.length) {
      return mode === 'build'
        ? 'Generate the requested build deliverable.'
        : 'Respond to the user in a helpful manner.';
    }

    return pieces.join('\n\n');
  }

  private mapComplexity(score: number | undefined) {
    if (score === undefined || score === null) {
      return undefined;
    }
    if (score < 0.3) return 'simple';
    if (score < 0.7) return 'medium';
    return 'complex';
  }

  private stringify(value: unknown): string {
    try {
      return JSON.stringify(value).slice(0, 4000);
    } catch {
      return String(value);
    }
  }

  private collectMetadata(
    context: HydratedExecutionContext,
  ): Record<string, any> {
    const baseMetadata = {
      agentId: context.definition.id,
      agentSlug: context.definition.slug,
      agentType: context.definition.agentType,
      modeProfile: context.definition.modeProfile,
      organizationSlug: context.definition.organizationSlug,
    };

    return {
      ...baseMetadata,
      ...(context.request.payload?.metadata ?? {}),
      ...(context.request.metadata ?? {}),
    };
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

    const definition = this.runtimeDefinitions.buildDefinition(agentRecord);

    return {
      ...context,
      organizationSlug,
      agentSlug,
      agent: agentRecord,
      definition,
    };
  }
}
