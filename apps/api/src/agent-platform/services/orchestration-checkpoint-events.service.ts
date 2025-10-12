import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationCheckpointDecision } from './orchestration-checkpoint.service';

interface CheckpointRequestedEvent {
  runId: string;
  approvalId: string;
  stepId?: string | null;
  checkpointId: string;
  question: string;
  options?: Array<{
    action: OrchestrationCheckpointDecision;
    label: string;
    allowsModification?: boolean;
    description?: string;
  }>;
}

interface CheckpointResolvedEvent {
  runId: string;
  approvalId: string;
  decision: OrchestrationCheckpointDecision;
  decidedBy?: string | null;
  notes?: string | null;
  modifications?: Record<string, any> | null;
}

@Injectable()
export class OrchestrationCheckpointEventsService {
  private readonly logger = new Logger(
    OrchestrationCheckpointEventsService.name,
  );
  private readonly webhookUrl =
    process.env.ORCHESTRATION_CHECKPOINT_WEBHOOK_URL ?? null;

  constructor(
    private readonly runner: OrchestrationRunnerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly http: HttpService,
  ) {}

  @OnEvent('orchestration.checkpoint.requested', { async: true })
  async handleCheckpointRequested(event: CheckpointRequestedEvent) {
    try {
      const run = await this.ensureRun(event.runId);
      const stepFromMetadata = this.extractStepFromMetadata(run);
      const payload = {
        event: 'orchestration.checkpoint.requested',
        runId: run.id,
        approvalId: event.approvalId,
        checkpointId: event.checkpointId,
        question: event.question,
        options: event.options ?? [],
        step:
          (await this.describeStep(run, event.stepId)) ?? stepFromMetadata,
        organizationSlug: run.organization_slug ?? null,
        conversationId: run.conversation_id ?? null,
        metadata: run.metadata ?? {},
        timestamp: new Date().toISOString(),
      };

      this.emitStreamChunk(run, payload.event, payload);
      await this.dispatchWebhook(payload.event, payload);
    } catch (error) {
      this.logger.warn(
        `Failed to handle checkpoint requested event for run ${event.runId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  @OnEvent('orchestration.checkpoint.resolved', { async: true })
  async handleCheckpointResolved(event: CheckpointResolvedEvent) {
    try {
      const run = await this.ensureRun(event.runId);
      const lastCheckpoint = this.extractLastCheckpoint(run);
      const payload = {
        event: 'orchestration.checkpoint.resolved',
        runId: run.id,
        approvalId: event.approvalId,
        decision: event.decision,
        checkpointId: lastCheckpoint?.checkpointId ?? null,
        decidedBy: event.decidedBy ?? null,
        notes: event.notes ?? null,
        modifications: event.modifications ?? null,
        organizationSlug: run.organization_slug ?? null,
        conversationId: run.conversation_id ?? null,
        metadata: run.metadata ?? {},
        status: run.status,
        step:
          (await this.describeStep(
            run,
            lastCheckpoint?.step?.definitionId ?? null,
          )) ?? lastCheckpoint?.step ??
          null,
        timestamp: new Date().toISOString(),
      };

      this.emitStreamChunk(run, payload.event, payload);
      await this.dispatchWebhook(payload.event, payload);
    } catch (error) {
      this.logger.warn(
        `Failed to handle checkpoint resolved event for run ${event.runId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async ensureRun(runId: string): Promise<OrchestrationRunRecord> {
    const run = await this.runner.getRun(runId);
    if (!run) {
      throw new Error(`Orchestration run ${runId} not found`);
    }
    return run;
  }

  private async describeStep(
    run: OrchestrationRunRecord,
    stepId?: string | null,
  ) {
    if (!stepId) {
      return null;
    }

    try {
      const steps = await this.runner.listSteps(run.id);
      const match = steps.find((step) => step.step_id === stepId);
      if (!match) {
        return null;
      }

      return {
        id: match.step_id,
        index: match.step_index,
        status: match.status,
        agentSlug: match.agent_slug,
        mode: match.mode,
        dependsOn: match.depends_on ?? [],
      };
    } catch (error) {
      this.logger.debug(
        `Unable to describe step ${stepId} for run ${run.id}`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  private extractLastCheckpoint(
    run: OrchestrationRunRecord,
  ): Record<string, any> | null {
    const metadata = run.metadata ?? {};
    const rawCheckpoint = metadata.lastCheckpoint;
    if (!rawCheckpoint || typeof rawCheckpoint !== 'object') {
      return null;
    }
    return rawCheckpoint as Record<string, any>;
  }

  private extractStepFromMetadata(run: OrchestrationRunRecord) {
    const lastCheckpoint = this.extractLastCheckpoint(run);
    if (!lastCheckpoint) {
      return null;
    }
    const stepInfo = lastCheckpoint.step;
    if (!stepInfo || typeof stepInfo !== 'object') {
      return null;
    }
    return stepInfo;
  }

  private emitStreamChunk(
    run: OrchestrationRunRecord,
    eventType: string,
    payload: Record<string, any>,
  ) {
    const agentMetadata = (run.metadata?.agent ?? {}) as Record<string, any>;
    const agentSlug =
      (agentMetadata.slug as string | undefined) ?? 'orchestration-manager';

    this.eventEmitter.emit('agent.stream.chunk', {
      streamId: run.id,
      conversationId: run.conversation_id ?? null,
      orchestrationRunId: run.id,
      organizationSlug: run.organization_slug ?? null,
      agentSlug,
      mode: 'orchestration_checkpoint',
      chunk: {
        type: 'partial',
        content: JSON.stringify(payload),
        metadata: {
          event: eventType,
          approvalId: payload.approvalId,
          checkpointId: payload.checkpointId,
          decision: payload.decision ?? null,
        },
      },
    });
  }

  private async dispatchWebhook(
    eventType: string,
    payload: Record<string, any>,
  ): Promise<void> {
    if (!this.webhookUrl) {
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(this.webhookUrl, {
          event: eventType,
          data: payload,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to dispatch checkpoint webhook for ${eventType}`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
