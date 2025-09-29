import { Injectable, Logger } from '@nestjs/common';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { LLMServiceFactory } from '@llm/services/llm-service-factory';
import { LLMServiceConfig, GenerateResponseParams } from '@llm/services/llm-interfaces';
import { RoutingDecision } from '@llm/centralized-routing.service';
import { AgentRecord } from '@agent-platform/interfaces/agent-record.interface';

export interface AgentExecutionContext {
  agent: AgentRecord;
  request: TaskRequestDto;
  routingMetadata?: Record<string, any>;
}

@Injectable()
export class AgentModeRouterService {
  private readonly logger = new Logger(AgentModeRouterService.name);

  constructor(private readonly llmFactory: LLMServiceFactory) {}

  async execute(context: AgentExecutionContext): Promise<TaskResponseDto> {
    switch (context.request.mode) {
      case AgentTaskMode.CONVERSE:
        return this.handleConverse(context);
      case AgentTaskMode.PLAN:
        return this.handlePlan(context);
      case AgentTaskMode.BUILD:
        return this.handleBuild(context);
      case AgentTaskMode.HUMAN_RESPONSE:
        return TaskResponseDto.human('Manual confirmation required');
      default:
        return TaskResponseDto.failure(
          context.request.mode,
          'Unsupported mode',
        );
    }
  }

  private async handleConverse(context: AgentExecutionContext) {
    const decision = this.extractDecision(context.routingMetadata);
    if (!decision) {
      return TaskResponseDto.failure(
        AgentTaskMode.CONVERSE,
        'Routing decision unavailable for conversation request',
      );
    }

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

  private async handlePlan(context: AgentExecutionContext) {
    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: {
        planDraft: {
          summary: 'Plan generation placeholder',
          agent: context.agent.slug,
        },
      },
    });
  }

  private async handleBuild(context: AgentExecutionContext) {
    const decision = this.extractDecision(context.routingMetadata);
    if (!decision) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'Routing decision unavailable for build request',
      );
    }

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
    context: AgentExecutionContext,
    decision: RoutingDecision,
    options: { mode?: 'build' | 'converse' } = { mode: 'converse' },
  ) {
    const config = this.buildLlmConfig(decision);
    const params = this.buildGenerateParams(context, decision, config, options);
    return this.llmFactory.generateResponse(config, params);
  }

  private buildLlmConfig(decision: RoutingDecision): LLMServiceConfig {
    return {
      provider: decision.provider ?? 'openai',
      model: decision.model ?? 'gpt-4o-mini',
      temperature: (decision as any).temperature,
    };
  }

  private buildGenerateParams(
    context: AgentExecutionContext,
    decision: RoutingDecision,
    config: LLMServiceConfig,
    opts: { mode?: 'build' | 'converse' },
  ): GenerateResponseParams {
    const systemPrompt = this.resolveSystemPrompt(context.agent, opts.mode);
    const userMessage = this.composeUserMessage(context, opts.mode);
    const payload = context.request.payload ?? {};
    const metadata = payload.metadata ?? {};

    return {
      systemPrompt,
      userMessage,
      config,
      conversationId: context.request.conversationId,
      userId: metadata.userId ?? payload.userId ?? null,
      options: {
        callerType: 'agent',
        callerName: context.agent.slug,
        temperature: config.temperature,
        piiMetadata: decision.piiMetadata,
        routingDecision: decision,
        preferLocal: decision.isLocal,
        maxComplexity: this.mapComplexity(decision.complexityScore),
        ...(payload.options ?? {}),
      },
    };
  }

  private resolveSystemPrompt(
    agent: AgentRecord,
    mode: 'build' | 'converse' = 'converse',
  ): string {
    const context = agent.context ?? {};
    const config = agent.config ?? {};
    const promptCandidate =
      context.system_prompt ??
      context.systemPrompt ??
      config.system_prompt ??
      config.systemPrompt ??
      agent.description;

    if (typeof promptCandidate === 'string' && promptCandidate.trim()) {
      return promptCandidate;
    }

    return mode === 'build'
      ? `You are ${agent.display_name}. Fulfill build requests by producing actionable output and deliverables.`
      : `You are ${agent.display_name}. Respond helpfully to the user while respecting organizational policies.`;
  }

  private composeUserMessage(
    context: AgentExecutionContext,
    mode: 'build' | 'converse' = 'converse',
  ): string {
    const { request } = context;
    const payload = request.payload ?? {};

    const pieces: string[] = [];

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
}
