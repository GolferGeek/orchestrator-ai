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
  const deliverablesByType = computed(() => store.deliverablesByType);
  const isEnhancing = computed(() => store.enhancementContext.isEnhancing);
  const enhancementSource = computed(() => store.enhancementContext.sourceDeliverableId);

  // Actions

  /**
   * Initialize deliverables (load recent deliverables)
   */
  async function initialize(): Promise<void> {
    await store.loadDeliverables({ limit: 50 });
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
      await store.processAgentDeliverable(
        response.deliverableId,
        conversationId,
        messageId,
        response.enhancedFrom
      );
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
    const existingDeliverable = await store.findDeliverableForEnhancement(conversationId, messageId);
    
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
    if (store.enhancementContext.isEnhancing && store.enhancementContext.sourceDeliverableId) {
      return {
        deliverableId: store.enhancementContext.sourceDeliverableId,
        enhanceDeliverableId: store.enhancementContext.sourceDeliverableId
      };
    }
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

    return await store.createDeliverable(data);
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
    await store.searchDeliverables(query, filters);
  }

  /**
   * Get deliverables for a conversation
   */
  async function getConversationDeliverables(conversationId: string): Promise<DeliverableSearchItem[]> {
    return await store.loadConversationDeliverables(conversationId);
  }

  /**
   * Show deliverable in modal
   */
  function showDeliverable(deliverable: Deliverable): void {
    selectedDeliverable.value = deliverable;
    store.setCurrentDeliverable(deliverable);
    showDeliverableModal.value = true;
  }

  /**
   * Hide deliverable modal
   */
  function hideDeliverable(): void {
    showDeliverableModal.value = false;
    selectedDeliverable.value = null;
    store.setCurrentDeliverable(null);
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
      const success = await store.deleteDeliverable(deliverable.id);
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
    return await store.getVersions(deliverableId);
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