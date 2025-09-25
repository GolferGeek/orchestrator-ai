import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export type ViewMode = 'marketing' | 'technical';

const VIEW_MODE_KEY = 'demoViewMode';
const DEFAULT_VIEW_MODE: ViewMode = 'marketing';

// Global state for the view mode
const viewMode = ref<ViewMode>(DEFAULT_VIEW_MODE);

// Reset function for testing
export function resetViewMode() {
  viewMode.value = DEFAULT_VIEW_MODE;
}

export function useViewToggle() {
  const route = useRoute();
  const router = useRouter();

  // Initialize view mode from localStorage or URL params
  const initializeViewMode = () => {
    // Check URL params first
    const urlViewMode = route.query.view as ViewMode;
    if (urlViewMode && ['marketing', 'technical'].includes(urlViewMode)) {
      viewMode.value = urlViewMode;
      localStorage.setItem(VIEW_MODE_KEY, urlViewMode);
      return;
    }

    // Fall back to localStorage
    const storedViewMode = localStorage.getItem(VIEW_MODE_KEY) as ViewMode;
    if (storedViewMode && ['marketing', 'technical'].includes(storedViewMode)) {
      viewMode.value = storedViewMode;
    } else {
      viewMode.value = DEFAULT_VIEW_MODE;
      localStorage.setItem(VIEW_MODE_KEY, DEFAULT_VIEW_MODE);
    }
  };

  // Toggle between marketing and technical views
  const toggleView = () => {
    const newViewMode: ViewMode = viewMode.value === 'marketing' ? 'technical' : 'marketing';
    setViewMode(newViewMode);
  };

  // Set specific view mode
  const setViewMode = (mode: ViewMode) => {
    viewMode.value = mode;
    localStorage.setItem(VIEW_MODE_KEY, mode);
    
    // Update URL params
    const query = { ...route.query, view: mode };
    router.replace({ query });
  };

  // Computed properties
  const isMarketingView = computed(() => viewMode.value === 'marketing');
  const isTechnicalView = computed(() => viewMode.value === 'technical');

  // Watch for URL changes to sync state
  watch(
    () => route.query.view,
    (newView) => {
      if (newView && ['marketing', 'technical'].includes(newView as string)) {
        const newViewMode = newView as ViewMode;
        if (viewMode.value !== newViewMode) {
          viewMode.value = newViewMode;
          localStorage.setItem(VIEW_MODE_KEY, newViewMode);
        }
      }
    }
  );

  // Auto-initialize when composable is created
  initializeViewMode();

  return {
    viewMode: computed(() => viewMode.value),
    isMarketingView,
    isTechnicalView,
    toggleView,
    setViewMode,
    initializeViewMode
  };
}
