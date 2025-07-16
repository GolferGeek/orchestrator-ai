import { defineStore } from 'pinia';
import { agentConversationsService } from '@/services/agentConversationsService';
import { tasksService } from '@/services/tasksService';

export interface AgentChatState {
  // Current agent being chatted with
  currentAgent: {
    name: string;
    type: 'specialist' | 'orchestrator' | 'external' | 'api';
    description?: string;
  } | null;
  
  // Current conversation ID (null until first message sent)
  currentConversationId: string | null;
  
  // Chat messages for current conversation
  messages: AgentChatMessage[];
  
  // UI state
  isLoading: boolean;
  isSendingMessage: boolean;
  error: string | null;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  taskId?: string;
  metadata?: Record<string, any>;
}

export const useAgentChatStore = defineStore('agentChat', {
  state: (): AgentChatState => ({
    currentAgent: null,
    currentConversationId: null,
    messages: [],
    isLoading: false,
    isSendingMessage: false,
    error: null,
  }),

  actions: {
    /**
     * Start a new chat session with an agent
     * This doesn't create a conversation yet - that happens on first message
     */
    startChatWithAgent(agent: { name: string; type: 'specialist' | 'orchestrator' | 'external' | 'api'; description?: string }) {
      console.log('[AgentChatStore] Starting chat with agent:', agent);
      
      this.currentAgent = agent;
      this.currentConversationId = null;
      this.messages = [];
      this.error = null;
      
      // Add welcome message
      this.messages.push({
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Hello! I'm ${agent.name}. How can I help you today?`,
        timestamp: new Date(),
        metadata: { isWelcome: true }
      });
    },

    /**
     * Send a message to the current agent
     * Creates conversation lazily on first message
     */
    async sendMessage(content: string) {
      console.log('[AgentChatStore] sendMessage called with:', { 
        content, 
        currentAgent: this.currentAgent,
        currentConversationId: this.currentConversationId 
      });
      
      if (!this.currentAgent) {
        throw new Error('No agent selected');
      }

      this.isSendingMessage = true;
      this.error = null;

      try {
        // Add user message immediately
        const userMessage: AgentChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: new Date(),
        };
        this.messages.push(userMessage);

        // Create task (this will create conversation if needed)
        console.log('[AgentChatStore] tasksService:', tasksService);
        console.log('[AgentChatStore] tasksService.createAgentTask:', tasksService.createAgentTask);
        
        // Use agent type as-is - everything should use 'specialist' (singular)
        const agentType = this.currentAgent.type;
        
        const task = await tasksService.createAgentTask(
          agentType,
          this.currentAgent.name,
          {
            method: 'process',
            prompt: content,
            conversationId: this.currentConversationId || undefined, // null on first message
          }
        );

        // Store conversation ID from response
        if (task.conversationId) {
          this.currentConversationId = task.conversationId;
        }

        // Parse agent response to extract markdown content
        let responseContent = 'Task submitted successfully.';
        let responseMetadata = {};
        
        if (task.result) {
          try {
            // A2A protocol agents return JSON with { success, response, metadata }
            const parsedResult = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
            if (parsedResult.success && parsedResult.response) {
              responseContent = String(parsedResult.response); // Ensure it's a string
              responseMetadata = parsedResult.metadata || {};
            } else {
              responseContent = String(task.result);
            }
          } catch (error) {
            // If parsing fails, use the raw result
            responseContent = String(task.result);
          }
        }

        // Add assistant message when task completes
        // For now, we'll add a placeholder. In reality, this would be handled by WebSocket updates
        const assistantMessage: AgentChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: responseContent,
          timestamp: new Date(),
          taskId: task.taskId,
          metadata: responseMetadata,
        };
        this.messages.push(assistantMessage);

      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to send message';
        console.error('[AgentChatStore] Error sending message:', error);
      } finally {
        this.isSendingMessage = false;
      }
    },

    /**
     * Load existing conversation
     */
    async loadConversation(conversationId: string) {
      this.isLoading = true;
      this.error = null;

      try {
        // Load conversation details
        const conversation = await agentConversationsService.getConversation(conversationId);
        
        this.currentAgent = {
          name: conversation.agentName,
          type: conversation.agentType,
        };
        this.currentConversationId = conversationId;

        // Load tasks/messages for this conversation
        const tasks = await tasksService.listTasks({
          conversationId,
          limit: 100,
        });

        // Convert tasks to messages
        this.messages = [];
        tasks.tasks.forEach(task => {
          // Add user message
          this.messages.push({
            id: `user-${task.id}`,
            role: 'user',
            content: task.prompt,
            timestamp: new Date(task.createdAt),
            taskId: task.id,
          });

          // Add assistant message if task has response
          if (task.response) {
            // Parse agent response to extract markdown content
            let responseContent = task.response;
            let responseMetadata = task.responseMetadata || {};
            
            try {
              // A2A protocol agents return JSON with { success, response, metadata }
              const parsedResponse = typeof task.response === 'string' ? JSON.parse(task.response) : task.response;
              if (parsedResponse.success && parsedResponse.response) {
                responseContent = String(parsedResponse.response); // Ensure it's a string
                responseMetadata = { ...responseMetadata, ...parsedResponse.metadata };
              }
            } catch (error) {
              // If parsing fails, use the raw response
              responseContent = String(task.response);
            }

            this.messages.push({
              id: `assistant-${task.id}`,
              role: 'assistant',
              content: responseContent,
              timestamp: new Date(task.completedAt || task.updatedAt),
              taskId: task.id,
              metadata: responseMetadata,
            });
          }
        });

        // Sort messages by timestamp
        this.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load conversation';
        console.error('[AgentChatStore] Error loading conversation:', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Clear current chat session
     */
    clearChat() {
      this.currentAgent = null;
      this.currentConversationId = null;
      this.messages = [];
      this.error = null;
    },

    /**
     * Set error state
     */
    setError(error: string | null) {
      this.error = error;
    },
  },

  getters: {
    hasCurrentAgent: (state) => !!state.currentAgent,
    hasActiveConversation: (state) => !!state.currentConversationId,
    canSendMessage: (state) => !!state.currentAgent && !state.isSendingMessage,
  },
});