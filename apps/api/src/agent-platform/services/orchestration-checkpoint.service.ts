import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HumanApprovalsRepository } from '../repositories/human-approvals.repository';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';

export type OrchestrationCheckpointDecision =
  | 'continue'
  | 'retry'
  | 'abort';

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
  options?: Array<{
    action: OrchestrationCheckpointDecision;
    label: string;
    allowsModification?: boolean;
    description?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface ResolveOrchestrationCheckpointOptions {
  approvalId: string;
  decision: OrchestrationCheckpointDecision;
  actorId?: string | null;
  notes?: string | null;
  modifications?: Record<string, any>;
}

interface StepStateEntry {
  status?: string;
  checkpoint?: Record<string, any>;
  [key: string]: any;
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
    const checkpointMetadata = {
      ...(options.metadata ?? {}),
      runId: run.id,
      checkpointId: options.checkpointId,
      step: {
        recordId: options.stepRecordId ?? null,
        definitionId: options.stepId ?? null,
        label: options.stepLabel ?? null,
        index: options.stepIndex ?? null,
      },
      question: options.question,
      options: options.options ?? [],
      status: 'pending',
      requestedAt,
    };

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
      metadata: {
        ...(run.metadata ?? {}),
        lastCheckpoint: {
          approvalId: approval.id,
          checkpointId: options.checkpointId,
          step: checkpointMetadata.step,
          requestedAt,
        },
      },
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
    approval: Awaited<
      ReturnType<HumanApprovalsRepository['setStatus']>
    >;
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
    };

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
    checkpointPatch: Record<string, any>,
  ): Record<string, StepStateEntry> {
    const stepDefinitionId =
      checkpointPatch.stepDefinitionId ??
      (run.metadata?.lastCheckpoint?.step?.definitionId as string | null) ??
      null;
    const stepRecordId =
      checkpointPatch.stepRecordId ??
      (run.metadata?.lastCheckpoint?.step?.recordId as string | null) ??
      null;
    const key = stepDefinitionId ?? stepRecordId ?? 'plan';
    const existingState: StepStateEntry = {
      ...(run.step_state?.[key] ?? {}),
    };

    const checkpointState = {
      ...(existingState.checkpoint ?? {}),
      approvalId,
      ...checkpointPatch,
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
    metadata: Record<string, any>,
    options: ResolveOrchestrationCheckpointOptions,
    stepState: Record<string, StepStateEntry>,
    timestamp: string,
  ) {
    const update = {
      runId: run.id,
      humanCheckpointId: null as string | null,
      stepState,
      metadata: {
        ...(run.metadata ?? {}),
        lastCheckpoint: {
          ...(run.metadata?.lastCheckpoint ?? {}),
          decision: options.decision,
          decidedAt: timestamp,
          decidedBy: options.actorId ?? null,
          notes: options.notes ?? null,
        },
      },
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
}
