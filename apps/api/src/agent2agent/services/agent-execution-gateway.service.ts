import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { JsonObject } from '@orchestrator-ai/transport-types';
import { AgentOrchestrationsRepository } from '@agent-platform/repositories/agent-orchestrations.repository';
import { AgentOrchestrationRecord } from '@agent-platform/interfaces/agent-orchestration-record.interface';
import { AgentRecord } from '@agent-platform/interfaces/agent.interface';
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
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { AgentRuntimeStreamService } from '@agent-platform/services/agent-runtime-stream.service';
import { HumanApprovalsRepository } from '@agent-platform/repositories/human-approvals.repository';
import { OrchestrationRunRecord } from '@agent-platform/interfaces/orchestration-run-record.interface';
import { OrchestrationCheckpointService } from '@agent-platform/services/orchestration-checkpoint.service';
import type { OrchestrationCheckpointDecision } from '@agent-platform/types/orchestration-run.types';
import { OrchestrationExecutionService } from '@agent-platform/services/orchestration-execution.service';
import { OrchestrationStepExecutorService } from './orchestration-step-executor.service';

@Injectable()
export class AgentExecutionGateway {
  private readonly logger = new Logger(AgentExecutionGateway.name);

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
    private readonly executionService: OrchestrationExecutionService,
    private readonly stepExecutor: OrchestrationStepExecutorService,
    private readonly checkpointService: OrchestrationCheckpointService,
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

    // Enforce execution capabilities before routing
    const unsupported = this.checkUnsupportedMode(definition, request.mode!);
    if (unsupported) {
      return unsupported;
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
      case AgentTaskMode.ORCHESTRATE:
        // Delegate to mode router (uses action-based routing for orchestrate operations)
        return this.modeRouter.execute({
          organizationSlug,
          agentSlug: agent.slug,
          agent,
          definition,
          request,
          routingMetadata: assessment.metadata,
        });
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
        return exec.canConverse
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.PLAN:
        return exec.canPlan
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.BUILD:
        return exec.canBuild
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.ORCHESTRATE:
        return exec.canOrchestrate
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      default:
        return null;
    }
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

    const fallbackPlan: JsonObject = {
      summary: request.userMessage ?? 'Plan draft not provided',
    };
    const draftPlan = this.toJsonObject(
      request.payload?.planDraft,
      fallbackPlan,
    );

    const metadata = this.runtimeExecution.collectRequestMetadata(request);
    const createdByValue = metadata.createdBy;
    const createdBy =
      typeof createdByValue === 'string' ? createdByValue : null;

    const planRecord = await this.planEngine.generateDraft({
      conversationId,
      organizationSlug,
      agentSlug: agent.slug,
      summary: request.payload?.summary ?? null,
      draftPlan,
      createdBy,
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
      if (
        request.payload?.action === 'resume_after_approval' &&
        request.payload.approvalId
      ) {
        const actorId =
          request.metadata?.actorId ?? request.metadata?.userId ?? null;

        const resolutionResult = await this.resolveCheckpointAndMaybeResume({
          approvalId: request.payload.approvalId,
          decision: request.payload.decision,
          actorId,
          notes: request.payload.notes ?? null,
          modifications: request.payload.modifications ?? undefined,
        });

        this.publishStreamChunk(streamSession, {
          type: 'partial',
          content: JSON.stringify({
            status: 'checkpoint_resolved',
            approvalId: request.payload.approvalId,
            decision: request.payload.decision,
          }),
        });

        if (resolutionResult.decision === 'abort') {
          this.completeStream(streamSession);
          return TaskResponseDto.success(responseMode, {
            content: {
              orchestrationRunId: resolutionResult.run.id,
              status: resolutionResult.run.status,
            },
            metadata: {
              orchestrationDefinitionId:
                resolutionResult.run.orchestration_definition_id,
              ownerAgentSlug: agentMetadata.slug,
            },
          });
        }

        const resumedRun = resolutionResult.run;
        const readySteps = resolutionResult.readySteps ?? [];
        const allSteps = resolutionResult.steps ?? [];

        this.publishStreamChunk(streamSession, {
          type: 'partial',
          content: JSON.stringify({
            status: 'run_resumed',
            run: resumedRun,
          }),
        });

        this.completeStream(streamSession);

        return TaskResponseDto.success(responseMode, {
          content: {
            orchestrationRunId: resumedRun.id,
            status: resumedRun.status,
            steps: allSteps,
            readySteps,
          },
          metadata: {
            orchestrationDefinitionId: resumedRun.orchestration_definition_id,
            ownerAgentSlug: agentMetadata.slug,
          },
        });
      }

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
          parameters: promptInputs,
          metadata: runMetadata,
        });

        const concurrencyLimit = this.executionService.getConcurrencyLimit(run);
        const { run: executionRun, readySteps } =
          await this.executionService.startExecution(run.id, {
            maxParallel: concurrencyLimit,
          });
        const allSteps = await this.orchestrationRunner.listSteps(
          executionRun.id,
        );

        this.triggerRunProcessing(executionRun.id, readySteps.length);

        this.triggerRunProcessing(executionRun.id, readySteps.length);

        this.publishStreamChunk(streamSession, {
          type: 'partial',
          content: JSON.stringify({
            status: 'run_started',
            run: executionRun,
          }),
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
          content: {
            orchestrationRunId: executionRun.id,
            status: executionRun.status,
            steps: allSteps.map((step) => ({
              id: step.step_id,
              index: step.step_index,
              status: step.status,
              agent: step.agent_slug,
              mode: step.mode,
              dependsOn: step.depends_on,
            })),
            readySteps: readySteps.map((step) => ({
              id: step.step_id,
              index: step.step_index,
              agent: step.agent_slug,
              mode: step.mode,
            })),
          },
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
          parameters: resolvedInputs,
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

        const savedConcurrency = this.executionService.getConcurrencyLimit(run);
        const { run: executionRun, readySteps } =
          await this.executionService.startExecution(run.id, {
            maxParallel: savedConcurrency,
          });
        const allSteps = await this.orchestrationRunner.listSteps(
          executionRun.id,
        );

        this.publishStreamChunk(streamSession, {
          type: 'partial',
          content: JSON.stringify({
            status: 'run_started',
            run: executionRun,
          }),
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
          content: {
            orchestrationRunId: executionRun.id,
            status: executionRun.status,
            steps: allSteps.map((step) => ({
              id: step.step_id,
              index: step.step_index,
              status: step.status,
              agent: step.agent_slug,
              mode: step.mode,
              dependsOn: step.depends_on,
            })),
            readySteps: readySteps.map((step) => ({
              id: step.step_id,
              index: step.step_index,
              agent: step.agent_slug,
              mode: step.mode,
            })),
          },
          metadata: responseMetadata,
        });
      }

      // If we reach this point there is no immediate orchestration to launch.
      // Keep the A2A contract clean by returning null after completing stream.
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

  private triggerRunProcessing(runId: string, readySteps: number): void {
    if (readySteps <= 0) {
      return;
    }

    this.stepExecutor.processRun(runId).catch((error) => {
      this.logger.error(
        `Failed to process orchestration run ${runId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
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
      request.metadata?.streamId ||
      request.payload?.metadata?.streamId ||
      undefined;
    return this.streamService.start(
      {
        conversationId: request.conversationId,
        sessionId: request.sessionId,
        orchestrationRunId: request.orchestrationRunId,
        organizationSlug,
        agentSlug: agent.slug,
        mode,
      },
      providedStreamId,
    );
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

  private async resolveCheckpointAndMaybeResume(options: {
    approvalId: string;
    decision: OrchestrationCheckpointDecision;
    actorId?: string | null;
    notes?: string | null;
    modifications?: Record<string, any> | undefined;
  }): Promise<{
    decision: OrchestrationCheckpointDecision;
    run: OrchestrationRunRecord;
    readySteps?: Awaited<
      ReturnType<OrchestrationExecutionService['startExecution']>
    >['readySteps'];
    steps?: Awaited<ReturnType<OrchestrationRunnerService['listSteps']>>;
  }> {
    const resolution = await this.checkpointService.resolveCheckpoint({
      approvalId: options.approvalId,
      decision: options.decision,
      actorId: options.actorId ?? null,
      notes: options.notes ?? null,
      modifications: options.modifications ?? undefined,
    });

    if (resolution.decision === 'abort') {
      return {
        decision: resolution.decision,
        run: resolution.run,
        readySteps: [],
        steps: [],
      };
    }

    const resumeConcurrency = this.executionService.getConcurrencyLimit(
      resolution.run,
    );
    const resumeResult = await this.executionService.startExecution(
      resolution.run.id,
      {
        maxParallel: resumeConcurrency,
      },
    );
    const stepList = await this.orchestrationRunner.listSteps(
      resumeResult.run.id,
    );

    this.triggerRunProcessing(
      resumeResult.run.id,
      resumeResult.readySteps?.length ?? 0,
    );

    return {
      decision: resolution.decision,
      run: resumeResult.run,
      readySteps: resumeResult.readySteps,
      steps: stepList,
    };
  }

  private toJsonObject(value: unknown, fallback: JsonObject): JsonObject {
    if (this.isJsonObject(value)) {
      return { ...value } as JsonObject;
    }

    return { ...fallback } as JsonObject;
  }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
