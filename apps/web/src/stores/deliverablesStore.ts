import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './authStore';
import type { 
  Deliverable as ServiceDeliverable,
  DeliverableSearchItem,
  DeliverableType,
  DeliverableFormat
} from '@/services/deliverablesService';

interface Deliverable {
  id: string;
  user_id: string;
  conversation_id?: string;
  message_id?: string;
  task_id?: string;
  title: string;
  content: string;
  type: DeliverableType | string;
  format: DeliverableFormat | string;
  version: number;
  parent_deliverable_id?: string;
  is_latest_version: boolean;
  metadata?: Record<string, any>;
  tags?: string[];
  created_by_agent?: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
  content_preview?: string;
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
  
  // Group deliverables by type for compatibility
  const deliverablesByType = computed(() => {
    const grouped: Record<string, any[]> = {
      'document': [],
      'analysis': [],
      'report': [],
      'plan': [],
      'requirements': []
    };
    
    deliverables.value.forEach(deliverable => {
      const type = deliverable.type.toLowerCase();
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

  const addDeliverable = (deliverable: any) => {
    // Normalize date fields to ensure consistency
    const normalizedDeliverable = {
      ...deliverable,
      created_at: deliverable.created_at instanceof Date ? deliverable.created_at : new Date(deliverable.created_at),
      updated_at: deliverable.updated_at instanceof Date ? deliverable.updated_at : new Date(deliverable.updated_at),
    };
    
    state.value.deliverables.set(deliverable.id, normalizedDeliverable as Deliverable);
    
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

  const isUuid = (value?: string) => {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  };

  const loadDeliverablesByConversation = async (conversationId: string) => {
    try {
      setLoading(true);
      clearError();

      console.log('🔍 loadDeliverablesByConversation called with:', {
        conversationId,
        type: typeof conversationId,
        length: conversationId?.length,
        isUuid: isUuid(conversationId)
      });

      // Enhanced validation to catch more edge cases
      if (!conversationId || 
          typeof conversationId !== 'string' || 
          conversationId.trim() === '' ||
          conversationId === 'undefined' ||
          conversationId === 'null' ||
          !isUuid(conversationId.trim())) {
        console.warn('Skipping loadDeliverablesByConversation: invalid conversationId', {
          conversationId,
          type: typeof conversationId,
          length: conversationId?.length,
          trimmed: conversationId?.trim(),
          isUuid: conversationId ? isUuid(conversationId.trim()) : false
        });
        return [] as any[];
      }

      const authToken = authStore.token;
      if (!authToken) {
        // If no token is available, just return empty array instead of throwing error
        // This handles the case where component loads before authentication
        console.log('No authentication token available for deliverables, skipping load');
        return [];
      }
      
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const deliverables = await deliverablesService.getConversationDeliverables(conversationId.trim());
      
      // Clear existing deliverables for this conversation
      const existingIds = state.value.conversationDeliverables.get(conversationId) || [];
      existingIds.forEach(id => {
        state.value.deliverables.delete(id);
      });
      
      state.value.conversationDeliverables.delete(conversationId);

      // Add new deliverables
      deliverables.forEach((deliverable: any) => {
        const storeDeliverable = {
          ...deliverable,
          created_at: new Date(deliverable.created_at),
          updated_at: new Date(deliverable.updated_at)
        };
        addDeliverable(storeDeliverable);
      });

      return deliverables;
    } catch (error: any) {
      console.error('Failed to load deliverables by conversation:', {
        conversationId,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        fullError: error
      });
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

      console.log('🔍 loadDeliverableVersions called with:', {
        parentId,
        type: typeof parentId,
        length: parentId?.length,
        isUuid: isUuid(parentId)
      });

      // Enhanced validation to catch invalid deliverable IDs
      if (!parentId || 
          typeof parentId !== 'string' || 
          parentId.trim() === '' ||
          parentId === 'undefined' ||
          parentId === 'null' ||
          !isUuid(parentId.trim())) {
        console.warn('Skipping loadDeliverableVersions: invalid parentId', {
          parentId,
          type: typeof parentId,
          length: parentId?.length,
          trimmed: parentId?.trim(),
          isUuid: parentId ? isUuid(parentId.trim()) : false
        });
        return [] as any[];
      }

      const authToken = authStore.token;
      if (!authToken) {
        console.log('No authentication token available for loading deliverable versions');
        return [];
      }
      
      // Use the proper deliverablesService instead of direct fetch
      const { deliverablesService } = await import('@/services/deliverablesService');
      const versions = await deliverablesService.getVersions(parentId);
      
      // Normalize date fields in versions
      const normalizedVersions = versions.map(v => ({
        ...v,
        created_at: (v.created_at as any) instanceof Date ? v.created_at : new Date(v.created_at as any)
      }));
      
      state.value.deliverableVersions.set(parentId, normalizedVersions as any);
      
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
      
      console.log('🔄 Creating new version:', {
        parentId,
        data,
        authToken: !!authToken
      });
      
      const newVersion = await deliverablesService.createVersion(parentId, data);
      
      console.log('✅ Version created successfully:', {
        newVersionId: newVersion.id,
        version: newVersion.version,
        title: newVersion.title,
        isLatest: newVersion.is_latest_version
      });
      const storeVersion = {
        ...newVersion,
        created_at: new Date(newVersion.created_at),
        updated_at: new Date(newVersion.updated_at)
      };
      addDeliverable(storeVersion as any);
      
      // Invalidate cached versions for this parent
      state.value.deliverableVersions.delete(parentId);
      
      return storeVersion as any;
    } catch (error: any) {
      console.error('Failed to create deliverable version:', error);
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

      console.log('🔍 loadDeliverables called - loading all user deliverables');

      const authToken = authStore.token;
      if (!authToken) {
        console.log('No authentication token available for loading deliverables, skipping load');
        return [];
      }
      
      // Use the proper deliverablesService to load all user deliverables
      const { deliverablesService } = await import('@/services/deliverablesService');
      const result = await deliverablesService.getDeliverables({
        limit: 100, // Get more deliverables for the main page
        offset: 0,
        latest_only: true // Only show latest versions by default
      });
      
      console.log('🔍 loadDeliverables result:', result);

      // Clear existing deliverables first
      state.value.deliverables.clear();
      state.value.conversationDeliverables.clear();

      // Add all deliverables to the store
      result.items.forEach((deliverable: any) => {
        const storeDeliverable = {
          ...deliverable,
          created_at: new Date(deliverable.created_at),
          updated_at: new Date(deliverable.updated_at)
        };
        addDeliverable(storeDeliverable);
      });

      console.log('🔍 Total deliverables loaded:', result.items.length);
      return result.items;
    } catch (error: any) {
      console.error('Failed to load all deliverables:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        fullError: error
      });
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
      console.error('Failed to delete deliverable:', error);
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
    enhancementContext.value.sourceDeliverableId = deliverableId;
    enhancementContext.value.isEnhancing = true;
    return deliverableId;
  };

  // Additional methods needed by useDeliverables composable
  const processAgentDeliverable = async (deliverableId: string, conversationId: string, messageId?: string, enhancedFrom?: string) => {
    // Process agent deliverable creation/update
    console.log('processAgentDeliverable called with:', { deliverableId, conversationId, messageId, enhancedFrom });
    
    try {
      const { deliverablesService } = await import('@/services/deliverablesService');
      const deliverable = await deliverablesService.getDeliverable(deliverableId);
      addDeliverable(deliverable);
      return deliverable;
    } catch (error) {
      console.error('Failed to process agent deliverable:', error);
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
      console.error('Failed to create deliverable:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const searchDeliverables = async (query: string, filters?: any) => {
    // For now, just filter existing deliverables
    // In a full implementation, this would call the backend search API
    console.log('searchDeliverables called with:', { query, filters });
    
    const filtered = deliverables.value.filter(d => 
      d.title.toLowerCase().includes(query.toLowerCase()) ||
      d.content.toLowerCase().includes(query.toLowerCase())
    );
    
    // For now, we don't have a separate search results state, so just log
    console.log('Search results:', filtered);
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
    console.log('setCurrentDeliverable called with:', deliverable);
  };

  const getVersions = async (deliverableId: string) => {
    // Alias to existing method
    return await getDeliverableVersions(deliverableId);
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
    getDeliverable, // alias for getDeliverableById
    getVersions, // alias for getDeliverableVersions

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
    
    // Additional methods for compatibility
    processAgentDeliverable,
    findDeliverableForEnhancement,
    createDeliverable,
    searchDeliverables,
    loadConversationDeliverables,
    setCurrentDeliverable,
  };
});