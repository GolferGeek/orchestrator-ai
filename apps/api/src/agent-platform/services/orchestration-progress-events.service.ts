import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import { TaskStatusService } from '@/agent2agent/tasks/task-status.service';
import {
  OrchestrationRunEventPayload,
  OrchestrationStepSnapshot,
} from '../types/orchestration-events.types';

@Injectable()
export class OrchestrationProgressEventsService {
  private readonly logger = new Logger(OrchestrationProgressEventsService.name);
  private readonly webhookUrl =
    process.env.ORCHESTRATION_PROGRESS_WEBHOOK_URL ?? null;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly http: HttpService,
    private readonly taskStatusService: TaskStatusService,
  ) {}

  @OnEvent('orchestration.event', { async: true })
  async handleEvent(event: OrchestrationRunEventPayload): Promise<void> {
    try {
      this.emitStreamChunk(event);
      await this.forwardTaskStatus(event);
      await this.dispatchWebhook(event);
      this.handleTerminalStreams(event);
    } catch (error) {
      this.logger.warn(
        `Failed to process orchestration event ${event.type} for run ${event.run.id}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private emitStreamChunk(event: OrchestrationRunEventPayload): void {
    const agentSlug = event.run.agent.slug || 'orchestration-manager';

    this.eventEmitter.emit('agent.stream.chunk', {
      streamId: event.run.id,
      conversationId: event.run.conversationId ?? null,
      orchestrationRunId: event.run.id,
      organizationSlug: event.run.organizationSlug ?? null,
      agentSlug,
      mode: 'orchestration',
      chunk: {
        type: 'partial',
        content: JSON.stringify({
          type: event.type,
          timestamp: event.timestamp,
          run: event.run,
          data: event.data ?? null,
        }),
        metadata: {
          eventType: event.type,
          progressPercentage: event.run.stats.progressPercentage ?? null,
          stepId: this.extractStep(event)?.id ?? null,
          stepIndex: this.extractStep(event)?.index ?? null,
        },
      },
    });
  }

  private handleTerminalStreams(event: OrchestrationRunEventPayload): void {
    if (
      event.type !== 'orchestration.run.completed' &&
      event.type !== 'orchestration.run.failed'
    ) {
      return;
    }

    const agentSlug = event.run.agent.slug || 'orchestration-manager';
    const basePayload = {
      streamId: event.run.id,
      conversationId: event.run.conversationId ?? null,
      orchestrationRunId: event.run.id,
      organizationSlug: event.run.organizationSlug ?? null,
      agentSlug,
      mode: 'orchestration',
    };

    if (event.type === 'orchestration.run.completed') {
      this.eventEmitter.emit('agent.stream.complete', basePayload);
      return;
    }

    const errorMessage =
      this.extractErrorMessage(event) ?? 'Orchestration run failed';
    this.eventEmitter.emit('agent.stream.error', {
      ...basePayload,
      error: errorMessage,
    });
  }

  private async forwardTaskStatus(
    event: OrchestrationRunEventPayload,
  ): Promise<void> {
    const task = event.run.task;
    if (!task?.id || !task.userId) {
      return;
    }

    const progress = event.run.stats.progressPercentage;
    const step = this.extractStep(event);

    switch (event.type) {
      case 'orchestration.run.created':
        await this.safeUpdateTaskStatus(task.id, task.userId, {
          status: 'running',
          progress: progress ?? 0,
          progressMessage: 'Orchestration run created',
        });
        break;
      case 'orchestration.run.updated':
        await this.safeUpdateTaskStatus(task.id, task.userId, {
          status: this.normalizeRunStatus(event.run.status),
          progress: progress,
          progressMessage: `Run status updated: ${event.run.status}`,
        });
        break;
      case 'orchestration.step.queued':
        await this.safeUpdateTaskStatus(task.id, task.userId, {
          status: 'running',
          progress: progress,
          progressMessage: this.buildStepMessage(step, 'queued'),
        });
        break;
      case 'orchestration.step.running':
        await this.safeUpdateTaskStatus(task.id, task.userId, {
          status: 'running',
          progress: progress,
          progressMessage: this.buildStepMessage(step, 'running'),
        });
        break;
      case 'orchestration.step.completed':
        await this.safeUpdateTaskStatus(task.id, task.userId, {
          status: 'running',
          progress: progress,
          progressMessage: this.buildStepMessage(step, 'completed'),
        });
        break;
      case 'orchestration.step.failed':
        await this.safeUpdateTaskStatus(task.id, task.userId, {
          status: 'failed',
          progress: progress,
          error:
            this.extractErrorMessage(event) ??
            this.buildStepMessage(step, 'failed'),
        });
        break;
      case 'orchestration.run.completed':
        await this.safeUpdateTaskStatus(task.id, task.userId, {
          status: 'completed',
          progress: 100,
          progressMessage: 'Orchestration run completed',
          result: event.run.results ?? {},
        });
        break;
      case 'orchestration.run.failed':
        await this.safeUpdateTaskStatus(task.id, task.userId, {
          status: 'failed',
          progress: progress,
          error: this.extractErrorMessage(event) ?? 'Orchestration run failed',
        });
        break;
      default:
        break;
    }
  }

  private async safeUpdateTaskStatus(
    taskId: string,
    userId: string,
    update: Parameters<TaskStatusService['updateTaskStatus']>[2],
  ): Promise<void> {
    try {
      await this.taskStatusService.updateTaskStatus(taskId, userId, update);
    } catch (error) {
      this.logger.debug(
        `Unable to update task status for task ${taskId}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  private async dispatchWebhook(
    event: OrchestrationRunEventPayload,
  ): Promise<void> {
    if (!this.webhookUrl) {
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(this.webhookUrl, {
          event: event.type,
          runId: event.run.id,
          data: {
            timestamp: event.timestamp,
            run: event.run,
            payload: event.data ?? null,
          },
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to POST orchestration webhook for ${event.type}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  private extractStep(
    event: OrchestrationRunEventPayload,
  ): OrchestrationStepSnapshot | undefined {
    const data = event.data ?? {};
    if (data.step && typeof data.step === 'object') {
      return data.step as OrchestrationStepSnapshot;
    }
    if (Array.isArray(data.steps) && data.steps.length > 0) {
      return data.steps[0] as OrchestrationStepSnapshot;
    }
    return undefined;
  }

  private buildStepMessage(
    step: OrchestrationStepSnapshot | undefined,
    status: string,
  ): string {
    if (!step) {
      return `Step ${status}`;
    }
    const label =
      this.extractStepName(step.metadata) ??
      step.id ??
      `#${step.index.toString()}`;
    return `Step ${label} ${status}`;
  }

  private extractStepName(metadata: Record<string, any>): string | undefined {
    if (!metadata) {
      return undefined;
    }
    const nameValue = metadata.name ?? metadata.label;
    if (typeof nameValue === 'string' && nameValue.trim().length > 0) {
      return nameValue;
    }
    return undefined;
  }

  private normalizeRunStatus(
    status: string,
  ): 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' {
    if (!status) {
      return 'running';
    }
    const normalized = status.toLowerCase();
    switch (normalized) {
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'cancelled':
      case 'canceled':
        return 'cancelled';
      default:
        return 'running';
    }
  }

  private extractErrorMessage(
    event: OrchestrationRunEventPayload,
  ): string | undefined {
    const data = event.data ?? {};
    const error = data.error ?? event.run.errorDetails ?? {};

    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
    }

    if (typeof error === 'object' && error) {
      const messageCandidates = [
        error.message,
        error.error,
        error.reason,
        error.details?.message,
      ];

      for (const candidate of messageCandidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
          return candidate;
        }
      }
    }

    return undefined;
  }
}
