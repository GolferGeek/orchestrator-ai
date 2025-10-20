/**
 * Build Actions (Deliverable Operations)
 * Orchestrates deliverable operations: read from store → build request → send → handle response → update store
 *
 * This layer coordinates between:
 * - Store (read-only access to get data)
 * - tasksService (send requests)
 * - Store mutations (update state)
 */

import { tasksService } from '@/services/tasksService';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { createAgent2AgentApi } from '@/services/agent2agent/api';
import type { DeliverableData, DeliverableVersionData } from '@orchestrator-ai/transport-types';

/**
 * Create a new deliverable
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleCreateDeliverable() {
 *   createDeliverable(agentName, conversationId, message, planId);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the agent to use
 * @param conversationId - Conversation ID
 * @param userMessage - User's message requesting the deliverable
 * @param planId - Optional plan ID to link
 * @returns The created deliverable and initial version
 */
export async function createDeliverable(
  agentName: string,
  conversationId: string,
  userMessage: string,
  planId?: string,
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {
  console.log('🔨 [Build Create Action] Starting', { agentName, conversationId, planId });

  const conversationsStore = useConversationsStore();
  const chatUiStore = useChatUiStore();
  const llmStore = useLLMPreferencesStore();
  const deliverablesStore = useDeliverablesStore();

  try {
    // 1. Mark as sending
    chatUiStore.setIsSendingMessage(true);

    // 2. Add user message to conversation
    const conversation = conversationsStore.conversationById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversationsStore.addMessage(conversationId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // 3. Build conversation history
    const messages = conversationsStore.messagesByConversation(conversationId);
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // 4. Build LLM selection from preferences store
    const llmSelection = llmStore.selectedProvider && llmStore.selectedModel ? {
      providerName: llmStore.selectedProvider.name,
      modelName: llmStore.selectedModel.modelName,
    } : undefined;

    // 5. Call tasksService to create and execute the build task
    console.log('📤 [Build Create Action] Calling tasksService.createAgentTask');

    const result = await tasksService.createAgentTask(
      conversation.agentType || 'custom',
      agentName,
      {
        method: 'build',
        prompt: userMessage,
        conversationId,
        conversationHistory,
        llmSelection,
        planId,
        executionMode: chatUiStore.executionMode || 'polling',
      },
      { namespace: conversation.organizationSlug || 'global' }
    );

    console.log('📥 [Build Create Action] Task response:', result);

    // 6. Parse result - backend should provide clean, structured response
    let parsedResult = result.result;
    if (typeof parsedResult === 'string') {
      try {
        parsedResult = JSON.parse(parsedResult);
      } catch (e) {
        console.warn('📦 [Build Create Action] Backend returned non-JSON string:', parsedResult?.substring(0, 200));
      }
    }

    console.log('📦 [Build Create Action] Full result from backend:', result);
    console.log('📦 [Build Create Action] Parsed result:', parsedResult);
    console.log('📦 [Build Create Action] Result keys:', Object.keys(parsedResult || {}));

    // Backend should provide clean thinking, message, and deliverable
    const thinkingContent = (parsedResult as any)?.thinking;
    const assistantContent = (parsedResult as any)?.message || 'Deliverable created successfully';

    // Extract deliverable from response - try multiple paths
    const deliverable = (parsedResult as any)?.payload?.deliverable ||
                       (parsedResult as any)?.deliverable ||
                       (parsedResult as any)?.payload?.content?.deliverable ||
                       (parsedResult as any)?.result?.deliverable;

    const version = (parsedResult as any)?.payload?.version ||
                   (parsedResult as any)?.version ||
                   (parsedResult as any)?.payload?.content?.version ||
                   deliverable?.currentVersion;

    // Also check if deliverable ID is in the result
    const deliverableId = (parsedResult as any)?.deliverableId ||
                         (parsedResult as any)?.payload?.deliverableId ||
                         (parsedResult as any)?.result?.deliverableId;

    console.log('📦 [Build Create Action] Extracted:', { deliverable, version, deliverableId, thinking: thinkingContent || (parsedResult as any).extractedThinking });

    // If we only have a deliverableId, fetch the full deliverable
    let finalDeliverable = deliverable;
    let finalVersion = version;

    if (!finalDeliverable && deliverableId) {
      console.log('📥 [Build Create Action] Only have deliverableId, fetching full deliverable:', deliverableId);
      const { deliverablesService } = await import('@/services/deliverablesService');
      try {
        finalDeliverable = await deliverablesService.getDeliverable(deliverableId);
        finalVersion = finalDeliverable?.currentVersion;
        console.log('✅ [Build Create Action] Fetched deliverable:', finalDeliverable);
      } catch (error) {
        console.error('❌ [Build Create Action] Failed to fetch deliverable:', error);
      }
    }

    if (!finalDeliverable) {
      console.error('❌ [Build Create Action] Could not find deliverable in response. Full result:', JSON.stringify(parsedResult, null, 2));
      throw new Error('No deliverable in response');
    }

    console.log('✅ [Build Create Action] Deliverable extracted:', { deliverable: finalDeliverable, version: finalVersion });

    // 7. Update deliverables store
    deliverablesStore.addDeliverable(finalDeliverable);

    if (finalVersion) {
      deliverablesStore.addVersion(finalDeliverable.id, finalVersion);
      deliverablesStore.setCurrentVersion(finalDeliverable.id, finalVersion.id);
    }

    // Associate deliverable with conversation
    deliverablesStore.associateDeliverableWithConversation(finalDeliverable.id, conversationId);

    // 8. Add assistant message to conversation
    const assistantMessage = conversationsStore.addMessage(conversationId, {
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date().toISOString(),
      deliverableId: finalDeliverable.id,
      metadata: {
        taskId: result.taskId,
        deliverableId: finalDeliverable.id,
        thinking: thinkingContent || (parsedResult as any).extractedThinking,
        provider: (parsedResult as any)?.payload?.metadata?.provider ||
                 (parsedResult as any)?.metadata?.provider,
        model: (parsedResult as any)?.payload?.metadata?.model ||
              (parsedResult as any)?.metadata?.model,
      },
    });

    console.log('💾 [Build Create Action] Complete');

    chatUiStore.setIsSendingMessage(false);

    return { deliverable: finalDeliverable, version: finalVersion };
  } catch (error) {
    console.error('❌ [Build Create Action] Error:', error);
    chatUiStore.setIsSendingMessage(false);
    conversationsStore.setError(error instanceof Error ? error.message : 'Failed to create deliverable');
    throw error;
  }
}

/**
 * Read an existing deliverable
 *
 * @param agentName - Name of the agent
 * @param deliverableId - Deliverable ID to read
 * @param versionId - Optional specific version ID
 * @returns The deliverable and version data
 */
export async function readDeliverable(
  agentName: string,
  deliverableId: string,
  versionId?: string,
): Promise<{ deliverable: DeliverableData; version?: DeliverableVersionData }> {
  console.log('📖 [Build Read Action] Starting', { agentName, deliverableId, versionId });

  const api = createAgent2AgentApi(agentName);
  const response = await api.builds.read(deliverableId, versionId);

  if (!response.success) {
    console.error('❌ [Build Read Action] Failed:', response.error);
    throw new Error(response.error?.message || 'Failed to read deliverable');
  }

  const deliverable = response.payload?.deliverable;
  const version = response.payload?.version;

  if (!deliverable) {
    throw new Error('No deliverable in response');
  }

  // Update store with latest data
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.addDeliverable(deliverable);

  if (version) {
    deliverablesStore.addVersion(deliverable.id, version);
  }

  console.log('✅ [Build Read Action] Complete');

  return { deliverable, version };
}

/**
 * Edit an existing deliverable
 *
 * @param agentName - Name of the agent
 * @param deliverableId - Deliverable ID to edit
 * @param editInstructions - Instructions for the edit
 * @param conversationId - Conversation ID
 * @returns The updated deliverable and new version
 */
export async function editDeliverable(
  agentName: string,
  deliverableId: string,
  editInstructions: string,
  conversationId: string,
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {
  console.log('✏️ [Build Edit Action] Starting', { agentName, deliverableId });

  const api = createAgent2AgentApi(agentName);
  const response = await api.builds.edit(deliverableId, editInstructions, conversationId);

  if (!response.success) {
    console.error('❌ [Build Edit Action] Failed:', response.error);
    throw new Error(response.error?.message || 'Failed to edit deliverable');
  }

  const deliverable = response.payload?.deliverable;
  const version = response.payload?.version;

  if (!deliverable || !version) {
    throw new Error('No deliverable or version in response');
  }

  // Update store
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.addDeliverable(deliverable);
  deliverablesStore.addVersion(deliverable.id, version);
  deliverablesStore.setCurrentVersion(deliverable.id, version.id);

  console.log('✅ [Build Edit Action] Complete');

  return { deliverable, version };
}

/**
 * List deliverables for a conversation
 *
 * @param agentName - Name of the agent
 * @param conversationId - Conversation ID
 * @returns Array of deliverables
 */
export async function listDeliverables(
  agentName: string,
  conversationId: string,
): Promise<DeliverableData[]> {
  console.log('📋 [Build List Action] Starting', { agentName, conversationId });

  const api = createAgent2AgentApi(agentName);
  const response = await api.builds.list(conversationId);

  if (!response.success) {
    console.error('❌ [Build List Action] Failed:', response.error);
    throw new Error(response.error?.message || 'Failed to list deliverables');
  }

  const deliverables = response.payload?.deliverables || [];

  // Update store with all deliverables
  const deliverablesStore = useDeliverablesStore();
  deliverables.forEach((deliverable: DeliverableData) => {
    deliverablesStore.addDeliverable(deliverable);
    deliverablesStore.associateDeliverableWithConversation(deliverable.id, conversationId);
  });

  console.log('✅ [Build List Action] Complete, found', deliverables.length);

  return deliverables;
}

/**
 * Rerun deliverable with different LLM
 *
 * @param agentName - Name of the agent
 * @param conversationId - Conversation ID
 * @param deliverableId - Deliverable ID to rerun
 * @param versionId - Version ID to rerun from
 * @param llmConfig - LLM configuration
 * @returns The new version
 */
export async function rerunDeliverable(
  agentName: string,
  conversationId: string,
  deliverableId: string,
  versionId: string,
  llmConfig: { provider: string; model: string; temperature?: number; maxTokens?: number },
  userMessage?: string,
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {
  console.log('🔄 [Build Rerun Action] Starting', { agentName, conversationId, deliverableId, versionId, llmConfig, userMessage });

  const api = createAgent2AgentApi(agentName);
  const response = await api.deliverables.rerun(conversationId, versionId, llmConfig, userMessage);

  console.log('🔍 [Build Rerun Action] Response:', JSON.stringify(response, null, 2));

  if (!response.success) {
    console.error('❌ [Build Rerun Action] Failed:', response.error);
    throw new Error(response.error?.message || 'Failed to rerun deliverable');
  }

  // The API client returns { success: true, data: content }
  // where content is the result from the handler
  const deliverable = response.data?.deliverable;
  const version = response.data?.version;

  if (!deliverable || !version) {
    console.error('❌ [Build Rerun Action] Missing data. Response structure:', response);
    throw new Error('No deliverable or version in response');
  }

  // Update store
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.addDeliverable(deliverable);
  deliverablesStore.addVersion(deliverable.id, version);

  console.log('✅ [Build Rerun Action] Complete');

  return { deliverable, version };
}

/**
 * Set current version of a deliverable
 *
 * @param agentName - Name of the agent
 * @param deliverableId - Deliverable ID
 * @param versionId - Version ID to set as current
 */
export async function setCurrentVersion(
  agentName: string,
  deliverableId: string,
  versionId: string,
): Promise<void> {
  console.log('🔖 [Build Set Current Action] Starting', { agentName, deliverableId, versionId });

  const api = createAgent2AgentApi(agentName);
  const response = await api.builds.setCurrent(deliverableId, versionId);

  if (!response.success) {
    console.error('❌ [Build Set Current Action] Failed:', response.error);
    throw new Error(response.error?.message || 'Failed to set current version');
  }

  // Update store
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.setCurrentVersion(deliverableId, versionId);

  console.log('✅ [Build Set Current Action] Complete');
}

/**
 * Delete a deliverable version
 *
 * @param agentName - Name of the agent
 * @param deliverableId - Deliverable ID
 * @param versionId - Version ID to delete
 */
export async function deleteVersion(
  agentName: string,
  deliverableId: string,
  versionId: string,
): Promise<void> {
  console.log('🗑️  [Build Delete Version Action] Starting', { agentName, deliverableId, versionId });

  const api = createAgent2AgentApi(agentName);
  const response = await api.builds.deleteVersion(deliverableId, versionId);

  if (!response.success) {
    console.error('❌ [Build Delete Version Action] Failed:', response.error);
    throw new Error(response.error?.message || 'Failed to delete version');
  }

  // Update store
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.removeVersion(deliverableId, versionId);

  console.log('✅ [Build Delete Version Action] Complete');
}

/**
 * Delete entire deliverable
 *
 * @param agentName - Name of the agent
 * @param deliverableId - Deliverable ID to delete
 */
export async function deleteDeliverable(
  agentName: string,
  deliverableId: string,
): Promise<void> {
  console.log('🗑️  [Build Delete Action] Starting', { agentName, deliverableId });

  const api = createAgent2AgentApi(agentName);
  const response = await api.builds.delete(deliverableId);

  if (!response.success) {
    console.error('❌ [Build Delete Action] Failed:', response.error);
    throw new Error(response.error?.message || 'Failed to delete deliverable');
  }

  // Update store
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.removeDeliverable(deliverableId);

  console.log('✅ [Build Delete Action] Complete');
}
