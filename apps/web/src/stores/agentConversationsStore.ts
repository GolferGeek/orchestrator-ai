import { defineStore } from 'pinia';
import { agentConversationsService, type AgentType } from '@/services/agentConversationsService';

interface AgentConversation {
  id: string;
  userId: string;
  agentName: string;
  agentType: AgentType;
  startedAt: Date;
  endedAt?: Date;
  lastActiveAt: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  taskCount: number;
  completedTasks: number;
  failedTasks: number;
  activeTasks: number;
}

interface AgentConversationsState {
  conversations: AgentConversation[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export const useAgentConversationsStore = defineStore('agentConversations', {
  state: (): AgentConversationsState => ({
    conversations: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
  }),

  getters: {
    getConversationById: (state) => (id: string) => {
      return state.conversations.find(conv => conv.id === id);
    },
    
    getConversationsByAgent: (state) => (agentName: string, agentType: string) => {
      const filtered = state.conversations.filter(conv => 
        conv.agentName === agentName && conv.agentType === agentType
      );
      
      // Debug: Show actual conversation data for first few conversations
      if (state.conversations.length > 0 && filtered.length === 0) {
      }
      
      return filtered;
    },
    
    getActiveConversations: (state) => {
      return state.conversations.filter(conv => !conv.endedAt);
    },
    
    getConversationsByAgentType: (state) => (agentType: string) => {
      return state.conversations.filter(conv => conv.agentType === agentType);
    },
  },

  actions: {
    async fetchConversations(force = false) {
      if (this.isLoading) return;
      
      // Don't fetch again if we have recent data and not forced
      if (!force && this.lastUpdated && Date.now() - this.lastUpdated.getTime() < 30000) {
        return;
      }

      this.isLoading = true;
      this.error = null;

      try {
        const response = await agentConversationsService.listConversations({
          limit: 1000,
        });

        // Convert API response to store format
        this.conversations = response.conversations.map(conv => ({
          ...conv,
          startedAt: new Date(conv.startedAt),
          endedAt: conv.endedAt ? new Date(conv.endedAt) : undefined,
          lastActiveAt: new Date(conv.lastActiveAt),
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          taskCount: conv.taskCount || 0,
          completedTasks: conv.completedTasks || 0,
          failedTasks: conv.failedTasks || 0,
          activeTasks: conv.activeTasks || 0,
        }));

        this.lastUpdated = new Date();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to fetch conversations';
      } finally {
        this.isLoading = false;
      }
    },

    async deleteConversation(conversationId: string) {
      try {
        // Optimistically remove from store first
        const conversationIndex = this.conversations.findIndex(conv => conv.id === conversationId);
        if (conversationIndex === -1) {
          throw new Error('Conversation not found');
        }

        // Store the conversation in case we need to rollback
        const deletedConversation = this.conversations[conversationIndex];
        
        // Remove from store immediately for instant UI update
        this.conversations.splice(conversationIndex, 1);

        // Make API call
        await agentConversationsService.deleteConversation(conversationId);

      } catch (error) {
        // Rollback on error - add the conversation back
        this.fetchConversations(true); // Force refresh to get correct state
        
        this.error = error instanceof Error ? error.message : 'Failed to delete conversation';
        throw error;
      }
    },

    async createConversation(agentName: string, agentType: AgentType) {
      try {
        const response = await agentConversationsService.createConversation({
          agentName,
          agentType,
        });

        // Convert API response and add to store
        const newConversation: AgentConversation = {
          ...response,
          startedAt: new Date(response.startedAt),
          endedAt: response.endedAt ? new Date(response.endedAt) : undefined,
          lastActiveAt: new Date(response.lastActiveAt),
          createdAt: new Date(response.createdAt),
          updatedAt: new Date(response.updatedAt),
          taskCount: response.taskCount || 0,
          completedTasks: response.completedTasks || 0,
          failedTasks: response.failedTasks || 0,
          activeTasks: response.activeTasks || 0,
        };

        this.conversations.push(newConversation);

        return newConversation;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to create conversation';
        throw error;
      }
    },

    async endConversation(conversationId: string) {
      try {
        const conversationIndex = this.conversations.findIndex(conv => conv.id === conversationId);
        if (conversationIndex === -1) {
          throw new Error('Conversation not found');
        }

        // Make API call first
        await agentConversationsService.endConversation(conversationId);

        // Update store
        this.conversations[conversationIndex] = {
          ...this.conversations[conversationIndex],
          endedAt: new Date(),
          updatedAt: new Date(),
        };

      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to end conversation';
        throw error;
      }
    },

    // Update conversation task counts (called by websocket events)
    updateConversationTaskCounts(conversationId: string, taskCounts: Partial<Pick<AgentConversation, 'taskCount' | 'completedTasks' | 'failedTasks' | 'activeTasks'>>) {
      const conversationIndex = this.conversations.findIndex(conv => conv.id === conversationId);
      if (conversationIndex !== -1) {
        this.conversations[conversationIndex] = {
          ...this.conversations[conversationIndex],
          ...taskCounts,
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        };
      }
    },

    clearError() {
      this.error = null;
    },

    // Refresh a specific conversation's data (for long-running task updates)
    async refreshConversation(conversationId: string) {
      try {
        const response = await agentConversationsService.getConversation(conversationId);
        const conversationIndex = this.conversations.findIndex(conv => conv.id === conversationId);
        
        if (conversationIndex !== -1) {
          // Update the conversation with fresh data
          this.conversations[conversationIndex] = {
            ...response,
            startedAt: new Date(response.startedAt),
            endedAt: response.endedAt ? new Date(response.endedAt) : undefined,
            lastActiveAt: new Date(response.lastActiveAt),
            createdAt: new Date(response.createdAt),
            updatedAt: new Date(response.updatedAt),
            taskCount: response.taskCount || 0,
            completedTasks: response.completedTasks || 0,
            failedTasks: response.failedTasks || 0,
            activeTasks: response.activeTasks || 0,
          };
          
        }
      } catch (error) {
      }
    },
  },
});