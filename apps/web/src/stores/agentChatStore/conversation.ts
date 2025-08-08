import agentConversationsService, { type AgentType } from '@/services/agentConversationsService';
import { useAgentsStore } from '@/stores/agentsStore';
import { tasksService } from '@/services/tasksService';
import type { AgentConversation, AgentChatMessage, ExecutionMode } from './types';
import type { Agent } from './types';
import { formatAgentName } from '@/utils/caseConverter';

/**
 * Service for managing conversations and backend persistence
 */
export class ConversationService {

  /**
   * Create a new conversation in the backend
   */
  async createConversation(agent: Agent): Promise<string> {
    console.log(`🔗 Creating backend conversation for agent: ${agent.name}`);
    
    const backendConversation = await agentConversationsService.createConversation({
      agentName: agent.name,
      agentType: agent.type as AgentType,
    });
    
    console.log('✅ Backend conversation created:', backendConversation.id);
    return backendConversation.id;
  }

  /**
   * Load conversation messages from backend by reconstructing from tasks
   */
  async loadConversationMessages(conversationId: string): Promise<AgentChatMessage[]> {
    console.log(`📚 Loading conversation messages for: ${conversationId}`);
    
    try {
      // Load all tasks for this conversation
      const tasksResponse = await tasksService.listTasks({ 
        conversationId: conversationId,
        limit: 100 // Load up to 100 tasks for this conversation
      });
      
      const tasks = tasksResponse.tasks || [];
      console.log(`📋 Found ${tasks.length} tasks for conversation ${conversationId}`);
      
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
            console.log(`📋 Using raw response for task ${task.id} (JSON parse failed):`, e);
            responseContent = task.response;
          }
          
          // Completed task - create assistant message with parsed response
          const assistantMessage: AgentChatMessage = {
            id: `assistant-${task.id}`,
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
      
      console.log(`✅ Reconstructed ${messages.length} messages from ${tasks.length} tasks for conversation ${conversationId}`);
      
      // Log active tasks for restoration
      const activeTasks = tasks.filter(t => ['pending', 'running'].includes(t.status));
      if (activeTasks.length > 0) {
        console.log(`🔄 Found ${activeTasks.length} active tasks that will need WebSocket restoration:`, activeTasks.map(t => t.id));
      }
      
      return messages;
      
    } catch (error) {
      console.error(`❌ Failed to load messages for conversation ${conversationId}:`, error);
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
      
      console.log(`🔄 Found ${activeTasks.length} active tasks for conversation ${conversationId}:`, activeTasks);
      return activeTasks;
      
    } catch (error) {
      console.error(`❌ Failed to get active tasks for conversation ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Update execution modes for a conversation based on agent capabilities
   */
  async updateConversationExecutionModes(conversation: AgentConversation): Promise<void> {
    if (!conversation.agent) return;

    console.log(`🔄 Updating execution modes for agent: ${conversation.agent.name}`);

    try {
      // Use the existing agents store instead of making a separate API call
      const agentsStore = useAgentsStore();
      
      // Find agent info from the store
      const agentInfo = agentsStore.availableAgents.find(agent => agent.name === conversation.agent?.name);
      
      console.log(`🔄 DEBUG: Agent data for ${conversation.agent.name}:`, agentInfo);
      console.log(`🔄 DEBUG: Raw execution_modes:`, agentInfo?.execution_modes);
      
      if (agentInfo?.execution_modes && Array.isArray(agentInfo.execution_modes)) {
        // Map execution modes from agent data (handles 'real-time' -> 'websocket')
        const rawModes = agentInfo.execution_modes;
        console.log(`🔄 DEBUG: Processing execution modes:`, rawModes);
        
        const mappedModes = rawModes.map((mode: string) => {
          if (mode === 'real-time') {
            console.log(`🔄 DEBUG: Mapping 'real-time' to 'websocket'`);
            return 'websocket';
          }
          console.log(`🔄 DEBUG: Keeping mode as-is: '${mode}'`);
          return mode as ExecutionMode;
        });
        
        console.log(`🔄 DEBUG: Mapped modes:`, mappedModes);
        
        const supportedModes = mappedModes.filter((mode: string) => {
          const isSupported = ['immediate', 'polling', 'websocket'].includes(mode);
          console.log(`🔄 DEBUG: Mode '${mode}' supported:`, isSupported);
          return isSupported;
        });
        
        conversation.supportedExecutionModes = supportedModes;
        console.log(`🔄 Updated execution modes for ${conversation.agent.name}:`, supportedModes);
      } else {
        // Default to immediate mode if no execution modes specified
        conversation.supportedExecutionModes = ['immediate'];
        console.log(`🔄 No execution modes found for ${conversation.agent.name}, defaulting to immediate`);
      }
    } catch (error) {
      console.warn('Failed to update execution modes for conversation:', error);
      conversation.supportedExecutionModes = ['immediate'];
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
      id: crypto.randomUUID(),
      agent,
      messages: [],
      createdAt,
      lastActiveAt: createdAt,
      executionMode: 'immediate',
      supportedExecutionModes: ['immediate'], // Will be updated by updateConversationExecutionModes
      title: this.createConversationTitle(agent, createdAt), // Use proper title with timestamp
      isLoading: false,
      isSendingMessage: false,
      isExecutionModeOverride: false,
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
      console.error(`❌ Failed to get conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Persist conversation state to backend
   */
  async persistConversationState(conversation: AgentConversation): Promise<void> {
    try {
      // This could be extended to save conversation metadata
      console.log(`💾 Persisting conversation state for: ${conversation.id}`);
      
      // For now, we don't need to persist the entire state
      // The messages are persisted separately when created
      
    } catch (error) {
      console.warn(`Failed to persist conversation state for ${conversation.id}:`, error);
    }
  }

  /**
   * Archive or delete conversation
   */
  async archiveConversation(conversationId: string): Promise<void> {
    try {
      console.log(`🗄️ Archiving conversation: ${conversationId}`);
      // Implementation depends on backend support for archiving
      // For now, we just log it
    } catch (error) {
      console.error(`Failed to archive conversation ${conversationId}:`, error);
    }
  }

  /**
   * Get all conversations for current user
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
      console.log(`🧹 Cleaning up active task: ${taskId}`);
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