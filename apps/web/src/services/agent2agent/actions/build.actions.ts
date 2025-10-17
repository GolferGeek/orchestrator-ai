/**
 * Build Actions (Deliverable Operations)
 * Orchestrates deliverable operations: read from store → build request → send → handle response → update store
 *
 * This layer coordinates between:
 * - Store (read-only access to get data)
 * - API (send requests)
 * - Handlers (validate and extract responses)
 * - Store mutations (update state)
 */

import { createAgent2AgentApi } from '../api/agent2agent.api';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
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

  // 1. Get any existing deliverable data from store (for context)
  const deliverablesStore = useDeliverablesStore();
  const existingDeliverables = deliverablesStore.deliverablesByConversation(conversationId);

  console.log('📚 [Build Create Action] Existing deliverables:', existingDeliverables.length);

  // 2. Create API client
  const api = createAgent2AgentApi(agentName);

  // 3. Build and send request
  console.log('📤 [Build Create Action] Sending request');
  const response = await api.builds.create(conversationId, userMessage, { planId });

  console.log('📥 [Build Create Action] Response received:', response);

  // 4. Validate response
  if (!response.success) {
    console.error('❌ [Build Create Action] Request failed:', response.error);
    throw new Error(response.error?.message || 'Failed to create deliverable');
  }

  // Extract deliverable and version from response
  const deliverable = response.payload?.deliverable;
  const version = response.payload?.version || response.payload?.deliverable?.currentVersion;

  if (!deliverable) {
    throw new Error('No deliverable in response');
  }

  console.log('✅ [Build Create Action] Response validated:', { deliverable, version });

  // 5. Update store
  deliverablesStore.addDeliverable(deliverable);

  if (version) {
    deliverablesStore.addVersion(deliverable.id, version);
    deliverablesStore.setCurrentVersion(deliverable.id, version.id);
  }

  // Associate deliverable with conversation
  deliverablesStore.associateDeliverableWithConversation(deliverable.id, conversationId);

  console.log('💾 [Build Create Action] Store updated');

  // 6. Return the result
  return { deliverable, version };
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
 * @param deliverableId - Deliverable ID to rerun
 * @param versionId - Version ID to rerun from
 * @param llmConfig - LLM configuration
 * @returns The new version
 */
export async function rerunDeliverable(
  agentName: string,
  deliverableId: string,
  versionId: string,
  llmConfig: { provider: string; model: string; temperature?: number; maxTokens?: number },
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {
  console.log('🔄 [Build Rerun Action] Starting', { agentName, deliverableId, versionId, llmConfig });

  const api = createAgent2AgentApi(agentName);
  const response = await api.builds.rerun(deliverableId, versionId, llmConfig);

  if (!response.success) {
    console.error('❌ [Build Rerun Action] Failed:', response.error);
    throw new Error(response.error?.message || 'Failed to rerun deliverable');
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
