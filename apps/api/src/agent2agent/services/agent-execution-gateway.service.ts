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
import { AgentRuntimeExecutionService } from '@agent-platform/services/agent-runtime-execution.service';
import { AgentRuntimeAgentMetadata } from '@agent-platform/interfaces/agent-runtime-agent-metadata.interface';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { AgentRuntimeStreamService } from '@agent-platform/services/agent-runtime-stream.service';
import { HumanApprovalsRepository } from '@agent-platform/repositories/human-approvals.repository';

@Injectable()
export class AgentExecutionGateway {
  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly runtimeDefinitions: AgentRuntimeDefinitionService,
    private readonly runtimeExecution: AgentRuntimeExecutionService,
    private readonly routingPolicy: RoutingPolicyAdapterService,
    private readonly modeRouter: AgentModeRouterService,
    private readonly planEngine: PlanEngineService,
    private readonly orchestrationRunner: OrchestrationRunnerService,
    private readonly agentOrchestrations: AgentOrchestrationsRepository,
    private readonly streamService: AgentRuntimeStreamService,
    private readonly approvals: HumanApprovalsRepository,
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
    const agentMetadata = this.runtimeExecution.getAgentMetadataFromDefinition(
      definition,
      organizationSlug,
    );

    const assessment = await this.routingPolicy.evaluate(request, agent);

    if (assessment.showstopper) {
      return TaskResponseDto.human(
        assessment.humanMessage ?? 'Routing policy requires human review.',
        'routing_showstopper',
      );
    }

    // Enforce execution capabilities + human gate before routing
    const unsupported = this.checkUnsupportedMode(definition, request.mode!);
    if (unsupported) {
      return unsupported;
    }

    const gated = await this.checkHumanGate(
      definition,
      request.mode!,
      {
        organizationSlug,
        agentSlug: agent.slug,
        conversationId: request.conversationId ?? null,
        taskId: undefined,
        request,
      },
    );
    if (gated) {
      return gated;
    }

    switch (request.mode!) {
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
        // Delegate to mode router (uses new plans table via PlansService)
        return this.modeRouter.execute({
          organizationSlug,
          agentSlug: agent.slug,
          agent,
          definition,
          request,
          routingMetadata: assessment.metadata,
        });
      case AgentTaskMode.BUILD:
        // Delegate to mode router (uses new deliverables table via DeliverablesService)
        return this.modeRouter.execute({
          organizationSlug,
          agentSlug: agent.slug,
          agent,
          definition,
          request,
          routingMetadata: assessment.metadata,
        });
      case AgentTaskMode.ORCHESTRATE_CREATE:
        return this.handleOrchestrateCreate(
          organizationSlug,
          agent,
          definition,
          agentMetadata,
          request,
        );
      case AgentTaskMode.ORCHESTRATE_EXECUTE:
        return this.handleOrchestrateExecute(
          organizationSlug,
          agent,
          definition,
          agentMetadata,
          request,
        );
      case AgentTaskMode.ORCHESTRATE_CONTINUE:
        return this.handleOrchestrateContinue(organizationSlug, request);
      case AgentTaskMode.ORCHESTRATE_SAVE_RECIPE:
        return this.handleOrchestrateSaveRecipe(
          organizationSlug,
          agent,
          request,
        );
      case AgentTaskMode.ORCHESTRATOR_PLAN_CREATE:
        return this.handleOrchestrateCreate(
          organizationSlug,
          agent,
          definition,
          agentMetadata,
          request,
        );
      case AgentTaskMode.ORCHESTRATOR_PLAN_UPDATE:
        return this.handleOrchestrateCreate(
          organizationSlug,
          agent,
          definition,
          agentMetadata,
          request,
        );
      case AgentTaskMode.ORCHESTRATOR_RUN_START:
        return this.handleOrchestrateExecute(
          organizationSlug,
          agent,
          definition,
          agentMetadata,
          request,
        );
      case AgentTaskMode.ORCHESTRATOR_RUN_CONTINUE:
        return this.handleOrchestrateContinue(organizationSlug, request);
      case AgentTaskMode.ORCHESTRATOR_RECIPE_SAVE:
        return this.handleOrchestrateSaveRecipe(
          organizationSlug,
          agent,
          request,
        );
      case AgentTaskMode.ORCHESTRATOR_RECIPE_UPDATE:
        return this.handleOrchestrateSaveRecipe(
          organizationSlug,
          agent,
          request,
        );
      case AgentTaskMode.ORCHESTRATOR_RECIPE_LIST:
        return this.handleOrchestratorRecipeList(
          organizationSlug,
          agent,
        );
      case AgentTaskMode.ORCHESTRATOR_RECIPE_LOAD:
        return this.handleOrchestratorRecipeLoad(
          organizationSlug,
          agent,
          request,
        );
      case AgentTaskMode.ORCHESTRATOR_RECIPE_VALIDATE:
        return this.handleOrchestratorRecipeValidate(
          organizationSlug,
          agent,
          request,
        );
      case AgentTaskMode.ORCHESTRATOR_RUN_HUMAN_RESPONSE:
        return TaskResponseDto.human('Manual confirmation required');
      case AgentTaskMode.ORCHESTRATOR_PLAN_REVIEW:
      case AgentTaskMode.ORCHESTRATOR_PLAN_APPROVE:
      case AgentTaskMode.ORCHESTRATOR_PLAN_REJECT:
      case AgentTaskMode.ORCHESTRATOR_PLAN_ARCHIVE:
      case AgentTaskMode.ORCHESTRATOR_RUN_PAUSE:
      case AgentTaskMode.ORCHESTRATOR_RUN_RESUME:
      case AgentTaskMode.ORCHESTRATOR_RUN_ROLLBACK_STEP:
      case AgentTaskMode.ORCHESTRATOR_RUN_CANCEL:
      case AgentTaskMode.ORCHESTRATOR_RUN_EVALUATE:
      case AgentTaskMode.ORCHESTRATOR_RECIPE_VALIDATE:
      case AgentTaskMode.ORCHESTRATOR_RECIPE_DELETE:
        return this.notImplemented(request.mode!);
      case AgentTaskMode.HUMAN_RESPONSE: {
        const decision = (request.payload as any)?.decision || (request.payload as any)?.approved;
        if (decision === true || decision === 'approve') {
          return TaskResponseDto.success(AgentTaskMode.HUMAN_RESPONSE, {
            content: { status: 'approved' },
            metadata: { timestamp: new Date().toISOString() },
          });
        }
        if (decision === false || decision === 'reject') {
          return TaskResponseDto.failure(
            AgentTaskMode.HUMAN_RESPONSE,
            'rejected_by_human',
          );
        }
        return TaskResponseDto.human('Manual confirmation required');
      }
      default:
        return TaskResponseDto.failure(request.mode!, 'Unsupported mode');
    }
  }

  private checkUnsupportedMode(
    definition: AgentRuntimeDefinition,
    mode: AgentTaskMode,
  ): TaskResponseDto | null {
    const exec = definition.execution;
    switch (mode) {
      case AgentTaskMode.CONVERSE:
        return exec.canConverse ? null : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.PLAN:
        return exec.canPlan ? null : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.BUILD:
        return exec.canBuild ? null : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      default:
        return null;
    }
  }

  private async checkHumanGate(
    definition: AgentRuntimeDefinition,
    mode: AgentTaskMode,
    context?: { organizationSlug: string | null; agentSlug: string; conversationId: string | null; taskId?: string | null; request?: TaskRequestDto },
  ): Promise<TaskResponseDto | null> {
    const exec = definition.execution;
    if (!exec.requiresHumanGate) {
      return null;
    }

    // For Phase 2, gate high-impact modes by default
    if (mode === AgentTaskMode.BUILD) {
      let approvalId: string | undefined = undefined;
      try {
        if (context) {
          const minimalRequest = context.request
            ? (() => {
                const base: any = {
                  userMessage: context.request.userMessage,
                  payload: context.request.payload ? { ...context.request.payload } : undefined,
                };
                // Remove potentially sensitive per-request headers before persisting
                if (base.payload?.options?.headers) {
                  base.payload.options = { ...(base.payload.options || {}) };
                  delete base.payload.options.headers;
                }
                return base;
              })()
            : undefined;
          const rec = await this.approvals.create({
            organizationSlug: context.organizationSlug ?? null,
            agentSlug: context.agentSlug,
            conversationId: context.conversationId ?? null,
            taskId: context.taskId ?? null,
            mode: 'build',
            metadata: { reason: 'requires_human_gate', request: minimalRequest },
          });
          approvalId = rec.id;
        }
      } catch (_err) {
        // If approval creation fails, still return a human gate without ID
      }

      return TaskResponseDto.human(
        'Manual confirmation required before build',
        {
          humanRequired: true,
          approvalStatus: 'pending',
          approvalId,
          mode: 'build',
          agentSlug: context?.agentSlug,
          organizationSlug: context?.organizationSlug ?? null,
          conversationId: context?.conversationId ?? null,
        },
      );
    }

    // Future: gate orchestration execution modes as needed
    return null;
  }

  private async handlePlan(
    organizationSlug: string | null,
    agent: AgentRecord,
    definition: AgentRuntimeDefinition,
    agentMetadata: AgentRuntimeAgentMetadata,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const conversationId = request.conversationId;
    if (!conversationId) {
      throw new BadRequestException(
        'conversationId is required for plan generation',
      );
    }

    const draftPlan =
      request.payload?.planDraft ?? {
        summary: request.userMessage ?? 'Plan draft not provided',
      };

    const metadata = this.runtimeExecution.collectRequestMetadata(request);

    const planRecord = await this.planEngine.generateDraft({
      conversationId,
      organizationSlug,
      agentSlug: agent.slug,
      summary: request.payload?.summary ?? null,
      draftPlan,
      createdBy: metadata.createdBy ?? null,
      agentMetadata,
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
    agentMetadata: AgentRuntimeAgentMetadata,
    request: TaskRequestDto,
    routingMetadata?: Record<string, any>,
  ): Promise<TaskResponseDto> {
    const orchestrationResponse = await this.startOrchestrationFromRequest(
      organizationSlug,
      agent,
      agentMetadata,
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
    agentMetadata: AgentRuntimeAgentMetadata,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const conversationId = request.conversationId;
    if (!conversationId) {
      throw new BadRequestException(
        'conversationId is required for orchestration creation',
      );
    }

    const draftPlan =
      request.payload?.planDraft ?? {
        summary: request.userMessage ?? 'Orchestration draft not provided',
      };

    const metadata = this.runtimeExecution.collectRequestMetadata(request);

    const planRecord = await this.planEngine.generateDraft({
      conversationId,
      organizationSlug,
      agentSlug: agent.slug,
      summary: request.payload?.summary ?? null,
      draftPlan,
      createdBy: metadata.createdBy ?? null,
      agentMetadata,
    });

    return TaskResponseDto.success(AgentTaskMode.ORCHESTRATE_CREATE, {
      content: planRecord,
      metadata: {
        mode: 'create',
        agentId: agentMetadata.id,
        agentSlug: agentMetadata.slug,
        organizationSlug: agentMetadata.organizationSlug ?? organizationSlug,
      },
    });
  }

  private async handleOrchestrateExecute(
    organizationSlug: string | null,
    agent: AgentRecord,
    definition: AgentRuntimeDefinition,
    agentMetadata: AgentRuntimeAgentMetadata,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const orchestrationResponse = await this.startOrchestrationFromRequest(
      organizationSlug,
      agent,
      agentMetadata,
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
    const streamSession = this.maybeStartStream(
      request,
      organizationSlug,
      { slug: patch.agentSlug ?? patch.agent_slug ?? 'unknown' } as AgentRecord,
      AgentTaskMode.ORCHESTRATE_CONTINUE,
    );

    try {
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

      this.publishStreamChunk(streamSession, {
        type: 'partial',
        content: JSON.stringify({ status: 'run_updated', run }),
      });

      this.completeStream(streamSession);

      return TaskResponseDto.success(AgentTaskMode.ORCHESTRATE_CONTINUE, {
        content: run,
        metadata: this.attachStreamId(
          {
            runId,
            organizationSlug,
          },
          streamSession,
        ),
      });
    } catch (error) {
      this.errorStream(streamSession, error);
      throw error;
    }
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
    agentMetadata: AgentRuntimeAgentMetadata,
    request: TaskRequestDto,
    responseMode: AgentTaskMode,
    options: { requireTarget: boolean },
  ): Promise<TaskResponseDto | null> {
    const agentSlug = agent.slug;
    const orchestrationSlug =
      request.orchestrationSlug ?? request.payload?.orchestrationSlug ?? null;
    const promptInputs =
      request.promptParameters ?? request.payload?.promptParameters ?? {};
    const streamSession = this.maybeStartStream(
      request,
      organizationSlug,
      agent,
      responseMode,
    );

    const metadata = this.runtimeExecution.collectRequestMetadata(request);

    try {
      if (request.planId) {
        const plan = await this.resolvePlanForExecution(
          organizationSlug,
          agent,
          request,
        );
      const runMetadata = this.runtimeExecution.buildRunMetadata(
        metadata,
        agentMetadata,
        {
          conversationId: plan.conversation_id,
          planVersion: plan.version,
        },
      );
      const run = await this.orchestrationRunner.startRun({
        planId: plan.id,
        originType: 'plan',
        originId: plan.id,
        organizationSlug: plan.organization_slug ?? null,
        agentId: agentMetadata.id,
        agentSlug: agentMetadata.slug,
        agentType: agentMetadata.type,
        agentDisplayName: agentMetadata.displayName,
        promptInputs,
        metadata: runMetadata,
      });

        this.publishStreamChunk(streamSession, {
          type: 'partial',
          content: JSON.stringify({ status: 'run_started', run }),
        });

        const responseMetadata = this.attachStreamId(
          this.runtimeExecution.buildRunMetadata(
            {
              originType: 'plan',
              planId: plan.id,
              planVersion: plan.version,
              conversationId: plan.conversation_id,
              promptInputs,
            },
            agentMetadata,
          ),
          streamSession,
        );

        this.completeStream(streamSession);

        return TaskResponseDto.success(responseMode, {
          content: run,
          metadata: responseMetadata,
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
          agentId: agentMetadata.id,
          agentSlug: agentMetadata.slug,
          agentType: agentMetadata.type,
          agentDisplayName: agentMetadata.displayName,
          metadata: this.runtimeExecution.buildRunMetadata(
            metadata,
            agentMetadata,
            {
              orchestrationId: orchestration.id,
            },
          ),
        });

        this.publishStreamChunk(streamSession, {
          type: 'partial',
          content: JSON.stringify({ status: 'run_started', run }),
        });

        const responseMetadata = this.attachStreamId(
          this.runtimeExecution.buildRunMetadata(
            {
              originType: 'saved_orchestration',
              orchestration: {
                id: orchestration.id,
                slug: orchestration.slug,
              },
              promptInputs: resolvedInputs,
            },
            agentMetadata,
          ),
          streamSession,
        );

        this.completeStream(streamSession);

        return TaskResponseDto.success(responseMode, {
          content: run,
          metadata: responseMetadata,
        });
      }

      if (options.requireTarget) {
        this.completeStream(streamSession);
        return null;
      }

      this.completeStream(streamSession);
      return null;
    } catch (error) {
      this.errorStream(streamSession, error);
      throw error;
    }
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

  private async handleOrchestratorRecipeList(
    organizationSlug: string | null,
    agent: AgentRecord,
  ) {
    const list = await this.agentOrchestrations.listByAgent(
      organizationSlug,
      agent.slug,
    );
    return TaskResponseDto.success(AgentTaskMode.ORCHESTRATOR_RECIPE_LIST, {
      content: list,
      metadata: {
        organizationSlug,
        agentSlug: agent.slug,
      },
    });
  }

  private async handleOrchestratorRecipeLoad(
    organizationSlug: string | null,
    agent: AgentRecord,
    request: TaskRequestDto,
  ) {
    const slug =
      request.orchestrationSlug ?? request.payload?.orchestrationSlug ?? null;
    if (!slug) {
      throw new BadRequestException('orchestrationSlug is required to load');
    }

    const record = await this.agentOrchestrations.findBySlug(
      organizationSlug,
      agent.slug,
      slug,
    );

    if (!record) {
      throw new NotFoundException('Saved orchestration not found');
    }

    return TaskResponseDto.success(AgentTaskMode.ORCHESTRATOR_RECIPE_LOAD, {
      content: record,
      metadata: {
        organizationSlug,
        agentSlug: agent.slug,
        slug,
      },
    });
  }

  private async handleOrchestratorRecipeValidate(
    organizationSlug: string | null,
    agent: AgentRecord,
    request: TaskRequestDto,
  ) {
    const slug =
      request.orchestrationSlug ?? request.payload?.orchestrationSlug ?? null;
    if (!slug) {
      throw new BadRequestException(
        'orchestrationSlug is required to validate prompt parameters',
      );
    }

    const record = await this.agentOrchestrations.findBySlug(
      organizationSlug,
      agent.slug,
      slug,
    );

    if (!record) {
      throw new NotFoundException('Saved orchestration not found');
    }

    const provided =
      request.promptParameters ?? request.payload?.promptParameters ?? {};
    const resolved = this.validatePromptInputs(record, provided);

    return TaskResponseDto.success(
      AgentTaskMode.ORCHESTRATOR_RECIPE_VALIDATE,
      {
        content: {
          valid: true,
          resolvedParameters: resolved,
        },
        metadata: {
          organizationSlug,
          agentSlug: agent.slug,
          slug,
        },
      },
    );
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

  private attachAgentMetadata(
    draft: Record<string, any>,
    definition: AgentRuntimeDefinition,
  ): Record<string, any> {
    if (!draft || typeof draft !== 'object') {
      return draft;
    }

    const enriched = { ...draft };
    const existingMeta = (enriched as any)._meta ?? {};
    (enriched as any)._meta = {
      ...existingMeta,
      agent: {
        id: definition.id,
        slug: definition.slug,
        displayName: definition.displayName,
        agentType: definition.agentType,
        modeProfile: definition.modeProfile,
        organizationSlug: definition.organizationSlug,
      },
    };

    return enriched;
  }

  private collectMetadata(request: TaskRequestDto): Record<string, any> {
    return {
      ...(request.payload?.metadata ?? {}),
      ...(request.metadata ?? {}),
    };
  }

  private maybeStartStream(
    request: TaskRequestDto,
    organizationSlug: string | null,
    agent: AgentRecord,
    mode: AgentTaskMode,
  ) {
    const wantsStream = Boolean(
      request.payload?.options?.stream || request.metadata?.stream,
    );

    if (!wantsStream) {
      return null;
    }

    const providedStreamId =
      request.metadata?.streamId || request.payload?.metadata?.streamId ||
      undefined;
    return this.streamService.start({
      conversationId: request.conversationId,
      sessionId: request.sessionId,
      orchestrationRunId: request.orchestrationRunId,
      organizationSlug,
      agentSlug: agent.slug,
      mode,
    }, providedStreamId);
  }

  private publishStreamChunk(
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
    chunk: { type: 'partial' | 'final'; content: string },
  ) {
    if (!session) {
      return;
    }

    session.publishChunk(chunk);
  }

  private completeStream(
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
  ) {
    if (!session) {
      return;
    }

    session.complete();
  }

  private errorStream(
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
    error: unknown,
  ) {
    if (!session) {
      return;
    }

    session.error(error);
  }

  private attachStreamId(
    metadata: Record<string, any>,
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
  ): Record<string, any> {
    if (!session) {
      return metadata;
    }

    return {
      ...metadata,
      streamId: session.streamId,
    };
  }

  private notImplemented(mode: AgentTaskMode): TaskResponseDto {
    return TaskResponseDto.failure(
      mode,
      'Orchestration mode not implemented yet',
    );
  }
}
