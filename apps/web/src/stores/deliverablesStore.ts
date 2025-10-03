import { defineStore } from 'pinia';
import { ref, computed, reactive } from 'vue';
import { useAuthStore } from './authStore';

// Agent task timeout configuration (in seconds)
const AGENT_TASK_TIMEOUT_SECONDS = parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '120000', 10) / 1000;
const AGENT_TASK_TIMEOUT_MS = AGENT_TASK_TIMEOUT_SECONDS * 1000;
import type { 
  Deliverable,
  DeliverableVersion,
  DeliverableSearchResult,
  DeliverableType,
  DeliverableFormat,
  CreateDeliverableDto,
  CreateVersionDto
} from '@/services/deliverablesService';
interface DeliverablesState {
  deliverables: Map<string, Deliverable>;
  deliverableVersions: Record<string, DeliverableVersion[]>; // deliverableId -> versions (using Record for reactivity)
  conversationDeliverables: Map<string, string[]>; // conversationId -> deliverableIds
  currentVersions: Map<string, DeliverableVersion>; // deliverableId -> current version
  isLoading: boolean;
  error: string | null;
  // Cache agent routing for conversations to avoid backend lookups
  conversationAgentRouting: Map<string, { agentType: string; agentName: string }>; // conversationId -> routing
}
export const useDeliverablesStore = defineStore('deliverables', () => {
  const authStore = useAuthStore();
  // State
  const state = ref<DeliverablesState>({
    deliverables: new Map(),
    deliverableVersions: {}, // Use reactive object instead of Map
    conversationDeliverables: new Map(),
    currentVersions: new Map(),
    isLoading: false,
    error: null,
    conversationAgentRouting: new Map(),
  });
  // Reactive counter to trigger updates when versions change
  const versionsUpdateCounter = ref(0);
  // Getters
  const deliverables = computed(() => Array.from(state.value.deliverables.values()));
  const isLoading = computed(() => state.value.isLoading);
  const error = computed(() => state.value.error);
  // Additional computed properties for compatibility
  const hasDeliverables = computed(() => deliverables.value.length > 0);
  const recentDeliverables = computed(() => 
    deliverables.value
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
  );
  const searchResults = computed(() => deliverables.value); // For now, just return all deliverables
  // Group deliverables by type for compatibility
  const deliverablesByType = computed(() => {
    const grouped: Record<string, Deliverable[]> = {
      'document': [],
      'analysis': [],
      'report': [],
      'plan': [],
      'requirements': []
    };
    deliverables.value.forEach(deliverable => {
      const type = (deliverable.type || 'document').toLowerCase();
      if (grouped[type]) {
        grouped[type].push(deliverable);
      } else {
        grouped['document'].push(deliverable); // Default fallback
      }
    });
    return grouped;
  });
  // Enhancement context for compatibility
  const enhancementContext = ref({
    sourceDeliverableId: null as string | null,
    isEnhancing: false
  });
  const getDeliverableById = (id: string) => {
    return state.value.deliverables.get(id) || null;
  };
  const getDeliverablesByConversation = (conversationId: string) => {
    const deliverableIds = state.value.conversationDeliverables.get(conversationId) || [];
    return deliverableIds
      .map(id => state.value.deliverables.get(id))
      .filter(Boolean) as Deliverable[];
  };
  const getCurrentVersion = (deliverableId: string) => {
    return state.value.currentVersions.get(deliverableId) || null;
  };
  const getDeliverableVersions = async (parentId: string) => {
    if (state.value.deliverableVersions[parentId]) {
      return state.value.deliverableVersions[parentId];
    }
    await loadDeliverableVersions(parentId);
    return state.value.deliverableVersions[parentId] || [];
  };
  // Reactive computed getter for use in Vue components
  const getDeliverableVersionsReactive = (parentId: string) => {
    return computed(() => {
      // Include the counter to trigger reactivity when versions change
      versionsUpdateCounter.value; // This creates a dependency
      return state.value.deliverableVersions[parentId] || [];
    });
  };
  // Synchronous getter for use in computed properties  
  const getDeliverableVersionsSync = (parentId: string): DeliverableVersion[] => {
    return state.value.deliverableVersions[parentId] || [];
  };
  // Actions
  const setLoading = (loading: boolean) => {
    state.value.isLoading = loading;
  };
  const setError = (error: string | null) => {
    state.value.error = error;
  };
  const clearError = () => {
    state.value.error = null;
  };
  const addDeliverable = (deliverable: Deliverable) => {
    state.value.deliverables.set(deliverable.id, deliverable);
    // Add to conversation mapping if conversationId exists
    if (deliverable.conversationId) {
      const existing = state.value.conversationDeliverables.get(deliverable.conversationId) || [];
      if (!existing.includes(deliverable.id)) {
        state.value.conversationDeliverables.set(
          deliverable.conversationId,
          [...existing, deliverable.id]
        );
      }
    }
    // Store current version if provided
    if (deliverable.currentVersion) {
      state.value.currentVersions.set(deliverable.id, deliverable.currentVersion);
    }
  };
  const addVersion = (deliverableId: string, version: DeliverableVersion) => {
    const existing = state.value.deliverableVersions[deliverableId] || [];
    // Remove existing version with same ID if present, then add new one
    const filtered = existing.filter(v => v.id !== version.id);
    const newVersions = [...filtered, version].sort((a, b) => b.versionNumber - a.versionNumber);
    state.value.deliverableVersions[deliverableId] = newVersions;
    versionsUpdateCounter.value++; // Trigger reactivity
    // Update current version if this is marked as current
    if (version.isCurrentVersion) {
      state.value.currentVersions.set(deliverableId, version);
      // Update the deliverable's currentVersion if it exists in store
      const deliverable = state.value.deliverables.get(deliverableId);
      if (deliverable) {
        deliverable.currentVersion = version;
      }
    }
  };
  const isUuid = (value?: string) => {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  };
  const loadDeliverablesByConversation = async (conversationId: string) => {
    try {
      setLoading(true);
      clearError();
      // Enhanced validation to catch more edge cases
      if (!conversationId || 
          typeof conversationId !== 'string' || 
          conversationId.trim() === '' ||
          conversationId === 'undefined' ||
          conversationId === 'null' ||
          !isUuid(conversationId.trim())) {

        return [] as any[];
      }
      const authToken = authStore.token;
      if (!authToken) {
        // If no token is available, just return empty array instead of throwing error
        // This handles the case where component loads before authentication
        return [];
      }

      // Prime routing cache from local chat store if available (no network)
      try {
        const { useAgentChatStore } = await import('@/stores/agentChatStore');
        const chatStore = useAgentChatStore();
        const conv = chatStore.getConversationById(conversationId.trim());
        if (conv?.agent?.name && conv?.agent?.type) {
          state.value.conversationAgentRouting.set(conversationId.trim(), {
            agentName: conv.agent.name as any,
            agentType: conv.agent.type as any,
          });
        }
      } catch (_) {
        // ignore if chat store not initialized
      }
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const deliverables = await deliverablesService.getConversationDeliverables(conversationId.trim());
      
      // Ensure deliverables is an array before proceeding
      if (!Array.isArray(deliverables)) {
        console.warn('Expected deliverables to be an array, got:', typeof deliverables, deliverables);
        return [];
      }
      
      // Clear existing deliverables for this conversation
      const existingIds = state.value.conversationDeliverables.get(conversationId) || [];
      existingIds.forEach(id => {
        state.value.deliverables.delete(id);
        state.value.currentVersions.delete(id);
      });
      state.value.conversationDeliverables.delete(conversationId);
      // Add new deliverables (inject routing slugs if we have them locally)
      const routing = state.value.conversationAgentRouting.get(conversationId.trim());
      deliverables.forEach((deliverable: Deliverable) => {
        if (routing) {
          // Only inject slug if not already set by backend
          if (!deliverable.agentName) {
            (deliverable as any).agentName = routing.agentName;
          }
          // Optionally store agentType alongside for convenience
          (deliverable as any).agentType = routing.agentType;
        }
        addDeliverable(deliverable);
      });
      return deliverables;
    } catch (error: any) {
      console.error('Failed to load deliverables for conversation:', error);
      setError(error.message);
      
      // Return empty array instead of throwing to prevent forEach errors
      return [];
    } finally {
      setLoading(false);
    }
  };
  const loadDeliverableVersions = async (parentId: string) => {
    try {
      setLoading(true);
      clearError();
      // Enhanced validation to catch invalid deliverable IDs
      if (!parentId || 
          typeof parentId !== 'string' || 
          parentId.trim() === '' ||
          parentId === 'undefined' ||
          parentId === 'null' ||
          !isUuid(parentId.trim())) {

        return [] as any[];
      }
      const authToken = authStore.token;
      if (!authToken) {
        return [];
      }
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const versions = await deliverablesService.getVersionHistory(parentId);
      // Store versions in state
      state.value.deliverableVersions[parentId] = versions;
      versionsUpdateCounter.value++; // Trigger reactivity
      // Update current version if we find one
      const currentVersion = versions.find(v => v.isCurrentVersion);
      if (currentVersion) {
        state.value.currentVersions.set(parentId, currentVersion);
      }
      return versions;
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  const createVersion = async (
    deliverableId: string, 
    data: CreateVersionDto
  ): Promise<DeliverableVersion> => {
    try {
      setLoading(true);
      clearError();
      const authToken = authStore.token;
      if (!authToken) {
        throw new Error('No authentication token available for creating deliverable version');
      }
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const newVersion = await deliverablesService.createVersion(deliverableId, data);
      // Add version to store
      addVersion(deliverableId, newVersion);
      return newVersion;
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  // Load all deliverables for the current user
  const loadDeliverables = async () => {
    try {
      setLoading(true);
      clearError();
      const authToken = authStore.token;
      if (!authToken) {
        return [];
      }
      // Use the proper deliverablesService to load all user deliverables
      const { deliverablesService } = await import('@/services/deliverablesService');
      const result = await deliverablesService.getDeliverables({
        limit: 100, // Get more deliverables for the main page
        offset: 0,
        latestOnly: true // Only show latest versions by default
      });
      // Clear existing deliverables first
      state.value.deliverables.clear();
      state.value.conversationDeliverables.clear();
      state.value.currentVersions.clear();
      // For search results, we need to convert to full deliverables
      // Note: This is a limitation - we may need a separate endpoint for full deliverable objects
      const deliverablePromises = result.items.map(async (searchItem) => {
        try {
          return await deliverablesService.getDeliverable(searchItem.id);
        } catch (error) {

          return null;
        }
      });
      const deliverables = (await Promise.all(deliverablePromises)).filter(Boolean) as Deliverable[];
      // Add all deliverables to the store
      deliverables.forEach((deliverable) => {
        addDeliverable(deliverable);
      });
      return deliverables;
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  const getDeliverable = (id: string) => {
    return getDeliverableById(id);
  };
  const deleteDeliverable = async (id: string) => {
    const authToken = authStore.token;
    if (!authToken) {
      throw new Error('No authentication token available');
    }
    try {
      setLoading(true);
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      await deliverablesService.deleteDeliverable(id);
      // Remove from store
      state.value.deliverables.delete(id);
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  const updateDeliverable = async (id: string, data: any) => {
    const authToken = authStore.token;
    if (!authToken) {
      throw new Error('No authentication token available');
    }
    try {
      setLoading(true);
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const serviceData = {
        ...data,
        type: data.type as DeliverableType,
        format: data.format as DeliverableFormat
      };
      const updatedDeliverable = await deliverablesService.updateDeliverable(id, serviceData as any);
      const storeDeliverable = {
        ...updatedDeliverable,
        created_at: new Date(updatedDeliverable.created_at),
        updated_at: new Date(updatedDeliverable.updated_at)
      };
      addDeliverable(storeDeliverable as any);
      return updatedDeliverable;
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  const startEnhancement = async (deliverableId: string) => {
    // This method would typically initialize an enhancement workflow
    // For now, just return the deliverable ID for enhancement context
    enhancementContext.value.sourceDeliverableId = deliverableId;
    enhancementContext.value.isEnhancing = true;
    return deliverableId;
  };
  const stopEnhancement = () => {
    enhancementContext.value.sourceDeliverableId = null;
    enhancementContext.value.isEnhancing = false;
  };

  const enhanceVersion = async (
    versionId: string,
    instruction: string,
    options?: { providerName?: string; modelName?: string; temperature?: number; maxTokens?: number },
  ) => {
    try {
      setLoading(true);
      clearError();
      const { deliverablesService } = await import('@/services/deliverablesService');
      const newVersion = await deliverablesService.enhanceVersion(versionId, {
        instruction,
        providerName: options?.providerName,
        modelName: options?.modelName,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });
      addVersion(newVersion.deliverableId, newVersion);
      // Optionally set as current if backend flagged it
      return newVersion;
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const copyVersion = async (versionId: string) => {
    try {
      setLoading(true);
      clearError();
      const { deliverablesService } = await import('@/services/deliverablesService');
      const newVersion = await deliverablesService.copyVersion(versionId);
      addVersion(newVersion.deliverableId, newVersion);
      return newVersion;
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  // Additional methods needed by useDeliverables composable
  const processAgentDeliverable = async (deliverableId: string, conversationId: string, messageId?: string, enhancedFrom?: string) => {
    // Process agent deliverable creation/update
    const { deliverablesService } = await import('@/services/deliverablesService');
    const deliverable = await deliverablesService.getDeliverable(deliverableId);
    addDeliverable(deliverable);
    return deliverable;
  };
  const findDeliverableForEnhancement = async (conversationId: string, messageId?: string) => {
    // Find existing deliverable for enhancement context
    const conversationDeliverables = getDeliverablesByConversation(conversationId);
    if (messageId) {
      // Look for deliverable with matching message ID
      return conversationDeliverables.find(d => d.message_id === messageId) || null;
    }
    // Return the most recent deliverable from this conversation
    return conversationDeliverables.length > 0 ? conversationDeliverables[0] : null;
  };
  const createDeliverable = async (data: any) => {
    try {
      setLoading(true);
      const { deliverablesService } = await import('@/services/deliverablesService');
      const newDeliverable = await deliverablesService.createDeliverable(data);
      addDeliverable(newDeliverable);
      return newDeliverable;
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  const searchDeliverables = async (query: string, filters?: any) => {
    // For now, just filter existing deliverables
    // In a full implementation, this would call the backend search API
    const filtered = deliverables.value.filter(d => 
      d.title.toLowerCase().includes(query.toLowerCase()) ||
      d.content.toLowerCase().includes(query.toLowerCase())
    );
    // For now, we don't have a separate search results state, so just log
  };
  const loadConversationDeliverables = async (conversationId: string) => {
    // Alias to existing method but return the expected format
    const deliverables = await loadDeliverablesByConversation(conversationId);
    return deliverables.map((d: any) => ({
      id: d.id,
      title: d.title,
      created_at: d.created_at,
      type: d.type,
      created_by_agent: d.created_by_agent,
      content_preview: d.content.substring(0, 200) + (d.content.length > 200 ? '...' : ''),
      ...d
    }));
  };
  const setCurrentDeliverable = (deliverable: any) => {
    // Store the current deliverable (for modal/detail view)
    // For now, just log - could add a currentDeliverable ref if needed
  };
  const getVersions = async (deliverableId: string) => {
    // Alias to existing method
    return await getDeliverableVersions(deliverableId);
  };
  const getVersion = async (versionId: string): Promise<DeliverableVersion> => {
    try {
      setLoading(true);
      clearError();
      const { deliverablesService } = await import('@/services/deliverablesService');
      const version = await deliverablesService.getVersion(versionId);
      return version;
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  // New version management methods
  const setCurrentVersion = async (versionId: string) => {
    try {
      setLoading(true);
      const { deliverablesService } = await import('@/services/deliverablesService');
      const version = await deliverablesService.setCurrentVersion(versionId);
      // Update store state
      addVersion(version.deliverableId, version);
      return version;
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  const deleteVersion = async (versionId: string) => {
    try {
      setLoading(true);
      const { deliverablesService } = await import('@/services/deliverablesService');
      await deliverablesService.deleteVersion(versionId);
      // Remove from store state
      for (const [deliverableId, versions] of Object.entries(state.value.deliverableVersions)) {
        const filtered = versions.filter(v => v.id !== versionId);
        if (filtered.length !== versions.length) {
          state.value.deliverableVersions[deliverableId] = filtered;
          versionsUpdateCounter.value++; // Trigger reactivity
          break;
        }
      }
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const rerunWithDifferentLLM = async (versionId: string, llmConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<DeliverableVersion> => {
    try {
      setLoading(true);
      clearError();
      const { deliverablesService } = await import('@/services/deliverablesService');
      const { tasksService } = await import('@/services/tasksService');

      // 1) Load the source version to get task/conversation/agent metadata
      const sourceVersion = await deliverablesService.getVersion(versionId);
      if (!sourceVersion) {
        throw new Error('Source version not found');
      }
      const deliverableId = sourceVersion.deliverableId;
      const currentNumber = sourceVersion.versionNumber || 0;

      if (!sourceVersion.taskId) {
        throw new Error('Cannot rerun: source version has no associated task');
      }

      // 2) Load original task to get prompt + conversation
      const originalTask = await tasksService.getTask(sourceVersion.taskId);
      if (!originalTask) {
        throw new Error('Cannot rerun: original task not found');
      }

      const conversationId = (originalTask as any).agentConversationId || sourceVersion.metadata?.conversationId;
      if (!conversationId) {
        throw new Error('Cannot rerun: missing conversationId');
      }

      // Determine agent routing; prefer local routing cache, then chat store, then backend
      let agentName = (sourceVersion.metadata as any)?.agentName as string | undefined;
      let agentType = (sourceVersion.metadata as any)?.agentType as string | undefined;

      // 2a) Try local routing cache populated when conversation was loaded
      const cachedRouting = state.value.conversationAgentRouting.get(conversationId);
      if (cachedRouting) {
        agentName = cachedRouting.agentName;
        agentType = cachedRouting.agentType;
      }

      // 2b) Try local agentChatStore next to avoid network calls
      try {
        const { useAgentChatStore } = await import('@/stores/agentChatStore');
        const chatStore = useAgentChatStore();
        const conv = chatStore.getConversationById(conversationId);
        if (conv?.agent?.name && conv?.agent?.type) {
          agentName = conv.agent.name as any;
          agentType = conv.agent.type as any;
          // Update cache for future lookups
          state.value.conversationAgentRouting.set(conversationId, {
            agentName: agentName as any,
            agentType: agentType as any,
          });
        }
      } catch (_) {
        // ignore and fall back
      }

      // 2c) If still missing, ask backend for authoritative conversation data
      if (!agentName || !agentType) {
        try {
          const { agentConversationsService } = await import('@/services/agentConversationsService');
          const convo = await agentConversationsService.getConversation(conversationId);
          if (convo?.agentName) agentName = convo.agentName as any;
          if (convo?.agentType) agentType = convo.agentType as any;
          if (agentName && agentType) {
            state.value.conversationAgentRouting.set(conversationId, {
              agentName: agentName as any,
              agentType: agentType as any,
            });
          }
        } catch (_) {
          // ignore and continue to final check
        }
      }
      if (!agentName || !agentType) {
        const deliverable = state.value.deliverables.get(deliverableId);
        if (deliverable?.agentName) agentName = deliverable.agentName as any;
      }
      if (!agentName || !agentType) {
        throw new Error('Cannot rerun: missing agent routing (agentName/agentType) for conversation');
      }

      // 3) Create an agent task using the SAME prompt, with new provider/model
      const llmSelection = {
        providerName: llmConfig.provider,
        modelName: llmConfig.model,
        ...(llmConfig.temperature !== undefined ? { temperature: llmConfig.temperature } : {}),
        ...(llmConfig.maxTokens !== undefined ? { maxTokens: llmConfig.maxTokens } : {}),
        // Include in cidafm custom options for broader compatibility
        cidafmOptions: {
          customOptions: {
          }
        }
      } as any;

      // Load conversation history to filter out the previous deliverable response
      let filteredConversationHistory: any[] = [];
      try {
        const { useAgentChatStore } = await import('@/stores/agentChatStore');
        const chatStore = useAgentChatStore();
        const conversation = chatStore.getConversationById(conversationId);

        if (conversation?.messages) {
          // Filter out any assistant messages that contain this deliverable
          // We want to exclude the previous deliverable response from the history
          filteredConversationHistory = conversation.messages
            .filter(msg => {
              // Keep all user messages
              if (msg.role === 'user') return true;

              // Exclude assistant messages that contain this specific deliverable
              const hasDeliverable = (msg as any).deliverableId === deliverableId ||
                                   msg.metadata?.deliverableId === deliverableId;
              return !hasDeliverable;
            })
            .map(msg => ({
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp.toISOString(),
              taskId: msg.taskId,
              metadata: msg.metadata
            }));

          console.log(`🔄 Filtered conversation history for rerun: ${filteredConversationHistory.length} messages (excluded deliverable response)`);
        }
      } catch (e) {
        console.warn('Could not load conversation history for filtering, backend will use full history', e);
      }

      const taskResp = await tasksService.createAgentTask(agentType!, agentName!, {
        method: 'process',
        prompt: originalTask.prompt,
        conversationId,
        llmSelection,
        executionMode: 'immediate',
        timeoutSeconds: AGENT_TASK_TIMEOUT_SECONDS,
        // Pass filtered conversation history if we have it
        ...(filteredConversationHistory.length > 0 ? { conversationHistory: filteredConversationHistory } : {}),
        // Ensure backend interprets this as a Build so deliverable gating allows persistence
        params: {
          mode: 'build',
        },
      });

      // 4) Poll for a new version to appear for the same deliverable
      const start = Date.now();
      const timeoutMs = AGENT_TASK_TIMEOUT_MS;
      const intervalMs = 1000; // 1s
      let latest: DeliverableVersion | null = null;
      const newTaskId = (taskResp && (taskResp as any).taskId) || undefined;
      while (Date.now() - start < timeoutMs) {
        // Prefer a precise check by taskId if available
        if (newTaskId) {
          console.log(`🔍 [LLM Rerun] Checking for deliverable with taskId: ${newTaskId}`);
          const maybeDeliverable = await deliverablesService.findExistingDeliverable(conversationId, newTaskId);
          if (maybeDeliverable) {
            // Load versions and pick the one created by this task
            const versions = await deliverablesService.getVersionHistory(maybeDeliverable.id);
            const created = versions.find(v => v.taskId === newTaskId) || null;
            console.log(`🔍 [LLM Rerun] Found ${versions.length} versions, taskId match:`, !!created);
            if (created) {
              latest = created;
              break;
            }
          }
        } else {
          // Fallback: detect by version number increment
          console.log(`🔍 [LLM Rerun] Checking for version number increment (current: ${currentNumber})`);
          const versions = await deliverablesService.getVersionHistory(deliverableId);
          const maxVersion = versions.reduce((max, v) => (v.versionNumber > max.versionNumber ? v : max), versions[0] || sourceVersion);
          console.log(`🔍 [LLM Rerun] Max version found: ${maxVersion?.versionNumber}`);
          if (maxVersion && maxVersion.versionNumber > currentNumber) {
            latest = maxVersion;
            break;
          }
        }
        await new Promise(res => setTimeout(res, intervalMs));
      }

      if (!latest) {
        throw new Error('Timed out waiting for new version after rerun');
      }

      // 5) Add the new version to the store state and return it
      addVersion(latest.deliverableId, latest);
      return latest;
    } catch (error: any) {
      console.error('Failed to rerun with different LLM via agent tasks:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentVersion = async (deliverableId: string) => {
    try {
      const { deliverablesService } = await import('@/services/deliverablesService');
      const version = await deliverablesService.getCurrentVersion(deliverableId);
      if (version) {
        state.value.currentVersions.set(deliverableId, version);
        // Update deliverable if it exists
        const deliverable = state.value.deliverables.get(deliverableId);
        if (deliverable) {
          deliverable.currentVersion = version;
        }
      }
      return version;
    } catch (error: any) {

      setError(error.message);
      throw error;
    }
  };
  // New methods for flexible deliverable-conversation relationships
  const loadStandaloneDeliverables = async () => {
    try {
      setLoading(true);
      clearError();
      const { deliverablesService } = await import('@/services/deliverablesService');
      const response = await deliverablesService.getDeliverables({ standalone: true });
      // Update store with standalone deliverables
      response.items.forEach(deliverable => {
        const mapped = {
          id: deliverable.id,
          userId: deliverable.userId,
          conversationId: deliverable.conversationId,
          agentName: deliverable.agentName,
          title: deliverable.title,
          type: deliverable.type,
          createdAt: deliverable.createdAt,
          updatedAt: deliverable.updatedAt,
          currentVersion: deliverable.content ? {
            id: deliverable.versionId,
            content: deliverable.content,
            format: deliverable.format,
            versionNumber: deliverable.versionNumber,
            isCurrentVersion: deliverable.isCurrentVersion,
          } : undefined,
        };
        state.value.deliverables.set(deliverable.id, mapped);
      });
      return response.items;
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  const createEditingConversation = async (
    deliverableId: string, 
    options: {
      agentName?: string;
      initialMessage?: string;
      action?: 'edit' | 'enhance' | 'revise' | 'discuss' | 'new-version';
    } = {}
  ) => {
    try {
      setLoading(true);
      clearError();
      const { deliverablesService } = await import('@/services/deliverablesService');
      const result = await deliverablesService.createEditingConversation(deliverableId, options);
      // Update the deliverable in our store to reflect the new conversation link
      const deliverable = state.value.deliverables.get(deliverableId);
      if (deliverable) {
        deliverable.conversationId = result.conversationId;
        state.value.deliverables.set(deliverableId, deliverable);
      }
      return result;
    } catch (error: any) {

      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  const handleConversationDeleted = (conversationId: string) => {
    // Update deliverables that were linked to this conversation
    state.value.deliverables.forEach((deliverable, id) => {
      if (deliverable.conversationId === conversationId) {
        deliverable.conversationId = undefined;
        state.value.deliverables.set(id, deliverable);
      }
    });
    // Remove from conversation deliverables mapping
    state.value.conversationDeliverables.delete(conversationId);
  };
  return {
    // State
    deliverables,
    isLoading,
    error,
    // Additional computed properties
    hasDeliverables,
    recentDeliverables,
    searchResults,
    deliverablesByType,
    enhancementContext,
    // Getters
    getDeliverableById,
    getDeliverablesByConversation,
    getDeliverableVersions,
    getDeliverableVersionsReactive, // reactive computed for Vue components
    getDeliverableVersionsSync, // synchronous version for computed properties
    getDeliverable, // alias for getDeliverableById
    getVersions, // alias for getDeliverableVersions
    getVersion, // get single version by ID
    getCurrentVersion,
    // Actions
    setLoading,
    setError,
    clearError,
    addDeliverable,
    addVersion,
    loadDeliverablesByConversation,
    loadDeliverableVersions,
    createVersion,
    loadDeliverables,
    deleteDeliverable,
    updateDeliverable,
    startEnhancement,
    // Version management
    setCurrentVersion,
    deleteVersion,
    rerunWithDifferentLLM,
    enhanceVersion,
    copyVersion,
    loadCurrentVersion,
    // Additional methods for compatibility
    processAgentDeliverable,
    findDeliverableForEnhancement,
    createDeliverable,
    searchDeliverables,
    loadConversationDeliverables,
    setCurrentDeliverable,
    // New methods for flexible deliverable-conversation relationships
    loadStandaloneDeliverables,
    createEditingConversation,
    handleConversationDeleted,
    stopEnhancement,
  };
});
