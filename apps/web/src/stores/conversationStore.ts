/**
 * Conversation Store
 * Manages conversations and messages for agent interactions
 * Pure state management - handlers call actions, Vue reactivity updates UI
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { ConverseResult } from '@/services/agent2agent/utils/handlers';

// Types
export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export const useConversationStore = defineStore('conversation', () => {
  // State - using Maps for O(1) lookups
  const conversations = ref<Map<string, Conversation>>(new Map());
  const messages = ref<Map<string, Message[]>>(new Map()); // conversationId -> messages
  const activeConversationId = ref<string | null>(null);
  const loadingStates = ref<Map<string, boolean>>(new Map());

  // Getters
  const activeConversation = computed(() => {
    if (!activeConversationId.value) return null;
    return conversations.value.get(activeConversationId.value) || null;
  });

  const activeMessages = computed(() => {
    if (!activeConversationId.value) return [];
    return messages.value.get(activeConversationId.value) || [];
  });

  const conversationById = (id: string): Conversation | undefined => {
    return conversations.value.get(id);
  };

  const messagesByConversation = (id: string): Message[] => {
    return messages.value.get(id) || [];
  };

  const allConversations = computed(() => {
    return Array.from(conversations.value.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

  const isLoading = (conversationId: string): boolean => {
    return loadingStates.value.get(conversationId) || false;
  };

  // Actions - ONLY way to mutate state

  /**
   * Create a new conversation
   * Called after API creates conversation successfully
   */
  function createConversation(
    id: string,
    userId: string,
    title: string,
    metadata?: Record<string, any>
  ): Conversation {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id,
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      metadata,
    };

    conversations.value.set(id, conversation);
    messages.value.set(id, []);

    return conversation;
  }

  /**
   * Set active conversation
   */
  function setActiveConversation(conversationId: string): void {
    if (conversations.value.has(conversationId)) {
      activeConversationId.value = conversationId;
    }
  }

  /**
   * Update conversation data
   */
  function updateConversation(conversationId: string, updates: Partial<Conversation>): void {
    const existing = conversations.value.get(conversationId);
    if (existing) {
      conversations.value.set(conversationId, {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Delete conversation
   */
  function deleteConversation(conversationId: string): void {
    conversations.value.delete(conversationId);
    messages.value.delete(conversationId);
    loadingStates.value.delete(conversationId);

    if (activeConversationId.value === conversationId) {
      activeConversationId.value = null;
    }
  }

  /**
   * Add message to conversation
   * Called by converse handler after successful response
   */
  function addMessage(conversationId: string, message: Omit<Message, 'id'>): Message {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
    };

    const conversationMessages = messages.value.get(conversationId) || [];
    messages.value.set(conversationId, [...conversationMessages, newMessage]);

    // Update conversation's updatedAt
    updateConversation(conversationId, { updatedAt: newMessage.timestamp });

    return newMessage;
  }

  /**
   * Add assistant message from ConverseResult
   * This is called by the converse handler
   */
  function addAssistantMessage(conversationId: string, result: ConverseResult): Message {
    return addMessage(conversationId, {
      conversationId,
      role: 'assistant',
      content: result.message,
      timestamp: result.metadata?.timestamp || new Date().toISOString(),
      metadata: result.metadata,
    });
  }

  /**
   * Add user message
   */
  function addUserMessage(conversationId: string, content: string, metadata?: Record<string, any>): Message {
    return addMessage(conversationId, {
      conversationId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  /**
   * Set messages for a conversation (from API load)
   */
  function setMessages(conversationId: string, messageList: Message[]): void {
    messages.value.set(conversationId, messageList);
  }

  /**
   * Clear all messages for a conversation
   */
  function clearMessages(conversationId: string): void {
    messages.value.set(conversationId, []);
  }

  /**
   * Set loading state for a conversation
   */
  function setLoading(conversationId: string, loading: boolean): void {
    loadingStates.value.set(conversationId, loading);
  }

  /**
   * Clear all conversations (logout)
   */
  function clearAll(): void {
    conversations.value.clear();
    messages.value.clear();
    loadingStates.value.clear();
    activeConversationId.value = null;
  }

  // Return public API
  return {
    // State (read-only exposure)
    conversations: readonly(conversations),
    activeConversationId: readonly(activeConversationId),

    // Getters
    activeConversation,
    activeMessages,
    conversationById,
    messagesByConversation,
    allConversations,
    isLoading,

    // Actions
    createConversation,
    setActiveConversation,
    updateConversation,
    deleteConversation,
    addMessage,
    addAssistantMessage,
    addUserMessage,
    setMessages,
    clearMessages,
    setLoading,
    clearAll,
  };
});
