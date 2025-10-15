/**
 * Migration Helper
 *
 * This file documents how to migrate from old store methods to new service layer.
 * Use this as a reference when updating components.
 *
 * MIGRATION PATTERN:
 * ------------------
 * OLD: chatStore.businessLogicMethod(params)
 * NEW: agentTaskService.serviceMethod(params)
 *
 * The store now only contains state and simple getters/setters.
 * All business logic has been moved to services.
 */

import { agentTaskService } from './agentTaskService';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { useLLMStore } from '@/stores/llmStore';
import type { AgentTaskMode } from './types';

/**
 * MIGRATION MAP
 * =============
 *
 * ## Sending Messages (Converse Mode)
 *
 * OLD:
 * ```typescript
 * await chatStore.sendMessage(message, conversationId);
 * ```
 *
 * NEW:
 * ```typescript
 * const chatStore = useAgentChatStore();
 * const conv = chatStore.getActiveConversation();
 *
 * await agentTaskService.sendTask({
 *   agentSlug: conv.agent.slug,
 *   namespace: conv.agent.namespace,
 *   mode: 'converse',
 *   userMessage: message,
 *   conversationId: conversationId,
 * });
 * ```
 *
 * ## Creating Plans
 *
 * OLD:
 * ```typescript
 * await chatStore.executeFromLastUserMessage('plan');
 * ```
 *
 * NEW:
 * ```typescript
 * const chatStore = useAgentChatStore();
 * const conv = chatStore.getActiveConversation();
 * const lastUserMessage = conv.messages.findLast(m => m.role === 'user')?.content;
 *
 * await agentTaskService.sendTask({
 *   agentSlug: conv.agent.slug,
 *   namespace: conv.agent.namespace,
 *   mode: 'plan',
 *   action: 'create',
 *   userMessage: lastUserMessage,
 *   conversationId: conv.id,
 * });
 * ```
 *
 * ## Creating Builds/Deliverables
 *
 * OLD:
 * ```typescript
 * await chatStore.executeFromLastUserMessage('build');
 * ```
 *
 * NEW:
 * ```typescript
 * const chatStore = useAgentChatStore();
 * const conv = chatStore.getActiveConversation();
 * const lastUserMessage = conv.messages.findLast(m => m.role === 'user')?.content;
 *
 * await agentTaskService.sendTask({
 *   agentSlug: conv.agent.slug,
 *   namespace: conv.agent.namespace,
 *   mode: 'build',
 *   action: 'create',
 *   userMessage: lastUserMessage,
 *   conversationId: conv.id,
 *   additionalParams: {
 *     planId: conv.latestPlan?.id, // Optional: link to plan
 *   },
 * });
 * ```
 *
 * ## Creating Conversations
 *
 * OLD:
 * ```typescript
 * await chatStore.createConversation(agent);
 * ```
 *
 * NEW:
 * ```typescript
 * const conversationId = await agentTaskService.createConversation(agent);
 * ```
 *
 * ## Loading Conversations
 *
 * OLD:
 * ```typescript
 * await chatStore.loadConversation(conversationId);
 * ```
 *
 * NEW:
 * ```typescript
 * await agentTaskService.loadConversation(conversationId);
 * ```
 *
 * ## Deleting Conversations
 *
 * OLD:
 * ```typescript
 * await chatStore.deleteConversation(conversationId);
 * ```
 *
 * NEW:
 * ```typescript
 * await agentTaskService.deleteConversation(conversationId);
 * ```
 *
 * ## State Access (No Change - Still Use Store)
 *
 * Reading state remains the same:
 * ```typescript
 * const chatStore = useAgentChatStore();
 * const conversations = chatStore.conversations;
 * const activeConv = chatStore.getActiveConversation();
 * const messages = activeConv?.messages;
 * const isLoading = chatStore.isLoading;
 * ```
 *
 * ## Simple Mutations (No Change - Still Use Store)
 *
 * Simple state updates remain the same:
 * ```typescript
 * chatStore.setActiveConversation(id);
 * chatStore.setChatMode(conversationId, 'plan');
 * chatStore.clearError(conversationId);
 * ```
 */

/**
 * Helper function: Send a message in converse mode
 */
export async function sendMessage(message: string, conversationId: string): Promise<void> {
  const chatStore = useAgentChatStore();
  const conv = chatStore.getConversationById(conversationId);

  if (!conv) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  await agentTaskService.sendTask({
    agentSlug: conv.agent.slug || '',
    namespace: conv.agent.namespace || undefined,
    mode: 'converse' as AgentTaskMode,
    userMessage: message,
    conversationId: conversationId,
  });
}

/**
 * Helper function: Execute from last user message
 * (replacement for old executeFromLastUserMessage method)
 */
export async function executeFromLastUserMessage(
  conversationId: string,
  mode: 'plan' | 'build'
): Promise<void> {
  const chatStore = useAgentChatStore();
  const conv = chatStore.getConversationById(conversationId);

  if (!conv) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  // Find last user message
  const lastUserMessage = [...conv.messages]
    .reverse()
    .find(m => m.role === 'user')?.content;

  if (!lastUserMessage) {
    throw new Error('No user message found to execute from');
  }

  // Send task based on mode
  await agentTaskService.sendTask({
    agentSlug: conv.agent.slug || '',
    namespace: conv.agent.namespace || undefined,
    mode: mode,
    action: 'create',
    userMessage: lastUserMessage,
    conversationId: conversationId,
    additionalParams:
      mode === 'build'
        ? {
            planId: conv.latestPlan?.id,
          }
        : undefined,
  });
}

/**
 * Helper function: Get last user message from conversation
 */
export function getLastUserMessage(conversationId: string): string | undefined {
  const chatStore = useAgentChatStore();
  const conv = chatStore.getConversationById(conversationId);

  if (!conv) return undefined;

  return [...conv.messages].reverse().find(m => m.role === 'user')?.content;
}

/**
 * COMPONENTS TO UPDATE:
 * =====================
 *
 * Priority order (from detailed plan):
 * 1. AgentChatView.vue - Main chat interface
 * 2. TwoPaneConversationView.vue - Two-pane layout
 * 3. AgentTaskItem.vue - Plan/Build buttons
 * 4. Search for remaining chatStore.methodName() calls
 *
 * SEARCH PATTERNS:
 * ----------------
 * - chatStore.sendMessage(
 * - chatStore.executeFromLastUserMessage(
 * - chatStore.createConversation(
 * - chatStore.loadConversation(
 * - chatStore.deleteConversation(
 * - Any other async chatStore method calls
 *
 * KEEP UNCHANGED:
 * ---------------
 * - chatStore.conversations (state access)
 * - chatStore.getActiveConversation() (getter)
 * - chatStore.isLoading (getter)
 * - chatStore.setActiveConversation() (simple mutation)
 * - chatStore.setChatMode() (simple mutation)
 * - chatStore.clearError() (simple mutation)
 */

export default {
  sendMessage,
  executeFromLastUserMessage,
  getLastUserMessage,
};
