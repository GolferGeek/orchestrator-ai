import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  OrchestrationRunRecord,
  OrchestrationRunStartInput,
  OrchestrationRunUpdateInput,
} from '../interfaces/orchestration-run-record.interface';

interface SupabaseSelectResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

const TABLE = 'orchestration_runs';

@Injectable()
export class OrchestrationRunsRepository {
  private readonly logger = new Logger(OrchestrationRunsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  private client() {
    return this.supabase.getServiceClient();
  }

  async start(
    input: OrchestrationRunStartInput,
  ): Promise<OrchestrationRunRecord> {
    const now = new Date().toISOString();
    const originType = input.origin_type ?? (input.plan_id ? 'plan' : 'ad_hoc');
    const originId =
      input.origin_id ??
      (originType === 'plan'
        ? (input.plan_id ?? null)
        : (input.origin_id ?? null));

    const payload = {
      plan_id: input.plan_id ?? null,
      orchestration_definition_id: input.orchestration_definition_id ?? null,
      orchestration_name: input.orchestration_name ?? null,
      conversation_id: input.conversation_id ?? null,
      parent_orchestration_run_id: input.parent_orchestration_run_id ?? null,
      origin_type: originType,
      origin_id: originId,
      orchestration_slug: input.orchestration_slug ?? null,
      parameters: input.parameters ?? {},
      organization_slug: input.organization_slug,
      status: 'pending',
      current_step_index: null,
      current_step_id: input.current_step_id ?? null,
      completed_steps: [],
      step_state: {},
      human_checkpoint_id: null,
      plan: input.plan ?? {},
      results: input.results ?? {},
      error_details: input.error_details ?? {},
      metadata: input.metadata ?? {},
      created_by: input.created_by ?? null,
      started_at: input.started_at ?? now,
      updated_at: now,
    };

    const { data, error } = (await this.client()
      .from(TABLE)
      .insert([payload])
      .select()
      .maybeSingle()) as SupabaseSelectResponse<OrchestrationRunRecord>;

    if (error) {
      this.logger.error(`Failed to create orchestration run: ${error.message}`);
      throw new Error(`Failed to create orchestration run: ${error.message}`);
    }

    if (!data) {
      throw new Error(
        'Orchestration run insert succeeded but returned no data',
      );
    }

    return data;
  }

  async update(
    id: string,
    patch: OrchestrationRunUpdateInput,
  ): Promise<OrchestrationRunRecord> {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    Object.entries(patch).forEach(([key, value]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });

    const { data, error } = (await this.client()
      .from(TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle()) as SupabaseSelectResponse<OrchestrationRunRecord>;

    if (error) {
      this.logger.error(
        `Failed to update orchestration run ${id}: ${error.message}`,
      );
      throw new Error(`Failed to update orchestration run: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Orchestration run ${id} not found for update`);
    }

    return data;
  }

  async getById(id: string): Promise<OrchestrationRunRecord | null> {
    const { data, error } = (await this.client()
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()) as SupabaseSelectResponse<OrchestrationRunRecord>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Failed to load orchestration run ${id}: ${error.message}`,
      );
      throw new Error(`Failed to load orchestration run: ${error.message}`);
    }

    return data;
  }
}
