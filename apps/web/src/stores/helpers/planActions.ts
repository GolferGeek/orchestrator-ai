/**
 * Plan Store Actions/Helpers
 *
 * These functions orchestrate plan operations:
 * 1. Call agent2agent API via actions
 * 2. Update planStore (state) via mutations
 * 3. Return data for component use
 *
 * This separates async operations (service calls) from state management (store).
 *
 * Usage in components:
 * ```typescript
 * import { createPlanVersion } from '@/stores/helpers/planActions';
 *
 * const newVersion = await createPlanVersion(agentSlug, planId, versionData);
 * ```
 */

import { createAgent2AgentApi } from '@/services/agent2agent/api';
import { usePlanStore } from '@/stores/planStore';
import type { PlanVersionData, JsonRpcSuccessResponse, JsonRpcErrorResponse } from '@orchestrator-ai/transport-types';
import type { JsonObject } from '@/types';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const normalizeError = (error: unknown): Error =>
  (error instanceof Error ? error : new Error(String(error)));

interface CreatePlanVersionDto {
  content: string;
  createdByType?: 'agent' | 'user' | 'manual_edit';
  taskId?: string;
  metadata?: JsonObject;
}

/**
 * Create a new version of a plan via A2A protocol
 * Updates store and returns the new version
 *
 * @param agentSlug - The agent to use for processing
 * @param planId - The plan being edited (for store updates)
 * @param versionId - The version being edited from
 * @param content - The new content
 * @param metadata - Additional metadata (editedFromVersionId will be added automatically)
 */
export async function createPlanVersion(
  agentSlug: string,
  planId: string,
  versionId: string,
  content: string,
  metadata?: JsonObject
): Promise<PlanVersionData> {
  const store = usePlanStore();

  try {
    store.setLoading(true);
    store.clearError();

    // Use A2A API to create version through agent task system
    const api = createAgent2AgentApi(agentSlug);

    // Get the plan to find its conversationId
    const plan = store.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found in store`);
    }

    console.log('🔖 [Plan Create Version Action] Starting:', {
      agentSlug,
      planId,
      versionId,
      conversationId: plan.conversationId,
      contentLength: content.length,
      metadata
    });

    // Prepare metadata with version tracking
    const versionMetadata: JsonObject = {
      ...metadata,
      editedFromVersionId: versionId,
      editedAt: new Date().toISOString(),
    };

    // Use edit action with conversationId to create a new version
    // The backend will derive planId from conversationId and create the new version
    const jsonRpcResponse = await api.plans.edit(plan.conversationId, content, versionMetadata) as JsonRpcSuccessResponse<{ success: boolean; version?: PlanVersionData }> | JsonRpcErrorResponse;

    console.log('🔖 [Plan Create Version Action] Response:', jsonRpcResponse);
    console.log('🔖 [Plan Create Version Action] Response.data:', jsonRpcResponse.data);
    console.log('🔖 [Plan Create Version Action] Response.result:', jsonRpcResponse.result);

    // Handle JSON-RPC response format
    if (jsonRpcResponse.error) {
      console.error('❌ [Plan Create Version Action] Failed:', jsonRpcResponse.error);
      throw new Error(jsonRpcResponse.error?.message || 'Failed to create version');
    }

    const response = jsonRpcResponse.result || jsonRpcResponse;

    if (!response.success) {
      console.error('❌ [Plan Create Version Action] Failed:', response);
      throw new Error('Failed to create version');
    }

    // Extract the new version from response
    const newVersion = response.data?.version || response.payload?.version;

    if (!newVersion) {
      throw new Error('No version returned from API');
    }

    // Update store via mutation
    store.addVersion(planId, newVersion);

    return newVersion;
  } catch (error) {
    console.error('Failed to create plan version:', error);
    store.setError(getErrorMessage(error));
    throw normalizeError(error);
  } finally {
    store.setLoading(false);
  }
}

/**
 * Load plan versions for a specific plan via A2A protocol
 * Updates store and returns versions
 */
export async function loadPlanVersions(
  agentSlug: string,
  planId: string
): Promise<PlanVersionData[]> {
  const store = usePlanStore();

  try {
    store.setLoading(true);
    store.clearError();

    // Use A2A API to list versions
    const api = createAgent2AgentApi(agentName);
    const jsonRpcResponse = await api.plans.list(planId) as JsonRpcSuccessResponse<{ versions?: PlanVersionData[] }> | JsonRpcErrorResponse;

    // Handle JSON-RPC response format
    if (jsonRpcResponse.error) {
      console.error('❌ [Plan Load Versions] Failed:', jsonRpcResponse.error);
      throw new Error(jsonRpcResponse.error?.message || 'Failed to load versions');
    }

    const response = jsonRpcResponse.result || jsonRpcResponse;

    if (!response.success) {
      console.error('❌ [Plan Load Versions] Failed:', response);
      throw new Error('Failed to load versions');
    }

    const versions = response.data?.versions || response.payload?.versions || [];

    // Update store via mutations
    versions.forEach((version: PlanVersionData) => {
      store.addVersion(planId, version);
    });

    return versions;
  } catch (error) {
    console.error('Failed to load plan versions:', error);
    store.setError(getErrorMessage(error));
    return [];
  } finally {
    store.setLoading(false);
  }
}
