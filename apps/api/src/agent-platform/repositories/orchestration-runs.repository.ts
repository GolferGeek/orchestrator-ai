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
    const { data, error } = (await this.client()
      .from(TABLE)
      .insert([
        {
          plan_id: input.plan_id ?? null,
          origin_type: input.origin_type ?? (input.plan_id ? 'plan' : 'ad_hoc'),
          origin_id: input.origin_id ?? input.plan_id ?? null,
          orchestration_slug: input.orchestration_slug ?? null,
          prompt_inputs: input.prompt_inputs ?? {},
          organization_slug: input.organization_slug,
          status: 'pending',
          metadata: input.metadata ?? {},
          started_at: now,
          updated_at: now,
        },
      ])
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
      ...patch,
      updated_at: new Date().toISOString(),
    };

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
