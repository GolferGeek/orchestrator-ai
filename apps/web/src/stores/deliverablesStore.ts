import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
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
  deliverableVersions: Map<string, DeliverableVersion[]>; // deliverableId -> versions
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
    deliverableVersions: new Map(),
    conversationDeliverables: new Map(),
    currentVersions: new Map(),
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
    const existing = state.value.deliverableVersions.get(deliverableId) || [];
    
    // Remove existing version with same ID if present, then add new one
    const filtered = existing.filter(v => v.id !== version.id);
    const newVersions = [...filtered, version].sort((a, b) => b.versionNumber - a.versionNumber);
    
    state.value.deliverableVersions.set(deliverableId, newVersions);
    
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
        state.value.currentVersions.delete(id);
      });
      
      state.value.conversationDeliverables.delete(conversationId);

      // Add new deliverables
      deliverables.forEach((deliverable: Deliverable) => {
        addDeliverable(deliverable);
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
      const versions = await deliverablesService.getVersionHistory(parentId);
      
      // Store versions in state
      state.value.deliverableVersions.set(parentId, versions);
      
      // Update current version if we find one
      const currentVersion = versions.find(v => v.isCurrentVersion);
      if (currentVersion) {
        state.value.currentVersions.set(parentId, currentVersion);
      }
      
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
      
      console.log('🔄 Creating new version:', {
        deliverableId,
        data,
        authToken: !!authToken
      });
      
      const newVersion = await deliverablesService.createVersion(deliverableId, data);
      
      console.log('✅ Version created successfully:', {
        newVersionId: newVersion.id,
        versionNumber: newVersion.versionNumber,
        isCurrentVersion: newVersion.isCurrentVersion
      });
      
      // Add version to store
      addVersion(deliverableId, newVersion);
      
      return newVersion;
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
        latestOnly: true // Only show latest versions by default
      });
      
      console.log('🔍 loadDeliverables result:', result);

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
          console.error(`Failed to load deliverable ${searchItem.id}:`, error);
          return null;
        }
      });

      const deliverables = (await Promise.all(deliverablePromises)).filter(Boolean) as Deliverable[];
      
      // Add all deliverables to the store
      deliverables.forEach((deliverable) => {
        addDeliverable(deliverable);
      });

      console.log('🔍 Total deliverables loaded:', deliverables.length);
      return deliverables;
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
      console.error('Failed to set current version:', error);
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
      for (const [deliverableId, versions] of state.value.deliverableVersions.entries()) {
        const filtered = versions.filter(v => v.id !== versionId);
        if (filtered.length !== versions.length) {
          state.value.deliverableVersions.set(deliverableId, filtered);
          break;
        }
      }
    } catch (error: any) {
      console.error('Failed to delete version:', error);
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
      console.error('Failed to load current version:', error);
      setError(error.message);
      throw error;
    }
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
    loadCurrentVersion,
    
    // Additional methods for compatibility
    processAgentDeliverable,
    findDeliverableForEnhancement,
    createDeliverable,
    searchDeliverables,
    loadConversationDeliverables,
    setCurrentDeliverable,
  };
});