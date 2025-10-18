import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  OrchestrationStepInsertInput,
  OrchestrationStepRecord,
  OrchestrationStepUpdateInput,
} from '../interfaces/orchestration-step-record.interface';
import type { OrchestrationStepStateEntry } from '../types/orchestration-run.types';

interface SupabaseSingleResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface SupabaseListResponse<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

const TABLE = 'orchestration_steps';

@Injectable()
export class OrchestrationStepsRepository {
  private readonly logger = new Logger(OrchestrationStepsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  private client() {
    return this.supabase.getServiceClient();
  }

  async create(
    input: OrchestrationStepInsertInput,
  ): Promise<OrchestrationStepRecord> {
    const payload = {
      orchestration_run_id: input.orchestration_run_id,
      step_index: input.step_index,
      step_id: input.step_id ?? null,
      status: input.status ?? 'pending',
      agent_slug: input.agent_slug ?? null,
      mode: input.mode ?? 'BUILD',
      conversation_id: input.conversation_id ?? null,
      plan_id: input.plan_id ?? null,
      deliverable_id: input.deliverable_id ?? null,
      depends_on: input.depends_on ?? [],
      attempt_number: input.attempt_number ?? 1,
      checkpoint_decision: input.checkpoint_decision ?? null,
      checkpoint_decided_by: input.checkpoint_decided_by ?? null,
      checkpoint_decided_at: input.checkpoint_decided_at ?? null,
      invalidated_at: input.invalidated_at ?? null,
      invalidated_reason: input.invalidated_reason ?? null,
      input: input.input ?? {},
      output: input.output ?? null,
      metadata: (input.metadata ?? {}) as OrchestrationStepStateEntry,
      error_details: input.error_details ?? null,
      started_at: input.started_at ?? null,
      completed_at: input.completed_at ?? null,
    } satisfies OrchestrationStepInsertInput;

    const { data, error } = (await this.client()
      .from(TABLE)
      .insert([payload])
      .select()
      .maybeSingle()) as SupabaseSingleResponse<OrchestrationStepRecord>;

    if (error) {
      this.logger.error(
        `Failed to create orchestration step: ${error.message}`,
      );
      throw new Error(`Failed to create orchestration step: ${error.message}`);
    }

    if (!data) {
      throw new Error('Orchestration step insert succeeded with no data');
    }

    return data;
  }

  async update(
    id: string,
    patch: OrchestrationStepUpdateInput,
  ): Promise<OrchestrationStepRecord> {
    const payload: Partial<OrchestrationStepUpdateInput> & {
      updated_at: string;
    } = {
      ...this.filterUndefined(patch),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = (await this.client()
      .from(TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle()) as SupabaseSingleResponse<OrchestrationStepRecord>;

    if (error) {
      this.logger.error(
        `Failed to update orchestration step ${id}: ${error.message}`,
      );
      throw new Error(`Failed to update orchestration step: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Orchestration step ${id} not found for update`);
    }

    return data;
  }

  async getById(id: string): Promise<OrchestrationStepRecord | null> {
    const { data, error } = (await this.client()
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()) as SupabaseSingleResponse<OrchestrationStepRecord>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Failed to load orchestration step ${id}: ${error.message}`,
      );
      throw new Error(`Failed to load orchestration step: ${error.message}`);
    }

    return data;
  }

  async listByRunId(
    orchestrationRunId: string,
  ): Promise<OrchestrationStepRecord[]> {
    const { data, error } = (await this.client()
      .from(TABLE)
      .select('*')
      .eq('orchestration_run_id', orchestrationRunId)
      .order('step_index', {
        ascending: true,
      })) as SupabaseListResponse<OrchestrationStepRecord>;

    if (error) {
      this.logger.error(
        `Failed to list orchestration steps for run ${orchestrationRunId}: ${error.message}`,
      );
      throw new Error(`Failed to list orchestration steps: ${error.message}`);
    }

    return data ?? [];
  }

  private filterUndefined<T extends Record<string, unknown>>(
    value: T,
  ): Partial<T> {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined),
    ) as Partial<T>;
  }
}
