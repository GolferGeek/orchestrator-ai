import { computed } from 'vue';
import { usePrivacyStore } from '@/stores/privacyStore';
import { privacyService } from '@/services/privacyService';
import { storeToRefs } from 'pinia';

/**
 * Composable for managing sovereign policy with simple Vue reactivity
 * No polling - just reactive access to store state
 *
 * Phase 4.3: Migrated to use unified privacyStore
 */
export function useSovereignPolicy() {
  const store = usePrivacyStore();

  // Extract reactive references from the store
  const {
    sovereignPolicy,
    userSovereignMode,
    sovereignLoading,
    sovereignError,
    sovereignInitialized,
    isEnforced,
    canUserControlSovereignMode,
    effectiveSovereignMode,
    allowedProviders,
  } = storeToRefs(store);

  // Computed properties for convenience
  const hasErrors = computed(() => !!sovereignError.value);

  const statusText = computed(() => {
    if (sovereignLoading.value) return 'Loading...';
    if (sovereignError.value) return 'Error';
    if (effectiveSovereignMode.value) return 'Active';
    return 'Inactive';
  });

  const policyWarnings = computed(() => {
    const warnings: string[] = [];

    if (sovereignPolicy.value?.enforced && !userSovereignMode.value) {
      warnings.push('Organization policy requires sovereign mode to be enabled');
    }

    return warnings;
  });

  // Actions
  const initialize = () => privacyService.initializeSovereignPolicy();
  const updateUserPreference = (enabled: boolean) => privacyService.updateUserSovereignPreference(enabled);
  const clearError = () => store.setSovereignError(null);
  const reset = () => {
    store.setSovereignPolicy(null);
    store.setUserSovereignMode(false);
    store.setSovereignInitialized(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('userSovereignMode');
    }
  };

  return {
    // State
    policy: sovereignPolicy.value,
    userSovereignMode: userSovereignMode.value,
    loading: sovereignLoading.value,
    error: sovereignError.value,
    initialized: sovereignInitialized.value,

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