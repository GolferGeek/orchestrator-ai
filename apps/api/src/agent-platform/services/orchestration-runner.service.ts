import { Injectable, Logger } from '@nestjs/common';
import { OrchestrationRunsRepository } from '../repositories/orchestration-runs.repository';
import {
  OrchestrationRunRecord,
  OrchestrationRunStartInput,
} from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepsRepository } from '../repositories/orchestration-steps.repository';
import {
  OrchestrationStepInsertInput,
  OrchestrationStepRecord,
  OrchestrationStepUpdateInput,
} from '../interfaces/orchestration-step-record.interface';
import type {
  OrchestrationAgentMetadata,
  OrchestrationRunErrorDetails,
  OrchestrationRunMetadata,
  OrchestrationRunParameters,
  OrchestrationRunPlan,
  OrchestrationRunResults,
  OrchestrationStepState,
} from '../types/orchestration-run.types';

export interface OrchestrationStartInput {
  planId?: string | null;
  orchestrationDefinitionId?: string | null;
  orchestrationName?: string | null;
  conversationId?: string | null;
  parentOrchestrationRunId?: string | null;
  organizationSlug: string | null;
  metadata?: OrchestrationRunMetadata;
  originType?: 'plan' | 'saved_orchestration' | 'ad_hoc';
  originId?: string | null;
  orchestrationSlug?: string | null;
  parameters?: OrchestrationRunParameters;
  plan?: OrchestrationRunPlan;
  results?: OrchestrationRunResults;
  errorDetails?: OrchestrationRunErrorDetails;
  agentId?: string | null;
  agentSlug?: string | null;
  agentType?: string | null;
  agentDisplayName?: string | null;
  createdBy?: string | null;
  currentStepId?: string | null;
}

export type OrchestrationProgressUpdate = {
  runId: string;
  status?: string;
  currentStepIndex?: number | null;
  currentStepId?: string | null;
  completedSteps?: string[];
  stepState?: OrchestrationStepState;
  humanCheckpointId?: string | null;
  metadata?: OrchestrationRunMetadata;
  completedAt?: string | null;
  parameters?: OrchestrationRunParameters;
  plan?: OrchestrationRunPlan;
  results?: OrchestrationRunResults;
  errorDetails?: OrchestrationRunErrorDetails;
};

@Injectable()
export class OrchestrationRunnerService {
  private readonly logger = new Logger(OrchestrationRunnerService.name);

  constructor(
    private readonly runsRepository: OrchestrationRunsRepository,
    private readonly stepsRepository: OrchestrationStepsRepository,
  ) {}

  async startRun(
    input: OrchestrationStartInput,
  ): Promise<OrchestrationRunRecord> {
    this.logger.debug(
      `Starting orchestration run for plan ${input.planId ?? 'n/a'}`,
    );
    const originType = input.originType ?? (input.planId ? 'plan' : 'ad_hoc');
    const originId =
      input.originId ?? (originType === 'plan' ? (input.planId ?? null) : null);
    const metadata: OrchestrationRunMetadata = {
      ...(input.metadata ?? {}),
    };
    if (
      input.agentId ||
      input.agentSlug ||
      input.agentType ||
      input.agentDisplayName
    ) {
      metadata.agent = {
        id: input.agentId ?? null,
        slug: input.agentSlug ?? null,
        type: input.agentType ?? null,
        displayName: input.agentDisplayName ?? null,
        organizationSlug: input.organizationSlug ?? null,
      } satisfies OrchestrationAgentMetadata;
    }
    return this.runsRepository.start({
      plan_id: input.planId,
      orchestration_definition_id: input.orchestrationDefinitionId ?? null,
      orchestration_name: input.orchestrationName ?? null,
      conversation_id: input.conversationId ?? null,
      parent_orchestration_run_id: input.parentOrchestrationRunId ?? null,
      origin_type: originType,
      origin_id: originId,
      orchestration_slug: input.orchestrationSlug ?? null,
      parameters: input.parameters,
      organization_slug: input.organizationSlug,
      current_step_id: input.currentStepId ?? null,
      plan: input.plan,
      results: input.results,
      error_details: input.errorDetails,
      metadata,
      created_by: input.createdBy ?? null,
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
      current_step_id: rest.currentStepId ?? null,
      completed_steps: rest.completedSteps,
      step_state: rest.stepState,
      human_checkpoint_id: rest.humanCheckpointId,
      metadata: rest.metadata,
      completed_at: rest.completedAt,
      parameters: rest.parameters,
      plan: rest.plan,
      results: rest.results,
      error_details: rest.errorDetails,
    });
  }

  async getRun(runId: string): Promise<OrchestrationRunRecord | null> {
    return this.runsRepository.getById(runId);
  }

  async createStep(
    input: OrchestrationStepInsertInput,
  ): Promise<OrchestrationStepRecord> {
    this.logger.debug(
      `Creating orchestration step ${input.step_id ?? `#${input.step_index}`} for run ${input.orchestration_run_id}`,
    );
    return this.stepsRepository.create(input);
  }

  async updateStep(
    id: string,
    patch: OrchestrationStepUpdateInput,
  ): Promise<OrchestrationStepRecord> {
    this.logger.debug(`Updating orchestration step ${id}`);
    return this.stepsRepository.update(id, patch);
  }

  async listSteps(runId: string): Promise<OrchestrationStepRecord[]> {
    return this.stepsRepository.listByRunId(runId);
  }

  async getStep(stepId: string): Promise<OrchestrationStepRecord | null> {
    return this.stepsRepository.getById(stepId);
  }
}
