import { defineStore, storeToRefs } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { AgentInfo } from '../types/chat';
import { apiService } from '../services/apiService';
import { useAuthStore } from './authStore';

interface HierarchyNode {
  id: string;
  name: string;
  children?: HierarchyNode[];
  [key: string]: any;
}

function normalizeHierarchyResponse(input: unknown) {
  if (input && typeof input === 'object' && 'data' in input) {
    const { data, metadata, ...rest } = input as {
      data?: unknown;
      metadata?: unknown;
      [key: string]: unknown;
    };

    return {
      data: Array.isArray(data) ? (data as HierarchyNode[]) : [],
      metadata,
      rest,
    };
  }

  return {
    data: Array.isArray(input) ? (input as HierarchyNode[]) : [],
    metadata: undefined,
    rest: {},
  };
}

function filterHierarchyByNamespace(
  hierarchy: unknown,
  namespace: string,
) {
  const { data, metadata, rest } = normalizeHierarchyResponse(hierarchy);

  const prune = (tree: HierarchyNode[]): HierarchyNode[] => {
    const result: HierarchyNode[] = [];

    for (const node of tree) {
      const children = Array.isArray(node.children) ? prune(node.children) : [];
      const nodeNamespace =
        (node as any).namespace || (node as any).metadata?.namespace;

      const matchesNamespace =
        !nodeNamespace || nodeNamespace === namespace || children.length > 0;

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
  const authStore = useAuthStore();
  const { currentNamespace } = storeToRefs(authStore);
  const isAuthenticated = computed(() => authStore.isAuthenticated);

  const availableAgents = ref<AgentInfo[]>([]);
  const agentHierarchy = ref<any>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastLoadedNamespace = ref<string | null>(null);

  let activeRequestId = 0;

  const resetAgents = () => {
    availableAgents.value = [];
    agentHierarchy.value = null;
  };

  const loadAgentsForNamespace = async (namespace: string) => {
    const requestId = ++activeRequestId;
    isLoading.value = true;
    error.value = null;

    try {
      const [agents, hierarchy] = await Promise.all([
        apiService.getAvailableAgents(),
        apiService.getAgentHierarchy().catch(() => null),
      ]);

      if (requestId !== activeRequestId) {
        return;
      }

      const filteredAgents = Array.isArray(agents)
        ? agents.filter((agent) => {
            if (!agent || typeof agent !== 'object') {
              return false;
            }
            if (!('namespace' in agent) || !agent.namespace) {
              // If backend doesn’t tag the agent, assume it belongs to the active namespace
              return true;
            }
            return agent.namespace === namespace;
          })
        : [];

      availableAgents.value = filteredAgents;

      const filteredHierarchy = hierarchy
        ? filterHierarchyByNamespace(hierarchy, namespace)
        : null;

      agentHierarchy.value = filteredHierarchy;

      if (import.meta.env.DEV) {
        const totalAgents = Array.isArray(agents) ? agents.length : 0;
        const filteredCount = filteredAgents.length;
        const hierarchySummary = filteredHierarchy?.data
          ? filteredHierarchy.data.map((node: any) => ({
              name: node.name,
              children: Array.isArray(node.children)
                ? node.children.map((child: any) => child.name)
                : [],
            }))
          : [];
        const namespaceSummary = {
          namespace,
          totalAgents,
          filteredCount,
          agentNames: filteredAgents.map((agent) => agent.name),
          hierarchyRootCount: hierarchySummary.length,
          hierarchy: hierarchySummary,
        };
        console.info('[AgentsStore] Loaded agents for namespace', namespaceSummary);
      }
      lastLoadedNamespace.value = namespace;
    } catch (err) {
      if (requestId !== activeRequestId) {
        return;
      }

      resetAgents();
      const message = err instanceof Error ? err.message : 'Failed to load agents.';
      error.value = message;
      console.error('[AgentsStore] Unable to load agents for namespace', namespace, err);
    } finally {
      if (requestId === activeRequestId) {
        isLoading.value = false;
      }
    }
  };

  const ensureAgentsLoaded = async () => {
    const namespace = currentNamespace.value;
    if (!isAuthenticated.value || !namespace) {
      activeRequestId++;
      resetAgents();
      lastLoadedNamespace.value = null;
      isLoading.value = false;
      error.value = null;
      return;
    }

    if (namespace === lastLoadedNamespace.value && availableAgents.value.length) {
      return;
    }

    await loadAgentsForNamespace(namespace);
  };

  watch(
    [isAuthenticated, currentNamespace],
    async ([authed, namespace]) => {
      if (!authed || !namespace) {
        activeRequestId++;
        resetAgents();
        lastLoadedNamespace.value = null;
        error.value = null;
        isLoading.value = false;
        return;
      }

      await ensureAgentsLoaded();
    },
    { immediate: true }
  );

  const fetchAvailableAgents = async () => {
    await ensureAgentsLoaded();
    return availableAgents.value;
  };

  const fetchAgentHierarchy = async () => {
    await ensureAgentsLoaded();
    return agentHierarchy.value;
  };

  return {
    // state
    availableAgents,
    agentHierarchy,
    isLoading,
    error,

    // getters
    hasAgents: computed(() => availableAgents.value.length > 0),
    lastLoadedNamespace,

    // actions
    fetchAvailableAgents,
    fetchAgentHierarchy,
    ensureAgentsLoaded,
  };
});
