import { Injectable, Logger } from '@nestjs/common';
import { TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentRecord } from '@agent-platform/interfaces/agent.interface';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { AgentRunnerRegistryService } from './agent-runner-registry.service';

export interface AgentExecutionContext {
  organizationSlug?: string | null;
  agentSlug?: string;
  agent?: AgentRecord;
  definition?: AgentRuntimeDefinition;
  request: TaskRequestDto;
  routingMetadata?: Record<string, unknown>;
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
    private readonly runnerRegistry: AgentRunnerRegistryService,
  ) {}

  async execute(context: AgentExecutionContext): Promise<TaskResponseDto> {
    const hydrated = await this.hydrateContext(context);

    if (!hydrated) {
      return TaskResponseDto.failure(
        context.request.mode!,
        'Agent record unavailable for execution',
      );
    }

    // Route to the appropriate runner based on agent type
    const agentType = hydrated.definition.agentType;
    const runner = this.runnerRegistry.getRunner(agentType);

    if (!runner) {
      this.logger.error(
        `No runner registered for agent type ${agentType}. Agent: ${hydrated.agentSlug}`,
      );
      return TaskResponseDto.failure(
        hydrated.request.mode!,
        `No runner available for agent type: ${agentType}`,
      );
    }

    this.logger.log(
      `Routing ${hydrated.request.mode} request to ${agentType} runner for agent ${hydrated.agentSlug}`,
    );
    return await runner.execute(
      hydrated.definition,
      hydrated.request,
      hydrated.organizationSlug,
    );
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
