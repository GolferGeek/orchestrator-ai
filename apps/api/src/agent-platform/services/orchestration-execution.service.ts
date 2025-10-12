import { Injectable, Logger } from '@nestjs/common';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationStateService } from './orchestration-state.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import {
  OrchestrationStepRecord,
  OrchestrationStepUpdateInput,
} from '../interfaces/orchestration-step-record.interface';

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
  ) {}

  /**
   * Begin execution by finding runnable steps and marking them as queued.
   * Returns updated run state and the steps ready for execution.
   */
  async startExecution(
    runId: string,
  ): Promise<{
    run: OrchestrationRunRecord;
    readySteps: OrchestrationStepRecord[];
  }> {
    const run = await this.orchestrationRunner.getRun(runId);
    if (!run) {
      throw new Error(`Orchestration run ${runId} not found`);
    }

    const readySteps = await this.stateService.findRunnableSteps(runId);

    if (!readySteps.length) {
      const completedRun = await this.orchestrationRunner.updateRun({
        runId,
        status: 'completed',
        currentStepIndex: null,
        currentStepId: null,
        completedAt: new Date().toISOString(),
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
      currentStepId: queuedSteps[0] ? this.resolveStepKey(queuedSteps[0]) : null,
      stepState: stepState,
    });

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

    await this.orchestrationRunner.updateRun({
      runId: step.orchestration_run_id,
      status: 'running',
      currentStepIndex: step.step_index,
      currentStepId: this.resolveStepKey(step),
      stepState: stepState,
    });

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
        runStatus === 'completed' ? null : run.current_step_index ?? null,
      currentStepId: runStatus === 'completed' ? null : run.current_step_id,
      completedSteps: completedSteps,
      stepState: stepState,
      results: this.mergeResults(
        run.results ?? {},
        this.resolveStepKey(step),
        output ?? {},
      ),
      metadata: {
        ...(run.metadata ?? {}),
        lastCompletedStep: this.resolveStepKey(step),
      },
      completedAt: runStatus === 'completed' ? now : undefined,
    });

    const nextSteps =
      runStatus === 'completed'
        ? []
        : await this.stateService.findRunnableSteps(step.orchestration_run_id);

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
      metadata: {
        error_details: {
          ...(run.error_details ?? {}),
          lastError: errorDetails,
        },
        lastFailedStep: this.resolveStepKey(step),
      },
      completedAt: now,
    });

    return { step, run: updatedRun };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
