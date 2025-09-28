import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentsRepository } from '@agent-platform/repositories/agents.repository';
import { TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentModeRouterService } from './agent-mode-router.service';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';

@Injectable()
export class AgentExecutionGateway {
  constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly routingPolicy: RoutingPolicyAdapterService,
    private readonly modeRouter: AgentModeRouterService,
  ) {}

  async execute(
    organizationSlug: string | null,
    agentSlug: string,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const agent = await this.agentsRepository.findBySlug(organizationSlug, agentSlug);

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const assessment = await this.routingPolicy.evaluate(request, agent);

    if (assessment.showstopper) {
      return TaskResponseDto.human(
        assessment.humanMessage ?? 'Routing policy requires human review.',
        'routing_showstopper',
      );
    }

    return this.modeRouter.execute({
      agent,
      request,
      routingMetadata: assessment.metadata,
    });
  }
}
