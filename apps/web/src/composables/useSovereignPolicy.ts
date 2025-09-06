import { computed } from 'vue';
import { useSovereignPolicyStore } from '../stores/sovereignPolicyStore';
import { storeToRefs } from 'pinia';

/**
 * Composable for managing sovereign policy with simple Vue reactivity
 * No polling - just reactive access to store state
 */
export function useSovereignPolicy() {
  const store = useSovereignPolicyStore();
  
  // Extract reactive references from the store
  const {
    policy,
    userSovereignMode,
    loading,
    error,
    initialized,
    isEnforced,
    canUserControlSovereignMode,
    effectiveSovereignMode,
    policyWarnings,
    allowedProviders,
  } = storeToRefs(store);

  // Computed properties for convenience
  const hasErrors = computed(() => !!error.value);
  
  const statusText = computed(() => {
    if (loading.value) return 'Loading...';
    if (error.value) return 'Error';
    if (effectiveSovereignMode.value) return 'Active';
    return 'Inactive';
  });

  // Actions
  const initialize = () => store.initialize();
  const updateUserPreference = (enabled: boolean) => store.updateUserPreference(enabled);
  const clearError = () => store.clearError();
  const reset = () => store.reset();

  return {
    // State
    policy: policy.value,
    userSovereignMode: userSovereignMode.value,
    loading: loading.value,
    error: error.value,
    initialized: initialized.value,
    
    // Computed getters
    isEnforced: isEnforced.value,
    canUserControlSovereignMode: canUserControlSovereignMode.value,
    effectiveSovereignMode: effectiveSovereignMode.value,
    policyWarnings: policyWarnings.value,
    allowedProviders: allowedProviders.value,
    
    // Convenience computed
    hasErrors: hasErrors.value,
    statusText: statusText.value,
    
    // Actions
    initialize,
    updateUserPreference,
    clearError,
    reset,
  };
}