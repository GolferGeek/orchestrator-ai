import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  AgentRecord,
  AgentUpsertInput,
  AgentUpsertRow,
} from '../interfaces/agent.interface';

type SupabaseError = { message: string; code?: string } | null;

type SupabaseSelectResponse<T> = {
  data: T | null;
  error: SupabaseError;
};

type SupabaseSelectListResponse<T> = {
  data: T[] | null;
  error: SupabaseError;
};

const AGENTS_TABLE = 'agents';

@Injectable()
export class AgentsRepository {
  private readonly logger = new Logger(AgentsRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  async upsert(payload: AgentUpsertInput): Promise<AgentRecord> {
    const client = this.getClient();
    const row: AgentUpsertRow = {
      organization_slug: payload.organization_slug,
      slug: payload.slug,
      display_name: payload.display_name,
      description: payload.description ?? null,
      agent_type: payload.agent_type,
      mode_profile: payload.mode_profile,
      version: payload.version ?? null,
      status: payload.status ?? null,
      yaml: payload.yaml,
      function_code: payload.function_code ?? null,
      context: payload.context ?? null,
      plan_structure: payload.plan_structure ?? null,
      deliverable_structure: payload.deliverable_structure ?? null,
      io_schema: payload.io_schema ?? null,
      config: payload.config ?? null,
      updated_at: new Date().toISOString(),
    };

    const rows = [row];

    const { data, error } = (await client
      .from(AGENTS_TABLE)
      .upsert(rows, { onConflict: 'organization_slug,slug' })
      .select()
      .maybeSingle()) as SupabaseSelectResponse<AgentRecord>;

    if (error) {
      this.logger.error(
        `Failed to upsert agent ${payload.slug}: ${error.message}`,
      );
      throw new Error(`Failed to upsert agent: ${error.message}`);
    }

    if (!data) {
      throw new Error('Upsert succeeded but no agent returned');
    }

    return data;
  }

  async findBySlug(
    organizationSlug: string | null,
    agentSlug: string,
  ): Promise<AgentRecord | null> {
    const client = this.getClient();
    let query = client
      .from(AGENTS_TABLE)
      .select('*')
      .eq('slug', agentSlug)
      .limit(1);

    query = organizationSlug
      ? query.eq('organization_slug', organizationSlug)
      : query.is('organization_slug', null);

    const { data, error } =
      (await query.maybeSingle()) as SupabaseSelectResponse<AgentRecord>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to load agent ${agentSlug}: ${error.message}`);
      throw new Error(`Failed to load agent: ${error.message}`);
    }

    return data;
  }

  async listByOrganization(
    organizationSlug: string | null,
  ): Promise<AgentRecord[]> {
    const client = this.getClient();
    let query = client.from(AGENTS_TABLE).select('*');
    query = organizationSlug
      ? query.eq('organization_slug', organizationSlug)
      : query.is('organization_slug', null);

    const { data, error } = (await query.order('slug', {
      ascending: true,
    })) as SupabaseSelectListResponse<AgentRecord>;

    if (error) {
      this.logger.error(
        `Failed to list agents for ${organizationSlug ?? 'global'}: ${error.message}`,
      );
      throw new Error(`Failed to list agents: ${error.message}`);
    }

    return data ?? [];
  }

  async listAll(): Promise<AgentRecord[]> {
    const client = this.getClient();
    const { data, error } = (await client
      .from(AGENTS_TABLE)
      .select('*')
      .order('organization_slug', { ascending: true, nullsFirst: true })
      .order('slug', {
        ascending: true,
      })) as SupabaseSelectListResponse<AgentRecord>;

    if (error) {
      this.logger.error(`Failed to list all agents: ${error.message}`);
      throw new Error(`Failed to list agents: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Returns the most recent updated_at timestamp across all agents.
   * Useful for cache invalidation polling.
   */
  async getLatestUpdatedAt(): Promise<string | null> {
    const client = this.getClient();
    const { data, error } = (await client
      .from(AGENTS_TABLE)
      .select('updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()) as SupabaseSelectResponse<{ updated_at: string }>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Failed to query latest agent updated_at: ${error.message}`,
      );
      throw new Error(
        `Failed to query latest agent updated_at: ${error.message}`,
      );
    }

    return data?.updated_at ?? null;
  }

  async deleteById(id: string): Promise<void> {
    const client = this.getClient();
    const { error } = await client.from(AGENTS_TABLE).delete().eq('id', id);
    if (error) {
      this.logger.error(`Failed to delete agent ${id}: ${error.message}`);
      throw new Error(`Failed to delete agent: ${error.message}`);
    }
  }

  async getById(id: string): Promise<AgentRecord | null> {
    const client = this.getClient();
    const { data, error } = (await client
      .from(AGENTS_TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()) as SupabaseSelectResponse<AgentRecord>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to load agent ${id}: ${error.message}`);
      throw new Error(`Failed to load agent: ${error.message}`);
    }

    return data;
  }

  async updateStatus(id: string, status: string): Promise<AgentRecord> {
    const client = this.getClient();
    const { data, error } = (await client
      .from(AGENTS_TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()) as SupabaseSelectResponse<AgentRecord>;

    if (error) {
      this.logger.error(
        `Failed to update agent ${id} status: ${error.message}`,
      );
      throw new Error(`Failed to update agent status: ${error.message}`);
    }

    if (!data) {
      throw new Error('Update succeeded but no agent returned');
    }

    return data;
  }
}
