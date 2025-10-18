import type { JsonObject } from '@orchestrator-ai/transport-types';
import apiService from './apiService';

export interface Agent2AgentConversation {
  id: string;
  agentName: string;
  organizationSlug: string; // Database organization slug (my-org, etc.) - renamed from namespace to match API
  startedAt: string;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
  title?: string; // Friendly display name
  metadata?: JsonObject;
}

/**
 * Format a date string into a relative time display (e.g., "2h ago", "yesterday")
 */
function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export interface CreateAgent2AgentConversationDto {
  agentName: string;
  agentType: string; // Agent type (context, function, tool, etc.)
  organizationSlug: string; // Database organization slug (my-org, etc.) - renamed from namespace to match API
  conversationId?: string; // Pre-generated conversation ID
  metadata?: JsonObject;
}

interface Agent2AgentConversationListResponse {
  conversations: Agent2AgentConversation[];
  total: number;
}

interface CreateAgent2AgentConversationPayload {
  agentName: string;
  agentType: string;
  namespace: string;
  conversationId?: string;
  metadata?: JsonObject;
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

    const payload: CreateAgent2AgentConversationPayload = {
      agentName: dto.agentName,
      agentType: dto.agentType, // Required for backend validation
      namespace: dto.organizationSlug, // Database organization slug like 'my-org' - API still expects 'namespace' field
      conversationId: dto.conversationId, // Pre-generated ID
      metadata: {
        source: 'agent2agent-frontend',
        ...dto.metadata,
      },
    };

    const response = await apiService.post<Agent2AgentConversation, CreateAgent2AgentConversationPayload>(
      '/agent-conversations',
      payload,
    );

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
  } = {}): Promise<Agent2AgentConversationListResponse> {
    const queryParams = new URLSearchParams();
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
    if (params.agentName) queryParams.append('agentName', params.agentName);
    if (params.agentType) queryParams.append('agentType', params.agentType);

    const url = queryParams.toString()
      ? `/agent-conversations?${queryParams.toString()}`
      : '/agent-conversations';

    const response = await apiService.get<Agent2AgentConversationListResponse>(url);

    // Add formatted titles to conversations
    if (response.conversations) {
      response.conversations = response.conversations.map((conv: Agent2AgentConversation) => ({
        ...conv,
        title: conv.title || formatRelativeTime(conv.startedAt || conv.createdAt),
      }));
    }

    return response;
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Agent2AgentConversation> {
    const response = await apiService.get<Agent2AgentConversation>(`/agent-conversations/${conversationId}`);
    return response;
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string): Promise<void> {
    await apiService.put(`/agent-conversations/${conversationId}/end`);
  }
}

export default new Agent2AgentConversationsService();
