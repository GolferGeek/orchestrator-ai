import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { OrchestrationRunsRepository } from '../repositories/orchestration-runs.repository';
import {
  HumanApprovalsRepository,
  HumanApprovalRecord,
  HumanApprovalListOptions,
} from '../repositories/human-approvals.repository';
import { OrchestrationEventsService } from './orchestration-events.service';
import { OrchestrationStatusService } from './orchestration-status.service';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationCheckpointService } from './orchestration-checkpoint.service';
import { OrchestrationDefinitionService } from './orchestration-definition.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../interfaces/orchestration-step-record.interface';
import {
  OrchestrationApprovalListResult,
  OrchestrationApprovalListItem,
  OrchestrationApprovalView,
  OrchestrationDashboardListResult,
  OrchestrationReplayContext,
  OrchestrationRunDetail,
  OrchestrationRunSummary,
} from '../types/orchestration-dashboard.types';
import { OrchestrationExecutionService } from './orchestration-execution.service';
import { OrchestrationStepExecutorService } from '@/agent2agent/services/orchestration-step-executor.service';
import type {
  OrchestrationCheckpointDecision,
  OrchestrationCheckpointMetadata,
  OrchestrationRunMetadata,
  OrchestrationStepState,
  OrchestrationStepStateEntry,
} from '../types/orchestration-run.types';

export interface OrchestrationDashboardListOptions {
  organizationSlug?: string | null;
  lifecycle?: 'active' | 'completed' | 'all';
  search?: string;
  definitionId?: string | null;
  parentRunId?: string | null;
  limit?: number;
  offset?: number;
  startedAfter?: string;
  startedBefore?: string;
}

export interface OrchestrationApprovalQueryOptions {
  organizationSlug?: string | null;
  status?: 'pending' | 'approved' | 'rejected';
  statuses?: Array<'pending' | 'approved' | 'rejected'>;
  limit?: number;
  offset?: number;
  sortDirection?: 'asc' | 'desc';
}

export interface OrchestrationRunDetailOptions {
  approvalLimit?: number;
  childLimit?: number;
}

export interface ResolveOrchestrationApprovalOptions {
  approvalId: string;
  decision: OrchestrationCheckpointDecision;
  actorId?: string | null;
  notes?: string | null;
  modifications?: Record<string, any>;
}

export interface ManualRetryOptions {
  runId: string;
  stepRecordId?: string;
  delaySeconds?: number;
  modifications?: Record<string, any>;
  note?: string | null;
  actorId?: string | null;
}

export interface ManualSkipOptions {
  runId: string;
  stepRecordId?: string;
  note?: string | null;
  replacementOutput?: Record<string, any> | null;
  actorId?: string | null;
}

export interface ManualAbortOptions {
  runId: string;
  note?: string | null;
  actorId?: string | null;
}

@Injectable()
export class OrchestrationDashboardService {
  private readonly logger = new Logger(OrchestrationDashboardService.name);
  private readonly activeStatuses = [
    'pending',
    'planning',
    'running',
    'checkpoint',
  ];
  private readonly completedStatuses = [
    'completed',
    'failed',
    'cancelled',
    'canceled',
    'aborted',
  ];

  constructor(
    private readonly runsRepository: OrchestrationRunsRepository,
    private readonly approvalsRepository: HumanApprovalsRepository,
    private readonly events: OrchestrationEventsService,
    private readonly statusService: OrchestrationStatusService,
    private readonly runner: OrchestrationRunnerService,
    private readonly checkpointService: OrchestrationCheckpointService,
    private readonly definitionService: OrchestrationDefinitionService,
    private readonly execution: OrchestrationExecutionService,
    @Inject(forwardRef(() => OrchestrationStepExecutorService))
    private readonly stepExecutor: OrchestrationStepExecutorService,
  ) {}

  async listRuns(
    options: OrchestrationDashboardListOptions = {},
  ): Promise<OrchestrationDashboardListResult> {
    const statuses = this.resolveLifecycleStatuses(options.lifecycle);

    const listOptions = {
      organizationSlug: options.organizationSlug,
      statuses,
      definitionId: options.definitionId ?? undefined,
      parentRunId: options.parentRunId ?? undefined,
      search: options.search,
      limit: options.limit,
      offset: options.offset,
      startedAfter: options.startedAfter,
      startedBefore: options.startedBefore,
      sortBy: 'created_at' as const,
      sortDirection: 'desc' as const,
    };

    const { data, count, limit, offset } =
      await this.runsRepository.list(listOptions);

    const runIds = data.map((run) => run.id);
    const pendingCounts =
      await this.approvalsRepository.countPendingByRunIds(runIds);

    const items = data.map((run) =>
      this.buildRunSummary(run, pendingCounts[run.id] ?? 0),
    );

    const total = count ?? items.length;
    const hasMore =
      total !== null
        ? offset + items.length < total
        : items.length === limit;

    return {
      items,
      total,
      limit,
      offset,
      hasMore,
    };
  }

  async getRunDetail(
    runId: string,
    options: OrchestrationRunDetailOptions = {},
  ): Promise<OrchestrationRunDetail | null> {
    const [status, runRecord] = await Promise.all([
      this.statusService.getRunStatus(runId),
      this.runner.getRun(runId),
    ]);

    if (!status || !runRecord) {
      return null;
    }

    const childLimit = options.childLimit ?? 20;
    const childRuns = await this.runsRepository.list({
      parentRunId: runId,
      limit: childLimit,
      sortBy: 'created_at',
      sortDirection: 'desc',
    });
    const childPending =
      await this.approvalsRepository.countPendingByRunIds(
        childRuns.data.map((child) => child.id),
      );

    const childSummaries = childRuns.data.map((child) =>
      this.buildRunSummary(child, childPending[child.id] ?? 0),
    );

    let parentSummary: OrchestrationRunSummary | null = null;
    if (runRecord.parent_orchestration_run_id) {
      const parent =
        await this.runner.getRun(runRecord.parent_orchestration_run_id);
      if (parent) {
        const parentCounts =
          await this.approvalsRepository.countPendingByRunIds([parent.id]);
        parentSummary = this.buildRunSummary(
          parent,
          parentCounts[parent.id] ?? 0,
        );
      }
    }

    const approvals = await this.approvalsRepository.list({
      orchestrationRunId: runId,
      statuses: ['pending', 'approved', 'rejected'],
      limit: options.approvalLimit ?? 200,
      offset: 0,
      sortBy: 'created_at',
      sortDirection: 'desc',
    });

    const approvalViews = approvals.data.map((record) =>
      this.buildApprovalView(record),
    );

    return {
      run: status.run,
      steps: status.steps,
      currentStep: status.currentStep,
      summary: status.summary,
      pendingApprovals: status.pendingApprovals,
      approvals: {
        items: approvalViews,
        total: approvals.count ?? approvalViews.length,
      },
      relatedRuns: {
        parent: parentSummary,
        children: childSummaries,
      },
      metadata: {
        latestCheckpoint: this.extractLatestCheckpoint(runRecord),
      },
    };
  }

  async listApprovals(
    options: OrchestrationApprovalQueryOptions = {},
  ): Promise<OrchestrationApprovalListResult> {
    const repoOptions: HumanApprovalListOptions = {
      organizationSlug: options.organizationSlug,
      status: options.status,
      statuses: options.statuses,
      mode: 'orchestration_checkpoint',
      limit: options.limit,
      offset: options.offset,
      sortBy: 'created_at',
      sortDirection: options.sortDirection ?? 'desc',
    };

    const { data, count, limit, offset } =
      await this.approvalsRepository.list(repoOptions);

    const runIds = Array.from(
      new Set(
        data
          .map((record) => record.orchestration_run_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const runs = runIds.length
      ? await this.runsRepository.listByIds(runIds)
      : [];

    const pendingCounts =
      await this.approvalsRepository.countPendingByRunIds(runIds);

    const runLookup = new Map(runs.map((run) => [run.id, run]));

    const items: OrchestrationApprovalListItem[] = data.map((record) => {
      const runId = record.orchestration_run_id;
      const runRecord = runId ? runLookup.get(runId) ?? null : null;
      return {
        approval: this.buildApprovalView(record),
        run:
          runRecord !== null
            ? this.buildRunSummary(
                runRecord,
                runId ? pendingCounts[runId] ?? 0 : 0,
              )
            : null,
      };
    });

    const total = count ?? items.length;
    const hasMore =
      total !== null
        ? offset + items.length < total
        : items.length === limit;

    return {
      items,
      total,
      limit,
      offset,
      hasMore,
    };
  }

  async resolveApproval(
    options: ResolveOrchestrationApprovalOptions,
  ): Promise<{
    approval: OrchestrationApprovalView;
    run: OrchestrationRunSummary;
  }> {
    const result = await this.checkpointService.resolveCheckpoint({
      approvalId: options.approvalId,
      decision: options.decision,
      actorId: options.actorId ?? null,
      notes: options.notes ?? null,
      modifications: options.modifications,
    });

    const pendingCounts =
      await this.approvalsRepository.countPendingByRunIds([
        result.run.id,
      ]);

    return {
      approval: this.buildApprovalView(result.approval),
      run: this.buildRunSummary(
        result.run,
        pendingCounts[result.run.id] ?? 0,
      ),
    };
  }

  async retryStep(
    options: ManualRetryOptions,
  ): Promise<OrchestrationRunSummary> {
    const now = new Date();
    const run = await this.runner.getRun(options.runId);
    if (!run) {
      throw new NotFoundException(
        `Orchestration run ${options.runId} could not be found`,
      );
    }

    const step = await this.resolveTargetStep(run.id, options.stepRecordId);
    if (!step) {
      throw new BadRequestException(
        'No failed step available to retry for this run',
      );
    }

    if (step.status !== 'failed') {
      throw new BadRequestException(
        `Step ${step.step_id ?? step.id} is not in a failed state`,
      );
    }

    const delaySeconds = Math.max(0, options.delaySeconds ?? 0);
    const delayMs = delaySeconds * 1000;
    const nextAttempt = step.attempt_number + 1;
    const scheduledAt =
      delayMs > 0 ? new Date(now.getTime() + delayMs).toISOString() : null;

    const metadata = this.mergeStepMetadata(
      step.metadata as Record<string, any> | undefined,
      {},
    );
    const runtime = this.asRecord(metadata.runtime) ?? {};
    const retryRuntime = this.asRecord(runtime.retry) ?? {};

    const history = Array.isArray(retryRuntime.history)
      ? [...retryRuntime.history]
      : [];
    history.push({
      attempt: step.attempt_number,
      failedAt: step.completed_at ?? now.toISOString(),
      manual: true,
      requestedAt: now.toISOString(),
      requestedBy: options.actorId ?? null,
      scheduledFor: scheduledAt,
      note: options.note ?? null,
    });

    retryRuntime.history = history;
    retryRuntime.nextRetryAt = scheduledAt;
    retryRuntime.lastError = step.error_details ?? {};
    retryRuntime.attempt = nextAttempt;
    retryRuntime.manual = true;
    retryRuntime.requestedAt = now.toISOString();
    retryRuntime.requestedBy = options.actorId ?? null;
    if (typeof retryRuntime.maxAttempts !== 'number') {
      retryRuntime.maxAttempts =
        this.resolveConfiguredMaxAttempts(
          metadata,
          step.metadata as Record<string, any> | undefined,
        ) ?? nextAttempt;
    }

    runtime.retry = retryRuntime;
    metadata.runtime = runtime;
    if (options.note) {
      metadata.lastManualNote = options.note;
    }

    const mergedInput = this.mergeRecords(
      step.input ?? {},
      options.modifications ?? {},
    );

    await this.runner.updateStep(step.id, {
      status: 'pending',
      attempt_number: nextAttempt,
      metadata,
      input: mergedInput,
      started_at: null,
      completed_at: null,
      deliverable_id: null,
      output: null,
    });

    const stepState = this.updateStepStateEntry(
      run.step_state ?? {},
      step.step_id ?? step.id,
      {
        status: 'pending',
        attemptNumber: nextAttempt,
        metadata: {
          manualRetry: {
            requestedAt: now.toISOString(),
            requestedBy: options.actorId ?? null,
            delaySeconds,
            note: options.note ?? null,
          },
        },
      },
    );

    const updatedRun = await this.runner.updateRun({
      runId: run.id,
      status: 'running',
      currentStepIndex: step.step_index,
      currentStepId: step.step_id ?? step.id,
      stepState,
      humanCheckpointId: null,
      metadata: this.mergeRunMetadata(run.metadata, {
        manualRecovery: {
          lastAction: 'retry',
          requestedAt: now.toISOString(),
          requestedBy: options.actorId ?? null,
          stepId: step.step_id ?? step.id,
          delaySeconds,
          note: options.note ?? null,
        },
      }),
      completedAt: null,
    });

    if (delayMs > 0) {
      setTimeout(() => {
        this.stepExecutor
          .processRun(run.id)
          .catch((error) =>
            this.logger.error(
              `Failed to resume orchestration run ${run.id} after manual retry delay: ${error instanceof Error ? error.message : String(
                error,
              )}`,
            ),
          );
      }, delayMs);
    } else {
      this.stepExecutor
        .processRun(run.id)
        .catch((error) =>
          this.logger.error(
            `Failed to resume orchestration run ${run.id} after manual retry: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
    }

    const pendingCounts =
      await this.approvalsRepository.countPendingByRunIds([updatedRun.id]);

    return this.buildRunSummary(
      updatedRun,
      pendingCounts[updatedRun.id] ?? 0,
    );
  }

  async skipStep(
    options: ManualSkipOptions,
  ): Promise<OrchestrationRunSummary> {
    const now = new Date().toISOString();
    const run = await this.runner.getRun(options.runId);
    if (!run) {
      throw new NotFoundException(
        `Orchestration run ${options.runId} could not be found`,
      );
    }

    const step = await this.resolveTargetStep(run.id, options.stepRecordId);
    if (!step) {
      throw new BadRequestException(
        'No target step available to skip for this run',
      );
    }

    if (step.status === 'completed') {
      throw new BadRequestException(
        `Step ${step.step_id ?? step.id} is already completed`,
      );
    }

    const behavior = this.asRecord(
      (step.metadata as Record<string, any> | undefined)?.behavior,
    );
    const retryBehavior = this.asRecord(behavior?.retry);
    if (retryBehavior && retryBehavior.allowSkip === false) {
      throw new BadRequestException(
        `Step ${step.step_id ?? step.id} does not allow skipping`,
      );
    }

    const metadata = this.mergeStepMetadata(
      step.metadata as Record<string, any> | undefined,
      {},
    );
    metadata.runtime = {
      ...(metadata.runtime ?? {}),
      skip: {
        manual: true,
        requestedAt: now,
        requestedBy: options.actorId ?? null,
        note: options.note ?? null,
      },
    };

    const output =
      options.replacementOutput && Object.keys(options.replacementOutput).length
        ? this.cloneRecord(options.replacementOutput)
        : { skipped: true };

    const completion = await this.execution.markStepCompleted(
      step.id,
      output,
      {
        metadata,
        deliverable_id: null,
      },
    );

    this.stepExecutor
      .processRun(run.id)
      .catch((error) =>
        this.logger.error(
          `Failed to continue orchestration run ${run.id} after manual skip: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );

    const pendingCounts =
      await this.approvalsRepository.countPendingByRunIds([
        completion.run.id,
      ]);

    return this.buildRunSummary(
      completion.run,
      pendingCounts[completion.run.id] ?? 0,
    );
  }

  async abortRun(
    options: ManualAbortOptions,
  ): Promise<OrchestrationRunSummary> {
    const now = new Date().toISOString();
    const run = await this.runner.getRun(options.runId);
    if (!run) {
      throw new NotFoundException(
        `Orchestration run ${options.runId} could not be found`,
      );
    }

    const stepState = { ...(run.step_state ?? {}) };
    const currentStepKey =
      typeof run.current_step_id === 'string' ? run.current_step_id : null;
    if (currentStepKey) {
      stepState[currentStepKey] = {
        ...(stepState[currentStepKey] ?? {}),
        status: 'aborted',
        metadata: {
          ...(this.asRecord(stepState[currentStepKey]?.metadata) ?? {}),
          manualAbort: {
            requestedAt: now,
            requestedBy: options.actorId ?? null,
            note: options.note ?? null,
          },
        },
      };
    }

    const updatedRun = await this.runner.updateRun({
      runId: run.id,
      status: 'aborted',
      stepState,
      humanCheckpointId: null,
      metadata: this.mergeRunMetadata(run.metadata, {
        manualRecovery: {
          lastAction: 'abort',
          requestedAt: now,
          requestedBy: options.actorId ?? null,
          note: options.note ?? null,
        },
      }),
      completedAt: now,
    });

    this.events.emitRunFailed(
      updatedRun,
      {
        type: 'manual_abort',
        note: options.note ?? null,
      },
      {
        totalSteps: updatedRun.completed_steps?.length ?? 0,
      },
    );

    const pendingCounts =
      await this.approvalsRepository.countPendingByRunIds([
        updatedRun.id,
      ]);

    return this.buildRunSummary(
      updatedRun,
      pendingCounts[updatedRun.id] ?? 0,
    );
  }

  async getReplayContext(
    runId: string,
  ): Promise<OrchestrationReplayContext | null> {
    const run = await this.runner.getRun(runId);
    if (!run) {
      return null;
    }

    const metadata = (run.metadata ?? {}) as Record<string, any>;
    const agentMetadata =
      (metadata.agent as Record<string, any> | undefined) ?? {};

    const definition =
      run.orchestration_definition_id !== null
        ? await this.definitionService.getDefinitionById(
            run.orchestration_definition_id,
          )
        : null;

    return {
      runId: run.id,
      organizationSlug: run.organization_slug ?? null,
      conversationId: run.conversation_id ?? null,
      definition: {
        id: run.orchestration_definition_id,
        name: definition?.name ?? run.orchestration_name ?? null,
        displayName: definition?.displayName ?? null,
        version: definition?.version ?? null,
        ownerAgentSlug: definition?.ownerAgentSlug ?? null,
      },
      agent: {
        id: this.asString(agentMetadata.id),
        slug: this.asString(agentMetadata.slug),
        displayName: this.asString(agentMetadata.displayName),
        type: this.asString(agentMetadata.type),
      },
      parameters: this.cloneRecord(run.parameters ?? {}),
      plan: this.cloneRecord(run.plan ?? {}),
      results: this.cloneRecord(run.results ?? {}),
      metadata: this.cloneRecord(metadata),
      origin: {
        type: run.origin_type ?? null,
        id: run.origin_id ?? null,
        slug: run.orchestration_slug ?? null,
      },
      timestamps: {
        createdAt: run.created_at,
        startedAt: run.started_at ?? null,
        completedAt: run.completed_at ?? null,
      },
    };
  }

  private resolveLifecycleStatuses(
    lifecycle: 'active' | 'completed' | 'all' | undefined,
  ): string[] | undefined {
    if (!lifecycle || lifecycle === 'all') {
      return undefined;
    }
    if (lifecycle === 'active') {
      return this.activeStatuses;
    }
    return this.completedStatuses;
  }

  private buildRunSummary(
    run: OrchestrationRunRecord,
    pendingApprovals: number,
  ): OrchestrationRunSummary {
    const snapshot = this.events.snapshotRun(run);
    return {
      id: snapshot.id,
      status: snapshot.status,
      name: snapshot.name,
      definitionId: snapshot.definitionId,
      planId: snapshot.planId,
      parentRunId: snapshot.parentRunId,
      organizationSlug: snapshot.organizationSlug,
      orchestrationSlug: run.orchestration_slug ?? null,
      originType: run.origin_type ?? null,
      originId: run.origin_id ?? null,
      agent: snapshot.agent,
      stats: snapshot.stats,
      timings: snapshot.timings,
      currentStepId: snapshot.currentStepId,
      currentStepIndex: snapshot.currentStepIndex,
      pendingApprovals,
      latestCheckpoint: this.extractLatestCheckpoint(run),
    };
  }

  private buildApprovalView(
    record: HumanApprovalRecord,
  ): OrchestrationApprovalView {
    const metadata = ((record.metadata ?? {}) as Record<string, any>) || null;
    const decision =
      (metadata?.decision as Record<string, any> | undefined) ?? undefined;

    return {
      id: record.id,
      status: record.status,
      mode: record.mode,
      runId: record.orchestration_run_id ?? null,
      stepId: record.orchestration_step_id ?? null,
      organizationSlug: record.organization_slug ?? null,
      agentSlug: record.agent_slug,
      conversationId: record.conversation_id ?? null,
      createdAt: record.created_at ?? null,
      updatedAt: record.updated_at ?? null,
      decisionAt:
        decision?.decidedAt ??
        decision?.decided_at ??
        record.decision_at ??
        null,
      decisionBy:
        decision?.decidedBy ??
        decision?.decided_by ??
        record.approved_by ??
        null,
      metadata,
    };
  }

  private extractLatestCheckpoint(
    run: OrchestrationRunRecord,
  ): OrchestrationRunSummary['latestCheckpoint'] {
    const metadata = (run.metadata ?? {}) as Record<string, any>;
    const checkpoint =
      (metadata.lastCheckpoint as Record<string, any> | undefined) ?? undefined;
    if (!checkpoint) {
      return null;
    }

    const step =
      (checkpoint.step as Record<string, any> | undefined) ?? undefined;

    return {
      approvalId: this.asString(checkpoint.approvalId),
      checkpointId: this.asString(checkpoint.checkpointId),
      requestedAt: this.asString(checkpoint.requestedAt),
      stepLabel: this.asString(step?.label),
    };
  }

  private async resolveTargetStep(
    runId: string,
    stepRecordId?: string,
  ): Promise<OrchestrationStepRecord | null> {
    if (stepRecordId) {
      return this.runner.getStep(stepRecordId);
    }

    const steps = await this.runner.listSteps(runId);
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      if (steps[index]?.status === 'failed') {
        return steps[index] ?? null;
      }
    }
    return null;
  }

  private mergeStepMetadata(
    current: Record<string, any> | undefined,
    patch: Record<string, any>,
  ): Record<string, any> {
    const base =
      current && typeof current === 'object'
        ? this.cloneRecord(current)
        : {};
    this.mergeInto(base, patch);
    return base;
  }

  private resolveConfiguredMaxAttempts(
    metadata: Record<string, any>,
    original: Record<string, any> | undefined,
  ): number | null {
    const behavior = this.asRecord(metadata.behavior);
    const retry = this.asRecord(behavior?.retry);
    if (retry && typeof retry.maxAttempts === 'number') {
      return retry.maxAttempts;
    }

    const originalBehavior = this.asRecord(original?.behavior);
    const originalRetry = this.asRecord(originalBehavior?.retry);
    if (
      originalRetry &&
      typeof originalRetry.maxAttempts === 'number'
    ) {
      return originalRetry.maxAttempts;
    }

    return null;
  }

  private mergeRecords(
    base: Record<string, any> | undefined,
    patch: Record<string, any>,
  ): Record<string, any> {
    if (!patch || Object.keys(patch).length === 0) {
      return base ? this.cloneRecord(base) : {};
    }

    const target =
      base && typeof base === 'object' ? this.cloneRecord(base) : {};
    this.mergeInto(target, patch);
    return target;
  }

  private mergeRunMetadata(
    existing: Record<string, any> | undefined,
    patch: Record<string, any>,
  ): Record<string, any> {
    const base = { ...(existing ?? {}) };
    const mergeResult = { ...base, ...patch };

    if (patch.stats && base.stats) {
      mergeResult.stats = {
        ...base.stats,
        ...patch.stats,
      };
    }

    return mergeResult;
  }

  private updateStepStateEntry(
    current: Record<string, any>,
    key: string,
    entry: Record<string, any>,
  ): Record<string, any> {
    return {
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        ...entry,
      },
    };
  }

  private mergeInto(
    target: Record<string, any>,
    patch: Record<string, any>,
  ): void {
    Object.entries(patch).forEach(([key, value]) => {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.mergeInto(target[key], value);
      } else {
        target[key] = value;
      }
    });
  }

  private asRecord(value: unknown): Record<string, any> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return { ...(value as Record<string, any>) };
  }

  private asString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return null;
  }

  private cloneRecord(source: Record<string, any>): Record<string, any> {
    try {
      return JSON.parse(JSON.stringify(source));
    } catch (_error) {
      return {};
    }
  }
}
