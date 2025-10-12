import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  OrchestrationDefinitionCreateInput,
  OrchestrationDefinitionRecord,
  OrchestrationDefinitionUpdateInput,
} from '../interfaces/orchestration-definition.interface';

interface SupabaseListResponse<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface SupabaseSingleResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

const TABLE = 'orchestration_definitions';

@Injectable()
export class OrchestrationDefinitionsRepository {
  private readonly logger = new Logger(
    OrchestrationDefinitionsRepository.name,
  );

  constructor(private readonly supabase: SupabaseService) {}

  private client() {
    return this.supabase.getServiceClient();
  }

  async create(
    input: OrchestrationDefinitionCreateInput,
  ): Promise<OrchestrationDefinitionRecord> {
    const now = new Date().toISOString();

    const payload = {
      owner_agent_slug: input.owner_agent_slug,
      organization_slug: input.organization_slug,
      name: input.name,
      display_name: input.display_name,
      version: input.version ?? '1.0.0',
      description: input.description ?? null,
      definition: input.definition,
      status: input.status ?? 'active',
      created_by: input.created_by ?? null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = (await this.client()
      .from(TABLE)
      .insert([payload])
      .select()
      .maybeSingle()) as SupabaseSingleResponse<OrchestrationDefinitionRecord>;

    if (error) {
      this.logger.error(
        `Failed to create orchestration definition: ${error.message}`,
      );
      throw new Error(
        `Failed to create orchestration definition: ${error.message}`,
      );
    }

    if (!data) {
      throw new Error(
        'Orchestration definition insert succeeded but returned no data',
      );
    }

    return data;
  }

  async update(
    id: string,
    patch: OrchestrationDefinitionUpdateInput,
  ): Promise<OrchestrationDefinitionRecord> {
    const payload: Record<string, unknown> = {
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
      .maybeSingle()) as SupabaseSingleResponse<OrchestrationDefinitionRecord>;

    if (error) {
      this.logger.error(
        `Failed to update orchestration definition ${id}: ${error.message}`,
      );
      throw new Error(
        `Failed to update orchestration definition: ${error.message}`,
      );
    }

    if (!data) {
      throw new Error(`Orchestration definition ${id} not found for update`);
    }

    return data;
  }

  async getById(id: string): Promise<OrchestrationDefinitionRecord | null> {
    const { data, error } = (await this.client()
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()) as SupabaseSingleResponse<OrchestrationDefinitionRecord>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Failed to load orchestration definition ${id}: ${error.message}`,
      );
      throw new Error(
        `Failed to load orchestration definition: ${error.message}`,
      );
    }

    return data;
  }

  async findByOwnerAndName(
    ownerAgentSlug: string,
    organizationSlug: string,
    name: string,
    version?: string,
  ): Promise<OrchestrationDefinitionRecord | null> {
    let query = this.client()
      .from(TABLE)
      .select('*')
      .eq('owner_agent_slug', ownerAgentSlug)
      .eq('organization_slug', organizationSlug)
      .eq('name', name)
      .order('version', { ascending: false })
      .limit(1);

    if (version) {
      query = query.eq('version', version);
    }

    const { data, error } = (await query.maybeSingle()) as SupabaseSingleResponse<OrchestrationDefinitionRecord>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Failed to load orchestration definition ${name}: ${error.message}`,
      );
      throw new Error(
        `Failed to load orchestration definition: ${error.message}`,
      );
    }

    return data;
  }

  async listByOrganization(
    organizationSlug: string,
  ): Promise<OrchestrationDefinitionRecord[]> {
    const { data, error } = (await this.client()
      .from(TABLE)
      .select('*')
      .eq('organization_slug', organizationSlug)
      .order('updated_at', { ascending: false })) as SupabaseListResponse<OrchestrationDefinitionRecord>;

    if (error) {
      this.logger.error(
        `Failed to list orchestration definitions: ${error.message}`,
      );
      throw new Error(
        `Failed to list orchestration definitions: ${error.message}`,
      );
    }

    return data ?? [];
  }
}
