import { Injectable } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
} from 'prom-client';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../interfaces/orchestration-step-record.interface';

type StepStatusLabel = 'completed' | 'failed';
type RunTerminalStatus = 'completed' | 'failed' | 'aborted';

@Injectable()
export class OrchestrationMetricsService {
  private readonly registry: Registry;
  private readonly runCounter: Counter<string>;
  private readonly runDuration: Histogram<string>;
  private readonly stepDuration: Histogram<string>;
  private readonly stepQueueDuration: Histogram<string>;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    this.runCounter = new Counter({
      name: 'orchestration_runs_total',
      help: 'Total number of orchestration runs by terminal status.',
      labelNames: ['definition', 'status'],
      registers: [this.registry],
    });

    this.runDuration = new Histogram({
      name: 'orchestration_run_duration_seconds',
      help: 'Duration of orchestration runs in seconds.',
      buckets: [1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800],
      labelNames: ['definition', 'status'],
      registers: [this.registry],
    });

    this.stepDuration = new Histogram({
      name: 'orchestration_step_duration_seconds',
      help: 'Execution duration of orchestration steps.',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      labelNames: ['definition', 'step', 'status'],
      registers: [this.registry],
    });

    this.stepQueueDuration = new Histogram({
      name: 'orchestration_step_queue_seconds',
      help: 'Time steps spend queued before execution.',
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      labelNames: ['definition', 'step'],
      registers: [this.registry],
    });
  }

  recordRunStarted(run: OrchestrationRunRecord): void {
    this.runCounter
      .labels({
        definition: this.resolveDefinitionLabel(run),
        status: 'started',
      })
      .inc();
  }

  recordRunCompleted(
    run: OrchestrationRunRecord,
    status: RunTerminalStatus,
  ): void {
    const definition = this.resolveDefinitionLabel(run);
    this.runCounter.labels({ definition, status }).inc();

    const durationSeconds = this.computeRunDurationSeconds(run);
    if (durationSeconds !== null) {
      this.runDuration.labels({ definition, status }).observe(durationSeconds);
    }
  }

  observeStepQueueDuration(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
    durationMs: number | null,
  ): void {
    if (durationMs === null || Number.isNaN(durationMs) || durationMs < 0) {
      return;
    }

    const definition = this.resolveDefinitionLabel(run);
    const stepLabel = this.resolveStepLabel(step);
    this.stepQueueDuration
      .labels({ definition, step: stepLabel })
      .observe(durationMs / 1000);
  }

  observeStepDuration(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
    durationMs: number | null,
    status: StepStatusLabel,
  ): void {
    if (durationMs === null || Number.isNaN(durationMs) || durationMs < 0) {
      return;
    }

    const definition = this.resolveDefinitionLabel(run);
    const stepLabel = this.resolveStepLabel(step);
    this.stepDuration
      .labels({ definition, step: stepLabel, status })
      .observe(durationMs / 1000);
  }

  async snapshot(): Promise<string> {
    return this.registry.metrics();
  }

  private computeRunDurationSeconds(
    run: OrchestrationRunRecord,
  ): number | null {
    if (!run.started_at || !run.completed_at) {
      return null;
    }
    const started = Date.parse(run.started_at);
    const completed = Date.parse(run.completed_at);
    if (Number.isNaN(started) || Number.isNaN(completed)) {
      return null;
    }
    const diff = completed - started;
    if (diff < 0) {
      return null;
    }
    return diff / 1000;
  }

  private resolveDefinitionLabel(run: OrchestrationRunRecord): string {
    const metadata = this.asRecord(run.metadata);
    const plan = this.asRecord(metadata?.plan);
    const agent = this.asRecord(metadata?.agent);
    const owner =
      (agent?.slug as string | undefined) ??
      run.orchestration_slug ??
      'unknown';
    const name =
      run.orchestration_name ??
      (plan?.name as string | undefined) ??
      'orchestration';
    const version =
      (plan?.version as string | undefined) ??
      (metadata?.definitionVersion as string | undefined) ??
      run.orchestration_definition_id ??
      null;

    return version ? `${owner}/${name}@${version}` : `${owner}/${name}`;
  }

  private resolveStepLabel(step: OrchestrationStepRecord): string {
    if (step.step_id) {
      return step.step_id;
    }
    return `index_${step.step_index}`;
  }

  private asRecord(value: unknown): Record<string, any> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return { ...(value as Record<string, any>) };
  }
}
