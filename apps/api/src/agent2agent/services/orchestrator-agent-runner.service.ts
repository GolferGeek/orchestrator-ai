import { Injectable, Logger } from '@nestjs/common';
import { BaseAgentRunner } from './base-agent-runner.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { OrchestrationDefinitionService } from '@agent-platform/services/orchestration-definition.service';
import { OrchestrationStateService } from '@agent-platform/services/orchestration-state.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { OrchestrationExecutionService } from '@agent-platform/services/orchestration-execution.service';
import {
  OrchestrationCheckpointService,
  OrchestrationCheckpointDecision,
} from '@agent-platform/services/orchestration-checkpoint.service';
import { OrchestrationResolvedDefinition } from '@agent-platform/types/orchestration-definition.types';
import { OrchestrationRunRecord } from '@agent-platform/interfaces/orchestration-run-record.interface';
import { OrchestrationEventsService } from '@agent-platform/services/orchestration-events.service';
import { OrchestrationStepExecutorService } from './orchestration-step-executor.service';

interface OrchestratorStartPayload {
  orchestrationDefinitionId?: string;
  orchestrationName?: string;
  orchestrationVersion?: string;
  parameters?: Record<string, any>;
  action?: undefined;
}

interface OrchestratorResumePayload {
  action: 'resume_after_approval';
  approvalId: string;
  decision: OrchestrationCheckpointDecision;
  notes?: string | null;
  modifications?: Record<string, any> | null;
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
    private readonly stepExecutor: OrchestrationStepExecutorService,
  ) {
    super();
  }

  protected async handleConverse(
    _definition: AgentRuntimeDefinition,
    _request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.failure(
      AgentTaskMode.CONVERSE,
      'Orchestrator agents do not support CONVERSE mode yet',
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
      this.logger.error(
        `Failed to generate orchestration plan: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  protected async handleBuild(
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
        (request.metadata ?? {}) as Record<string, any> | undefined,
      );

      const runRecord = await this.orchestrationRunner.startRun({
        planId: request.planId ?? null,
        orchestrationDefinitionId: resolvedDefinition.recordId ?? null,
        orchestrationName: resolvedDefinition.name,
        conversationId: request.conversationId ?? null,
        parentOrchestrationRunId: request.orchestrationRunId ?? null,
        organizationSlug:
          resolvedDefinition.organizationSlug ?? definition.organizationSlug,
        parameters: runtimeParameters,
        plan: {
          name: resolvedDefinition.name,
          steps: resolvedDefinition.steps.map((step) => ({
            id: step.id,
            agent: step.agent,
            mode: step.mode ?? 'BUILD',
          })),
        },
        agentId: definition.record.id ?? null,
        agentSlug: definition.slug,
        agentType: definition.agentType,
        agentDisplayName: definition.displayName ?? null,
        createdBy: this.asString(request.metadata?.userId) ?? null,
        metadata: {
          triggeredByAgent: definition.slug,
          agent: this.buildAgentMetadata(definition),
          requestMetadata,
          ...(taskLink ? { task: taskLink } : {}),
        },
      });

      const createdSteps = await this.stateService.initializeRun(
        runRecord,
        resolvedDefinition,
        runtimeParameters,
      );

      const planningRun = await this.orchestrationRunner.updateRun({
        runId: runRecord.id,
        status: 'planning',
        currentStepIndex: createdSteps[0]?.step_index ?? 0,
        currentStepId: createdSteps[0]?.step_id ?? null,
        metadata: this.mergeRunMetadata(runRecord.metadata, {
          lifecycle: 'initialized',
          stats: {
            totalSteps: createdSteps.length,
            completedSteps: 0,
            progressPercentage: createdSteps.length > 0 ? 0 : null,
          },
        }),
      });

      this.orchestrationEvents.emitRunCreated(planningRun, {
        totalSteps: createdSteps.length,
      });

      const { run: executionRun, readySteps } =
        await this.executionService.startExecution(planningRun.id);
      const allSteps = await this.orchestrationRunner.listSteps(
        executionRun.id,
      );

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
      this.logger.error(
        `Failed to initialize orchestration run: ${
          error instanceof Error ? error.message : error
        }`,
      );
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
    const orchestrationConfig =
      agentDefinition.config?.orchestration ||
      agentDefinition.context?.orchestration ||
      {};
    const available: string[] =
      orchestrationConfig.available_orchestrations || [];
    return available.length > 0 ? (available[0] ?? null) : null;
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
      modifications: payload.modifications ?? undefined,
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

    const { run: resumedRun, readySteps } =
      await this.executionService.startExecution(resolution.run.id);
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
          dependsOn: step.depends_on,
        })),
        readySteps: readySteps.map((step) => ({
          id: step.step_id,
          index: step.step_index,
          agent: step.agent_slug,
          mode: step.mode,
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

  private buildAgentMetadata(
    definition: AgentRuntimeDefinition,
  ): Record<string, any> {
    return {
      id: definition.record.id ?? null,
      slug: definition.slug,
      type: definition.agentType ?? null,
      displayName: definition.displayName ?? null,
      organizationSlug: definition.organizationSlug ?? null,
    };
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
    metadata?: Record<string, any>,
  ): Record<string, any> {
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

    const result: Record<string, any> = {};
    for (const key of allowedKeys) {
      if (metadata[key] !== undefined) {
        result[key] = metadata[key];
      }
    }

    return result;
  }

  private mergeRunMetadata(
    existing: Record<string, any> | undefined,
    patch: Record<string, any>,
  ): Record<string, any> {
    const base = { ...(existing ?? {}) };
    const existingStats = (base.stats as Record<string, any> | undefined) ?? {};
    const patchStats =
      (patch.stats as Record<string, any> | undefined) ?? undefined;

    const merged: Record<string, any> = {
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

  private asString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return undefined;
  }
}
