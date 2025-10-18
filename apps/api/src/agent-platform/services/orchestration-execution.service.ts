import { Injectable, Logger } from '@nestjs/common';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationStateService } from './orchestration-state.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import {
  OrchestrationStepRecord,
  OrchestrationStepUpdateInput,
} from '../interfaces/orchestration-step-record.interface';
import { OrchestrationEventsService } from './orchestration-events.service';
import { OrchestrationMetricsService } from './orchestration-metrics.service';
import type { JsonObject } from '@orchestrator-ai/transport-types';
import type {
  OrchestrationRunMetadata,
  OrchestrationStepState,
  OrchestrationStepStateEntry,
} from '../types/orchestration-run.types';

interface StepFailureOptions {
  allowRetry?: boolean;
  retryAt?: string | null;
}

@Injectable()
export class OrchestrationExecutionService {
  private readonly logger = new Logger(OrchestrationExecutionService.name);

  constructor(
    private readonly orchestrationRunner: OrchestrationRunnerService,
    private readonly stateService: OrchestrationStateService,
    private readonly events: OrchestrationEventsService,
    private readonly metrics: OrchestrationMetricsService,
  ) {}

  getConcurrencyLimit(run: OrchestrationRunRecord): number {
    const metadata = this.asRecord(run.metadata as JsonObject | undefined);
    const execution = this.asRecord(
      metadata?.execution as JsonObject | undefined,
    );
    const concurrency = this.asRecord(
      execution?.concurrency as JsonObject | undefined,
    );

    const configured = this.coercePositiveInteger(
      concurrency?.maxParallelSteps,
      concurrency?.max_parallel_steps,
      concurrency?.maxParallel,
      concurrency?.max_parallel,
    );
    if (configured !== null) {
      return configured;
    }

    const fallback = this.coercePositiveInteger(
      process.env.ORCHESTRATION_DEFAULT_MAX_PARALLEL,
      process.env.ORCHESTRATION_MAX_CONCURRENCY,
    );

    return fallback ?? 1;
  }

  /**
   * Begin execution by finding runnable steps and marking them as queued.
   * Returns updated run state and the steps ready for execution.
   */
  async startExecution(
    runId: string,
    options: { maxParallel?: number } = {},
  ): Promise<{
    run: OrchestrationRunRecord;
    readySteps: OrchestrationStepRecord[];
  }> {
    const run = await this.orchestrationRunner.getRun(runId);
    if (!run) {
      throw new Error(`Orchestration run ${runId} not found`);
    }

    const steps = await this.orchestrationRunner.listSteps(runId);
    const metrics = await this.gatherStepMetrics(runId, steps);
    const activeCount = steps.filter((step) =>
      ['running', 'queued'].includes(step.status),
    ).length;

    const maxParallel =
      typeof options.maxParallel === 'number'
        ? options.maxParallel
        : Number.POSITIVE_INFINITY;

    const availableSlots =
      Number.isFinite(maxParallel) && maxParallel >= 0
        ? Math.max(0, Math.floor(maxParallel) - activeCount)
        : steps.length;

    let readySteps: OrchestrationStepRecord[];
    if (availableSlots <= 0) {
      readySteps = [];
    } else {
      readySteps = await this.stateService.findRunnableSteps(runId, {
        steps,
        limit: Number.isFinite(maxParallel)
          ? Math.max(availableSlots, 0)
          : undefined,
      });
    }

    if (!readySteps.length && activeCount === 0) {
      const completedRun = await this.orchestrationRunner.updateRun({
        runId,
        status: 'completed',
        currentStepIndex: null,
        currentStepId: null,
        completedAt: new Date().toISOString(),
        metadata: this.mergeMetadata(run.metadata, {
          lifecycle: 'completed',
          stats: this.buildStats(metrics.total, metrics.completed),
        }),
      });
      this.events.emitRunCompleted(completedRun, {
        totalSteps: metrics.total,
      });
      this.metrics.recordRunCompleted(completedRun, 'completed');
      return { run: completedRun, readySteps: [] };
    }

    if (!readySteps.length) {
      return { run, readySteps: [] };
    }

    const now = new Date().toISOString();
    const queuedSteps = await Promise.all(
      readySteps.map((step) => {
        const metadata = this.cloneMetadata(
          step.metadata as JsonObject | undefined,
        );
        metadata.queuedAt = now;

        const runtime = this.asRecord(metadata.runtime);
        if (runtime?.retry) {
          const retryConfig = runtime.retry as Record<string, unknown>;
          runtime.retry = {
            ...retryConfig,
            nextRetryAt: null,
            lastQueuedAt: now,
          };
          metadata.runtime = runtime;
        }

        return this.orchestrationRunner.updateStep(step.id, {
          status: 'queued',
          metadata,
        });
      }),
    );

    const stepState = this.mergeStepState(
      run.step_state ?? {},
      queuedSteps.map((step) => ({
        key: this.resolveStepKey(step),
        state: {
          status: 'queued',
          metadata: { queuedAt: now },
        },
      })),
    );

    const updatedRun = await this.orchestrationRunner.updateRun({
      runId,
      status: 'running',
      currentStepIndex: queuedSteps[0]?.step_index ?? null,
      currentStepId: queuedSteps[0]
        ? this.resolveStepKey(queuedSteps[0])
        : null,
      stepState,
      metadata: this.mergeMetadata(run.metadata, {
        lifecycle: 'running',
        stats: this.buildStats(metrics.total, metrics.completed),
      }),
    });

    this.events.emitStepsQueued(updatedRun, queuedSteps, {
      totalSteps: metrics.total,
    });
    this.events.emitRunUpdated(
      updatedRun,
      {
        reason: 'execution_started',
        queuedStepIds: queuedSteps.map((step) => this.resolveStepKey(step)),
      },
      {
        totalSteps: metrics.total,
      },
    );

    return { run: updatedRun, readySteps: queuedSteps };
  }

  /**
   * Mark a step as running and update run metadata.
   */
  async markStepRunning(stepId: string): Promise<OrchestrationStepRecord> {
    const now = new Date().toISOString();
    const step = await this.orchestrationRunner.updateStep(stepId, {
      status: 'running',
      started_at: now,
    });

    const run = await this.ensureRun(step.orchestration_run_id);
    const stepState = this.mergeStepState(run.step_state ?? {}, [
      {
        key: this.resolveStepKey(step),
        state: {
          status: 'running',
          startedAt: now,
          attemptNumber: step.attempt_number,
        },
      },
    ]);

    const updatedRun = await this.orchestrationRunner.updateRun({
      runId: step.orchestration_run_id,
      status: 'running',
      currentStepIndex: step.step_index,
      currentStepId: this.resolveStepKey(step),
      stepState,
      metadata: this.mergeMetadata(run.metadata, {
        lifecycle: 'running',
        currentStep: this.resolveStepKey(step),
      }),
    });

    const queueDuration = this.computeQueueDuration(step);
    if (queueDuration !== null) {
      this.metrics.observeStepQueueDuration(updatedRun, step, queueDuration);
    }

    const totalSteps = this.extractTotalSteps(updatedRun.metadata) ?? undefined;

    this.events.emitStepRunning(
      updatedRun,
      step,
      totalSteps !== undefined ? { totalSteps } : undefined,
    );
    this.events.emitRunUpdated(
      updatedRun,
      {
        reason: 'step_running',
        stepId: this.resolveStepKey(step),
      },
      totalSteps !== undefined ? { totalSteps } : undefined,
    );

    return step;
  }

  /**
   * Mark step as completed, update run state, and return updated step/run.
   */
  async markStepCompleted(
    stepId: string,
    output: JsonObject | null,
    additional?: Partial<OrchestrationStepUpdateInput>,
  ): Promise<{
    step: OrchestrationStepRecord;
    run: OrchestrationRunRecord;
    nextSteps: OrchestrationStepRecord[];
  }> {
    const now = new Date().toISOString();
    const step = await this.orchestrationRunner.updateStep(stepId, {
      status: 'completed',
      output: output ?? null,
      completed_at: now,
      ...additional,
    });

    const run = await this.ensureRun(step.orchestration_run_id);
    const allSteps = await this.orchestrationRunner.listSteps(
      step.orchestration_run_id,
    );
    const completedSteps = allSteps
      .filter((item) => item.status === 'completed')
      .map((item) => this.resolveStepKey(item));

    const totalSteps = allSteps.length;
    const completedCount = completedSteps.length;

    const stepState = this.mergeStepState(run.step_state ?? {}, [
      {
        key: this.resolveStepKey(step),
        state: {
          status: 'completed',
          completedAt: now,
          metadata: {
            ...(step.metadata ?? {}),
            outputPreview: output ? Object.keys(output) : [],
          },
        },
      },
    ]);

    const runStatus =
      completedSteps.length === allSteps.length ? 'completed' : 'running';

    const updatedRun = await this.orchestrationRunner.updateRun({
      runId: step.orchestration_run_id,
      status: runStatus,
      currentStepIndex:
        runStatus === 'completed' ? null : (run.current_step_index ?? null),
      currentStepId: runStatus === 'completed' ? null : run.current_step_id,
      completedSteps: completedSteps,
      stepState,
      results: this.mergeResults(
        run.results ?? {},
        this.resolveStepKey(step),
        output ?? {},
      ),
      metadata: this.mergeMetadata(run.metadata, {
        lastCompletedStep: this.resolveStepKey(step),
        stats: this.buildStats(totalSteps, completedCount),
      }),
      completedAt: runStatus === 'completed' ? now : undefined,
    });

    const nextSteps =
      runStatus === 'completed'
        ? []
        : await this.stateService.findRunnableSteps(step.orchestration_run_id);

    const context =
      totalSteps > 0
        ? {
            totalSteps,
          }
        : undefined;

    const stepDuration = this.computeStepDuration(step);
    if (stepDuration !== null) {
      this.metrics.observeStepDuration(
        updatedRun,
        step,
        stepDuration,
        'completed',
      );
    }

    this.events.emitStepCompleted(updatedRun, step, nextSteps, context);

    if (runStatus === 'completed') {
      this.events.emitRunCompleted(updatedRun, context);
    } else {
      this.events.emitRunUpdated(
        updatedRun,
        {
          reason: 'step_completed',
          stepId: this.resolveStepKey(step),
        },
        context,
      );
    }

    return { step, run: updatedRun, nextSteps };
  }

  /**
   * Mark step as failed and propagate failure to the run.
   */
  async markStepFailed(
    stepId: string,
    errorDetails: Record<string, unknown>,
    options: StepFailureOptions = {},
  ): Promise<{ step: OrchestrationStepRecord; run: OrchestrationRunRecord }> {
    const now = new Date().toISOString();
    const step = await this.orchestrationRunner.updateStep(stepId, {
      status: 'failed',
      error_details: errorDetails as JsonObject,
      completed_at: now,
    });

    const run = await this.ensureRun(step.orchestration_run_id);
    const metrics = await this.gatherStepMetrics(step.orchestration_run_id);
    const allowRetry = options.allowRetry === true;
    const stepState = this.mergeStepState(run.step_state ?? {}, [
      {
        key: this.resolveStepKey(step),
        state: {
          status: 'failed',
          completedAt: now,
          metadata: allowRetry
            ? ({
                ...errorDetails,
                retryAt: options.retryAt ?? null,
              } as JsonObject)
            : (errorDetails as JsonObject),
        },
      },
    ]);
    const retryMetadataPatch = allowRetry
      ? {
          retry: {
            scheduledAt: options.retryAt ?? null,
          },
        }
      : undefined;

    const updatedRun = await this.orchestrationRunner.updateRun({
      runId: step.orchestration_run_id,
      status: allowRetry ? 'running' : 'failed',
      currentStepIndex: step.step_index,
      currentStepId: this.resolveStepKey(step),
      stepState,
      metadata: this.mergeMetadata(run.metadata, {
        error_details: {
          ...(run.error_details ?? {}),
          lastError: errorDetails as JsonObject,
        } as JsonObject,
        lastFailedStep: this.resolveStepKey(step),
        stats: this.buildStats(metrics.total, metrics.completed),
        ...(retryMetadataPatch ?? {}),
      }),
      completedAt: allowRetry ? (run.completed_at ?? null) : now,
    });

    const failureDuration = this.computeStepDuration(step);
    if (failureDuration !== null) {
      this.metrics.observeStepDuration(
        updatedRun,
        step,
        failureDuration,
        'failed',
      );
    }

    if (!allowRetry) {
      this.metrics.recordRunCompleted(updatedRun, 'failed');
    }

    const context =
      metrics.total > 0
        ? {
            totalSteps: metrics.total,
          }
        : undefined;

    this.events.emitStepFailed(updatedRun, step, errorDetails, context);
    if (allowRetry) {
      this.events.emitRunUpdated(
        updatedRun,
        {
          reason: 'step_failed_retry_scheduled',
          stepId: this.resolveStepKey(step),
          nextRetryAt: options.retryAt ?? null,
        },
        context,
      );
    } else {
      this.events.emitRunFailed(updatedRun, errorDetails, context);
    }

    return { step, run: updatedRun };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async gatherStepMetrics(
    runId: string,
    steps?: OrchestrationStepRecord[],
  ): Promise<{
    total: number;
    completed: number;
  }> {
    const records = steps ?? (await this.orchestrationRunner.listSteps(runId));
    const completed = records.filter(
      (step) => step.status === 'completed',
    ).length;
    return {
      total: records.length,
      completed,
    };
  }

  private buildStats(
    totalSteps: number,
    completedSteps: number,
  ): Record<string, unknown> {
    if (totalSteps <= 0) {
      return {
        totalSteps,
        completedSteps,
        progressPercentage: 100,
      };
    }

    const percentage = Math.min(
      100,
      Math.max(0, Math.round((completedSteps / totalSteps) * 100)),
    );

    return {
      totalSteps,
      completedSteps,
      progressPercentage: percentage,
    };
  }

  private mergeMetadata(
    existing: Record<string, unknown> | undefined,
    patch: Record<string, unknown>,
  ): OrchestrationRunMetadata {
    const base = { ...(existing ?? {}) };
    const existingStats = (base.stats as Record<string, unknown> | undefined) ?? {};
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

    return merged as OrchestrationRunMetadata;
  }

  private cloneMetadata(metadata: JsonObject | undefined): JsonObject {
    if (!metadata) {
      return {};
    }
    try {
      return JSON.parse(JSON.stringify(metadata)) as JsonObject;
    } catch (error) {
      this.logger.warn(
        `Failed to deep clone step metadata, falling back to shallow copy: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { ...metadata };
    }
  }

  private computeQueueDuration(step: OrchestrationStepRecord): number | null {
    const metadata = this.asRecord(step.metadata) as Record<
      string,
      unknown
    > | null;
    const queuedAtRaw = metadata?.queuedAt;
    if (!queuedAtRaw || !step.started_at) {
      return null;
    }

    const queuedAtStr =
      typeof queuedAtRaw === 'string'
        ? queuedAtRaw
        : typeof queuedAtRaw === 'number'
          ? String(queuedAtRaw)
          : null;
    if (!queuedAtStr) {
      return null;
    }
    const queuedAt = Date.parse(queuedAtStr);
    const startedAt = Date.parse(step.started_at);
    if (Number.isNaN(queuedAt) || Number.isNaN(startedAt)) {
      return null;
    }

    const diff = startedAt - queuedAt;
    return diff >= 0 ? diff : null;
  }

  private computeStepDuration(step: OrchestrationStepRecord): number | null {
    if (!step.started_at || !step.completed_at) {
      return null;
    }
    const startedAt = Date.parse(step.started_at);
    const completedAt = Date.parse(step.completed_at);
    if (Number.isNaN(startedAt) || Number.isNaN(completedAt)) {
      return null;
    }
    const diff = completedAt - startedAt;
    return diff >= 0 ? diff : null;
  }

  private coercePositiveInteger(...values: unknown[]): number | null {
    for (const value of values) {
      if (value === null || value === undefined) {
        continue;
      }
      const parsed =
        typeof value === 'number'
          ? value
          : typeof value === 'string'
            ? Number(value)
            : NaN;
      if (!Number.isNaN(parsed) && parsed > 0) {
        const normalized = Math.max(1, Math.floor(Number(parsed)));
        return Math.min(normalized, 16);
      }
    }
    return null;
  }

  private asRecord(value: unknown): JsonObject | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return { ...(value as JsonObject) };
  }

  private extractTotalSteps(
    metadata: Record<string, unknown> | undefined,
  ): number | undefined {
    const stats =
      (metadata?.stats as Record<string, unknown> | undefined) ?? undefined;
    if (!stats) {
      return undefined;
    }

    const value: unknown = stats.totalSteps;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  private async ensureRun(runId: string): Promise<OrchestrationRunRecord> {
    const run = await this.orchestrationRunner.getRun(runId);
    if (!run) {
      throw new Error(`Orchestration run ${runId} not found`);
    }
    return run;
  }

  private resolveStepKey(step: OrchestrationStepRecord): string {
    return step.step_id ?? `index_${step.step_index}`;
  }

  private mergeStepState(
    current: OrchestrationStepState,
    patches: Array<{ key: string; state: OrchestrationStepStateEntry }>,
  ): OrchestrationStepState {
    const next: OrchestrationStepState = { ...current };

    patches.forEach(({ key, state }) => {
      const existing = this.cloneStepStateEntry(next[key]);
      next[key] = {
        ...existing,
        ...state,
        metadata: this.mergeJsonObjects(existing.metadata, state.metadata),
      } as OrchestrationStepStateEntry;
    });

    return next;
  }

  private mergeResults(
    current: Record<string, unknown>,
    stepKey: string,
    output: Record<string, unknown>,
  ): JsonObject {
    return {
      ...current,
      [stepKey]: output,
    } as JsonObject;
  }

  private cloneStepStateEntry(
    entry: OrchestrationStepStateEntry | undefined,
  ): OrchestrationStepStateEntry {
    if (!entry) {
      return {} as OrchestrationStepStateEntry;
    }

    return {
      ...entry,
      metadata: entry.metadata ? { ...entry.metadata } : undefined,
      runtime: entry.runtime ? { ...entry.runtime } : undefined,
      behavior: entry.behavior ? { ...entry.behavior } : undefined,
      checkpoint: entry.checkpoint ? { ...entry.checkpoint } : undefined,
      outputSummary: entry.outputSummary ? [...entry.outputSummary] : undefined,
    };
  }

  private mergeJsonObjects(
    base: JsonObject | undefined,
    patch: JsonObject | undefined,
  ): JsonObject | undefined {
    if (!base && !patch) {
      return undefined;
    }

    return {
      ...(base ?? {}),
      ...(patch ?? {}),
    } as JsonObject;
  }
}
