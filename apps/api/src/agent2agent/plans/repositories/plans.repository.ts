import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { getTableName } from '@/supabase/supabase.config';

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
  async create(data: CreatePlanData) {
    const { data: planData, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plans'))
      .insert([data])
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(`Failed to create plan: ${error.message}`);
    }

    return planData;
  }

  /**
   * Find plan by conversation ID
   */
  async findByConversationId(conversationId: string, userId: string) {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plans'))
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        `Failed to find plan by conversation: ${error.message}`,
      );
    }

    return data;
  }

  /**
   * Find plan by ID
   */
  async findById(id: string, userId: string) {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plans'))
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new BadRequestException(`Failed to find plan: ${error.message}`);
    }

    return data;
  }

  /**
   * Update plan metadata
   */
  async update(id: string, userId: string, data: UpdatePlanData) {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: planData, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('plans'))
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update plan: ${error.message}`);
    }

    return planData;
  }

  /**
   * Delete plan (CASCADE will delete all versions)
   */
  async delete(id: string, userId: string) {
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
  async setCurrentVersion(id: string, userId: string, versionId: string) {
    return this.update(id, userId, { current_version_id: versionId });
  }
}
