import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  AgentOrchestrationRecord,
  AgentOrchestrationUpsertInput,
} from '../interfaces/agent-orchestration-record.interface';

interface SupabaseListResponse<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface SupabaseSingleResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

const TABLE = 'agent_orchestrations';

@Injectable()
export class AgentOrchestrationsRepository {
  private readonly logger = new Logger(AgentOrchestrationsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  private client() {
    return this.supabase.getServiceClient();
  }

  async upsert(
    input: AgentOrchestrationUpsertInput,
  ): Promise<AgentOrchestrationRecord> {
    const payload = {
      organization_slug: input.organization_slug,
      agent_slug: input.agent_slug,
      slug: input.slug,
      display_name: input.display_name,
      description: input.description ?? null,
      status: input.status ?? 'active',
      orchestration_json: input.orchestration_json,
      prompt_templates: input.prompt_templates ?? [],
      tags: input.tags ?? [],
      version: input.version ?? null,
      created_by: input.created_by ?? null,
      updated_by: input.updated_by ?? input.created_by ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = (await this.client()
      .from(TABLE)
      .upsert(payload, {
        onConflict: 'organization_slug,agent_slug,slug',
      })
      .select()
      .maybeSingle()) as SupabaseSingleResponse<AgentOrchestrationRecord>;

    if (error) {
      this.logger.error(
        `Failed to upsert agent orchestration ${input.slug}: ${error.message}`,
      );
      throw new Error(
        `Failed to upsert agent orchestration: ${error.message}`,
      );
    }

    if (!data) {
      throw new Error('Upsert succeeded but no orchestration returned');
    }

    return data;
  }

  async findBySlug(
    organizationSlug: string | null,
    agentSlug: string,
    orchestrationSlug: string,
  ): Promise<AgentOrchestrationRecord | null> {
    let query = this.client()
      .from(TABLE)
      .select('*')
      .eq('agent_slug', agentSlug)
      .eq('slug', orchestrationSlug)
      .limit(1);

    query = organizationSlug
      ? query.eq('organization_slug', organizationSlug)
      : query.is('organization_slug', null);

    const { data, error } = (await query.maybeSingle()) as SupabaseSingleResponse<AgentOrchestrationRecord>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Failed to load agent orchestration ${orchestrationSlug}: ${error.message}`,
      );
      throw new Error(
        `Failed to load agent orchestration: ${error.message}`,
      );
    }

    return data;
  }

  async listByAgent(
    organizationSlug: string | null,
    agentSlug: string,
  ): Promise<AgentOrchestrationRecord[]> {
    let query = this.client()
      .from(TABLE)
      .select('*')
      .eq('agent_slug', agentSlug);

    query = organizationSlug
      ? query.eq('organization_slug', organizationSlug)
      : query.is('organization_slug', null);

    const { data, error } = (await query.order('slug', {
      ascending: true,
    })) as SupabaseListResponse<AgentOrchestrationRecord>;

    if (error) {
      this.logger.error(
        `Failed to list orchestrations for agent ${agentSlug}: ${error.message}`,
      );
      throw new Error(
        `Failed to list agent orchestrations: ${error.message}`,
      );
    }

    return data ?? [];
  }
}
