import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { getTableName } from '@/supabase/supabase.config';

export interface CreatePlanVersionData {
  plan_id: string;
  version_number: number;
  content: string;
  format: 'markdown' | 'json' | 'text';
  created_by_type: 'agent' | 'user';
  created_by_id?: string;
  task_id?: string;
  metadata?: Record<string, any>;
  is_current_version: boolean;
}

@Injectable()
export class PlanVersionsRepository {
  private readonly logger = new Logger(PlanVersionsRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create a new plan version
   */
  async create(data: CreatePlanVersionData) {
    const { data: versionData, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plan_versions'))
      .insert([data])
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to create plan version: ${error.message}`,
      );
    }

    return versionData;
  }

  /**
   * Find version by ID
   */
  async findById(versionId: string) {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plan_versions'))
      .select('*')
      .eq('id', versionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new BadRequestException(
        `Failed to find plan version: ${error.message}`,
      );
    }

    return data;
  }

  /**
   * Find all versions for a plan
   */
  async findByPlanId(planId: string) {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plan_versions'))
      .select('*')
      .eq('plan_id', planId)
      .order('version_number', { ascending: true });

    if (error) {
      throw new BadRequestException(
        `Failed to find plan versions: ${error.message}`,
      );
    }

    return data || [];
  }

  /**
   * Get current version for a plan
   */
  async getCurrentVersion(planId: string) {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plan_versions'))
      .select('*')
      .eq('plan_id', planId)
      .eq('is_current_version', true)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        `Failed to get current plan version: ${error.message}`,
      );
    }

    return data;
  }

  /**
   * Get next version number for a plan
   */
  async getNextVersionNumber(planId: string): Promise<number> {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plan_versions'))
      .select('version_number')
      .eq('plan_id', planId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        `Failed to get next version number: ${error.message}`,
      );
    }

    return data ? data.version_number + 1 : 1;
  }

  /**
   * Mark a version as current
   */
  async markAsCurrent(versionId: string) {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plan_versions'))
      .update({ is_current_version: true })
      .eq('id', versionId)
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to mark version as current: ${error.message}`,
      );
    }

    return data;
  }

  /**
   * Mark all versions as not current for a plan
   */
  async markAllAsNotCurrent(planId: string) {
    const { error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plan_versions'))
      .update({ is_current_version: false })
      .eq('plan_id', planId);

    if (error) {
      throw new BadRequestException(
        `Failed to mark versions as not current: ${error.message}`,
      );
    }
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(versionId: string) {
    const { error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plan_versions'))
      .delete()
      .eq('id', versionId);

    if (error) {
      throw new BadRequestException(
        `Failed to delete plan version: ${error.message}`,
      );
    }
  }
}
