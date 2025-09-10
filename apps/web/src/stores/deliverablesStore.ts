import { defineStore } from 'pinia';
import { ref, computed, reactive } from 'vue';
import { useAuthStore } from './authStore';
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
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const deliverables = await deliverablesService.getConversationDeliverables(conversationId.trim());
      // Clear existing deliverables for this conversation
      const existingIds = state.value.conversationDeliverables.get(conversationId) || [];
      existingIds.forEach(id => {
        state.value.deliverables.delete(id);
        state.value.currentVersions.delete(id);
      });
      state.value.conversationDeliverables.delete(conversationId);
      // Add new deliverables
      deliverables.forEach((deliverable: Deliverable) => {
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
  // Additional methods needed by useDeliverables composable
  const processAgentDeliverable = async (deliverableId: string, conversationId: string, messageId?: string, enhancedFrom?: string) => {
    // Process agent deliverable creation/update
    try {
      const { deliverablesService } = await import('@/services/deliverablesService');
      const deliverable = await deliverablesService.getDeliverable(deliverableId);
      addDeliverable(deliverable);
      return deliverable;
    } catch (error) {

      throw error;
    }
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
      const newVersion = await deliverablesService.rerunWithDifferentLLM(versionId, llmConfig);
      
      // Add the new version to the store state
      addVersion(newVersion.deliverableId, newVersion);
      
      return newVersion;
    } catch (error: any) {
      console.error('Failed to rerun with different LLM:', error);
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
  };
});