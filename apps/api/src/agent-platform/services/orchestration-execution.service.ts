import { Injectable, Logger } from '@nestjs/common';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationStateService } from './orchestration-state.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import {
  OrchestrationStepRecord,
  OrchestrationStepUpdateInput,
} from '../interfaces/orchestration-step-record.interface';
import { OrchestrationEventsService } from './orchestration-events.service';

interface StepStateEntry {
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  attemptNumber?: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class OrchestrationExecutionService {
  private readonly logger = new Logger(OrchestrationExecutionService.name);

  constructor(
    private readonly orchestrationRunner: OrchestrationRunnerService,
    private readonly stateService: OrchestrationStateService,
    private readonly events: OrchestrationEventsService,
  ) {}

  /**
   * Begin execution by finding runnable steps and marking them as queued.
   * Returns updated run state and the steps ready for execution.
   */
  async startExecution(runId: string): Promise<{
    run: OrchestrationRunRecord;
    readySteps: OrchestrationStepRecord[];
  }> {
    const run = await this.orchestrationRunner.getRun(runId);
    if (!run) {
      throw new Error(`Orchestration run ${runId} not found`);
    }

    const metrics = await this.gatherStepMetrics(runId);
    const readySteps = await this.stateService.findRunnableSteps(runId);

    if (!readySteps.length) {
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
      return { run: completedRun, readySteps: [] };
    }

    const now = new Date().toISOString();
    const queuedSteps = await Promise.all(
      readySteps.map((step) =>
        this.orchestrationRunner.updateStep(step.id, {
          status: 'queued',
          metadata: {
            ...(step.metadata ?? {}),
            queuedAt: now,
          },
        }),
      ),
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
      stepState: stepState,
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
      stepState: stepState,
      metadata: this.mergeMetadata(run.metadata, {
        lifecycle: 'running',
        currentStep: this.resolveStepKey(step),
      }),
    });

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
    output: Record<string, any> | null,
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
      stepState: stepState,
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
    errorDetails: Record<string, any>,
  ): Promise<{ step: OrchestrationStepRecord; run: OrchestrationRunRecord }> {
    const now = new Date().toISOString();
    const step = await this.orchestrationRunner.updateStep(stepId, {
      status: 'failed',
      error_details: errorDetails,
      completed_at: now,
    });

    const run = await this.ensureRun(step.orchestration_run_id);
    const metrics = await this.gatherStepMetrics(step.orchestration_run_id);
    const stepState = this.mergeStepState(run.step_state ?? {}, [
      {
        key: this.resolveStepKey(step),
        state: {
          status: 'failed',
          completedAt: now,
          metadata: errorDetails,
        },
      },
    ]);

    const updatedRun = await this.orchestrationRunner.updateRun({
      runId: step.orchestration_run_id,
      status: 'failed',
      currentStepIndex: step.step_index,
      currentStepId: this.resolveStepKey(step),
      stepState: stepState,
      metadata: this.mergeMetadata(run.metadata, {
        error_details: {
          ...(run.error_details ?? {}),
          lastError: errorDetails,
        },
        lastFailedStep: this.resolveStepKey(step),
        stats: this.buildStats(metrics.total, metrics.completed),
      }),
      completedAt: now,
    });

    const context =
      metrics.total > 0
        ? {
            totalSteps: metrics.total,
          }
        : undefined;

    this.events.emitStepFailed(updatedRun, step, errorDetails, context);
    this.events.emitRunFailed(updatedRun, errorDetails, context);

    return { step, run: updatedRun };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async gatherStepMetrics(runId: string): Promise<{
    total: number;
    completed: number;
  }> {
    const steps = await this.orchestrationRunner.listSteps(runId);
    const completed = steps.filter(
      (step) => step.status === 'completed',
    ).length;
    return {
      total: steps.length,
      completed,
    };
  }

  private buildStats(
    totalSteps: number,
    completedSteps: number,
  ): Record<string, any> {
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

  private extractTotalSteps(
    metadata: Record<string, any> | undefined,
  ): number | undefined {
    const stats =
      (metadata?.stats as Record<string, any> | undefined) ?? undefined;
    if (!stats) {
      return undefined;
    }

    const value = stats.totalSteps;
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
    current: Record<string, StepStateEntry>,
    patches: Array<{ key: string; state: StepStateEntry }>,
  ): Record<string, StepStateEntry> {
    const next = { ...current };

    patches.forEach(({ key, state }) => {
      const existing = next[key] ?? {};
      next[key] = {
        ...existing,
        ...state,
        metadata: {
          ...((existing as any).metadata ?? {}),
          ...(state.metadata ?? {}),
        },
      };
    });

    return next;
  }

  private mergeResults(
    current: Record<string, any>,
    stepKey: string,
    output: Record<string, any>,
  ): Record<string, any> {
    return {
      ...current,
      [stepKey]: output,
    };
  }
}
