import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AgentsRepository } from '@agent-platform/repositories/agents.repository';
import { AgentOrchestrationsRepository } from '@agent-platform/repositories/agent-orchestrations.repository';
import { AgentOrchestrationRecord } from '@agent-platform/interfaces/agent-orchestration-record.interface';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentModeRouterService } from './agent-mode-router.service';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { PlanEngineService } from '@agent-platform/services/plan-engine.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';

@Injectable()
export class AgentExecutionGateway {
  constructor(
    private readonly agentsRepository: AgentsRepository,
    private readonly routingPolicy: RoutingPolicyAdapterService,
    private readonly modeRouter: AgentModeRouterService,
    private readonly planEngine: PlanEngineService,
    private readonly orchestrationRunner: OrchestrationRunnerService,
    private readonly agentOrchestrations: AgentOrchestrationsRepository,
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
        return this.handleBuild(organizationSlug, agent.slug, request);
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
    agentSlug: string,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const orchestrationSlug =
      request.orchestrationSlug ?? request.payload?.orchestrationSlug ?? null;
    const promptInputs =
      request.promptParameters ?? request.payload?.promptParameters ?? {};
    const metadata = request.payload?.metadata ?? {};

    if (request.planId) {
      const run = await this.orchestrationRunner.startRun({
        planId: request.planId,
        originType: 'plan',
        originId: request.planId,
        organizationSlug,
        promptInputs,
        metadata,
      });

      return TaskResponseDto.success(AgentTaskMode.BUILD, {
        content: run,
        metadata: {
          originType: 'plan',
          planId: request.planId,
          promptInputs,
        },
      });
    }

    if (orchestrationSlug) {
      const orchestration = await this.agentOrchestrations.findBySlug(
        organizationSlug,
        agentSlug,
        orchestrationSlug,
      );

      if (!orchestration) {
        throw new NotFoundException('Saved orchestration not found');
      }

      const resolvedInputs = this.validatePromptInputs(
        orchestration,
        promptInputs,
      );

      const run = await this.orchestrationRunner.startRun({
        organizationSlug,
        originType: 'saved_orchestration',
        originId: orchestration.id,
        orchestrationSlug: orchestration.slug,
        promptInputs: resolvedInputs,
        metadata: {
          ...metadata,
          orchestrationId: orchestration.id,
        },
      });

      return TaskResponseDto.success(AgentTaskMode.BUILD, {
        content: run,
        metadata: {
          originType: 'saved_orchestration',
          orchestration: {
            id: orchestration.id,
            slug: orchestration.slug,
          },
          promptInputs: resolvedInputs,
        },
      });
    }

    const run = await this.orchestrationRunner.startRun({
      organizationSlug,
      originType: 'ad_hoc',
      promptInputs,
      metadata,
    });

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: run,
      metadata: {
        originType: 'ad_hoc',
        promptInputs,
      },
    });
  }

  private validatePromptInputs(
    orchestration: AgentOrchestrationRecord,
    provided: Record<string, any> | undefined,
  ): Record<string, any> {
    const templates = orchestration.prompt_templates ?? [];
    if (!templates.length) {
      return provided ?? {};
    }

    const result: Record<string, any> = {};
    for (const template of templates) {
      const supplied = (provided ?? {})[template.name] ?? {};
      const params = template.parameters ?? [];
      const resolved: Record<string, any> = { ...supplied };

      for (const param of params) {
        const value = supplied[param.key];
        if (value === undefined || value === null) {
          if (param.defaultValue !== undefined) {
            resolved[param.key] = param.defaultValue;
          } else if (param.required !== false) {
            throw new BadRequestException(
              `Missing prompt parameter ${param.key} for template ${template.name}`,
            );
          }
        }
      }

      result[template.name] = resolved;
    }

    return result;
  }
}
