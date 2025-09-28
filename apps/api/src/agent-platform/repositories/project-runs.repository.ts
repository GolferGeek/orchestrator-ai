import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  ProjectRunRecord,
  ProjectRunStartInput,
  ProjectRunUpdateInput,
} from '../interfaces/project-run-record.interface';

interface SupabaseSelectResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

const TABLE = 'project_runs';

@Injectable()
export class ProjectRunsRepository {
  private readonly logger = new Logger(ProjectRunsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  private client() {
    return this.supabase.getServiceClient();
  }

  async start(
    input: ProjectRunStartInput,
  ): Promise<ProjectRunRecord> {
    const now = new Date().toISOString();
    const { data, error } = (await this.client()
      .from(TABLE)
      .insert([
        {
          plan_id: input.plan_id,
          organization_slug: input.organization_slug,
          status: 'pending',
          metadata: input.metadata ?? {},
          started_at: now,
          updated_at: now,
        },
      ])
      .select()
      .maybeSingle()) as SupabaseSelectResponse<ProjectRunRecord>;

    if (error) {
      this.logger.error(`Failed to create project run: ${error.message}`);
      throw new Error(`Failed to create project run: ${error.message}`);
    }

    if (!data) {
      throw new Error('Project run insert succeeded but returned no data');
    }

    return data;
  }

  async update(
    id: string,
    patch: ProjectRunUpdateInput,
  ): Promise<ProjectRunRecord> {
    const payload: Record<string, any> = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = (await this.client()
      .from(TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle()) as SupabaseSelectResponse<ProjectRunRecord>;

    if (error) {
      this.logger.error(`Failed to update project run ${id}: ${error.message}`);
      throw new Error(`Failed to update project run: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Project run ${id} not found for update`);
    }

    return data;
  }

  async getById(id: string): Promise<ProjectRunRecord | null> {
    const { data, error } = (await this.client()
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()) as SupabaseSelectResponse<ProjectRunRecord>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to load project run ${id}: ${error.message}`);
      throw new Error(`Failed to load project run: ${error.message}`);
    }

    return data;
  }
}
