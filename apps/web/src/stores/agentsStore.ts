/**
 * Agents Store - State + Synchronous Mutations Only
 *
 * Phase 4.2 Refactoring: Removed all async methods
 * Use agentsService for API calls
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AgentInfo } from '../types/chat';
import type { HierarchyNode, AgentNodeMetadata, AgentHierarchyResponse } from '@/types/agent';
import type { JsonObject } from '@orchestrator-ai/transport-types';

interface NormalizedHierarchyResponse {
  data: HierarchyNode[];
  metadata?: AgentNodeMetadata | null;
  rest: JsonObject;
}

// Re-export for backward compatibility
export type { HierarchyNode, AgentNodeMetadata };

export function normalizeHierarchyResponse(input: HierarchyNode[] | AgentHierarchyResponse | null | undefined): NormalizedHierarchyResponse {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const { data, metadata, ...rest } = input as AgentHierarchyResponse;

    return {
      data: Array.isArray(data) ? data : [],
      metadata: metadata ?? null,
      rest: rest as JsonObject,
    };
  }

  return {
    data: Array.isArray(input) ? input : [],
    metadata: null,
    rest: {},
  };
}

export function filterHierarchyByNamespace(
  hierarchy: HierarchyNode[] | AgentHierarchyResponse | null | undefined,
  namespace: string,
) {
  const { data, metadata, rest } = normalizeHierarchyResponse(hierarchy);

  const prune = (tree: HierarchyNode[]): HierarchyNode[] => {
    const result: HierarchyNode[] = [];

    for (const node of tree) {
      const children = Array.isArray(node.children) ? prune(node.children) : [];
      const nodeNamespace = node.namespace || node.metadata?.namespace;

      const matchesNamespace =
        !nodeNamespace || nodeNamespace === namespace || nodeNamespace === 'global' || children.length > 0;

      if (matchesNamespace) {
        result.push({ ...node, children });
      }
    }

    return result;
  };

  const filtered = prune(data);

  return {
    data: filtered,
    metadata,
    ...rest,
  };
}

export const useAgentsStore = defineStore('agents', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  const availableAgents = ref<AgentInfo[]>([]);
  const agentHierarchy = ref<HierarchyNode | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastLoadedNamespace = ref<string | null>(null);

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  const hasAgents = computed(() => availableAgents.value.length > 0);

  // ============================================================================
  // MUTATIONS (Synchronous Only)
  // ============================================================================

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage;
  }

  function setAvailableAgents(agents: AgentInfo[]) {
    availableAgents.value = agents;
  }

  function setAgentHierarchy(hierarchy: HierarchyNode | null) {
    agentHierarchy.value = hierarchy;
  }

  function setLastLoadedNamespace(namespace: string | null) {
    lastLoadedNamespace.value = namespace;
  }

  function resetAgents() {
    availableAgents.value = [];
    agentHierarchy.value = null;
  }

  function clearError() {
    error.value = null;
  }

  // ============================================================================
  // RETURN (Public API)
  // ============================================================================

  return {
    // State (computed)
    availableAgents,
    agentHierarchy,
    isLoading,
    error,
    hasAgents,
    lastLoadedNamespace,

    // Mutations
    setLoading,
    setError,
    clearError,
    setAvailableAgents,
    setAgentHierarchy,
    setLastLoadedNamespace,
    resetAgents,
  };
});
