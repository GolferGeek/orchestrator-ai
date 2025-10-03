import apiService from './apiService';

export interface Agent2AgentConversation {
  id: string;
  agentName: string;
  agentType: string;
  startedAt: string;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface CreateAgent2AgentConversationDto {
  agentName: string;
  agentType: string; // This will be the namespace for database agents
  metadata?: Record<string, any>;
}

/**
 * Service for managing Agent2Agent (database) conversations
 * Clean separation from legacy file-based agent conversations
 */
class Agent2AgentConversationsService {
  /**
   * Create a new conversation for database agents
   */
  async createConversation(dto: CreateAgent2AgentConversationDto): Promise<Agent2AgentConversation> {
    console.log('🔍 [Agent2AgentConversationsService] Creating conversation:', dto);
    
    const response = await apiService.post('/agent-to-agent/conversations', {
      agentName: dto.agentName,
      agentType: dto.agentType, // Namespace like 'my-org'
      metadata: {
        source: 'agent2agent-frontend',
        ...dto.metadata,
      },
    });

    console.log('✅ [Agent2AgentConversationsService] Created:', response.id);
    return response;
  }

  /**
   * List conversations for database agents
   */
  async listConversations(params: {
    limit?: number;
    offset?: number;
    agentName?: string;
    agentType?: string;
  } = {}): Promise<{ conversations: Agent2AgentConversation[]; total: number }> {
    const response = await apiService.get('/agent-to-agent/conversations', { params });
    return response;
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Agent2AgentConversation> {
    const response = await apiService.get(`/agent-to-agent/conversations/${conversationId}`);
    return response;
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string): Promise<void> {
    await apiService.put(`/agent-to-agent/conversations/${conversationId}/end`);
  }
}

export default new Agent2AgentConversationsService();
