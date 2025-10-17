import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { JsonObject } from '@orchestrator-ai/transport-types';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../interfaces/orchestration-step-record.interface';
import {
  OrchestrationAgentInfo,
  OrchestrationEventType,
  OrchestrationRunEventPayload,
  OrchestrationRunSnapshot,
  OrchestrationRunStats,
  OrchestrationStepSnapshot,
  OrchestrationTaskLink,
} from '../types/orchestration-events.types';
import type {
  OrchestrationRunMetadata,
  OrchestrationRunMetricsMetadata,
  OrchestrationStepState,
} from '../types/orchestration-run.types';

interface RunEventContext {
  totalSteps?: number;
}

@Injectable()
export class OrchestrationEventsService {
  private readonly logger = new Logger(OrchestrationEventsService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  emitRunCreated(run: OrchestrationRunRecord, context?: RunEventContext): void {
    this.dispatch(
      this.buildRunEventPayload('orchestration.run.created', run, context),
    );
  }

  emitRunUpdated(
    run: OrchestrationRunRecord,
    data: JsonObject = {},
    context?: RunEventContext,
  ): void {
    this.dispatch(
      this.buildRunEventPayload(
        'orchestration.run.updated',
        run,
        context,
        data,
      ),
    );
  }

  emitRunCompleted(
    run: OrchestrationRunRecord,
    context?: RunEventContext,
  ): void {
    this.dispatch(
      this.buildRunEventPayload('orchestration.run.completed', run, context, {
        results: run.results ?? {},
      }),
    );
  }

  emitRunFailed(
    run: OrchestrationRunRecord,
    error: JsonObject = {},
    context?: RunEventContext,
  ): void {
    this.dispatch(
      this.buildRunEventPayload('orchestration.run.failed', run, context, {
        error,
      }),
    );
  }

  emitStepsQueued(
    run: OrchestrationRunRecord,
    steps: OrchestrationStepRecord[],
    context?: RunEventContext,
  ): void {
    if (!steps.length) {
      return;
    }

    const stepSnapshots = steps.map((step) =>
      this.buildStepSnapshot(run, step),
    );
    this.dispatch(
      this.buildRunEventPayload('orchestration.step.queued', run, context, {
        steps: stepSnapshots,
      }),
    );
  }

  emitStepRunning(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
    context?: RunEventContext,
  ): void {
    const payload = this.buildRunEventPayload(
      'orchestration.step.running',
      run,
      context,
      {
        step: this.buildStepSnapshot(run, step),
      },
    );
    this.dispatch(payload);
  }

  emitStepCompleted(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
    nextSteps: OrchestrationStepRecord[],
    context?: RunEventContext,
  ): void {
    const payload = this.buildRunEventPayload(
      'orchestration.step.completed',
      run,
      context,
      {
        step: this.buildStepSnapshot(run, step),
        nextSteps: nextSteps.map((next) => this.buildStepSnapshot(run, next)),
      },
    );
    this.dispatch(payload);
  }

  emitStepFailed(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
    error: JsonObject = {},
    context?: RunEventContext,
  ): void {
    const payload = this.buildRunEventPayload(
      'orchestration.step.failed',
      run,
      context,
      {
        step: this.buildStepSnapshot(run, step),
        error,
      },
    );
    this.dispatch(payload);
  }

  snapshotRun(
    run: OrchestrationRunRecord,
    context?: RunEventContext,
  ): OrchestrationRunSnapshot {
    return this.buildRunSnapshot(run, context);
  }

  snapshotStep(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
  ): OrchestrationStepSnapshot {
    return this.buildStepSnapshot(run, step);
  }

  private dispatch(payload: OrchestrationRunEventPayload): void {
    this.eventEmitter.emit(payload.type, payload);
    this.eventEmitter.emit('orchestration.event', payload);
    this.logger.debug(
      `Dispatched orchestration event ${payload.type} for run ${payload.run.id}`,
    );
  }

  private buildRunEventPayload(
    type: OrchestrationEventType,
    run: OrchestrationRunRecord,
    context?: RunEventContext,
    data?: JsonObject,
  ): OrchestrationRunEventPayload {
    return {
      type,
      timestamp: new Date().toISOString(),
      run: this.buildRunSnapshot(run, context),
      data,
    };
  }

  private buildRunSnapshot(
    run: OrchestrationRunRecord,
    context?: RunEventContext,
  ): OrchestrationRunSnapshot {
    const metadata = (run.metadata ?? {}) as OrchestrationRunMetadata;
    const stats = this.buildStats(run, context);

    return {
      id: run.id,
      status: run.status,
      definitionId: run.orchestration_definition_id,
      name: run.orchestration_name,
      planId: run.plan_id,
      conversationId: run.conversation_id,
      parentRunId: run.parent_orchestration_run_id,
      organizationSlug: run.organization_slug,
      currentStepId: run.current_step_id,
      currentStepIndex: run.current_step_index,
      completedSteps: Array.isArray(run.completed_steps)
        ? [...run.completed_steps]
        : [],
      humanCheckpointId: run.human_checkpoint_id,
      plan: run.plan ?? {},
      results: run.results ?? {},
      parameters: run.parameters ?? {},
      errorDetails: run.error_details ?? {},
      metadata,
      stats,
      timings: {
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        startedAt: run.started_at ?? null,
        completedAt: run.completed_at ?? null,
      },
      agent: this.resolveAgent(metadata),
      task: this.resolveTaskLink(metadata),
    };
  }

  private buildStepSnapshot(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
  ): OrchestrationStepSnapshot {
    const metadata = step.metadata ?? {};
    let outputSummary: string[] = [];
    if (step.output) {
      outputSummary = Object.keys(step.output);
    } else if (Array.isArray(metadata.outputSummary)) {
      outputSummary = [...metadata.outputSummary];
    } else {
      const nestedMetadata = metadata.metadata as JsonObject | undefined;
      const preview = nestedMetadata?.outputPreview;
      if (Array.isArray(preview)) {
        outputSummary = preview.map((value) => String(value));
      }
    }

    return {
      id: step.step_id,
      runId: run.id,
      index: step.step_index,
      status: step.status,
      agentSlug: step.agent_slug,
      mode: step.mode,
      attemptNumber: step.attempt_number,
      dependsOn: Array.isArray(step.depends_on) ? [...step.depends_on] : [],
      conversationId: step.conversation_id,
      startedAt: step.started_at,
      completedAt: step.completed_at,
      metadata,
      outputSummary,
      errorDetails: step.error_details ?? null,
    };
  }

  private buildStats(
    run: OrchestrationRunRecord,
    context?: RunEventContext,
  ): OrchestrationRunStats {
    const metadataStats: OrchestrationRunMetricsMetadata =
      (run.metadata?.stats as OrchestrationRunMetricsMetadata | undefined) ??
      {};

    const totalSteps =
      this.extractNumber(context?.totalSteps ?? metadataStats.totalSteps) ??
      this.estimateTotalSteps(run);

    const completedSteps =
      this.extractNumber(metadataStats.completedSteps) ??
      (Array.isArray(run.completed_steps) ? run.completed_steps.length : 0);

    const progress =
      totalSteps && totalSteps > 0
        ? Math.min(
            100,
            Math.max(0, Math.round((completedSteps / totalSteps) * 100)),
          )
        : (metadataStats.progressPercentage ?? undefined);

    return {
      totalSteps: totalSteps ?? undefined,
      completedSteps,
      progressPercentage: progress,
    };
  }

  private resolveAgent(
    metadata: OrchestrationRunMetadata,
  ): OrchestrationAgentInfo {
    const agentMetadata = metadata.agent ?? {};
    const slug =
      this.extractString(agentMetadata.slug) ??
      this.extractString(agentMetadata.agentSlug) ??
      'orchestration-manager';

    return {
      id: this.extractString(agentMetadata.id) ?? null,
      slug,
      type: this.extractString(agentMetadata.type) ?? null,
      displayName:
        this.extractString(agentMetadata.displayName) ??
        this.extractString(agentMetadata.name) ??
        null,
    };
  }

  private resolveTaskLink(
    metadata: OrchestrationRunMetadata,
  ): OrchestrationTaskLink | undefined {
    const taskMetadata = metadata.task ?? metadata.requestMetadata;

    if (!taskMetadata) {
      return undefined;
    }

    const taskId =
      this.extractString(taskMetadata.id) ??
      this.extractString(taskMetadata.taskId);
    const userId =
      this.extractString(taskMetadata.userId) ??
      this.extractString(taskMetadata.ownerId);

    if (!taskId && !userId) {
      return undefined;
    }

    return {
      id: taskId ?? null,
      userId: userId ?? null,
    };
  }

  private extractNumber(value: unknown): number | undefined {
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

  private extractString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return undefined;
  }

  private estimateTotalSteps(run: OrchestrationRunRecord): number | undefined {
    const stepState: OrchestrationStepState = run.step_state ?? {};
    const keys = Object.keys(stepState);
    if (keys.length > 0) {
      return keys.length;
    }
    return undefined;
  }
}
