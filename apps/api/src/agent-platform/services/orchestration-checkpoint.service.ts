import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { JsonObject } from '@orchestrator-ai/transport-types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HumanApprovalsRepository } from '../repositories/human-approvals.repository';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import type {
  OrchestrationApprovalMetadata,
  OrchestrationCheckpointDecision,
  OrchestrationCheckpointMetadata,
  OrchestrationCheckpointOptionState,
  OrchestrationRunMetadata,
  OrchestrationStepState,
  OrchestrationStepStateEntry,
} from '../types/orchestration-run.types';

export interface RequestOrchestrationCheckpointOptions {
  runId: string;
  checkpointId: string;
  question: string;
  agentSlug: string;
  stepId?: string | null;
  stepRecordId?: string | null;
  stepLabel?: string;
  stepIndex?: number | null;
  conversationId?: string | null;
  organizationSlug?: string | null;
  options?: OrchestrationCheckpointOptionState[];
  metadata?: JsonObject;
}

export interface ResolveOrchestrationCheckpointOptions {
  approvalId: string;
  decision: OrchestrationCheckpointDecision;
  actorId?: string | null;
  notes?: string | null;
  modifications?: JsonObject;
}

interface CheckpointStatePatch {
  checkpointId?: string;
  question?: string;
  options?: OrchestrationCheckpointOptionState[];
  status?: string;
  requestedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string | null;
  notes?: string | null;
  modifications?: JsonObject | null;
  stepRecordId?: string | null;
  stepDefinitionId?: string | null;
  stepLabel?: string | null;
  stepIndex?: number | null;
}

@Injectable()
export class OrchestrationCheckpointService {
  private readonly logger = new Logger(OrchestrationCheckpointService.name);

  constructor(
    private readonly approvals: HumanApprovalsRepository,
    private readonly runner: OrchestrationRunnerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestCheckpoint(
    options: RequestOrchestrationCheckpointOptions,
  ): Promise<{
    approvalId: string;
    run: OrchestrationRunRecord;
  }> {
    const run = await this.ensureRun(options.runId);

    const requestedAt = new Date().toISOString();
    const checkpointMetadata = this.createRequestMetadata(
      run,
      options,
      requestedAt,
    );

    const approval = await this.approvals.create({
      organizationSlug: options.organizationSlug ?? run.organization_slug,
      agentSlug: options.agentSlug,
      conversationId: options.conversationId ?? null,
      orchestrationRunId: run.id,
      orchestrationStepId: options.stepRecordId ?? null,
      mode: 'orchestration_checkpoint',
      metadata: checkpointMetadata,
    });

    const stepState = this.buildUpdatedStepState(run, approval.id, {
      stepRecordId: options.stepRecordId ?? null,
      stepDefinitionId: options.stepId ?? null,
      stepLabel: options.stepLabel ?? null,
      stepIndex: options.stepIndex ?? null,
      checkpointId: options.checkpointId,
      question: options.question,
      options: options.options ?? [],
      status: 'pending',
      requestedAt,
    });

    await this.runner.updateRun({
      runId: run.id,
      status: 'checkpoint',
      humanCheckpointId: approval.id,
      stepState,
      metadata: this.mergeRunMetadata(run.metadata, {
        lastCheckpoint: {
          approvalId: approval.id,
          checkpointId: options.checkpointId,
          step: checkpointMetadata.step,
          requestedAt,
        },
      }),
    });

    this.eventEmitter.emit('orchestration.checkpoint.requested', {
      runId: run.id,
      approvalId: approval.id,
      stepId: options.stepId ?? null,
      checkpointId: options.checkpointId,
      question: options.question,
      options: options.options ?? [],
    });

    const updatedRun = await this.ensureRun(run.id);

    return {
      approvalId: approval.id,
      run: updatedRun,
    };
  }

  async resolveCheckpoint(
    options: ResolveOrchestrationCheckpointOptions,
  ): Promise<{
    approval: Awaited<ReturnType<HumanApprovalsRepository['setStatus']>>;
    run: OrchestrationRunRecord;
    decision: OrchestrationCheckpointDecision;
  }> {
    const approval = await this.approvals.get(options.approvalId);
    if (!approval) {
      throw new NotFoundException(
        `Approval ${options.approvalId} could not be found`,
      );
    }

    const metadata = {
      ...(approval.metadata ?? {}),
    } as OrchestrationApprovalMetadata;

    const runId = metadata.runId;
    if (!runId) {
      throw new BadRequestException(
        `Approval ${options.approvalId} is missing runId metadata`,
      );
    }

    const run = await this.ensureRun(runId);
    const now = new Date().toISOString();

    const updatedApproval = await this.approvals.setStatus(
      options.approvalId,
      options.decision === 'abort' ? 'rejected' : 'approved',
      options.actorId ?? null,
      {
        ...metadata,
        decision: {
          action: options.decision,
          decidedAt: now,
          decidedBy: options.actorId ?? null,
          notes: options.notes ?? null,
          modifications: options.modifications ?? null,
        },
      },
    );

    const stepState = this.buildUpdatedStepState(run, options.approvalId, {
      stepRecordId: metadata.step?.recordId ?? null,
      stepDefinitionId: metadata.step?.definitionId ?? null,
      stepLabel: metadata.step?.label ?? null,
      stepIndex: metadata.step?.index ?? null,
      checkpointId: metadata.checkpointId,
      question: metadata.question,
      options: metadata.options,
      status: options.decision,
      resolvedAt: now,
      resolvedBy: options.actorId ?? null,
      notes: options.notes ?? null,
      modifications: options.modifications ?? null,
    });

    const updatePayload = await this.buildRunUpdatePayload(
      run,
      metadata,
      options,
      stepState,
      now,
    );

    await this.runner.updateRun(updatePayload);
    const updatedRun = await this.ensureRun(run.id);

    this.eventEmitter.emit('orchestration.checkpoint.resolved', {
      runId: run.id,
      approvalId: options.approvalId,
      decision: options.decision,
      decidedBy: options.actorId ?? null,
      notes: options.notes ?? null,
      modifications: options.modifications ?? null,
    });

    return {
      approval: updatedApproval,
      run: updatedRun,
      decision: options.decision,
    };
  }

  private async ensureRun(runId: string): Promise<OrchestrationRunRecord> {
    const run = await this.runner.getRun(runId);
    if (!run) {
      throw new NotFoundException(
        `Orchestration run ${runId} could not be found`,
      );
    }
    return run;
  }

  private buildUpdatedStepState(
    run: OrchestrationRunRecord,
    approvalId: string,
    patch: CheckpointStatePatch,
  ): OrchestrationStepState {
    const lastCheckpoint = run.metadata?.lastCheckpoint;
    const stepDefinitionId =
      patch.stepDefinitionId ??
      (lastCheckpoint?.step?.definitionId as string | null) ??
      null;
    const stepRecordId =
      patch.stepRecordId ??
      (lastCheckpoint?.step?.recordId as string | null) ??
      null;
    const key = stepDefinitionId ?? stepRecordId ?? 'plan';

    const existingState = this.cloneStepStateEntry(run.step_state?.[key]);
    const checkpointState: OrchestrationCheckpointMetadata = {
      ...(existingState.checkpoint ?? {}),
      approvalId,
      ...this.createCheckpointPatch(patch, existingState.checkpoint),
    };

    return {
      ...(run.step_state ?? {}),
      [key]: {
        ...existingState,
        checkpoint: checkpointState,
      },
    };
  }

  private async buildRunUpdatePayload(
    run: OrchestrationRunRecord,
    metadata: OrchestrationApprovalMetadata,
    options: ResolveOrchestrationCheckpointOptions,
    stepState: OrchestrationStepState,
    timestamp: string,
  ) {
    const update = {
      runId: run.id,
      humanCheckpointId: null as string | null,
      stepState,
      metadata: this.mergeRunMetadata(run.metadata, {
        lastCheckpoint: {
          ...(run.metadata?.lastCheckpoint ?? {}),
          decision: options.decision,
          decidedAt: timestamp,
          decidedBy: options.actorId ?? null,
          notes: options.notes ?? null,
        },
      }),
    } as Parameters<OrchestrationRunnerService['updateRun']>[0];

    switch (options.decision) {
      case 'continue':
        update.status = 'running';
        break;
      case 'retry': {
        update.status = 'running';
        const stepInfo = metadata.step ?? {};

        if (stepInfo.definitionId) {
          const remainingSteps = (run.completed_steps ?? []).filter(
            (id) => id !== stepInfo.definitionId,
          );
          update.completedSteps = remainingSteps;
        }
        if (typeof stepInfo.index === 'number') {
          update.currentStepIndex = stepInfo.index;
        }

        if (stepInfo.recordId) {
          const existingStep = await this.runner.getStep(stepInfo.recordId);
          if (existingStep) {
            await this.runner.updateStep(stepInfo.recordId, {
              status: 'pending',
              attempt_number: existingStep.attempt_number + 1,
              started_at: null,
              completed_at: null,
              output: null,
              error_details: null,
            });
          }
        }
        break;
      }
      case 'abort':
        update.status = 'aborted';
        update.completedAt = timestamp;
        break;
    }

    return update;
  }

  private createRequestMetadata(
    run: OrchestrationRunRecord,
    options: RequestOrchestrationCheckpointOptions,
    requestedAt: string,
  ): OrchestrationCheckpointMetadata {
    const base = this.cloneCheckpointMetadata(options.metadata);
    const step = {
      ...(base.step ?? {}),
      recordId: options.stepRecordId ?? null,
      definitionId: options.stepId ?? null,
      label: options.stepLabel ?? null,
      index: options.stepIndex ?? null,
    };

    return {
      ...base,
      runId: run.id,
      checkpointId: options.checkpointId,
      step,
      question: options.question,
      options: this.normalizeCheckpointOptions(options.options ?? base.options ?? []),
      status: 'pending',
      requestedAt,
    };
  }

  private mergeRunMetadata(
    current: OrchestrationRunMetadata | undefined,
    patch: JsonObject,
  ): OrchestrationRunMetadata {
    return {
      ...(current ?? {}),
      ...patch,
    } as OrchestrationRunMetadata;
  }

  private cloneCheckpointMetadata(
    metadata: JsonObject | undefined,
  ): OrchestrationCheckpointMetadata {
    return metadata
      ? { ...(metadata as OrchestrationCheckpointMetadata) }
      : ({} as OrchestrationCheckpointMetadata);
  }

  private normalizeCheckpointOptions(
    options: OrchestrationCheckpointOptionState[],
  ): OrchestrationCheckpointOptionState[] {
    return options.map((option) => ({ ...option }));
  }

  private cloneStepStateEntry(
    entry: OrchestrationStepStateEntry | undefined,
  ): OrchestrationStepStateEntry {
    if (!entry) {
      return {} as OrchestrationStepStateEntry;
    }

    return {
      ...entry,
      checkpoint: entry.checkpoint ? { ...entry.checkpoint } : undefined,
      metadata: entry.metadata ? { ...entry.metadata } : undefined,
      runtime: entry.runtime ? { ...entry.runtime } : undefined,
      behavior: entry.behavior ? { ...entry.behavior } : undefined,
      outputSummary: entry.outputSummary ? [...entry.outputSummary] : undefined,
    };
  }

  private createCheckpointPatch(
    patch: CheckpointStatePatch,
    existing: OrchestrationCheckpointMetadata | undefined,
  ): Partial<OrchestrationCheckpointMetadata> {
    const result: Partial<OrchestrationCheckpointMetadata> = {};

    if (patch.checkpointId !== undefined) {
      result.checkpointId = patch.checkpointId;
    }
    if (patch.question !== undefined) {
      result.question = patch.question;
    }
    if (patch.status !== undefined) {
      result.status = patch.status;
    }
    if (patch.requestedAt !== undefined) {
      result.requestedAt = patch.requestedAt;
    }
    if (patch.resolvedAt !== undefined) {
      result.resolvedAt = patch.resolvedAt;
    }
    if (patch.resolvedBy !== undefined) {
      result.resolvedBy = patch.resolvedBy;
    }
    if (patch.notes !== undefined) {
      result.notes = patch.notes;
    }
    if (patch.modifications !== undefined) {
      result.modifications = patch.modifications ?? null;
    }
    if (patch.options !== undefined) {
      result.options = this.normalizeCheckpointOptions(
        patch.options ?? existing?.options ?? [],
      );
    }

    const step = {
      ...(existing?.step ?? {}),
    } as OrchestrationCheckpointMetadata['step'];

    if (patch.stepRecordId !== undefined) {
      step.recordId = patch.stepRecordId;
    }
    if (patch.stepDefinitionId !== undefined) {
      step.definitionId = patch.stepDefinitionId;
    }
    if (patch.stepLabel !== undefined) {
      step.label = patch.stepLabel;
    }
    if (patch.stepIndex !== undefined) {
      step.index = patch.stepIndex;
    }

    if (Object.keys(step ?? {}).length > 0) {
      result.step = step;
    }

    return result;
  }
}
