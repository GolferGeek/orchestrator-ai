import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { getTableName } from '../../supabase/supabase.config';
import { AgentType } from '../../common/types/agent-conversations.types';

/**
 * Agent2Agent-specific Conversations Service
 * Handles conversation management for A2A Google protocol agents
 * Isolated from legacy file-based agent system
 */
@Injectable()
export class Agent2AgentConversationsService {
  private readonly logger = new Logger(Agent2AgentConversationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create a new conversation
   * A2A protocol: conversation initiation
   */
  async createConversation(
    userId: string,
    agentName: string,
    agentType: AgentType,
    options?: {
      title?: string;
      metadata?: Record<string, any>;
      conversationId?: string;
    },
  ): Promise<{
    id: string;
    userId: string;
    agentName: string;
    agentType: AgentType;
    title: string;
    metadata: Record<string, any>;
    createdAt: Date;
  }> {
    try {
      const conversationData = {
        id: options?.conversationId || undefined,
        user_id: userId,
        agent_name: agentName,
        agent_type: agentType,
        metadata: {
          ...options?.metadata,
          title: options?.title || `${agentName} - ${new Date().toLocaleDateString()}`,
          protocol: 'a2a-google',
          source: 'agent2agent',
        },
      };

      const { data: conversation, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('conversations'))
        .insert([conversationData])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create conversation: ${error.message}`);
      }

      this.logger.debug(`✅ Created A2A conversation ${conversation.id} for agent ${agentName}`);

      return {
        id: conversation.id,
        userId: conversation.user_id,
        agentName: conversation.agent_name,
        agentType: conversation.agent_type,
        title: conversation.title,
        metadata: conversation.metadata,
        createdAt: new Date(conversation.created_at),
      };
    } catch (error) {
      this.logger.error('Failed to create A2A conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   * A2A protocol: conversation context retrieval
   */
  async getConversationById(
    conversationId: string,
    userId: string,
  ): Promise<{
    id: string;
    userId: string;
    agentName: string;
    agentType: AgentType;
    title: string;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      const { data: conversation, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('conversations'))
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (error || !conversation) {
        return null;
      }

      return {
        id: conversation.id,
        userId: conversation.user_id,
        agentName: conversation.agent_name,
        agentType: conversation.agent_type,
        title: conversation.title,
        metadata: conversation.metadata,
        createdAt: new Date(conversation.created_at),
        updatedAt: new Date(conversation.updated_at),
      };
    } catch (error) {
      this.logger.error(`Failed to get A2A conversation ${conversationId}:`, error);
      return null;
    }
  }

  /**
   * Get or create conversation
   * A2A protocol: ensure conversation exists for task execution
   */
  async getOrCreateConversation(
    conversationId: string | undefined,
    userId: string,
    agentName: string,
    agentType: AgentType,
  ): Promise<{
    id: string;
    userId: string;
    agentName: string;
    agentType: AgentType;
    title: string;
    metadata: Record<string, any>;
    createdAt: Date;
  }> {
    // If conversationId provided, try to get it
    if (conversationId) {
      const existing = await this.getConversationById(conversationId, userId);
      if (existing) {
        return {
          id: existing.id,
          userId: existing.userId,
          agentName: existing.agentName,
          agentType: existing.agentType,
          title: existing.title,
          metadata: existing.metadata,
          createdAt: existing.createdAt,
        };
      }

      this.logger.warn(`Conversation ${conversationId} not found, creating new one`);
    }

    // Create new conversation
    return this.createConversation(userId, agentName, agentType);
  }

  /**
   * Update conversation metadata
   * A2A protocol: conversation state updates
   */
  async updateConversation(
    conversationId: string,
    userId: string,
    updates: {
      title?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.title) {
        updateData.title = updates.title;
      }

      if (updates.metadata) {
        // Merge metadata
        const { data: current } = await this.supabaseService
          .getServiceClient()
          .from(getTableName('conversations'))
          .select('metadata')
          .eq('id', conversationId)
          .eq('user_id', userId)
          .single();

        updateData.metadata = {
          ...(current?.metadata || {}),
          ...updates.metadata,
          protocol: 'a2a-google',
        };
      }

      const { error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('conversations'))
        .update(updateData)
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to update conversation: ${error.message}`);
      }

      this.logger.debug(`✅ Updated A2A conversation ${conversationId}`);
    } catch (error) {
      this.logger.error(`Failed to update A2A conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * List conversations for a user and agent
   * A2A protocol: conversation history
   */
  async listConversations(
    userId: string,
    agentName?: string,
    agentType?: AgentType,
  ): Promise<any[]> {
    try {
      let query = this.supabaseService
        .getServiceClient()
        .from(getTableName('conversations'))
        .select('*')
        .eq('user_id', userId);

      if (agentName) {
        query = query.eq('agent_name', agentName);
      }

      if (agentType) {
        query = query.eq('agent_type', agentType);
      }

      const { data: conversations, error } = await query.order('updated_at', {
        ascending: false,
      });

      if (error) {
        throw new Error(`Failed to list conversations: ${error.message}`);
      }

      return conversations || [];
    } catch (error) {
      this.logger.error('Failed to list A2A conversations:', error);
      return [];
    }
  }

  /**
   * Delete a conversation
   * A2A protocol: conversation cleanup
   */
  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('conversations'))
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete conversation: ${error.message}`);
      }

      this.logger.log(`🗑️ Deleted A2A conversation ${conversationId}`);
    } catch (error) {
      this.logger.error(`Failed to delete A2A conversation ${conversationId}:`, error);
      throw error;
    }
  }
}
