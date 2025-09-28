import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AgentsRepository } from '@agent-platform/repositories/agents.repository';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentModeRouterService } from './agent-mode-router.service';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { PlanEngineService } from '@agent-platform/services/plan-engine.service';
import { ProjectRunnerService } from '@agent-platform/services/project-runner.service';

@Injectable()
export class AgentExecutionGateway {
  constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly routingPolicy: RoutingPolicyAdapterService,
    private readonly modeRouter: AgentModeRouterService,
    private readonly planEngine: PlanEngineService,
    private readonly projectRunner: ProjectRunnerService,
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

    switch (request.mode) {
      case AgentTaskMode.CONVERSE:
        return this.modeRouter.execute({
          agent,
          request,
          routingMetadata: assessment.metadata,
        });
      case AgentTaskMode.PLAN:
        return this.handlePlan(organizationSlug, agent, request);
      case AgentTaskMode.BUILD:
        return this.handleBuild(organizationSlug, request);
      case AgentTaskMode.HUMAN_RESPONSE:
        return TaskResponseDto.human('Manual confirmation required');
      default:
        return TaskResponseDto.failure(request.mode, 'Unsupported mode');
    }
  }

  private async handlePlan(
    organizationSlug: string | null,
    agent: any,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const conversationId = request.conversationId;
    if (!conversationId) {
      throw new BadRequestException('conversationId is required for plan generation');
    }

    const draftPlan = request.payload?.planDraft ?? {
      summary: request.userMessage ?? 'Plan draft not provided',
    };

    const planRecord = await this.planEngine.generateDraft({
      conversationId,
      organizationSlug,
      agentSlug: agent.slug,
      summary: request.payload?.summary ?? null,
      draftPlan,
      createdBy: request.payload?.createdBy ?? null,
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: planRecord,
    });
  }

  private async handleBuild(
    organizationSlug: string | null,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    if (!request.planId) {
      throw new BadRequestException('planId is required to start build mode');
    }

    const run = await this.projectRunner.startRun({
      planId: request.planId,
      organizationSlug,
      metadata: request.payload?.metadata ?? {},
    });

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: run,
    });
  }
}
