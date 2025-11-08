import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
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
import { ObservabilityWebhookService } from '../../observability/observability-webhook.service';

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
    private readonly observability: ObservabilityWebhookService,
    @Inject(HttpService) private readonly httpService?: HttpService,
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

    // Observability: Agent execution started
    this.emitAgentLifecycleEvent('agent.started', 'Agent execution started', {
      definition,
      request,
      organizationSlug,
    });

    const assessment = await this.routingPolicy.evaluate(request, agent);
    const routingMetadata = {
      ...(assessment.metadata ?? {}),
      agentMetadata,
    };

    if (assessment.showstopper) {
      return TaskResponseDto.human(
        assessment.humanMessage ?? 'Routing policy requires human review.',
        'routing_showstopper',
      );
    }

    // Enforce execution capabilities before routing
    const unsupported = this.checkUnsupportedMode(definition, request.mode!);
    if (unsupported) {
      this.emitAgentLifecycleEvent('agent.failed', 'Unsupported mode', {
        definition,
        request,
        organizationSlug,
      });
      return unsupported;
    }

    try {
      let response: TaskResponseDto;

      switch (request.mode!) {
        case AgentTaskMode.CONVERSE:
          response = await this.modeRouter.execute({
            organizationSlug,
            agentSlug: agent.slug,
            agent,
            definition,
            request,
            routingMetadata,
          });
          break;
        case AgentTaskMode.PLAN:
          // Delegate to mode router (uses new plans table via PlansService)
          response = await this.modeRouter.execute({
            organizationSlug,
            agentSlug: agent.slug,
            agent,
            definition,
            request,
            routingMetadata,
          });
          break;
        case AgentTaskMode.BUILD:
          // Delegate to mode router (uses new deliverables table via DeliverablesService)
          response = await this.modeRouter.execute({
            organizationSlug,
            agentSlug: agent.slug,
            agent,
            definition,
            request,
            routingMetadata,
          });
          break;
        case AgentTaskMode.ORCHESTRATE:
          // Delegate to mode router (uses action-based routing for orchestrate operations)
          response = await this.modeRouter.execute({
            organizationSlug,
            agentSlug: agent.slug,
            agent,
            definition,
            request,
            routingMetadata,
          });
          break;
        default:
          response = TaskResponseDto.failure(request.mode!, 'Unsupported mode');
      }

      // Emit completion or failure based on response
      if (response.success) {
        this.emitAgentLifecycleEvent('agent.completed', 'Agent execution completed', {
          definition,
          request,
          organizationSlug,
        });
      } else {
        this.emitAgentLifecycleEvent('agent.failed', 'Agent execution failed', {
          definition,
          request,
          organizationSlug,
        });
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitAgentLifecycleEvent('agent.failed', `Agent execution error: ${errorMessage}`, {
        definition,
        request,
        organizationSlug,
      });
      throw error;
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

    const summaryValue = request.payload?.summary;
    const summary = typeof summaryValue === 'string' ? summaryValue : null;

    const planRecord = await this.planEngine.generateDraft({
      conversationId,
      organizationSlug,
      agentSlug: agent.slug,
      summary,
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
    routingMetadata?: Record<string, unknown>,
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
    _options: { requireTarget: boolean },
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
        const actorIdValue =
          request.metadata?.actorId ?? request.metadata?.userId;
        const actorId = typeof actorIdValue === 'string' ? actorIdValue : null;

        const approvalId = request.payload.approvalId;
        const decision = request.payload.decision;
        const notesValue = request.payload.notes;
        const notes = typeof notesValue === 'string' ? notesValue : null;

        const resolutionResult = await this.resolveCheckpointAndMaybeResume({
          approvalId: typeof approvalId === 'string' ? approvalId : '',
          decision: decision as Parameters<
            typeof this.resolveCheckpointAndMaybeResume
          >[0]['decision'],
          actorId,
          notes,
          modifications: request.payload.modifications as
            | Record<string, unknown>
            | undefined,
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
          parameters: promptInputs as unknown as Parameters<
            typeof this.orchestrationRunner.startRun
          >[0]['parameters'],
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
            } as unknown as Parameters<
              typeof this.runtimeExecution.buildRunMetadata
            >[0],
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
          typeof orchestrationSlug === 'string' ? orchestrationSlug : '',
        );

        if (!orchestration) {
          throw new NotFoundException('Saved orchestration not found');
        }

        const resolvedInputs = this.validatePromptInputs(
          orchestration,
          (promptInputs ?? {}) as Record<string, unknown>,
        );

        const run = await this.orchestrationRunner.startRun({
          organizationSlug,
          originType: 'saved_orchestration',
          originId: orchestration.id,
          orchestrationSlug: orchestration.slug,
          parameters: resolvedInputs as JsonObject,
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
              promptInputs: resolvedInputs as JsonObject,
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
    provided: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    const templates = orchestration.prompt_templates ?? [];
    if (!templates.length) {
      return provided ?? {};
    }

    const result: Record<string, unknown> = {};
    for (const template of templates) {
      const supplied = (provided ?? {})[template.name] ?? {};
      const params = template.parameters ?? [];
      const resolved: Record<string, unknown> = { ...supplied };

      for (const param of params) {
        const suppliedRecord = supplied as Record<string, unknown>;
        const value = suppliedRecord[param.key];
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
    draft: Record<string, unknown>,
    definition: AgentRuntimeDefinition,
  ): Record<string, unknown> {
    if (!draft || typeof draft !== 'object') {
      return draft;
    }

    const enriched = { ...draft };
    const draftWithMeta = enriched as Record<string, unknown> & {
      _meta?: Record<string, unknown>;
    };
    const existingMeta = draftWithMeta._meta ?? {};
    draftWithMeta._meta = {
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

  private collectMetadata(request: TaskRequestDto): Record<string, unknown> {
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
    const payloadOptions = request.payload?.options as
      | Record<string, unknown>
      | undefined;
    const metadata = request.metadata;
    const payloadMetadata = request.payload?.metadata as
      | Record<string, unknown>
      | undefined;

    const wantsStream = Boolean(payloadOptions?.stream || metadata?.stream);

    if (!wantsStream) {
      return null;
    }

    const streamIdValue = metadata?.streamId || payloadMetadata?.streamId;
    const providedStreamId =
      typeof streamIdValue === 'string' ? streamIdValue : undefined;

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
    metadata: Record<string, unknown>,
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
  ): Record<string, unknown> {
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
    modifications?: Record<string, unknown> | undefined;
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
      modifications: (options.modifications ?? undefined) as
        | JsonObject
        | undefined,
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

  /**
   * Emit agent lifecycle event for observability.
   * Fire-and-forget to avoid blocking agent execution.
   */
  private emitAgentLifecycleEvent(
    eventType: string,
    message: string,
    context: {
      definition: AgentRuntimeDefinition;
      request: TaskRequestDto;
      organizationSlug: string | null;
    },
  ): void {
    try {
      const userId = this.resolveUserId(context.request);
      const conversationId = context.request.conversationId || null;
      const taskId = (context.request.payload as Record<string, unknown>)?.taskId as string | null;

      // Fire webhook call (non-blocking)
      if (this.httpService) {
        this.httpService.post('http://localhost:7100/webhooks/status', {
          taskId: taskId || conversationId || 'unknown',
          status: eventType,
          timestamp: new Date().toISOString(),
          message,
          userId: userId || undefined,
          conversationId: conversationId || undefined,
          agentSlug: context.definition.slug,
          organizationSlug: context.organizationSlug || 'global',
          mode: context.request.mode || undefined,
        }).toPromise().catch((error: Error) => {
          // Log but don't throw - observability should never break execution
          this.logger.warn(
            `Failed to emit observability event (${eventType}): ${error.message}`,
          );
        });
      }
    } catch (error) {
      // Silently catch - observability is non-critical
      this.logger.debug(
        `Error preparing observability event: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private resolveUserId(request: TaskRequestDto): string | null {
    return (
      ((request.metadata as Record<string, unknown>)?.userId as string) ||
      ((request.payload as Record<string, unknown>)?.userId as string) ||
      null
    );
  }
}
