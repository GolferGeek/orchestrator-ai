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
    const prompt = this.promptBuilder.buildPromptPayload({
      definition: context.definition,
      request: context.request,
      mode: 'converse',
    });

    try {
      const response = await this.generateLlmResponse(
        context,
        decision,
        prompt,
      );
      return TaskResponseDto.success(AgentTaskMode.CONVERSE, {
        content: {
          message: response.content,
        },
        metadata: {
          provider: response.metadata.provider,
          model: response.metadata.model,
          usage: response.metadata.usage,
          routingDecision: decision,
          metadata: prompt.metadata,
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
    const prompt = this.promptBuilder.buildPromptPayload({
      definition: context.definition,
      request: context.request,
      mode: 'build',
    });

    try {
      const response = await this.generateLlmResponse(
        context,
        decision,
        prompt,
      );
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
          metadata: prompt.metadata,
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
    prompt: PromptPayload,
  ) {
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

    return response;
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
}
