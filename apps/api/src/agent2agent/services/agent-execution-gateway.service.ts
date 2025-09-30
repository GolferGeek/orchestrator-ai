import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentOrchestrationsRepository } from '@agent-platform/repositories/agent-orchestrations.repository';
import { AgentOrchestrationRecord } from '@agent-platform/interfaces/agent-orchestration-record.interface';
import { AgentRecord } from '@agent-platform/interfaces/agent-record.interface';
import { ConversationPlanRecord } from '@agent-platform/interfaces/conversation-plan-record.interface';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentModeRouterService } from './agent-mode-router.service';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { PlanEngineService } from '@agent-platform/services/plan-engine.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';

@Injectable()
export class AgentExecutionGateway {
  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly runtimeDefinitions: AgentRuntimeDefinitionService,
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
    const agent = await this.agentRegistry.getAgent(
      organizationSlug,
      agentSlug,
    );

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const definition = this.runtimeDefinitions.buildDefinition(agent);

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
          organizationSlug,
          agentSlug: agent.slug,
          agent,
          definition,
          request,
          routingMetadata: assessment.metadata,
        });
      case AgentTaskMode.PLAN:
        return this.handlePlan(organizationSlug, agent, definition, request);
      case AgentTaskMode.BUILD:
        return this.handleBuild(
          organizationSlug,
          agent,
          definition,
          request,
          assessment.metadata,
        );
      case AgentTaskMode.ORCHESTRATE_CREATE:
        return this.handleOrchestrateCreate(
          organizationSlug,
          agent,
          definition,
          request,
        );
      case AgentTaskMode.ORCHESTRATE_EXECUTE:
        return this.handleOrchestrateExecute(organizationSlug, agent, request);
      case AgentTaskMode.ORCHESTRATE_CONTINUE:
        return this.handleOrchestrateContinue(organizationSlug, request);
      case AgentTaskMode.ORCHESTRATE_SAVE_RECIPE:
        return this.handleOrchestrateSaveRecipe(
          organizationSlug,
          agent,
          request,
        );
      case AgentTaskMode.HUMAN_RESPONSE:
        return TaskResponseDto.human('Manual confirmation required');
      default:
        return TaskResponseDto.failure(request.mode, 'Unsupported mode');
    }
  }

  private async handlePlan(
    organizationSlug: string | null,
    agent: AgentRecord,
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const conversationId = request.conversationId;
    if (!conversationId) {
      throw new BadRequestException(
        'conversationId is required for plan generation',
      );
    }

    const draftPlan = request.payload?.planDraft ?? {
      summary: request.userMessage ?? 'Plan draft not provided',
    };

    const metadata = this.collectMetadata(request);

    const planRecord = await this.planEngine.generateDraft({
      conversationId,
      organizationSlug,
      agentSlug: agent.slug,
      summary: request.payload?.summary ?? null,
      draftPlan,
      createdBy: metadata.createdBy ?? null,
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: planRecord,
      metadata: {
        agentId: definition.id,
        agentSlug: definition.slug,
        organizationSlug,
      },
    });
  }

  private async handleBuild(
    organizationSlug: string | null,
    agent: AgentRecord,
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    routingMetadata?: Record<string, any>,
  ): Promise<TaskResponseDto> {
    const orchestrationResponse = await this.startOrchestrationFromRequest(
      organizationSlug,
      agent,
      request,
      AgentTaskMode.BUILD,
      { requireTarget: false },
    );

    if (orchestrationResponse) {
      return orchestrationResponse;
    }

    return this.modeRouter.execute({
      organizationSlug,
      agentSlug: agent.slug,
      agent,
      definition,
      request,
      routingMetadata,
    });
  }

  private async handleOrchestrateCreate(
    organizationSlug: string | null,
    agent: AgentRecord,
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const conversationId = request.conversationId;
    if (!conversationId) {
      throw new BadRequestException(
        'conversationId is required for orchestration creation',
      );
    }

    const draftPlan = request.payload?.planDraft ?? {
      summary: request.userMessage ?? 'Orchestration draft not provided',
    };

    const metadata = this.collectMetadata(request);

    const planRecord = await this.planEngine.generateDraft({
      conversationId,
      organizationSlug,
      agentSlug: agent.slug,
      summary: request.payload?.summary ?? null,
      draftPlan,
      createdBy: metadata.createdBy ?? null,
    });

    return TaskResponseDto.success(AgentTaskMode.ORCHESTRATE_CREATE, {
      content: planRecord,
      metadata: {
        mode: 'create',
        agentId: definition.id,
        agentSlug: definition.slug,
        organizationSlug,
      },
    });
  }

  private async handleOrchestrateExecute(
    organizationSlug: string | null,
    agent: AgentRecord,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const orchestrationResponse = await this.startOrchestrationFromRequest(
      organizationSlug,
      agent,
      request,
      AgentTaskMode.ORCHESTRATE_EXECUTE,
      { requireTarget: true },
    );

    if (!orchestrationResponse) {
      throw new BadRequestException(
        'planId or orchestrationSlug required for orchestration execution',
      );
    }

    return orchestrationResponse;
  }

  private async handleOrchestrateContinue(
    organizationSlug: string | null,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const runId = request.orchestrationRunId ?? request.payload?.runId ?? null;

    if (!runId) {
      throw new BadRequestException(
        'orchestrationRunId is required to continue an orchestration run',
      );
    }

    const patch = request.payload?.update ?? {};
    const run = await this.orchestrationRunner.updateRun({
      runId,
      status: patch.status,
      currentStepIndex: patch.currentStepIndex,
      completedSteps: patch.completedSteps,
      stepState: patch.stepState,
      humanCheckpointId: patch.humanCheckpointId,
      metadata: patch.metadata,
      completedAt: patch.completedAt,
    });

    return TaskResponseDto.success(AgentTaskMode.ORCHESTRATE_CONTINUE, {
      content: run,
      metadata: {
        runId,
        organizationSlug,
      },
    });
  }

  private async handleOrchestrateSaveRecipe(
    organizationSlug: string | null,
    agent: AgentRecord,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const orchestrationPayload = request.payload?.orchestration;
    const metadata = this.collectMetadata(request);

    if (!orchestrationPayload) {
      throw new BadRequestException(
        'orchestration payload required to save as recipe',
      );
    }

    const saved = await this.agentOrchestrations.upsert({
      organization_slug: organizationSlug,
      agent_slug: agent.slug,
      slug: orchestrationPayload.slug,
      display_name:
        orchestrationPayload.displayName ?? orchestrationPayload.slug,
      description: orchestrationPayload.description ?? null,
      status: orchestrationPayload.status,
      orchestration_json:
        orchestrationPayload.orchestrationJson ??
        orchestrationPayload.definition ??
        {},
      prompt_templates: orchestrationPayload.promptTemplates ?? [],
      tags: orchestrationPayload.tags ?? [],
      version: orchestrationPayload.version ?? null,
      created_by: orchestrationPayload.createdBy ?? metadata.createdBy ?? null,
      updated_by:
        orchestrationPayload.updatedBy ??
        metadata.updatedBy ??
        metadata.createdBy ??
        null,
    });

    return TaskResponseDto.success(AgentTaskMode.ORCHESTRATE_SAVE_RECIPE, {
      content: saved,
    });
  }

  private async startOrchestrationFromRequest(
    organizationSlug: string | null,
    agent: AgentRecord,
    request: TaskRequestDto,
    responseMode: AgentTaskMode,
    options: { requireTarget: boolean },
  ): Promise<TaskResponseDto | null> {
    const agentSlug = agent.slug;
    const orchestrationSlug =
      request.orchestrationSlug ?? request.payload?.orchestrationSlug ?? null;
    const promptInputs =
      request.promptParameters ?? request.payload?.promptParameters ?? {};
    const metadata = this.collectMetadata(request);

    if (request.planId) {
      const plan = await this.resolvePlanForExecution(
        organizationSlug,
        agent,
        request,
      );
      const runMetadata = {
        ...metadata,
        conversationId: plan.conversation_id,
        planVersion: plan.version,
      };
      const run = await this.orchestrationRunner.startRun({
        planId: plan.id,
        originType: 'plan',
        originId: plan.id,
        organizationSlug: plan.organization_slug ?? null,
        promptInputs,
        metadata: runMetadata,
      });

      return TaskResponseDto.success(responseMode, {
        content: run,
        metadata: {
          originType: 'plan',
          planId: plan.id,
          planVersion: plan.version,
          conversationId: plan.conversation_id,
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

      return TaskResponseDto.success(responseMode, {
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

    if (options.requireTarget) {
      return null;
    }

    return null;
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

  private async resolvePlanForExecution(
    organizationSlug: string | null,
    agent: AgentRecord,
    request: TaskRequestDto,
  ): Promise<ConversationPlanRecord> {
    const planId = request.planId;
    if (!planId) {
      throw new BadRequestException('planId is required for plan execution');
    }

    const plan = await this.planEngine.getPlan(planId);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const normalizedOrg = organizationSlug ?? null;
    if ((plan.organization_slug ?? null) !== normalizedOrg) {
      throw new BadRequestException('Plan belongs to a different organization');
    }

    if (plan.agent_slug !== agent.slug) {
      throw new BadRequestException('Plan is not associated with this agent');
    }

    if (plan.conversation_id !== request.conversationId) {
      throw new BadRequestException('Plan is tied to a different conversation');
    }

    return plan;
  }

  private collectMetadata(request: TaskRequestDto): Record<string, any> {
    return {
      ...(request.payload?.metadata ?? {}),
      ...(request.metadata ?? {}),
    };
  }
}
