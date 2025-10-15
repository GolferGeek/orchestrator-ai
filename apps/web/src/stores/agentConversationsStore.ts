import { defineStore } from 'pinia';
import { agentConversationsService, type AgentType } from '@/services/agentConversationsService';
import agent2AgentConversationsService from '@/services/agent2AgentConversationsService';
interface AgentConversation {
  id: string;
  userId: string;
  agentName: string;
  agentType: AgentType;
  organizationSlug?: string | null; // Organization identifier for database agents
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
    getConversationsByAgent: (state) => (agentName: string, organizationSlug?: string | null) => {
      const filtered = state.conversations.filter(conv => {
        // Match agent name
        if (conv.agentName !== agentName) return false;

        // Match by organizationSlug if provided, otherwise return all for this agent
        if (organizationSlug) {
          return conv.organizationSlug === organizationSlug;
        }

        // If no organizationSlug filter specified, return all conversations for this agent
        return true;
      });

      // Debug logging if no conversations found
      if (state.conversations.length > 0 && filtered.length === 0) {
        console.log('🔍 [ConversationsFilter] No conversations found for:', {
          agentName,
          organizationSlug,
          totalConversations: state.conversations.length,
          sample: state.conversations.slice(0, 3).map(c => ({
            agentName: c.agentName,
            organizationSlug: c.organizationSlug
          }))
        });
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
        // All agents are now database agents - use agent2agent service
        console.log('🚀 [AgentConversationsStore] Fetching conversations from agent2agent service');
        const response = await agent2AgentConversationsService.listConversations({
          limit: 1000,
        });

        // Convert API response to store format
        const mappedConversations = response.conversations.map(conv => ({
          ...conv,
          // organizationSlug should already be present from API (interface updated to match)
          organizationSlug: conv.organizationSlug,
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

        this.conversations = mappedConversations;
        this.lastUpdated = new Date();

        console.log('✅ [AgentConversationsStore] Conversations loaded:', {
          total: this.conversations.length,
          rawSample: response.conversations.slice(0, 2).map((c: any) => ({
            id: c.id,
            agentName: c.agentName,
            organizationSlug: c.organizationSlug,
            hasOrgSlug: !!c.organizationSlug,
            allFields: Object.keys(c)
          })),
          mappedSample: this.conversations.slice(0, 2).map(c => ({
            id: c.id,
            agentName: c.agentName,
            organizationSlug: c.organizationSlug,
            agentType: c.agentType,
            hasOrgSlug: !!c.organizationSlug
          }))
        });
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
        
        // ✅ Close any open tabs for this conversation
        // Import stores to close tabs and clean up deliverables
        const { useAgentChatStore } = await import('./agentChatStore');
        const { useDeliverablesStore } = await import('./deliverablesStore');
        
        const agentChatStore = useAgentChatStore();
        const deliverablesStore = useDeliverablesStore();
        
        // Close the conversation tab immediately
        console.log(`🗂️ Closing tabs for conversation: ${conversationId}`);
        agentChatStore.closeConversation(conversationId);
        console.log(`✅ Tab closure called for conversation: ${conversationId}`);
        
        // Clean up any deliverables references
        if (deliverablesStore.handleConversationDeleted) {
          console.log(`🗂️ Cleaning up deliverables for conversation: ${conversationId}`);
          deliverablesStore.handleConversationDeleted(conversationId);
        }
        
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
    // Add an existing conversation to the store (when created elsewhere)
    addExistingConversation(conversationData: any) {
      const newConversation: AgentConversation = {
        ...conversationData,
        startedAt: new Date(conversationData.startedAt),
        endedAt: conversationData.endedAt ? new Date(conversationData.endedAt) : undefined,
        lastActiveAt: new Date(conversationData.lastActiveAt),
        createdAt: new Date(conversationData.createdAt),
        updatedAt: new Date(conversationData.updatedAt),
        taskCount: conversationData.taskCount || 0,
        completedTasks: conversationData.completedTasks || 0,
        failedTasks: conversationData.failedTasks || 0,
        activeTasks: conversationData.activeTasks || 0,
      };
      // Check if conversation already exists to avoid duplicates
      const existingIndex = this.conversations.findIndex(conv => conv.id === newConversation.id);
      if (existingIndex === -1) {
        this.conversations.push(newConversation);
      } else {
        // Update existing conversation
        this.conversations[existingIndex] = newConversation;
      }
      return newConversation;
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
        const oldActiveTasks = this.conversations[conversationIndex].activeTasks;
        this.conversations[conversationIndex] = {
          ...this.conversations[conversationIndex],
          ...taskCounts,
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        };
        const newActiveTasks = this.conversations[conversationIndex].activeTasks;
      } else {
        // Conversation not found in store
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
        // Failed to load conversation task counts
      }
    },
  },
});