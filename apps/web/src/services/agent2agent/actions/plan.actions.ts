/**
 * Plan Actions
 * Orchestrates plan operations: read from store → build request → send → handle response → update store
 *
 * This layer coordinates between:
 * - Store (read-only access to get data)
 * - Builders (create request payloads)
 * - API (send requests)
 * - Handlers (validate and extract responses)
 * - Store mutations (update state)
 */

import { createAgent2AgentApi } from '../api/agent2agent.api';
import { planResponseHandler, type PlanCreateResult, type PlanRerunResult } from '../utils/handlers/plan.handler';
import { usePlanStore } from '@/stores/planStore';
import type { PlanData, PlanVersionData } from '@orchestrator-ai/transport-types';

/**
 * Create a new plan
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleCreatePlan() {
 *   createPlan(agentName, conversationId, message);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the agent to use
 * @param conversationId - Conversation ID
 * @param userMessage - User's message requesting the plan
 * @returns The created plan and initial version (mainly for testing/logging)
 */
export async function createPlan(
  agentName: string,
  conversationId: string,
  userMessage: string,
): Promise<{ plan: PlanData; version: PlanVersionData; isNew: boolean }> {
  console.log('🔨 [Plan Create Action] Starting', { agentName, conversationId });

  // 1. Get any existing plan data from store (for context)
  const planStore = usePlanStore();
  const existingPlans = planStore.plansByConversationId(conversationId);

  console.log('📚 [Plan Create Action] Existing plans:', existingPlans.length);

  // 2. Create API client
  const api = createAgent2AgentApi(agentName);

  // 3. Build and send request
  console.log('📤 [Plan Create Action] Sending request');
  const response = await api.plans.create(conversationId, userMessage);

  console.log('📥 [Plan Create Action] Response received:', response);

  // 4. Validate and extract using handler
  if (!response.success) {
    console.error('❌ [Plan Create Action] Request failed:', response.error);
    throw new Error(response.error?.message || 'Failed to create plan');
  }

  const result: PlanCreateResult = planResponseHandler.handleCreate(response);

  console.log('✅ [Plan Create Action] Response validated:', result);

  // 5. Update store

  // Add the plan and version to the store
  planStore.addPlan(result.plan, result.version);

  // Associate plan with conversation
  planStore.associatePlanWithConversation(result.plan.id, conversationId);

  // Set the version as current
  if (result.version) {
    planStore.setCurrentVersion(result.plan.id, result.version.id);
  }

  console.log('💾 [Plan Create Action] Store updated');

  // 6. Return the result for the component to use
  return {
    plan: result.plan,
    version: result.version,
    isNew: result.isNew || false,
  };
}

/**
 * Rerun plan with different LLM
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleRerunPlan() {
 *   rerunPlan(agentName, conversationId, versionId, llmConfig);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the agent to use
 * @param conversationId - Conversation ID
 * @param versionId - Version ID to rerun
 * @param llmConfig - LLM configuration for rerun
 * @returns The new plan version (mainly for testing/logging)
 */
export async function rerunPlan(
  agentName: string,
  conversationId: string,
  versionId: string,
  llmConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<{ plan: PlanData; version: PlanVersionData }> {
  console.log('🔄 [Plan Rerun Action] Starting', { agentName, conversationId, versionId, llmConfig });

  // 1. Get existing plan from store (for context)
  const planStore = usePlanStore();
  const existingPlans = planStore.plansByConversationId(conversationId);

  console.log('📚 [Plan Rerun Action] Existing plans:', existingPlans.length);

  // 2. Create API client
  const api = createAgent2AgentApi(agentName);

  // 3. Build and send request
  console.log('📤 [Plan Rerun Action] Sending rerun request');
  const response = await api.plans.rerun(conversationId, versionId, llmConfig);

  console.log('📥 [Plan Rerun Action] Response received:', JSON.stringify(response, null, 2));

  // 4. Validate and extract using handler
  // Check if it's a JSON-RPC response
  if (response.jsonrpc === '2.0' && response.result) {
    // JSON-RPC format - check the result
    if (!response.result.success) {
      console.error('❌ [Plan Rerun Action] Request failed:', response.result);
      throw new Error(response.result.payload?.metadata?.reason || 'Failed to rerun plan');
    }
  } else if (response.success === false) {
    // Direct format - check success
    console.error('❌ [Plan Rerun Action] Request failed:', response);
    throw new Error(response.error?.message || 'Failed to rerun plan');
  }

  const result: PlanRerunResult = planResponseHandler.handleRerun(response);

  console.log('✅ [Plan Rerun Action] Response validated:', result);
  console.log('🔍 [Plan Rerun Action] Plan ID:', result.plan.id, 'Version ID:', result.version.id, 'Version #:', result.version.versionNumber);

  // 5. Update store
  // Add the new version to the store
  console.log('📝 [Plan Rerun Action] Calling addVersion...');
  planStore.addVersion(result.plan.id, result.version);
  console.log('📝 [Plan Rerun Action] addVersion completed');

  // Set the new version as current (optional - depends on UX preference)
  console.log('📝 [Plan Rerun Action] Calling setCurrentVersion...');
  planStore.setCurrentVersion(result.plan.id, result.version.id);
  console.log('📝 [Plan Rerun Action] setCurrentVersion completed');

  console.log('💾 [Plan Rerun Action] Store updated with new version');

  // 6. Return the result
  return {
    plan: result.plan,
    version: result.version,
  };
}
