import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  AgentConversation,
  AgentConversationWithStats,
  CreateAgentConversationDto,
  AgentConversationQueryParams,
  AgentType,
} from '@/agent2agent/types/agent-conversations.types';
import { getTableName } from '@/supabase/supabase.config';

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
      'context', // Add context for database agents
      'function',
      'tool',
    ];
    // Allow file-based types
    if (validTypes.includes(agentType as AgentType)) {
      return agentType as AgentType;
    }

    // Allow database namespaces (contain hyphens, underscores, or end with -org)
    if (agentType.includes('-') || agentType.includes('_') || agentType.endsWith('org')) {
      return agentType as AgentType;
    }

    // NO FALLBACKS - fail fast with clear error instead of defaulting
    throw new Error(
      `Invalid agentType '${agentType}'. ` +
      `Must be a valid file-based type (${validTypes.join(', ')}) ` +
      `or a database namespace (e.g., 'my-org', 'company-name'). ` +
      `No default agentType is provided - explicit configuration required.`
    );
  }

  /**
   * Create a new agent conversation
   */
  async createConversation(
    userId: string,
    dto: CreateAgentConversationDto,
  ): Promise<AgentConversation> {
    const validatedAgentType = this.validateAgentType(dto.agentType);

    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .insert({
        user_id: userId,
        agent_name: dto.agentName,
        agent_type: validatedAgentType,
        organization_slug: dto.namespace || null, // Store organization slug for database agents
        started_at: now,
        last_active_at: now,
        metadata: dto.metadata || {},
        ...(dto.workProduct && {
          primary_work_product_type: dto.workProduct.type,
          primary_work_product_id: dto.workProduct.id,
        }),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return this.mapToAgentConversation(data);
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(
    conversationId: string,
    userId: string,
  ): Promise<AgentConversation | null> {
    this.logger.debug(
      `🔍 getConversationById: Looking for conversation ${conversationId} for user ${userId}`,
    );

    const { data, error } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .select()
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    this.logger.debug(
      `🔍 getConversationById: Query result - data:`,
      data ? 'Found' : 'Null',
      'error:',
      error?.message || 'None',
    );

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows found"
      this.logger.error(`🔍 getConversationById: Database error:`, error);
      throw new Error(`Failed to fetch conversation: ${error.message}`);
    }

    return data ? this.mapToAgentConversation(data) : null;
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
    // If a conversation ID was provided, validate it exists and belongs to the user
    if (existingConversationId) {
      const { data: existing } = await this.supabaseService
        .getAnonClient()
        .from(getTableName('conversations'))
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
    }

    // First try to find an active conversation
    const { data: existing } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
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
  }

  /**
   * List conversations with optional filters
   */
  async listConversations(
    params: AgentConversationQueryParams,
  ): Promise<{ conversations: AgentConversationWithStats[]; total: number }> {
    let query = this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations_with_stats'))
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
      throw new Error(`Failed to list conversations: ${error.message}`);
    }

    return {
      conversations: data.map((item) =>
        this.mapToAgentConversationWithStats(item),
      ),
      total: count || 0,
    };
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string, userId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .update({
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to end conversation: ${error.message}`);
    }
  }

  /**
   * Delete a conversation and all related tasks
   */
  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    this.logger.debug(
      `🗑️ Attempting to delete conversation: ${conversationId} for user: ${userId}`,
    );

    // First verify the conversation exists and belongs to the user
    const conversation = await this.getConversationById(conversationId, userId);

    this.logger.debug(
      `🗑️ getConversationById result:`,
      conversation ? 'Found' : 'Not found',
    );

    if (!conversation) {
      this.logger.error(
        `🗑️ Conversation not found: ${conversationId} for user: ${userId}`,
      );
      throw new Error('Conversation not found');
    }

    this.logger.debug(
      `🗑️ Found conversation to delete: ${conversation.agentName}`,
    );

    // Delete related LLM usage records first to avoid foreign key constraint violation
    const { error: llmUsageDeleteError } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('llm_usage'))
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (llmUsageDeleteError) {
      this.logger.error(
        `🗑️ Failed to delete LLM usage records:`,
        llmUsageDeleteError,
      );
      throw new Error(
        `Failed to delete LLM usage records: ${llmUsageDeleteError.message}`,
      );
    }

    this.logger.debug(
      `🗑️ Deleted LLM usage records for conversation: ${conversationId}`,
    );

    // Preserve agent_name in deliverables before deleting conversation
    // The database will automatically set conversation_id to NULL due to SET NULL constraint,
    // but we want to ensure agent_name is preserved for future editing
    const { error: deliverablesUpdateError } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('deliverables'))
      .update({
        agent_name: conversation.agentName, // Preserve the agent name
        // conversation_id will be automatically set to NULL by the database constraint
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('agent_name', null); // Only update if agent_name is not already set

    if (deliverablesUpdateError) {
      // Don't throw here - this is not critical enough to stop deletion
    }

    // Delete related tasks (if any)
    const { error: tasksError } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('tasks'))
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (tasksError) {
      throw new Error(
        `Failed to delete conversation tasks: ${tasksError.message}`,
      );
    }

    // Delete the conversation
    const { error } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete conversation: ${error.message}`);
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
    const { error } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .update({
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(
        `Failed to update conversation metadata: ${error.message}`,
      );
    }
  }

  /**
   * Get active conversations for a user
   */
  async getActiveConversations(userId: string): Promise<AgentConversation[]> {
    const { data, error } = await this.supabaseService
      .getAnonClient()
      .from(getTableName('conversations'))
      .select()
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('last_active_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch active conversations: ${error.message}`);
    }

    return data.map((item) => this.mapToAgentConversation(item));
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
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('primary_work_product_type', workProduct.type)
      .eq('primary_work_product_id', workProduct.id)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
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
      .from('conversations')
      .select('id, user_id, primary_work_product_type, primary_work_product_id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
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
      .from('conversations')
      .update({
        primary_work_product_type: workProduct.type,
        primary_work_product_id: workProduct.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (updateError) {
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
      startedAt: data.started_at
        ? new Date(data.started_at)
        : new Date(data.created_at),
      endedAt: data.ended_at ? new Date(data.ended_at) : undefined,
      lastActiveAt: data.last_active_at
        ? new Date(data.last_active_at)
        : new Date(data.created_at),
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
