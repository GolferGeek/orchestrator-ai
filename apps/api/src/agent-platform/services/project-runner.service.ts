import { Injectable, Logger } from '@nestjs/common';
import { ProjectRunsRepository } from '../repositories/project-runs.repository';
import { ProjectRunRecord } from '../interfaces/project-run-record.interface';

export interface StartRunInput {
  planId: string;
  organizationSlug: string | null;
  metadata?: Record<string, any>;
}

export interface StepProgressUpdate {
  runId: string;
  status?: string;
  currentStepIndex?: number | null;
  completedSteps?: string[];
  stepState?: Record<string, any>;
  humanCheckpointId?: string | null;
  metadata?: Record<string, any>;
  completedAt?: string | null;
}

@Injectable()
export class ProjectRunnerService {
  private readonly logger = new Logger(ProjectRunnerService.name);

  constructor(private readonly runsRepository: ProjectRunsRepository) {}

  async startRun(input: StartRunInput): Promise<ProjectRunRecord> {
    this.logger.debug(`Starting project run for plan ${input.planId}`);
    return this.runsRepository.start({
      plan_id: input.planId,
      organization_slug: input.organizationSlug,
      metadata: input.metadata ?? {},
    });
  }

  async updateRun(update: StepProgressUpdate): Promise<ProjectRunRecord> {
    this.logger.debug(`Updating project run ${update.runId}`);
    return this.runsRepository.update(update.runId, {
      status: update.status,
      current_step_index: update.currentStepIndex,
      completed_steps: update.completedSteps,
      step_state: update.stepState,
      human_checkpoint_id: update.humanCheckpointId,
      metadata: update.metadata,
      completed_at: update.completedAt,
    });
  }

  async getRun(runId: string): Promise<ProjectRunRecord | null> {
    return this.runsRepository.getById(runId);
  }
}
