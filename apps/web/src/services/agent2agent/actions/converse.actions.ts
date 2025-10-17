/**
 * Converse Actions (Conversation Operations)
 * Orchestrates conversation operations: read from store → build request → send → handle response → update store
 *
 * This layer coordinates between:
 * - Store (read-only access to get data)
 * - API (send requests)
 * - Handlers (validate and extract responses)
 * - Store mutations (update state)
 */

import { createAgent2AgentApi } from '../api/agent2agent.api';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import type { Conversation, Message } from '@/stores/conversationsStore';

/**
 * Send a message in converse mode
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleSendMessage() {
 *   sendMessage(agentName, conversationId, messageContent);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the agent to converse with
 * @param conversationId - Conversation ID
 * @param userMessage - User's message content
 * @returns The assistant's response message
 */
export async function sendMessage(
  agentName: string,
  conversationId: string,
  userMessage: string,
): Promise<Message> {
  console.log('💬 [Converse Send Action] Starting', { agentName, conversationId });

  // 1. Get conversation from store (for context)
  const conversationsStore = useConversationsStore();
  const conversation = conversationsStore.conversationById(conversationId);

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  console.log('📚 [Converse Send Action] Found conversation:', conversation.title);

  // 2. Add user message to store immediately (optimistic update)
  const userMessageObj: Message = {
    id: crypto.randomUUID(),
    conversationId,
    role: 'user',
    content: userMessage,
    createdAt: new Date().toISOString(),
  };

  conversationsStore.addMessage(userMessageObj);
  console.log('📝 [Converse Send Action] Added user message to store');

  // 3. Create API client and send request
  const api = createAgent2AgentApi(agentName);

  console.log('📤 [Converse Send Action] Sending request');
  const response = await api.converse.send(conversationId, userMessage);

  console.log('📥 [Converse Send Action] Response received:', response);

  // 4. Validate response
  if (!response.success) {
    console.error('❌ [Converse Send Action] Request failed:', response.error);

    // Update conversation with error
    conversationsStore.setError(conversationId, response.error?.message || 'Failed to send message');

    throw new Error(response.error?.message || 'Failed to send message');
  }

  // 5. Extract assistant message from response
  const assistantContent = response.payload?.content?.message || response.payload?.message || '';

  if (!assistantContent) {
    throw new Error('No message in response');
  }

  const assistantMessage: Message = {
    id: crypto.randomUUID(),
    conversationId,
    role: 'assistant',
    content: assistantContent,
    createdAt: new Date().toISOString(),
    metadata: response.payload?.metadata,
  };

  // 6. Update store with assistant message
  conversationsStore.addMessage(assistantMessage);

  // Clear any existing errors
  conversationsStore.clearError(conversationId);

  console.log('💾 [Converse Send Action] Store updated with assistant message');
  console.log('✅ [Converse Send Action] Complete');

  return assistantMessage;
}

/**
 * Create a new conversation
 *
 * @param agentName - Name of the agent
 * @param agentType - Type of the agent
 * @param organizationSlug - Organization slug
 * @param title - Optional conversation title
 * @returns The created conversation
 */
export async function createConversation(
  agentName: string,
  agentType: string,
  organizationSlug: string,
  title?: string,
): Promise<Conversation> {
  console.log('🆕 [Converse Create Action] Starting', { agentName, agentType, organizationSlug });

  // 1. Create API client
  const api = createAgent2AgentApi(agentName);

  // 2. Send create conversation request
  console.log('📤 [Converse Create Action] Sending request');
  const response = await api.conversations.create(agentName, agentType, organizationSlug);

  console.log('📥 [Converse Create Action] Response received:', response);

  // 3. Validate response
  if (!response.success || !response.conversationId) {
    console.error('❌ [Converse Create Action] Request failed:', response.error);
    throw new Error(response.error?.message || 'Failed to create conversation');
  }

  // 4. Create conversation object
  const conversation: Conversation = {
    id: response.conversationId,
    userId: '', // Will be set by backend
    title: title || `Chat with ${agentName}`,
    agentName,
    agentType,
    organizationSlug,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    taskCount: 0,
  };

  // 5. Update store
  const conversationsStore = useConversationsStore();
  conversationsStore.addConversation(conversation);

  // 6. Set as active conversation
  const chatUiStore = useChatUiStore();
  chatUiStore.setActiveConversation(conversation.id);

  console.log('💾 [Converse Create Action] Store updated');
  console.log('✅ [Converse Create Action] Complete');

  return conversation;
}

/**
 * Load conversation from backend
 *
 * @param conversationId - Conversation ID to load
 * @returns The loaded conversation with messages
 */
export async function loadConversation(
  conversationId: string,
): Promise<Conversation> {
  console.log('📖 [Converse Load Action] Starting', { conversationId });

  // This would call a backend API to load the conversation
  // For now, we'll just return what's in the store
  const conversationsStore = useConversationsStore();
  const conversation = conversationsStore.conversationById(conversationId);

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  console.log('✅ [Converse Load Action] Complete');

  return conversation;
}

/**
 * Delete a conversation
 *
 * @param conversationId - Conversation ID to delete
 */
export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  console.log('🗑️  [Converse Delete Action] Starting', { conversationId });

  const conversationsStore = useConversationsStore();
  const chatUiStore = useChatUiStore();

  // 1. Close the conversation tab if open
  chatUiStore.closeConversationTab(conversationId);

  // 2. Remove from store
  conversationsStore.removeConversation(conversationId);

  console.log('✅ [Converse Delete Action] Complete');
}
