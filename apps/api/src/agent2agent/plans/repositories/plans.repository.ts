import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { getTableName } from '@/supabase/supabase.config';

export interface PlanRecord {
  id: string;
  conversation_id: string;
  user_id: string;
  agent_name: string;
  namespace: string;
  title: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanData {
  conversation_id: string;
  user_id: string;
  agent_name: string;
  namespace: string;
  title: string;
  current_version_id?: string | null;
}

export interface UpdatePlanData {
  title?: string;
  agent_name?: string;
  namespace?: string;
  current_version_id?: string;
}

@Injectable()
export class PlansRepository {
  private readonly logger = new Logger(PlansRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create a new plan
   */
  async create(data: CreatePlanData): Promise<PlanRecord> {
    const {
      data: planData,
      error,
    }: { data: PlanRecord | null; error: unknown } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plans'))
      .insert([data])
      .select('*')
      .single();

    if (error) {
      const errorMsg =
        error && typeof error === 'object' && 'message' in error
          ? (error as Error).message
          : typeof error === 'string'
            ? error
            : JSON.stringify(error);
      throw new BadRequestException(`Failed to create plan: ${errorMsg}`);
    }

    return planData as PlanRecord;
  }

  /**
   * Find plan by conversation ID
   */
  async findByConversationId(
    conversationId: string,
    userId: string,
  ): Promise<PlanRecord | null> {
    const { data, error }: { data: PlanRecord | null; error: unknown } =
      await this.supabaseService
        .getServiceClient()
        .from(getTableName('plans'))
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
      const errorMsg =
        error && typeof error === 'object' && 'message' in error
          ? (error as Error).message
          : typeof error === 'string'
            ? error
            : JSON.stringify(error);
      throw new BadRequestException(
        `Failed to find plan by conversation: ${errorMsg}`,
      );
    }

    return data ?? null;
  }

  /**
   * Find plan by ID
   */
  async findById(id: string, userId: string): Promise<PlanRecord | null> {
    const response = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plans'))
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    const result: unknown = response.data;
    const error: unknown = response.error;

    if (error) {
      if ((error as { code?: string })?.code === 'PGRST116') {
        return null;
      }
      throw new BadRequestException(
        `Failed to find plan: ${(error as { message?: string })?.message}`,
      );
    }

    return result as PlanRecord | null;
  }

  /**
   * Update plan metadata
   */
  async update(
    id: string,
    userId: string,
    data: UpdatePlanData,
  ): Promise<PlanRecord> {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const response = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plans'))
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    const result: unknown = response.data;
    const error: unknown = response.error;

    if (error) {
      throw new BadRequestException(
        `Failed to update plan: ${(error as { message?: string })?.message}`,
      );
    }

    const planData = result as PlanRecord | null;
    if (!planData) {
      throw new BadRequestException('No data returned from plan update');
    }

    return planData;
  }

  /**
   * Delete plan (CASCADE will delete all versions)
   */
  async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plans'))
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestException(`Failed to delete plan: ${error.message}`);
    }
  }

  /**
   * Set current version
   */
  async setCurrentVersion(
    id: string,
    userId: string,
    versionId: string,
  ): Promise<PlanRecord> {
    return this.update(id, userId, { current_version_id: versionId });
  }
}
