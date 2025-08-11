import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './authStore';

interface Deliverable {
  id: string;
  user_id: string;
  conversation_id?: string;
  message_id?: string;
  title: string;
  content: string;
  deliverable_type: string;
  format: string;
  version: number;
  parent_deliverable_id?: string;
  is_latest_version: boolean;
  metadata?: Record<string, any>;
  tags?: string[];
  created_by_agent?: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

interface DeliverableVersion {
  id: string;
  title: string;
  version: number;
  is_latest_version: boolean;
  created_at: Date;
  created_by_agent?: string;
  content_preview: string;
}

interface DeliverablesState {
  deliverables: Map<string, Deliverable>;
  deliverableVersions: Map<string, DeliverableVersion[]>;
  conversationDeliverables: Map<string, string[]>; // conversationId -> deliverableIds
  isLoading: boolean;
  error: string | null;
}

export const useDeliverablesStore = defineStore('deliverables', () => {
  const authStore = useAuthStore();

  // State
  const state = ref<DeliverablesState>({
    deliverables: new Map(),
    deliverableVersions: new Map(),
    conversationDeliverables: new Map(),
    isLoading: false,
    error: null,
  });

  // Getters
  const deliverables = computed(() => Array.from(state.value.deliverables.values()));
  const isLoading = computed(() => state.value.isLoading);
  const error = computed(() => state.value.error);
  
  // Additional computed properties for compatibility
  const hasDeliverables = computed(() => deliverables.value.length > 0);
  const recentDeliverables = computed(() => 
    deliverables.value
      .slice()
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10)
  );
  const searchResults = computed(() => deliverables.value); // For now, just return all deliverables

  const getDeliverableById = (id: string) => {
    return state.value.deliverables.get(id) || null;
  };

  const getDeliverablesByConversation = (conversationId: string) => {
    const deliverableIds = state.value.conversationDeliverables.get(conversationId) || [];
    return deliverableIds
      .map(id => state.value.deliverables.get(id))
      .filter(Boolean) as Deliverable[];
  };

  const getDeliverableVersions = async (parentId: string) => {
    if (state.value.deliverableVersions.has(parentId)) {
      return state.value.deliverableVersions.get(parentId)!;
    }
    
    await loadDeliverableVersions(parentId);
    return state.value.deliverableVersions.get(parentId) || [];
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
    
    // Add to conversation mapping if conversation_id exists
    if (deliverable.conversation_id) {
      const existing = state.value.conversationDeliverables.get(deliverable.conversation_id) || [];
      if (!existing.includes(deliverable.id)) {
        state.value.conversationDeliverables.set(
          deliverable.conversation_id,
          [...existing, deliverable.id]
        );
      }
    }
  };

  const loadDeliverablesByConversation = async (conversationId: string) => {
    try {
      setLoading(true);
      clearError();

      const authToken = authStore.token;
      if (!authToken) {
        // If no token is available, just return empty array instead of throwing error
        // This handles the case where component loads before authentication
        console.log('No authentication token available for deliverables, skipping load');
        return [];
      }
      
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const deliverables = await deliverablesService.getConversationDeliverables(conversationId);
      
      // Clear existing deliverables for this conversation
      const existingIds = state.value.conversationDeliverables.get(conversationId) || [];
      existingIds.forEach(id => {
        state.value.deliverables.delete(id);
      });
      
      state.value.conversationDeliverables.delete(conversationId);

      // Add new deliverables
      deliverables.forEach((deliverable: Deliverable) => {
        addDeliverable(deliverable);
      });

      return deliverables;
    } catch (error: any) {
      console.error('Failed to load deliverables by conversation:', error);
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

      const authToken = authStore.token;
      if (!authToken) {
        console.log('No authentication token available for loading deliverable versions');
        return [];
      }
      
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const versions = await deliverablesService.getVersions(parentId);
      state.value.deliverableVersions.set(parentId, versions);
      
      return versions;
    } catch (error: any) {
      console.error('Failed to load deliverable versions:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createVersion = async (
    parentId: string, 
    data: {
      title: string;
      content: string;
      created_by_agent?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Deliverable> => {
    try {
      setLoading(true);
      clearError();

      const authToken = authStore.token;
      if (!authToken) {
        throw new Error('No authentication token available for creating deliverable version');
      }
      
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const newVersion = await deliverablesService.createVersion(parentId, data);
      addDeliverable(newVersion);
      
      // Invalidate cached versions for this parent
      state.value.deliverableVersions.delete(parentId);
      
      return newVersion;
    } catch (error: any) {
      console.error('Failed to create deliverable version:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Additional methods for compatibility
  const loadDeliverables = async () => {
    // For now, this can be an alias to loading all deliverables for a conversation
    // In a full implementation, this might load all deliverables for a user
    console.log('loadDeliverables called - implementing as needed');
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
      console.error('Failed to delete deliverable:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateDeliverable = async (id: string, data: Partial<Deliverable>) => {
    const authToken = authStore.token;
    if (!authToken) {
      throw new Error('No authentication token available');
    }

    try {
      setLoading(true);
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const updatedDeliverable = await deliverablesService.updateDeliverable(id, data);
      addDeliverable(updatedDeliverable);
      return updatedDeliverable;
    } catch (error: any) {
      console.error('Failed to update deliverable:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const startEnhancement = async (deliverableId: string) => {
    // This method would typically initialize an enhancement workflow
    // For now, just return the deliverable ID for enhancement context
    console.log(`Starting enhancement for deliverable: ${deliverableId}`);
    return deliverableId;
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

    // Getters
    getDeliverableById,
    getDeliverablesByConversation,
    getDeliverableVersions,
    getDeliverable, // alias for getDeliverableById

    // Actions
    setLoading,
    setError,
    clearError,
    addDeliverable,
    loadDeliverablesByConversation,
    loadDeliverableVersions,
    createVersion,
    loadDeliverables,
    deleteDeliverable,
    updateDeliverable,
    startEnhancement,
  };
});