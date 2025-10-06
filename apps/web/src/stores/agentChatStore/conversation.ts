import agentConversationsService, { type AgentType } from '@/services/agentConversationsService';
import agent2AgentConversationsService from '@/services/agent2AgentConversationsService';
import { useAgentsStore } from '@/stores/agentsStore';
import { useAuthStore } from '@/stores/authStore';
import { tasksService } from '@/services/tasksService';
import type { AgentConversation, AgentChatMessage, ExecutionMode, Agent, AgentChatMode } from './types';
import { DEFAULT_CHAT_MODES } from './types';
import { formatAgentName } from '@/utils/caseConverter';

/**
 * Generate a UUID - polyfill for crypto.randomUUID()
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback implementation for browsers that don't support crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Service for managing conversations and backend persistence
 */
export class ConversationService {

  /**
   * Create a new conversation in the backend
   */
  async createConversation(agent: Agent): Promise<string> {
    // Get organization slug from authStore - the canonical source of truth
    const authStore = useAuthStore();
    const orgSlug = authStore.currentNamespace;

    // Database agents have an organization slug (like 'my-org')
    // File-based agents have type 'demo', 'specialist', etc.
    const isDatabaseAgent = orgSlug && orgSlug !== 'demo';

    console.log('🔍 [ConversationService.createConversation] Agent routing:', {
      agentName: agent.name,
      agentType: agent.type,
      orgSlug: orgSlug,
      isDatabaseAgent,
      approach: isDatabaseAgent ? 'agent2agent-service' : 'legacy-service'
    });

    if (isDatabaseAgent) {
      // Database agents: Use dedicated Agent2Agent conversation service
      console.log('🚀 [ConversationService] Using Agent2Agent service for database agent');
      const conversationId = generateUUID(); // Generate ID upfront
      const backendConversation = await agent2AgentConversationsService.createConversation({
        agentName: agent.name,
        agentType: agent.type as AgentType, // Required for backend validation
        organizationSlug: orgSlug!, // Use authStore.currentNamespace as canonical source
        conversationId: conversationId, // Pass the generated ID
        metadata: {
          source: 'frontend',
        },
      });

      console.log('✅ [ConversationService.createConversation] Database agent - created:', backendConversation.id);
      return backendConversation.id;
    } else {
      // File-based agents: Use existing flow with old service
      console.log('🚀 [ConversationService] Using legacy service for file-based agent');
      const backendConversation = await agentConversationsService.createConversation({
        agentName: agent.name,
        agentType: agent.type as AgentType,
      });

      console.log('✅ [ConversationService.createConversation] File-based agent - created:', backendConversation.id);
      return backendConversation.id;
    }
  }

  /**
   * Load conversation messages from backend by reconstructing from tasks
   */
  async loadConversationMessages(conversationId: string): Promise<AgentChatMessage[]> {

    
    try {
      // Load all tasks for this conversation
      const tasksResponse = await tasksService.listTasks({ 
        conversationId: conversationId,
        limit: 100 // Load up to 100 tasks for this conversation
      });
      
      const tasks = tasksResponse.tasks || [];

      
      // Load deliverables for this conversation to link them to messages
      const deliverables: any[] = [];
      try {
        const { deliverablesService } = await import('@/services/deliverablesService');
        const conversationDeliverables = await deliverablesService.getConversationDeliverables(conversationId);
        deliverables.push(...conversationDeliverables);

      } catch (error) {
        // Failed to load conversation deliverables
      }
      
      // Create maps for linking deliverables to messages
      const messageDeliverableMap = new Map<string, string>(); // message_id -> deliverableId
      const taskDeliverableMap = new Map<string, string>(); // task_id -> deliverableId
      
      // First, extract deliverableId from task responses and create task->deliverable mapping
      tasks.forEach(task => {
        if (task.response && task.status === 'completed') {
          try {
            const parsedResponse = JSON.parse(task.response);
            if (parsedResponse.deliverableId) {
              taskDeliverableMap.set(task.id, parsedResponse.deliverableId);
            }
          } catch (e) {
            // Could not parse task response to extract deliverableId
          }
        }
      });
      
      deliverables.forEach(deliverable => {
        // Keep the existing logic for backwards compatibility
        if (deliverable.message_id) {
          messageDeliverableMap.set(deliverable.message_id, deliverable.id);
        }
        if (deliverable.metadata?.taskId) {
          taskDeliverableMap.set(deliverable.metadata.taskId, deliverable.id);
        }
      });
      
      const messages: AgentChatMessage[] = [];
      
      // Convert each task to a pair of messages (user prompt + assistant response)
      for (const task of tasks) {
        // Create user message from task prompt
        if (task.prompt) {
          const userMessage: AgentChatMessage = {
            id: `user-${task.id}`,
            role: 'user',
            content: task.prompt,
            timestamp: new Date(task.createdAt),
            taskId: task.id,
            metadata: {
              originalTaskData: {
                method: task.method,
                params: task.params,
                status: task.status
              }
            }
          };
          messages.push(userMessage);
        }
        
        // Create assistant message based on task status
        if (task.status === 'completed' && task.response) {
          // Parse the JSON response to extract the actual content
          let responseContent = task.response;
          try {
            // The response is stored as a JSON string, need to parse it
            const parsedResponse = JSON.parse(task.response);
            // Extract the actual response content from the parsed JSON
            responseContent = parsedResponse.response || parsedResponse.content || parsedResponse;
            
            // If it's still an object, stringify it nicely
            if (typeof responseContent === 'object') {
              responseContent = JSON.stringify(responseContent, null, 2);
            }
          } catch (e) {
            // If parsing fails, use the raw response
            responseContent = task.response;
          }
          
        // Completed task - create assistant message with parsed response
        const assistantMessageId = `assistant-${task.id}`;
        const assistantMessage: AgentChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: responseContent,
          timestamp: new Date(task.completedAt || task.updatedAt),
          taskId: task.id,
          metadata: {
            isCompleted: true,
            completedAt: task.completedAt,
            responseMetadata: task.responseMetadata,
            llmMetadata: task.llmMetadata,
            originalTaskData: {
              method: task.method,
              status: task.status,
              progress: task.progress
            }
          }
        };
          
          // Check if this message has an associated deliverable
          // Try both message ID and task ID mapping
          let deliverableId = messageDeliverableMap.get(assistantMessageId);
          if (!deliverableId) {
            deliverableId = taskDeliverableMap.get(task.id);
          }
          
          if (deliverableId) {
            assistantMessage.deliverableId = deliverableId;
          }
          messages.push(assistantMessage);
          
        } else if (['pending', 'running'].includes(task.status)) {
          // Active task - create placeholder message
          const placeholderMessage: AgentChatMessage = {
            id: `placeholder-${task.id}`,
            role: 'assistant',
            content: task.progressMessage || 'Processing your request...',
            timestamp: new Date(task.startedAt || task.createdAt),
            taskId: task.id,
            metadata: {
              isPlaceholder: true,
              processing_type: 'active_task',
              originalTaskData: {
                method: task.method,
                status: task.status,
                progress: task.progress,
                progressMessage: task.progressMessage
              },
              lastUpdated: task.updatedAt
            }
          };
          messages.push(placeholderMessage);
          
        } else if (task.status === 'failed') {
          // Failed task - create error message
          const errorMessage: AgentChatMessage = {
            id: `error-${task.id}`,
            role: 'assistant',
            content: `❌ Task failed: ${task.errorMessage || 'Unknown error occurred'}`,
            timestamp: new Date(task.completedAt || task.updatedAt),
            taskId: task.id,
            metadata: {
              isCompleted: true,
              isError: true,
              errorCode: task.errorCode,
              errorMessage: task.errorMessage,
              errorData: task.errorData,
              originalTaskData: {
                method: task.method,
                status: task.status,
                progress: task.progress
              }
            }
          };
          messages.push(errorMessage);
        }
      }
      
      // Sort messages by timestamp
      messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      

      
      // Log active tasks for restoration
      const activeTasks = tasks.filter(t => ['pending', 'running'].includes(t.status));
      if (activeTasks.length > 0) {
        // Log active tasks for debugging
      }
      
      return messages;
      
    } catch (error) {
console.error(`Failed to load messages for conversation ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Get active tasks for a conversation that need WebSocket restoration
   */
  async getActiveTasksForConversation(conversationId: string): Promise<Array<{
    taskId: string;
    status: string;
    progress: number;
    progressMessage?: string;
  }>> {
    try {
      const tasksResponse = await tasksService.listTasks({ 
        conversationId: conversationId,
        status: 'pending,running' // Filter for active tasks only
      });
      
      const activeTasks = (tasksResponse.tasks || [])
        .filter(task => ['pending', 'running'].includes(task.status))
        .map(task => ({
          taskId: task.id,
          status: task.status,
          progress: task.progress,
          progressMessage: task.progressMessage
        }));
      

      return activeTasks;
      
    } catch (error) {
console.error(`Failed to get active tasks for conversation ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Update execution modes for a conversation based on agent capabilities
   */
  async updateConversationExecutionModes(conversation: AgentConversation): Promise<void> {
    if (!conversation.agent) return;

    console.log('🔍 [ConversationService.updateConversationExecutionModes] Starting with agent:', {
      name: conversation.agent.name,
      execution_profile: conversation.agent.execution_profile,
      execution_capabilities: conversation.agent.execution_capabilities
    });

    try {
      // Use the existing agents store instead of making a separate API call
      const agentsStore = useAgentsStore();
      
      // Find agent info from the store
      const agentInfo = agentsStore.availableAgents.find(agent => agent.name === conversation.agent?.name);
      
      console.log('🔍 [ConversationService.updateConversationExecutionModes] Found agentInfo:', {
        found: !!agentInfo,
        agentInfo: agentInfo ? {
          name: agentInfo.name,
          execution_profile: agentInfo.execution_profile,
          execution_capabilities: agentInfo.execution_capabilities
        } : null
      });

      if (agentInfo?.execution_modes && Array.isArray(agentInfo.execution_modes)) {
        // Map execution modes from agent data (handles 'real-time' -> 'websocket')
        const rawModes = agentInfo.execution_modes;

        const mappedModes = rawModes.map((mode: string) => {
          if (mode === 'real-time') {

            return 'websocket';
          }

          return mode as ExecutionMode;
        });
        const supportedModes = mappedModes.filter((mode: string) => {
          const isSupported = ['immediate', 'polling', 'websocket'].includes(mode);

          return isSupported;
        });
        conversation.supportedExecutionModes = supportedModes;

      } else {
        // Default to immediate mode if no execution modes specified
        conversation.supportedExecutionModes = ['immediate'];

      }

      const defaultAllowed: AgentChatMode[] = [...DEFAULT_CHAT_MODES];
      let allowedChatModes = [...defaultAllowed];

      // Always use execution fields from the original agent object (from hierarchy)
      // The agentsStore.availableAgents may have stale data
      const profile = conversation.agent.execution_profile;
      const capabilities = conversation.agent.execution_capabilities;

      console.log('🔍 [ConversationService.updateConversationExecutionModes] Final execution fields:', {
        profile,
        capabilities,
        source: 'originalAgent',
        agentStoreHadFields: !!(agentInfo?.execution_profile)
      });

      conversation.executionProfile = profile;
      conversation.executionCapabilities = capabilities;

      if (profile === 'conversation_only') {
        allowedChatModes = ['converse'];
      } else {
        if (capabilities?.can_plan === false) {
          allowedChatModes = allowedChatModes.filter(mode => mode !== 'plan');
        }

        if (capabilities?.can_build === false) {
          allowedChatModes = allowedChatModes.filter(mode => mode !== 'build');
        }
      }

      console.log('🔍 [ConversationService.updateConversationExecutionModes] Final allowedChatModes:', allowedChatModes);
      conversation.allowedChatModes = allowedChatModes;
      if (!allowedChatModes.includes(conversation.chatMode)) {
        conversation.chatMode = allowedChatModes[0] || DEFAULT_CHAT_MODES[0];
      }
    } catch (error) {

      conversation.supportedExecutionModes = ['immediate'];
      if (!conversation.allowedChatModes || conversation.allowedChatModes.length === 0) {
        conversation.allowedChatModes = [...DEFAULT_CHAT_MODES];
      }
    }
  }

  /**
   * Create conversation title based on agent and timestamp
   */
  createConversationTitle(agent: Agent, createdAt: Date): string {
    const agentDisplayName = formatAgentName(agent.name);
    const now = new Date();
    
    // If it's today, show time only
    if (createdAt.toDateString() === now.toDateString()) {
      const time = createdAt.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      return `${agentDisplayName} ${time}`;
    }
    
    // If it's this week, show day and time
    const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      const dayName = createdAt.toLocaleDateString([], { weekday: 'short' });
      const time = createdAt.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      return `${agentDisplayName} ${dayName} ${time}`;
    }
    
    // For older conversations, show full date and time
    const dateTime = createdAt.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${agentDisplayName} ${dateTime}`;
  }

  /**
   * Create a new conversation object
   */
  createConversationObject(agent: Agent, createdAt: Date = new Date()): AgentConversation {
    return {
      id: generateUUID(),
      agent,
      messages: [],
      createdAt,
      lastActiveAt: createdAt,
      chatMode: DEFAULT_CHAT_MODES[0],
      allowedChatModes: [...DEFAULT_CHAT_MODES],
      executionMode: 'immediate',
      supportedExecutionModes: ['immediate'], // Will be updated by updateConversationExecutionModes
      executionProfile: agent.execution_profile,
      executionCapabilities: agent.execution_capabilities,
      title: this.createConversationTitle(agent, createdAt), // Use proper title with timestamp
      isLoading: false,
      isSendingMessage: false,
      isExecutionModeOverride: false,
      latestPlanId: null,
      latestPlan: null,
      plans: [],
      orchestrationRuns: [],
      savedOrchestrations: [],
      streamSubscriptions: {},
    };
  }

  /**
   * Check if conversation exists in backend
   */
  async conversationExists(conversationId: string): Promise<boolean> {
    try {
      const conversation = await agentConversationsService.getConversation(conversationId);
      return !!conversation;
    } catch {
      return false;
    }
  }

  /**
   * Get conversation from backend
   */
  async getBackendConversation(conversationId: string): Promise<any> {
    try {
      return await agentConversationsService.getConversation(conversationId);
    } catch (error) {
console.error(`Failed to get conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Persist conversation state to backend
   */
  async persistConversationState(conversation: AgentConversation): Promise<void> {
    try {
      // This could be extended to save conversation metadata

      
      // For now, we don't need to persist the entire state
      // The messages are persisted separately when created
      
    } catch (error) {
      // Failed to persist conversation state
    }
  }

  /**
   * Archive or delete conversation
   */
  async archiveConversation(conversationId: string): Promise<void> {
    try {

      // Implementation depends on backend support for archiving
      // For now, we just log it
    } catch (error) {
console.error(`Failed to archive conversation ${conversationId}:`, error);
    }
  }

  /**
   * Get all conversations for current user
   * @deprecated Use useAgentConversationsStore().fetchConversations() instead for reactive updates
   */
  async getUserConversations(): Promise<any[]> {
    try {
      const response = await agentConversationsService.listConversations();
      return response.conversations;
    } catch (error) {
console.error('Failed to get user conversations:', error);
      return [];
    }
  }

  /**
   * Update conversation metadata
   */
  updateConversationMetadata(
    conversation: AgentConversation, 
    metadata: Partial<{
      executionMode: ExecutionMode;
      isExecutionModeOverride: boolean;
      lastActiveAt: Date;
      error?: string;
    }>
  ): void {
    Object.assign(conversation, metadata);
    
    if (metadata.lastActiveAt) {
      conversation.lastActiveAt = metadata.lastActiveAt;
    }
  }

  /**
   * Find conversation by ID
   */
  findConversationById(conversations: AgentConversation[], conversationId: string): AgentConversation | undefined {
    return conversations.find(conv => conv.id === conversationId);
  }

  /**
   * Filter conversations by agent
   */
  filterConversationsByAgent(conversations: AgentConversation[], agentName: string): AgentConversation[] {
    return conversations.filter(conv => conv.agent.name === agentName);
  }

  /**
   * Sort conversations by last active time
   */
  sortConversationsByActivity(conversations: AgentConversation[]): AgentConversation[] {
    return conversations.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(conversation: AgentConversation): {
    messageCount: number;
    userMessages: number;
    assistantMessages: number;
    hasActiveTask: boolean;
    lastActivity: string;
  } {
    const messages = conversation.messages;
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const hasActiveTask = messages.some(m => m.metadata?.isPlaceholder);
    
    return {
      messageCount: messages.length,
      userMessages,
      assistantMessages,
      hasActiveTask,
      lastActivity: conversation.lastActiveAt.toISOString()
    };
  }

  /**
   * Clean up conversation resources
   */
  cleanupConversation(conversation: AgentConversation): void {
    // Clean up any active tasks
    const activeTasks = conversation.messages
      .filter(m => m.metadata?.isPlaceholder)
      .map(m => m.taskId)
      .filter(Boolean);
    
    activeTasks.forEach(taskId => {

      // This could unsubscribe from WebSocket events, etc.
    });
  }

  /**
   * Validate conversation object
   */
  validateConversation(conversation: any): conversation is AgentConversation {
    return (
      conversation &&
      typeof conversation.id === 'string' &&
      conversation.agent &&
      Array.isArray(conversation.messages) &&
      conversation.createdAt instanceof Date &&
      conversation.lastActiveAt instanceof Date &&
      typeof conversation.executionMode === 'string' &&
      Array.isArray(conversation.supportedExecutionModes)
    );
  }
}

// Export singleton instance
export const conversation = new ConversationService();
