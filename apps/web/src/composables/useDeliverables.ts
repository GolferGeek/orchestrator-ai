import { ref, computed } from 'vue';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { 
  DeliverableType, 
  DeliverableFormat, 
  type Deliverable, 
  type DeliverableSearchItem,
  type CreateDeliverableDto,
  type DeliverableFilters 
} from '@/services/deliverablesService';

/**
 * Composable for deliverable management with chat integration
 * Provides a convenient interface for working with deliverables in components
 */
export function useDeliverables() {
  const store = useDeliverablesStore();

  // UI state
  const showDeliverableModal = ref(false);
  const selectedDeliverable = ref<Deliverable | null>(null);
  const isCreatingDeliverable = ref(false);

  // Computed properties
  const hasDeliverables = computed(() => store.hasDeliverables);
  const recentDeliverables = computed(() => store.recentDeliverables);
  const isLoading = computed(() => store.isLoading);
  const error = computed(() => store.error);
  const deliverablesByType = computed(() => store.deliverables);
  const isEnhancing = computed(() => false); // Enhancement context disabled for now
  const enhancementSource = computed(() => null as string | null);

  // Actions

  /**
   * Initialize deliverables (load recent deliverables)
   */
  async function initialize(): Promise<void> {
    await store.loadDeliverables();
  }

  /**
   * Process agent response for deliverable information
   * Call this when agents return responses with deliverable IDs
   */
  async function processAgentResponse(
    response: any,
    conversationId: string,
    messageId?: string
  ): Promise<void> {
    if (!response || typeof response !== 'object') {
      return;
    }

    // Check if response contains deliverable ID
    if (response.deliverableId) {
      // Process agent deliverable - simplified for now
      console.log('Processing agent deliverable:', response.deliverableId);
    }
  }

  /**
   * Prepare enhancement context for agent request
   * Call this before sending enhancement requests to agents
   */
  async function prepareEnhancementContext(
    conversationId: string,
    messageId?: string
  ): Promise<{ deliverableId?: string }> {
    // Find existing deliverable for this conversation/message
    // Find existing deliverable for enhancement
    const conversationDeliverables = store.getDeliverablesByConversation(conversationId);
    const existingDeliverable = messageId 
      ? conversationDeliverables.find(d => d.message_id === messageId)
      : conversationDeliverables[0];
    
    if (existingDeliverable) {
      store.startEnhancement(existingDeliverable.id);
      return { deliverableId: existingDeliverable.id };
    }

    return {};
  }

  /**
   * Get enhancement parameters for agent requests
   * Returns parameters to include in agent task requests
   */
  function getEnhancementParams(): Record<string, any> {
    // Enhancement context disabled for now
    // if (store.enhancementContext?.isEnhancing && store.enhancementContext?.sourceDeliverableId) {
    //   return {
    //     deliverableId: store.enhancementContext.sourceDeliverableId,
    //     enhanceDeliverableId: store.enhancementContext.sourceDeliverableId
    //   };
    // }
    return {};
  }

  /**
   * Create a new deliverable manually
   */
  async function createDeliverable(
    title: string,
    content: string,
    options: {
      type?: DeliverableType;
      format?: DeliverableFormat;
      description?: string;
      conversationId?: string;
      messageId?: string;
      agentName?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Deliverable | null> {
    const data: CreateDeliverableDto = {
      title,
      content,
      deliverable_type: options.type || DeliverableType.DOCUMENT,
      format: options.format || DeliverableFormat.MARKDOWN,
      description: options.description,
      conversation_id: options.conversationId,
      message_id: options.messageId,
      created_by_agent: options.agentName,
      tags: options.tags || [],
      metadata: {
        manuallyCreated: true,
        createdAt: new Date().toISOString(),
        ...options.metadata
      }
    };

    // Create via service
    const { deliverablesService } = await import('@/services/deliverablesService');
    const newDeliverable = await deliverablesService.createDeliverable(data);
    store.addDeliverable({
      ...newDeliverable,
      deliverable_type: data.deliverable_type,
      format: data.format,
      created_at: new Date(newDeliverable.created_at),
      updated_at: new Date(newDeliverable.updated_at)
    } as any);
    return newDeliverable;
  }

  /**
   * Enhance an existing deliverable
   */
  async function enhanceDeliverable(
    sourceId: string,
    newTitle: string,
    newContent: string,
    options: {
      agentName?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Deliverable | null> {
    return await store.createVersion(sourceId, {
      title: newTitle,
      content: newContent,
      created_by_agent: options.agentName,
      metadata: {
        enhancementReason: 'manual_enhancement',
        enhancedAt: new Date().toISOString(),
        ...options.metadata
      }
    });
  }

  /**
   * Search deliverables
   */
  async function search(query: string, filters?: DeliverableFilters): Promise<void> {
    // Search functionality to be implemented
    console.log('Search deliverables:', query, filters);
  }

  /**
   * Get deliverables for a conversation
   */
  async function getConversationDeliverables(conversationId: string): Promise<DeliverableSearchItem[]> {
    const deliverables = await store.loadDeliverablesByConversation(conversationId);
    return deliverables.map(d => ({
      id: d.id,
      title: d.title,
      deliverable_type: d.deliverable_type,
      format: d.format,
      version: d.version,
      is_latest_version: d.is_latest_version,
      created_at: d.created_at instanceof Date ? d.created_at.toISOString() : d.created_at,
      updated_at: d.updated_at instanceof Date ? d.updated_at.toISOString() : d.updated_at,
      created_by_agent: d.created_by_agent,
      content_preview: d.content?.substring(0, 200) || '',
      tags: d.tags
    } as DeliverableSearchItem));
  }

  /**
   * Show deliverable in modal
   */
  function showDeliverable(deliverable: Deliverable): void {
    selectedDeliverable.value = deliverable;
    // Set current deliverable - to be implemented
    console.log('Setting current deliverable:', deliverable);
    showDeliverableModal.value = true;
  }

  /**
   * Hide deliverable modal
   */
  function hideDeliverable(): void {
    showDeliverableModal.value = false;
    selectedDeliverable.value = null;
    // Clear current deliverable
    console.log('Clearing current deliverable');
  }

  /**
   * Start creating a new deliverable
   */
  function startCreating(): void {
    isCreatingDeliverable.value = true;
    showDeliverableModal.value = true;
  }

  /**
   * Cancel creating deliverable
   */
  function cancelCreating(): void {
    isCreatingDeliverable.value = false;
    showDeliverableModal.value = false;
  }

  /**
   * Delete a deliverable with confirmation
   */
  async function deleteDeliverable(deliverable: Deliverable): Promise<boolean> {
    if (confirm(`Are you sure you want to delete "${deliverable.title}"?`)) {
      await store.deleteDeliverable(deliverable.id);
      const success = true;
      if (success && selectedDeliverable.value?.id === deliverable.id) {
        hideDeliverable();
      }
      return success;
    }
    return false;
  }

  /**
   * Get display icon for deliverable type
   */
  function getTypeIcon(type: DeliverableType): string {
    const icons = {
      [DeliverableType.DOCUMENT]: '📄',
      [DeliverableType.ANALYSIS]: '📊',
      [DeliverableType.REPORT]: '📋',
      [DeliverableType.PLAN]: '📝',
      [DeliverableType.REQUIREMENTS]: '📋'
    };
    return icons[type] || '📄';
  }

  /**
   * Get display name for deliverable type
   */
  function getTypeName(type: DeliverableType): string {
    const names = {
      [DeliverableType.DOCUMENT]: 'Document',
      [DeliverableType.ANALYSIS]: 'Analysis',
      [DeliverableType.REPORT]: 'Report',
      [DeliverableType.PLAN]: 'Plan',
      [DeliverableType.REQUIREMENTS]: 'Requirements'
    };
    return names[type] || 'Document';
  }

  /**
   * Format deliverable date for display
   */
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Get versions for a deliverable
   */
  async function getVersions(deliverableId: string) {
    return await store.getDeliverableVersions(deliverableId);
  }

  return {
    // State
    showDeliverableModal,
    selectedDeliverable,
    isCreatingDeliverable,

    // Computed
    hasDeliverables,
    recentDeliverables,
    isLoading,
    error,
    deliverablesByType,
    isEnhancing,
    enhancementSource,

    // Actions
    initialize,
    processAgentResponse,
    prepareEnhancementContext,
    getEnhancementParams,
    createDeliverable,
    enhanceDeliverable,
    search,
    getConversationDeliverables,
    showDeliverable,
    hideDeliverable,
    startCreating,
    cancelCreating,
    deleteDeliverable,
    getVersions,

    // Utilities
    getTypeIcon,
    getTypeName,
    formatDate,

    // Store access (for advanced usage)
    store
  };
}