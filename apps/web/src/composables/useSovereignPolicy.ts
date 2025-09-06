import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useSovereignPolicyStore } from '../stores/sovereignPolicyStore';
import { storeToRefs } from 'pinia';

/**
 * Composable for managing sovereign policy data with SWR-like behavior
 * Provides reactive access to policy data with automatic polling and caching
 */
export function useSovereignPolicy() {
  const store = useSovereignPolicyStore();
  
  // Extract reactive references from the store
  const {
    policy,
    policyStatus,
    loadingPolicy,
    loadingStatus,
    policyError,
    statusError,
    userSovereignMode,
    effectiveSovereignMode,
    canUserControlSovereignMode,
    allowedProviders,
    policyWarnings,
    hasErrors,
    isPolicyFresh,
  } = storeToRefs(store);

  // Local state for the composable
  const isInitialized = ref(false);
  const isRefreshing = ref(false);

  // Computed properties for convenience
  const isLoading = computed(() => loadingPolicy.value || loadingStatus.value);
  const error = computed(() => policyError.value || statusError.value);

  /**
   * Initialize the policy data
   */
  const initialize = async () => {
    if (isInitialized.value) return;
    
    try {
      await store.initialize();
      isInitialized.value = true;
    } catch (error) {
      console.error('Failed to initialize sovereign policy:', error);
    }
  };

  /**
   * Manually refresh the policy data
   */
  const refresh = async () => {
    isRefreshing.value = true;
    try {
      await Promise.all([
        store.fetchPolicy(),
        store.fetchPolicyStatus()
      ]);
    } catch (error) {
      console.error('Failed to refresh sovereign policy:', error);
    } finally {
      isRefreshing.value = false;
    }
  };

  /**
   * Mutate (update) the user sovereign mode preference
   */
  const mutateUserSovereignMode = (enabled: boolean) => {
    store.setUserSovereignMode(enabled);
  };

  /**
   * Validate a policy configuration
   */
  const validatePolicy = async (request: {
    enforced?: boolean;
    defaultMode?: 'strict' | 'relaxed';
    userSovereignMode?: boolean;
    auditLevel?: 'none' | 'basic' | 'full';
  }) => {
    return await store.validatePolicy(request);
  };

  /**
   * Check if models should be filtered for sovereign mode
   */
  const shouldFilterModels = computed(() => effectiveSovereignMode.value);

  /**
   * Get models with appropriate sovereign mode filtering
   */
  const getFilteredModels = async () => {
    const { sovereignPolicyService } = await import('../services/sovereignPolicyService');
    return await sovereignPolicyService.getModels(shouldFilterModels.value);
  };

  // Auto-initialize on mount
  onMounted(() => {
    initialize();
  });

  // Cleanup on unmount
  onUnmounted(() => {
    store.cleanup();
  });

  // Watch for changes in effective sovereign mode and log them
  watch(effectiveSovereignMode, (newValue, oldValue) => {
    if (oldValue !== undefined && newValue !== oldValue) {
      console.log(`Sovereign mode changed: ${oldValue} -> ${newValue}`);
    }
  });

  return {
    // State
    policy: computed(() => policy.value),
    policyStatus: computed(() => policyStatus.value),
    userSovereignMode: computed(() => userSovereignMode.value),
    effectiveSovereignMode: computed(() => effectiveSovereignMode.value),
    canUserControlSovereignMode: computed(() => canUserControlSovereignMode.value),
    allowedProviders: computed(() => allowedProviders.value),
    policyWarnings: computed(() => policyWarnings.value),
    
    // Loading and error states
    isLoading,
    isRefreshing,
    error,
    hasErrors: computed(() => hasErrors.value),
    isPolicyFresh: computed(() => isPolicyFresh.value),
    isInitialized,
    
    // Actions
    initialize,
    refresh,
    mutateUserSovereignMode,
    validatePolicy,
    getFilteredModels,
    shouldFilterModels,
    
    // Store actions (for advanced usage)
    startPolling: store.startPolling,
    stopPolling: store.stopPolling,
    reset: store.reset,
  };
}
