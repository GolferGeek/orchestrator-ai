import { Injectable } from '@nestjs/common';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationEventsService } from './orchestration-events.service';
import { HumanApprovalsRepository } from '../repositories/human-approvals.repository';

@Injectable()
export class OrchestrationStatusService {
  constructor(
    private readonly runner: OrchestrationRunnerService,
    private readonly events: OrchestrationEventsService,
    private readonly approvals: HumanApprovalsRepository,
  ) {}

  async getRunStatus(runId: string): Promise<{
    run: ReturnType<OrchestrationEventsService['snapshotRun']>;
    steps: ReturnType<OrchestrationEventsService['snapshotStep']>[];
    currentStep: ReturnType<OrchestrationEventsService['snapshotStep']> | null;
    pendingApprovals: Array<{
      id: string;
      status: string;
      mode: string;
      stepId: string | null;
      createdAt: string | null;
      metadata: Record<string, unknown> | null;
      conversationId: string | null;
      organizationSlug: string | null;
    }>;
    summary: {
      totalSteps: number;
      completedSteps: number;
      progressPercentage: number | null;
      pendingApprovals: number;
    };
  } | null> {
    const run = await this.runner.getRun(runId);
    if (!run) {
      return null;
    }

    const steps = await this.runner.listSteps(runId);
    const totalSteps = steps.length;
    const runSnapshot = this.events.snapshotRun(run, { totalSteps });
    const stepSnapshots = steps
      .sort((a, b) => a.step_index - b.step_index)
      .map((step) => this.events.snapshotStep(run, step));

    const currentStep = this.resolveCurrentStep(
      runSnapshot.currentStepId,
      stepSnapshots,
    );

    const pendingApprovals = await this.approvals.listPendingByRun(runId);

    return {
      run: runSnapshot,
      steps: stepSnapshots,
      currentStep,
      pendingApprovals: pendingApprovals.map((approval) => ({
        id: approval.id,
        status: approval.status,
        mode: approval.mode,
        stepId: approval.orchestration_step_id ?? null,
        createdAt: approval.created_at ?? null,
        metadata: approval.metadata ?? null,
        conversationId: approval.conversation_id ?? null,
        organizationSlug: approval.organization_slug ?? null,
      })),
      summary: {
        totalSteps,
        completedSteps: runSnapshot.stats.completedSteps,
        progressPercentage: runSnapshot.stats.progressPercentage ?? null,
        pendingApprovals: pendingApprovals.length,
      },
    };
  }

  private resolveCurrentStep(
    currentStepId: string | null,
    steps: Array<ReturnType<OrchestrationEventsService['snapshotStep']>>,
  ): ReturnType<OrchestrationEventsService['snapshotStep']> | null {
    if (!currentStepId) {
      return null;
    }
    return (
      steps.find((step) => step.id === currentStepId) ??
      this.findFallbackStep(currentStepId, steps)
    );
  }

  private findFallbackStep(
    currentStepId: string,
    steps: Array<ReturnType<OrchestrationEventsService['snapshotStep']>>,
  ): ReturnType<OrchestrationEventsService['snapshotStep']> | null {
    const indexMatch = steps.find(
      (step) => `index_${step.index}` === currentStepId,
    );
    if (indexMatch) {
      return indexMatch;
    }
    return steps.length > 0 ? (steps[steps.length - 1] ?? null) : null;
  }
}
