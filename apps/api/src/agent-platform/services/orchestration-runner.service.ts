import { Injectable, Logger } from '@nestjs/common';
import { OrchestrationRunsRepository } from '../repositories/orchestration-runs.repository';
import {
  OrchestrationRunRecord,
  OrchestrationRunStartInput,
} from '../interfaces/orchestration-run-record.interface';

export interface OrchestrationStartInput {
  planId?: string | null;
  organizationSlug: string | null;
  metadata?: Record<string, any>;
  originType?: 'plan' | 'saved_orchestration' | 'ad_hoc';
  originId?: string | null;
  orchestrationSlug?: string | null;
  promptInputs?: Record<string, any>;
}

export type OrchestrationProgressUpdate = {
  runId: string;
  status?: string;
  currentStepIndex?: number | null;
  completedSteps?: string[];
  stepState?: Record<string, any>;
  humanCheckpointId?: string | null;
  metadata?: Record<string, any>;
  completedAt?: string | null;
};

@Injectable()
export class OrchestrationRunnerService {
  private readonly logger = new Logger(OrchestrationRunnerService.name);

  constructor(
    private readonly runsRepository: OrchestrationRunsRepository,
  ) {}

  async startRun(
    input: OrchestrationStartInput,
  ): Promise<OrchestrationRunRecord> {
    this.logger.debug(
      `Starting orchestration run for plan ${input.planId ?? 'n/a'}`,
    );
    const originType =
      input.originType ?? (input.planId ? 'plan' : 'ad_hoc');
    const originId =
      input.originId ?? (originType === 'plan' ? input.planId ?? null : null);
    return this.runsRepository.start({
      plan_id: input.planId,
      origin_type: originType,
      origin_id: originId,
      orchestration_slug: input.orchestrationSlug ?? null,
      prompt_inputs: input.promptInputs,
      organization_slug: input.organizationSlug,
      metadata: input.metadata ?? {},
    } satisfies OrchestrationRunStartInput);
  }

  async updateRun(
    update: OrchestrationProgressUpdate,
  ): Promise<OrchestrationRunRecord> {
    this.logger.debug(`Updating orchestration run ${update.runId}`);
    const { runId, ...rest } = update;
    return this.runsRepository.update(runId, {
      status: rest.status,
      current_step_index: rest.currentStepIndex,
      completed_steps: rest.completedSteps,
      step_state: rest.stepState,
      human_checkpoint_id: rest.humanCheckpointId,
      metadata: rest.metadata,
      completed_at: rest.completedAt,
    });
  }

  async getRun(runId: string): Promise<OrchestrationRunRecord | null> {
    return this.runsRepository.getById(runId);
  }
}
