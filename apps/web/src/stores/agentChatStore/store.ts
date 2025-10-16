/**
 * Minimal Agent Chat Store (State Only)
 *
 * This store contains ONLY reactive state and simple mutations.
 * NO business logic, NO async operations, NO API calls.
 *
 * All business logic has been moved to services in:
 * - apps/web/src/services/agent-tasks/
 *
 * Vue reactivity automatically updates the UI when state changes.
 */

import { defineStore } from 'pinia';
import { usePlanStore } from '../planStore';
import type {
  AgentConversation,
  AgentChatMessage,
  Agent,
  PendingAction,
  AgentChatMode,
  ConversationPlanRecord,
  OrchestrationRunRecord,
} from './types';
import { DEFAULT_CHAT_MODES } from './types';

/**
 * State interface - pure data, no methods
 */
interface AgentChatState {
  /** All conversations */
  conversations: AgentConversation[];
  /** Currently active conversation ID */
  activeConversationId: string | null;
  /** Global error message */
  globalError: string | null;
  /** Pending action (plan/build) */
  pendingAction?: PendingAction | null;
  /** Track if last message was from speech */
  lastMessageWasSpeech: boolean;
}

/**
 * Minimal Agent Chat Store
 */
export const useAgentChatStore = defineStore('agentChat', {
  // ============================================================================
  // STATE - Pure reactive data only
  // ============================================================================
  state: (): AgentChatState => ({
    conversations: [],
    activeConversationId: null,
    globalError: null,
    pendingAction: null,
    lastMessageWasSpeech: false,
  }),

  // ============================================================================
  // GETTERS - Simple computed properties only (no complex logic)
  // ============================================================================
  getters: {
    /**
     * Get the active conversation
     */
    activeConversation: (state): AgentConversation | null => {
      if (!state.activeConversationId) return null;
      return state.conversations.find(c => c.id === state.activeConversationId) ?? null;
    },

    /**
     * Check if there's an active conversation
     */
    hasActiveConversation: (state) => !!state.activeConversationId,

    /**
     * Check if current agent exists
     */
    hasCurrentAgent: (state) => {
      const conv = state.conversations.find(c => c.id === state.activeConversationId);
      return !!conv?.agent;
    },

    /**
     * Check if can send message
     */
    canSend: (state) => {
      const conv = state.conversations.find(c => c.id === state.activeConversationId);
      return !!conv?.agent && !conv.isSendingMessage;
    },

    /**
     * Check if sending message
     */
    isSendingMessage: (state) => {
      const conv = state.conversations.find(c => c.id === state.activeConversationId);
      return conv?.isSendingMessage || false;
    },

    /**
     * Check if loading
     */
    isLoading: (state) => {
      const conv = state.conversations.find(c => c.id === state.activeConversationId);
      return conv?.isLoading || false;
    },

    /**
     * Get error message
     */
    error: (state) => {
      const conv = state.conversations.find(c => c.id === state.activeConversationId);
      return conv?.error || state.globalError;
    },

    /**
     * Get latest plan
     */
    getLatestPlan(state): ConversationPlanRecord | null {
      const conv = state.conversations.find(c => c.id === state.activeConversationId);
      return conv?.latestPlan ?? null;
    },

    /**
     * Get latest orchestration run
     */
    getLatestRun(state): OrchestrationRunRecord | null {
      const conv = state.conversations.find(c => c.id === state.activeConversationId);
      return conv?.orchestrationRuns?.[0] ?? null;
    },

    /**
     * Get active chat mode
     */
    activeChatMode(state): AgentChatMode {
      const conv = state.conversations.find(c => c.id === state.activeConversationId);
      return conv?.chatMode || DEFAULT_CHAT_MODES[0];
    },

    /**
     * Get effective execution mode
     */
    effectiveExecutionMode(state): string | null {
      const conv = state.conversations.find(c => c.id === state.activeConversationId);
      return conv?.executionMode || null;
    },
  },

  // ============================================================================
  // ACTIONS - Simple synchronous mutations only (NO async, NO business logic)
  // ============================================================================
  actions: {
    /**
     * Set active conversation
     */
    setActiveConversation(conversationId: string | null) {
      this.activeConversationId = conversationId;
    },

    /**
     * Add a new conversation
     */
    addConversation(conversation: AgentConversation) {
      this.conversations.push(conversation);
      this.activeConversationId = conversation.id;
    },

    /**
     * Remove a conversation
     */
    removeConversation(conversationId: string) {
      const index = this.conversations.findIndex(c => c.id === conversationId);
      if (index !== -1) {
        this.conversations.splice(index, 1);
      }
      // If active conversation was removed, clear active ID
      if (this.activeConversationId === conversationId) {
        this.activeConversationId = this.conversations[0]?.id ?? null;
      }
    },

    /**
     * Close a conversation (alias for removeConversation)
     * Used when a conversation is deleted and needs to be closed
     */
    closeConversation(conversationId: string) {
      // Clear active conversation if it's the one being closed
      if (this.activeConversationId === conversationId) {
        this.activeConversationId = null;
      }
      // Note: We don't remove from conversations array here because
      // that's handled by the conversationsStore
    },

    /**
     * Get conversation by ID
     */
    getConversationById(conversationId: string): AgentConversation | undefined {
      return this.conversations.find(c => c.id === conversationId);
    },

    /**
     * Get active conversation
     */
    getActiveConversation(): AgentConversation | null {
      if (!this.activeConversationId) return null;
      return this.conversations.find(c => c.id === this.activeConversationId) ?? null;
    },

    /**
     * Add a message to a conversation
     */
    addMessage(conversationId: string, message: AgentChatMessage) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        // Clean up deliverable/plan messages that have JSON content
        let cleanedMessage = { ...message };

        // If this is an assistant message with deliverableId or planId, and content looks like JSON
        if (cleanedMessage.role === 'assistant' && (cleanedMessage.deliverableId || cleanedMessage.planId || cleanedMessage.metadata?.deliverableId || cleanedMessage.metadata?.planId)) {
          const content = cleanedMessage.content;
          // Check if content looks like JSON (starts with { or [)
          if (typeof content === 'string' && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
            // Replace with simple message
            if (cleanedMessage.deliverableId || cleanedMessage.metadata?.deliverableId) {
              cleanedMessage.content = 'Deliverable created';
            } else if (cleanedMessage.planId || cleanedMessage.metadata?.planId) {
              cleanedMessage.content = 'Plan created';
            }
          }
        }

        conv.messages.push(cleanedMessage);
        conv.lastActiveAt = new Date();
      }
    },

    /**
     * Update a message in a conversation
     */
    updateMessage(conversationId: string, messageId: string, updates: Partial<AgentChatMessage>) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        const message = conv.messages.find(m => m.id === messageId);
        if (message) {
          Object.assign(message, updates);
        }
      }
    },

    /**
     * Remove a message from a conversation
     */
    removeMessage(conversationId: string, messageId: string) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        const index = conv.messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
          conv.messages.splice(index, 1);
        }
      }
    },

    /**
     * Set plan for a conversation
     */
    setPlan(conversationId: string, plan: any) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.currentPlan = plan;
        conv.latestPlan = plan;

        // Also add to planStore for reactivity
        const planStore = usePlanStore();
        planStore.addPlan(plan);
        planStore.associatePlanWithConversation(plan.id, conversationId);
      }
    },

    /**
     * Set deliverable for a conversation
     */
    setDeliverable(conversationId: string, deliverable: any) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.currentDeliverable = deliverable;
      }
    },

    /**
     * Set error for a conversation
     */
    setError(conversationId: string, error: string) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.error = error;
      }
    },

    /**
     * Clear error for a conversation
     */
    clearError(conversationId: string) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.error = undefined;
      }
    },

    /**
     * Set global error
     */
    setGlobalError(error: string | null) {
      this.globalError = error;
    },

    /**
     * Set sending message flag
     */
    setSendingMessage(conversationId: string, sending: boolean) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.isSendingMessage = sending;
      }
    },

    /**
     * Set loading flag
     */
    setLoading(conversationId: string, loading: boolean) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.isLoading = loading;
      }
    },

    /**
     * Set chat mode for a conversation
     */
    setChatMode(conversationId: string, mode: AgentChatMode) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        // Only set if mode is allowed
        if (conv.allowedChatModes.includes(mode)) {
          conv.chatMode = mode;
        }
      }
    },

    /**
     * Get active chat mode
     */
    getActiveChatMode(): AgentChatMode {
      const conv = this.getActiveConversation();
      if (!conv) return 'converse';

      const current = conv.chatMode;
      const allowed = conv.allowedChatModes || DEFAULT_CHAT_MODES;

      // Return current if allowed, otherwise default to first allowed
      if (!allowed.includes(current)) {
        return allowed[0] || 'converse';
      }

      return current;
    },

    /**
     * Check if mode is allowed
     */
    isModeAllowed(mode: AgentChatMode): boolean {
      const conv = this.getActiveConversation();
      if (!conv) return false;

      const allowed = conv.allowedChatModes || DEFAULT_CHAT_MODES;
      return allowed.includes(mode);
    },

    /**
     * Set pending action
     */
    setPendingAction(type: 'plan' | 'build', sourceTaskId?: string, ttlMs: number = 20000) {
      this.pendingAction = {
        type,
        expiresAt: Date.now() + ttlMs,
        sourceTaskId,
      };
    },

    /**
     * Clear pending action
     */
    clearPendingAction() {
      this.pendingAction = null;
    },

    /**
     * Set last message was speech flag
     */
    setLastMessageWasSpeech(wasSpeech: boolean) {
      this.lastMessageWasSpeech = wasSpeech;
    },

    /**
     * Update conversation agent
     */
    updateConversationAgent(conversationId: string, agent: Agent) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.agent = agent;
      }
    },

    /**
     * Set active task ID
     */
    setActiveTaskId(conversationId: string, taskId: string | null) {
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.activeTaskId = taskId;
      }
    },
  },
});
