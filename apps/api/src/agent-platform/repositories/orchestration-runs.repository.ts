import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  OrchestrationRunRecord,
  OrchestrationRunStartInput,
  OrchestrationRunUpdateInput,
} from '../interfaces/orchestration-run-record.interface';
import type { OrchestrationStepState } from '../types/orchestration-run.types';

interface SupabaseSelectResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface SupabaseListResponse<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
  count: number | null;
}

const TABLE = 'orchestration_runs';

export interface OrchestrationRunListOptions {
  organizationSlug?: string | null;
  userId?: string | null;
  statuses?: string[];
  parentRunId?: string | null;
  definitionId?: string | null;
  originType?: string | null;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'updated_at' | 'started_at' | 'completed_at';
  sortDirection?: 'asc' | 'desc';
  startedAfter?: string;
  startedBefore?: string;
  includeUnassigned?: boolean;
}

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
      user_id: input.user_id ?? null,
      status: 'pending',
      current_step_index: null,
      current_step_id: input.current_step_id ?? null,
      completed_steps: [],
      step_state: (input.step_state ?? {}) as OrchestrationStepState,
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
    const payload: Partial<OrchestrationRunUpdateInput> & {
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

  private filterUndefined<T extends object>(value: T): Partial<T> {
    const pairs = Object.entries(value as Record<string, unknown>).filter(
      ([, entry]) => entry !== undefined,
    );
    return Object.fromEntries(pairs) as Partial<T>;
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

  async list(
    options: OrchestrationRunListOptions = {},
  ): Promise<{
    data: OrchestrationRunRecord[];
    count: number | null;
    limit: number;
    offset: number;
  }> {
    const limit = this.clampLimit(options.limit ?? 25);
    const offset = Math.max(options.offset ?? 0, 0);

    let query = this.client()
      .from(TABLE)
      .select('*', { count: 'exact', head: false });

    if (options.organizationSlug) {
      query = query.eq('organization_slug', options.organizationSlug);
    } else if (options.includeUnassigned === false) {
      query = query.not('organization_slug', 'is', null);
    }

    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }

    if (options.statuses && options.statuses.length > 0) {
      query = query.in('status', options.statuses);
    }

    if (options.parentRunId !== undefined) {
      if (options.parentRunId === null) {
        query = query.is('parent_orchestration_run_id', null);
      } else {
        query = query.eq(
          'parent_orchestration_run_id',
          options.parentRunId,
        );
      }
    }

    if (options.definitionId) {
      query = query.eq(
        'orchestration_definition_id',
        options.definitionId,
      );
    }

    if (options.originType) {
      query = query.eq('origin_type', options.originType);
    }

    if (options.startedAfter) {
      query = query.gte('started_at', options.startedAfter);
    }

    if (options.startedBefore) {
      query = query.lte('started_at', options.startedBefore);
    }

    if (options.search && options.search.trim().length > 0) {
      const term = options.search.trim();
      const pattern = `%${term}%`;
      query = query.or(
        `id.ilike.${pattern},orchestration_name.ilike.${pattern},orchestration_slug.ilike.${pattern}`,
      );
    }

    const sortBy = options.sortBy ?? 'created_at';
    const ascending = (options.sortDirection ?? 'desc') === 'asc';

    query = query.order(sortBy, { ascending });

    const { data, error, count } = (await query.range(
      offset,
      offset + limit - 1,
    )) as SupabaseListResponse<OrchestrationRunRecord>;

    if (error) {
      this.logger.error(
        `Failed to list orchestration runs: ${error.message}`,
      );
      throw new Error(`Failed to list orchestration runs: ${error.message}`);
    }

    return {
      data: data ?? [],
      count: count ?? null,
      limit,
      offset,
    };
  }

  async listByIds(ids: string[]): Promise<OrchestrationRunRecord[]> {
    if (!ids.length) {
      return [];
    }

    const { data, error} = (await this.client()
      .from(TABLE)
      .select('*')
      .in('id', ids)) as SupabaseListResponse<OrchestrationRunRecord>;

    if (error) {
      this.logger.error(
        `Failed to list orchestration runs by ids: ${error.message}`,
      );
      throw new Error(`Failed to list orchestration runs: ${error.message}`);
    }

    return data ?? [];
  }

  private clampLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit <= 0) {
      return 25;
    }
    return Math.min(Math.floor(limit), 100);
  }
}
