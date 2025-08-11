import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AgentConversation,
  AgentConversationWithStats,
  CreateAgentConversationDto,
  AgentConversationQueryParams,
  AgentType,
} from '../common/types/agent-conversations.types';

@Injectable()
export class AgentConversationsService {
  private readonly logger = new Logger(AgentConversationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Validate agent type matches database constraints
   */
  private validateAgentType(agentType: string): AgentType {
    // Ensure the type is one of the allowed values
    const validTypes: AgentType[] = [
      'orchestrator',
      'specialist',
      'marketing',
      'finance',
      'hr',
      'operations',
      'sales',
      'legal',
      'engineering',
      'product',
      'research',
    ];
    if (validTypes.includes(agentType as AgentType)) {
      return agentType as AgentType;
    }

    // Default to 'specialist' if type is not recognized
    this.logger.warn(
      `Unknown agent type "${agentType}", defaulting to "specialist"`,
    );
    return 'specialist';
  }

  /**
   * Create a new agent conversation
   */
  async createConversation(
    userId: string,
    dto: CreateAgentConversationDto,
  ): Promise<AgentConversation> {
    try {
      const validatedAgentType = this.validateAgentType(dto.agentType);

      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('agent_conversations')
        .insert({
          user_id: userId,
          agent_name: dto.agentName,
          agent_type: validatedAgentType,
          metadata: dto.metadata || {},
          ...(dto.workProduct && {
            primary_work_product_type: dto.workProduct.type,
            primary_work_product_id: dto.workProduct.id,
          }),
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating agent conversation:', error);
        throw new Error(`Failed to create conversation: ${error.message}`);
      }

      return this.mapToAgentConversation(data);
    } catch (error) {
      this.logger.error('Error in createConversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(
    conversationId: string,
    userId: string,
  ): Promise<AgentConversation | null> {
    try {
      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('agent_conversations')
        .select()
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows found"
        this.logger.error('Error fetching conversation:', error);
        throw new Error(`Failed to fetch conversation: ${error.message}`);
      }

      return data ? this.mapToAgentConversation(data) : null;
    } catch (error) {
      this.logger.error('Error in getConversationById:', error);
      throw error;
    }
  }

  /**
   * Get or create a conversation for an agent
   */
  async getOrCreateConversation(
    userId: string,
    agentName: string,
    agentType: AgentType,
    existingConversationId?: string | null,
  ): Promise<AgentConversation> {
    try {
      // If a conversation ID was provided, validate it exists and belongs to the user
      if (existingConversationId) {
        const { data: existing } = await this.supabaseService
          .getAnonClient()
          .from('agent_conversations')
          .select()
          .eq('id', existingConversationId)
          .eq('user_id', userId)
          .eq('agent_name', agentName)
          .eq('agent_type', agentType)
          .single();

        if (existing) {
          return this.mapToAgentConversation(existing);
        }

        // If provided conversation ID doesn't exist or doesn't match, log warning and create new
        this.logger.warn(
          `Conversation ${existingConversationId} not found or doesn't match user/agent, creating new conversation`,
        );
      }

      // First try to find an active conversation
      const { data: existing } = await this.supabaseService
        .getAnonClient()
        .from('agent_conversations')
        .select()
        .eq('user_id', userId)
        .eq('agent_name', agentName)
        .eq('agent_type', agentType)
        .is('ended_at', null)
        .order('last_active_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        return this.mapToAgentConversation(existing[0]);
      }

      // Create new conversation if none exists
      return this.createConversation(userId, {
        agentName,
        agentType,
      });
    } catch (error) {
      this.logger.error('Error in getOrCreateConversation:', error);
      throw error;
    }
  }

  /**
   * List conversations with optional filters
   */
  async listConversations(
    params: AgentConversationQueryParams,
  ): Promise<{ conversations: AgentConversationWithStats[]; total: number }> {
    try {
      let query = this.supabaseService
        .getAnonClient()
        .from('agent_conversations_with_stats')
        .select('*', { count: 'exact' });

      // Apply filters
      if (params.userId) {
        query = query.eq('user_id', params.userId);
      }
      if (params.agentName) {
        query = query.eq('agent_name', params.agentName);
      }
      if (params.agentType) {
        query = query.eq('agent_type', params.agentType);
      }
      if (params.activeOnly) {
        query = query.is('ended_at', null);
      }

      // Apply pagination
      const limit = params.limit || 50;
      const offset = params.offset || 0;
      query = query
        .order('last_active_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Error listing conversations:', error);
        throw new Error(`Failed to list conversations: ${error.message}`);
      }

      return {
        conversations: data.map((item) =>
          this.mapToAgentConversationWithStats(item),
        ),
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Error in listConversations:', error);
      throw error;
    }
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getAnonClient()
        .from('agent_conversations')
        .update({
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Error ending conversation:', error);
        throw new Error(`Failed to end conversation: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Error in endConversation:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation and all related tasks
   */
  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    try {
      // First verify the conversation exists and belongs to the user
      const conversation = await this.getConversationById(
        conversationId,
        userId,
      );
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Delete related tasks first (if any)
      const { error: tasksError } = await this.supabaseService
        .getAnonClient()
        .from('tasks')
        .delete()
        .eq('agent_conversation_id', conversationId)
        .eq('user_id', userId);

      if (tasksError) {
        this.logger.error('Error deleting conversation tasks:', tasksError);
        throw new Error(
          `Failed to delete conversation tasks: ${tasksError.message}`,
        );
      }

      // Delete the conversation
      const { error } = await this.supabaseService
        .getAnonClient()
        .from('agent_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Error deleting conversation:', error);
        throw new Error(`Failed to delete conversation: ${error.message}`);
      }

      this.logger.debug(
        `Successfully deleted conversation ${conversationId} for user ${userId}`,
      );
    } catch (error) {
      this.logger.error('Error in deleteConversation:', error);
      throw error;
    }
  }

  /**
   * Update conversation metadata
   */
  async updateConversationMetadata(
    conversationId: string,
    userId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getAnonClient()
        .from('agent_conversations')
        .update({
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Error updating conversation metadata:', error);
        throw new Error(
          `Failed to update conversation metadata: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.error('Error in updateConversationMetadata:', error);
      throw error;
    }
  }

  /**
   * Get active conversations for a user
   */
  async getActiveConversations(userId: string): Promise<AgentConversation[]> {
    try {
      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('agent_conversations')
        .select()
        .eq('user_id', userId)
        .is('ended_at', null)
        .order('last_active_at', { ascending: false });

      if (error) {
        this.logger.error('Error fetching active conversations:', error);
        throw new Error(
          `Failed to fetch active conversations: ${error.message}`,
        );
      }

      return data.map((item) => this.mapToAgentConversation(item));
    } catch (error) {
      this.logger.error('Error in getActiveConversations:', error);
      throw error;
    }
  }

  /**
   * Helper: Find conversation by work product binding
   */
  async findByWorkProduct(
    userId: string,
    workProduct: { type: 'deliverable' | 'project'; id: string },
  ): Promise<AgentConversation | null> {
    const { data, error } = await this.supabaseService
      .getAnonClient()
      .from('agent_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('primary_work_product_type', workProduct.type)
      .eq('primary_work_product_id', workProduct.id)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Error finding conversation by work product:', error);
      throw new Error(
        `Failed to find conversation by work product: ${error.message}`,
      );
    }

    return data ? this.mapToAgentConversation(data) : null;
  }

  /**
   * Set the primary work product for a conversation exactly once.
   * If already set to a different value, throw (immutability enforcement).
   */
  async setPrimaryWorkProduct(
    conversationId: string,
    userId: string,
    workProduct: { type: 'deliverable' | 'project'; id: string },
  ): Promise<void> {
    const client = this.supabaseService.getAnonClient();

    // Fetch existing values
    const { data: existing, error: fetchError } = await client
      .from('agent_conversations')
      .select('id, user_id, primary_work_product_type, primary_work_product_id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      this.logger.warn(
        `Conversation ${conversationId} not found for user ${userId} when setting work product`,
      );
      throw new Error('Conversation not found or access denied');
    }

    const existingType = existing.primary_work_product_type as
      | 'deliverable'
      | 'project'
      | null;
    const existingId = existing.primary_work_product_id as string | null;

    if (
      existingType &&
      existingId &&
      (existingType !== workProduct.type || existingId !== workProduct.id)
    ) {
      this.logger.warn(
        `Immutable work product already set for conversation ${conversationId}. Existing ${existingType}:${existingId}, attempted ${workProduct.type}:${workProduct.id}`,
      );
      throw new Error('Primary work product is immutable once set');
    }

    if (
      existingType === workProduct.type &&
      existingId === workProduct.id &&
      existingType !== null &&
      existingId !== null
    ) {
      return; // no-op
    }

    const { error: updateError } = await client
      .from('agent_conversations')
      .update({
        primary_work_product_type: workProduct.type,
        primary_work_product_id: workProduct.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (updateError) {
      this.logger.error(
        `Failed to set primary work product for conversation ${conversationId}: ${updateError.message}`,
      );
      throw new Error(
        updateError.message || 'Could not set primary work product',
      );
    }
  }

  /**
   * Map database record to AgentConversation type
   */
  private mapToAgentConversation(data: any): AgentConversation {
    return {
      id: data.id,
      userId: data.user_id,
      agentName: data.agent_name,
      agentType: data.agent_type,
      startedAt: new Date(data.started_at),
      endedAt: data.ended_at ? new Date(data.ended_at) : undefined,
      lastActiveAt: new Date(data.last_active_at),
      metadata: data.metadata,
      workProduct:
        data.primary_work_product_type && data.primary_work_product_id
          ? {
              type: data.primary_work_product_type,
              id: data.primary_work_product_id,
            }
          : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Map database record to AgentConversationWithStats type
   */
  private mapToAgentConversationWithStats(
    data: any,
  ): AgentConversationWithStats {
    return {
      ...this.mapToAgentConversation(data),
      taskCount: parseInt(data.task_count) || 0,
      completedTasks: parseInt(data.completed_tasks) || 0,
      failedTasks: parseInt(data.failed_tasks) || 0,
      activeTasks: parseInt(data.active_tasks) || 0,
    };
  }
}
