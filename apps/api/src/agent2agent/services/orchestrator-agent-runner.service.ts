import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import type { JsonObject } from '@orchestrator-ai/transport-types';
import { BaseAgentRunner } from './base-agent-runner.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { LLMService } from '@llm/llm.service';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { PlansService } from '../plans/services/plans.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { OrchestrationDefinitionService } from '@agent-platform/services/orchestration-definition.service';
import { OrchestrationStateService } from '@agent-platform/services/orchestration-state.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { OrchestrationExecutionService } from '@agent-platform/services/orchestration-execution.service';
import { OrchestrationCheckpointService } from '@agent-platform/services/orchestration-checkpoint.service';
import type { OrchestrationCheckpointDecision } from '@agent-platform/types/orchestration-run.types';
import { OrchestrationResolvedDefinition } from '@agent-platform/types/orchestration-definition.types';
import { OrchestrationRunRecord } from '@agent-platform/interfaces/orchestration-run-record.interface';
import { OrchestrationEventsService } from '@agent-platform/services/orchestration-events.service';
import { OrchestrationStepExecutorService } from './orchestration-step-executor.service';
import { OrchestrationRunFactoryService } from '@agent-platform/services/orchestration-run-factory.service';
import {
  handleOrchestrateAction,
  OrchestrateHandlerDependencies,
  RunnerContext,
} from './base-agent-runner/orchestrate.handlers';

interface OrchestratorStartPayload {
  orchestrationDefinitionId?: string;
  orchestrationName?: string;
  orchestrationVersion?: string;
  parameters?: Record<string, unknown>;
  action?: undefined;
}

interface OrchestratorResumePayload {
  action: 'resume_after_approval';
  approvalId: string;
  decision: OrchestrationCheckpointDecision;
  notes?: string | null;
  modifications?: Record<string, unknown> | null;
  actorId?: string | null;
}

type OrchestratorRequestPayload =
  | OrchestratorStartPayload
  | OrchestratorResumePayload;

@Injectable()
export class OrchestratorAgentRunnerService extends BaseAgentRunner {
  protected readonly logger = new Logger(OrchestratorAgentRunnerService.name);

  constructor(
    private readonly definitionService: OrchestrationDefinitionService,
    private readonly stateService: OrchestrationStateService,
    private readonly orchestrationRunner: OrchestrationRunnerService,
    private readonly executionService: OrchestrationExecutionService,
    private readonly orchestrationEvents: OrchestrationEventsService,
    private readonly checkpointService: OrchestrationCheckpointService,
    @Inject(forwardRef(() => OrchestrationStepExecutorService))
    private readonly stepExecutor: OrchestrationStepExecutorService,
    private readonly runFactory: OrchestrationRunFactoryService,
    llmService: LLMService,
    contextOptimization: ContextOptimizationService,
    plansService: PlansService,
    conversationsService: Agent2AgentConversationsService,
    deliverablesService: DeliverablesService,
  ) {
    super(
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
    );
  }

  /**
   * Handle ORCHESTRATE mode with action-based routing
   * Routes to appropriate handler based on action field in payload
   */
  protected async handleOrchestrate(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    const services: OrchestrateHandlerDependencies = {};

    return handleOrchestrateAction(
      definition,
      request,
      organizationSlug,
      services,
      this as unknown as RunnerContext, // Pass runner context for access to existing methods
    );
  }

  protected async handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    try {
      const payload = this.parsePayload(request);
      const resolvedDefinition = await this.resolveDefinition(
        definition,
        payload,
      );

      // Ensure dependency graph is valid
      this.stateService.resolveExecutionOrder(resolvedDefinition.steps);

      const stepSummary = resolvedDefinition.steps.map((step) => ({
        id: step.id,
        name: step.name,
        agent: step.agent,
        mode: step.mode ?? 'BUILD',
        dependsOn: step.depends_on ?? [],
        checkpoint: step.checkpoint_after ?? null,
      }));

      return TaskResponseDto.success(AgentTaskMode.PLAN, {
        content: {
          orchestration: {
            name: resolvedDefinition.name,
            displayName: resolvedDefinition.displayName,
            version: resolvedDefinition.version,
            description: resolvedDefinition.description,
            steps: stepSummary,
            parameters: resolvedDefinition.parameters,
          },
        },
        metadata: {
          orchestrationDefinitionId: resolvedDefinition.recordId,
          ownerAgentSlug: resolvedDefinition.ownerAgentSlug,
        },
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : error && typeof error === 'object'
              ? JSON.stringify(error)
              : 'Unknown error';
      this.logger.error(`Failed to generate orchestration plan: ${errorMsg}`);
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  protected async executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    try {
      const payload = this.parsePayload(request);

      if (payload.action === 'resume_after_approval') {
        return await this.resumeAfterApproval(definition, request, payload);
      }

      const resolvedDefinition = await this.resolveDefinition(
        definition,
        payload,
      );
      const runtimeParameters = {
        ...(payload.parameters ?? {}),
        ...(request.promptParameters ?? {}),
      };

      const taskLink = this.resolveTaskLink(request);
      const requestMetadata = this.extractRequestMetadata(
        (request.metadata ?? {}) as Record<string, unknown> | undefined,
      );

      const factoryResult = await this.runFactory.createRunFromDefinition({
        definition: resolvedDefinition,
        parameters: runtimeParameters,
        planId: request.planId ?? null,
        conversationId: request.conversationId ?? null,
        parentRunId: request.orchestrationRunId ?? null,
        organizationSlug:
          resolvedDefinition.organizationSlug ?? definition.organizationSlug,
        agent: {
          id: definition.record.id ?? null,
          slug: definition.slug,
          type: definition.agentType ?? null,
          displayName: definition.displayName ?? null,
        },
        createdBy: this.asString(request.metadata?.userId) ?? null,
        requestMetadata,
        taskLink,
      });

      const executionRun = factoryResult.run;
      const allSteps = factoryResult.steps;
      const readySteps = factoryResult.readySteps;

      if (readySteps.length > 0) {
        this.stepExecutor
          .processRun(executionRun.id)
          .catch((err) =>
            this.logger.error(
              `Failed to process orchestration run ${executionRun.id}: ${err instanceof Error ? err.message : err}`,
            ),
          );
      }

      return this.buildRunSuccessResponse(
        executionRun,
        allSteps,
        readySteps,
        resolvedDefinition.recordId ?? null,
        resolvedDefinition.ownerAgentSlug,
      );
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : error && typeof error === 'object'
              ? JSON.stringify(error)
              : 'Unknown error';
      this.logger.error(`Failed to initialize orchestration run: ${errorMsg}`);
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private parsePayload(request: TaskRequestDto): OrchestratorRequestPayload {
    const payload = request.payload ?? {};
    if (payload && typeof payload === 'object' && 'action' in payload) {
      return payload as OrchestratorRequestPayload;
    }
    return payload as OrchestratorRequestPayload;
  }

  private async resolveDefinition(
    agentDefinition: AgentRuntimeDefinition,
    payload: OrchestratorRequestPayload,
  ): Promise<OrchestrationResolvedDefinition> {
    if ('action' in payload && payload.action === 'resume_after_approval') {
      throw new Error(
        'Resume payload does not require orchestration definition resolution',
      );
    }

    const startPayload = payload;

    if (startPayload.orchestrationDefinitionId) {
      const record = await this.definitionService.getDefinitionById(
        startPayload.orchestrationDefinitionId,
      );
      if (!record) {
        throw new Error(
          `Orchestration definition ${startPayload.orchestrationDefinitionId} not found`,
        );
      }
      return record;
    }

    const requestedName =
      startPayload.orchestrationName ??
      this.resolveDefaultOrchestrationName(agentDefinition);

    if (!requestedName) {
      throw new Error(
        'No orchestration name provided and no default orchestrations configured',
      );
    }

    return this.definitionService.getDefinitionForExecution({
      ownerAgentSlug: agentDefinition.slug,
      organizationSlug: agentDefinition.organizationSlug || 'global',
      name: requestedName,
      version: startPayload.orchestrationVersion,
    });
  }

  private resolveDefaultOrchestrationName(
    agentDefinition: AgentRuntimeDefinition,
  ): string | null {
    const configRecord = this.asRecord(agentDefinition.config);
    const contextRecord = this.asRecord(agentDefinition.context);
    const orchestrationConfig =
      this.asRecord(configRecord?.orchestration) ??
      this.asRecord(contextRecord?.orchestration);

    const available = this.ensureStringArray(
      orchestrationConfig?.available_orchestrations,
    );
    return available && available.length > 0 ? (available[0] ?? null) : null;
  }

  private async resumeAfterApproval(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    payload: OrchestratorResumePayload,
  ): Promise<TaskResponseDto> {
    if (!payload.approvalId) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'approvalId is required to resume orchestration',
      );
    }

    const actorId =
      payload.actorId ??
      (request.metadata?.actorId as string | undefined) ??
      (request.metadata?.userId as string | undefined) ??
      null;

    const resolution = await this.checkpointService.resolveCheckpoint({
      approvalId: payload.approvalId,
      decision: payload.decision,
      actorId,
      notes: payload.notes ?? null,
      modifications: (payload.modifications ?? undefined) as JsonObject | undefined,
    });

    if (resolution.decision === 'abort') {
      return TaskResponseDto.success(AgentTaskMode.BUILD, {
        content: {
          orchestrationRunId: resolution.run.id,
          status: resolution.run.status,
        },
        metadata: {
          orchestrationDefinitionId: resolution.run.orchestration_definition_id,
          ownerAgentSlug: definition.slug,
        },
      });
    }

    const concurrencyLimit = this.executionService.getConcurrencyLimit(
      resolution.run,
    );
    const { run: resumedRun, readySteps } =
      await this.executionService.startExecution(resolution.run.id, {
        maxParallel: concurrencyLimit,
      });
    const allSteps = await this.orchestrationRunner.listSteps(resumedRun.id);

    if (readySteps.length > 0) {
      this.stepExecutor
        .processRun(resumedRun.id)
        .catch((err) =>
          this.logger.error(
            `Failed to continue orchestration run ${resumedRun.id}: ${err instanceof Error ? err.message : err}`,
          ),
        );
    }

    return this.buildRunSuccessResponse(
      resumedRun,
      allSteps,
      readySteps,
      resumedRun.orchestration_definition_id,
      definition.slug,
    );
  }

  private buildRunSuccessResponse(
    run: Awaited<
      ReturnType<OrchestrationExecutionService['startExecution']>
    >['run'],
    steps: Awaited<ReturnType<OrchestrationRunnerService['listSteps']>>,
    readySteps: Awaited<
      ReturnType<OrchestrationExecutionService['startExecution']>
    >['readySteps'],
    orchestrationDefinitionId: string | null,
    ownerAgentSlug: string,
  ): TaskResponseDto {
    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        orchestrationRunId: run.id,
        status: run.status,
        steps: steps.map((step) => ({
          id: step.step_id,
          index: step.step_index,
          status: step.status,
          agent: step.agent_slug,
          mode: step.mode,
          type:
            ((step.metadata as Record<string, unknown> | undefined)
              ?.type as string) ?? 'agent',
          dependsOn: step.depends_on,
        })),
        readySteps: readySteps.map((step) => ({
          id: step.step_id,
          index: step.step_index,
          agent: step.agent_slug,
          mode: step.mode,
          type:
            ((step.metadata as Record<string, unknown> | undefined)
              ?.type as string) ?? 'agent',
        })),
      },
      metadata: {
        orchestrationDefinitionId,
        ownerAgentSlug,
        orchestrationRunId: run.id,
        streamId: run.id,
        streaming: {
          streamId: run.id,
          streamSource: 'orchestration',
        },
      },
    });
  }

  public buildAwaitingApprovalResponse(options: {
    run: OrchestrationRunRecord;
    approvalId: string;
    question: string;
    checkpointId: string;
    step?: {
      definitionId?: string | null;
      label?: string | null;
      index?: number | null;
    };
    choices?: Array<{
      action: OrchestrationCheckpointDecision;
      label: string;
      allowsModification?: boolean;
      description?: string;
    }>;
  }): TaskResponseDto {
    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        orchestrationRunId: options.run.id,
        status: 'awaiting_approval',
        approvalId: options.approvalId,
        checkpointId: options.checkpointId,
        question: options.question,
        step: options.step ?? null,
        options: options.choices ?? [],
      },
      metadata: {
        orchestrationDefinitionId: options.run.orchestration_definition_id,
        ownerAgentSlug: options.run.metadata?.agent?.slug ?? null,
        orchestrationRunId: options.run.id,
        streamId: options.run.id,
        streaming: {
          streamId: options.run.id,
          streamSource: 'orchestration',
        },
      },
    });
  }

  private resolveTaskLink(
    request: TaskRequestDto,
  ): { id: string | null; userId: string | null } | null {
    const metadata = request.metadata ?? {};
    const payloadTaskId = this.asString(request.payload?.taskId);
    const metadataTaskId =
      this.asString(metadata.taskId) ?? this.asString(metadata.id);
    const id = metadataTaskId ?? payloadTaskId ?? null;
    const userId =
      this.asString(metadata.userId) ??
      this.asString(metadata.createdBy) ??
      this.asString(metadata.actorId);

    if (!id && !userId) {
      return null;
    }

    return {
      id,
      userId: userId ?? null,
    };
  }

  private extractRequestMetadata(
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }

    const allowedKeys = [
      'taskId',
      'userId',
      'createdBy',
      'actorId',
      'sessionId',
      'streamId',
      'requestId',
    ];

    const result: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (metadata[key] !== undefined) {
        const value: unknown = metadata[key];
        result[key] = value;
      }
    }

    return result;
  }

  private mergeRunMetadata(
    existing: Record<string, unknown> | undefined,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    const base = { ...(existing ?? {}) };
    const existingStats =
      (base.stats as Record<string, unknown> | undefined) ?? {};
    const patchStats =
      (patch.stats as Record<string, unknown> | undefined) ?? undefined;

    const merged: Record<string, unknown> = {
      ...base,
      ...patch,
    };

    if (patchStats) {
      merged.stats = {
        ...existingStats,
        ...patchStats,
      };
    } else if (Object.keys(existingStats).length > 0 && !merged.stats) {
      merged.stats = existingStats;
    }

    return merged;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private ensureStringArray(value: unknown): string[] | null {
    if (!value) {
      return null;
    }

    if (Array.isArray(value)) {
      const sanitized = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
        .filter((entry): entry is string => Boolean(entry));
      return sanitized.length ? sanitized : null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : null;
    }

    return null;
  }

  private asString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return undefined;
  }
}
