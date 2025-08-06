import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  deliverablesService, 
  type Deliverable, 
  type DeliverableVersion,
  type CreateDeliverableDto,
  type CreateVersionDto,
  type DeliverableFilters,
  type DeliverableSearchResult,
  type DeliverableSearchItem,
  DeliverableType,
  DeliverableFormat
} from '@/services/deliverablesService';

export interface DeliverableState {
  deliverables: Map<string, Deliverable>;
  versions: Map<string, DeliverableVersion[]>; // Map of parentId -> versions
  currentDeliverable: Deliverable | null;
  searchResults: DeliverableSearchResult | null;
  conversationDeliverables: Map<string, string[]>; // Map of conversationId -> deliverable IDs
  enhancementContext: {
    sourceDeliverableId: string | null;
    isEnhancing: boolean;
  };
  isLoading: boolean;
  error: string | null;
}

export const useDeliverablesStore = defineStore('deliverables', () => {
  // State
  const deliverables = ref<Map<string, Deliverable>>(new Map());
  const versions = ref<Map<string, DeliverableVersion[]>>(new Map());
  const currentDeliverable = ref<Deliverable | null>(null);
  const searchResults = ref<DeliverableSearchResult | null>(null);
  const conversationDeliverables = ref<Map<string, string[]>>(new Map());
  const enhancementContext = ref({
    sourceDeliverableId: null as string | null,
    isEnhancing: false
  });
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const allDeliverables = computed(() => Array.from(deliverables.value.values()));
  const searchItems = computed(() => searchResults.value?.items || []);
  
  const deliverablesByType = computed(() => {
    const grouped: Record<DeliverableType, DeliverableSearchItem[]> = {
      [DeliverableType.DOCUMENT]: [],
      [DeliverableType.ANALYSIS]: [],
      [DeliverableType.REPORT]: [],
      [DeliverableType.PLAN]: [],
      [DeliverableType.REQUIREMENTS]: []
    };
    
    searchItems.value.forEach(deliverable => {
      if (grouped[deliverable.deliverable_type]) {
        grouped[deliverable.deliverable_type].push(deliverable);
      }
    });
    
    return grouped;
  });

  const recentDeliverables = computed(() => {
    return searchItems.value
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  });

  const hasDeliverables = computed(() => (searchResults.value?.items.length || 0) > 0);

  // Actions
  
  /**
   * Load all deliverables with optional filtering
   */
  async function loadDeliverables(filters?: DeliverableFilters): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await deliverablesService.getDeliverables(filters);
      searchResults.value = result;
      
      // Store search results separately - they don't have full deliverable details
      // Full deliverables will be fetched on-demand when needed

      console.log(`📄 Loaded ${result.items.length} deliverables`);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load deliverables';
      console.error('Failed to load deliverables:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get a specific deliverable by ID
   */
  async function getDeliverable(id: string): Promise<Deliverable | null> {
    // Check cache first
    if (deliverables.value.has(id)) {
      return deliverables.value.get(id)!;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const deliverable = await deliverablesService.getDeliverable(id);
      deliverables.value.set(id, deliverable);
      return deliverable;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get deliverable';
      console.error('Failed to get deliverable:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create a new deliverable
   */
  async function createDeliverable(data: CreateDeliverableDto): Promise<Deliverable | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const deliverable = await deliverablesService.createDeliverable(data);
      deliverables.value.set(deliverable.id, deliverable);

      // Update conversation mapping if conversation_id is provided
      if (deliverable.conversation_id) {
        addToConversationMapping(deliverable.conversation_id, deliverable.id);
      }

      console.log(`📄 Created deliverable: ${deliverable.title} (${deliverable.id})`);
      return deliverable;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create deliverable';
      console.error('Failed to create deliverable:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create a new version of an existing deliverable (enhancement)
   */
  async function createVersion(parentId: string, data: CreateVersionDto): Promise<Deliverable | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const newVersion = await deliverablesService.createVersion(parentId, data);
      deliverables.value.set(newVersion.id, newVersion);

      // Update versions cache
      await loadVersions(parentId);

      console.log(`📄 Enhanced deliverable: ${newVersion.title} (${newVersion.id}) from ${parentId}`);
      return newVersion;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create deliverable version';
      console.error('Failed to create deliverable version:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update an existing deliverable
   */
  async function updateDeliverable(id: string, updates: Partial<CreateDeliverableDto>): Promise<Deliverable | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const updated = await deliverablesService.updateDeliverable(id, updates);
      deliverables.value.set(id, updated);

      console.log(`📄 Updated deliverable: ${updated.title} (${id})`);
      return updated;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update deliverable';
      console.error('Failed to update deliverable:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Delete a deliverable
   */
  async function deleteDeliverable(id: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await deliverablesService.deleteDeliverable(id);
      
      const deliverable = deliverables.value.get(id);
      deliverables.value.delete(id);
      versions.value.delete(id);

      // Remove from conversation mapping
      if (deliverable?.conversation_id) {
        removeFromConversationMapping(deliverable.conversation_id, id);
      }

      console.log(`📄 Deleted deliverable: ${id}`);
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete deliverable';
      console.error('Failed to delete deliverable:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load versions for a deliverable
   */
  async function loadVersions(parentId: string): Promise<DeliverableVersion[]> {
    try {
      const versionsList = await deliverablesService.getVersions(parentId);
      versions.value.set(parentId, versionsList);
      return versionsList;
    } catch (err) {
      console.error('Failed to load versions:', err);
      return [];
    }
  }

  /**
   * Search deliverables
   */
  async function searchDeliverables(query: string, filters?: Omit<DeliverableFilters, 'search'>): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await deliverablesService.searchDeliverables(query, filters);
      searchResults.value = result;

      // Store search results separately - they don't have full deliverable details
      // Full deliverables will be fetched on-demand when needed

      console.log(`📄 Search found ${result.items.length} deliverables for query: "${query}"`);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Search failed';
      console.error('Failed to search deliverables:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Load deliverables for a specific conversation
   */
  async function loadConversationDeliverables(conversationId: string): Promise<DeliverableSearchItem[]> {
    try {
      const conversationDeliverablesList = await deliverablesService.getConversationDeliverables(conversationId);
      
      // Update conversation mapping
      const deliverableIds: string[] = [];
      conversationDeliverablesList.forEach(deliverable => {
        deliverableIds.push(deliverable.id);
      });
      
      conversationDeliverables.value.set(conversationId, deliverableIds);
      
      console.log(`📄 Loaded ${conversationDeliverablesList.length} deliverables for conversation ${conversationId}`);
      return conversationDeliverablesList;
    } catch (err) {
      console.error('Failed to load conversation deliverables:', err);
      return [];
    }
  }

  /**
   * Get deliverables for a conversation (from cache or load)
   */
  function getConversationDeliverables(conversationId: string): Deliverable[] {
    const deliverableIds = conversationDeliverables.value.get(conversationId) || [];
    return deliverableIds
      .map(id => deliverables.value.get(id))
      .filter((d): d is Deliverable => d !== undefined);
  }

  /**
   * Set current deliverable for editing/viewing
   */
  function setCurrentDeliverable(deliverable: Deliverable | null): void {
    currentDeliverable.value = deliverable;
  }

  /**
   * Start deliverable enhancement workflow
   */
  function startEnhancement(sourceDeliverableId: string): void {
    enhancementContext.value = {
      sourceDeliverableId,
      isEnhancing: true
    };
    console.log(`📄 Started enhancement workflow for deliverable: ${sourceDeliverableId}`);
  }

  /**
   * Complete deliverable enhancement workflow
   */
  function completeEnhancement(): void {
    enhancementContext.value = {
      sourceDeliverableId: null,
      isEnhancing: false
    };
    console.log('📄 Completed enhancement workflow');
  }

  /**
   * Process deliverable ID from agent response
   * This is called when agents return deliverable IDs in their responses
   */
  async function processAgentDeliverable(
    deliverableId: string, 
    conversationId: string,
    messageId?: string,
    enhancedFrom?: string
  ): Promise<void> {
    try {
      // Load the deliverable into cache
      const deliverable = await getDeliverable(deliverableId);
      
      if (deliverable) {
        // Update conversation mapping
        addToConversationMapping(conversationId, deliverableId);
        
        // If this was an enhancement, complete the enhancement workflow
        if (enhancedFrom && enhancementContext.value.sourceDeliverableId === enhancedFrom) {
          completeEnhancement();
        }
        
        console.log(`📄 Processed agent deliverable: ${deliverable.title} (${deliverableId})`);
      }
    } catch (err) {
      console.error('Failed to process agent deliverable:', err);
    }
  }

  /**
   * Find existing deliverable for enhancement context
   */
  async function findDeliverableForEnhancement(
    conversationId: string, 
    messageId?: string
  ): Promise<Deliverable | null> {
    try {
      return await deliverablesService.findExistingDeliverable(conversationId, messageId);
    } catch (err) {
      console.error('Failed to find deliverable for enhancement:', err);
      return null;
    }
  }

  // Helper functions
  function addToConversationMapping(conversationId: string, deliverableId: string): void {
    const existing = conversationDeliverables.value.get(conversationId) || [];
    if (!existing.includes(deliverableId)) {
      conversationDeliverables.value.set(conversationId, [...existing, deliverableId]);
    }
  }

  function removeFromConversationMapping(conversationId: string, deliverableId: string): void {
    const existing = conversationDeliverables.value.get(conversationId) || [];
    const filtered = existing.filter(id => id !== deliverableId);
    conversationDeliverables.value.set(conversationId, filtered);
  }

  /**
   * Clear all cached data
   */
  function clearCache(): void {
    deliverables.value.clear();
    versions.value.clear();
    conversationDeliverables.value.clear();
    currentDeliverable.value = null;
    searchResults.value = null;
    completeEnhancement();
    error.value = null;
  }

  /**
   * Get versions for a deliverable (from cache or load)
   */
  async function getVersions(parentId: string): Promise<DeliverableVersion[]> {
    if (versions.value.has(parentId)) {
      return versions.value.get(parentId)!;
    }
    return await loadVersions(parentId);
  }

  return {
    // State
    deliverables: computed(() => deliverables.value),
    currentDeliverable,
    searchResults,
    enhancementContext,
    isLoading,
    error,

    // Computed
    allDeliverables,
    deliverablesByType,
    recentDeliverables,
    hasDeliverables,

    // Actions
    loadDeliverables,
    getDeliverable,
    createDeliverable,
    createVersion,
    updateDeliverable,
    deleteDeliverable,
    loadVersions,
    getVersions,
    searchDeliverables,
    loadConversationDeliverables,
    getConversationDeliverables,
    setCurrentDeliverable,
    startEnhancement,
    completeEnhancement,
    processAgentDeliverable,
    findDeliverableForEnhancement,
    clearCache
  };
});