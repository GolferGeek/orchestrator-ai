// Store Reactivity Tests
// Tests for validating reactive state updates across modules

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { usePIIPatternsStore } from '@/stores/piiPatternsStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';

// Mock component for testing reactivity
const TestComponent = {
  template: `
    <div>
      <div data-testid="pattern-count">{{ piiStore.patterns.length }}</div>
      <div data-testid="loading-state">{{ piiStore.isLoading }}</div>
      <div data-testid="error-state">{{ piiStore.error }}</div>
      <div data-testid="enabled-patterns">{{ piiStore.enabledPatterns.length }}</div>
    </div>
  `,
  setup() {
    const piiStore = usePIIPatternsStore();
    return { piiStore };
  }
};

const ComposableTestComponent = {
  template: `
    <div>
      <div data-testid="is-loading">{{ isLoading }}</div>
      <div data-testid="has-error">{{ hasError }}</div>
      <div data-testid="pattern-count">{{ piiPatternsStore.patterns.length }}</div>
    </div>
  `,
  setup() {
    const { piiPatternsStore, isLoading, hasError } = usePIIManagement();
    return { piiPatternsStore, isLoading, hasError };
  }
};

describe('Store Reactivity Tests', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('Direct Store Reactivity', () => {
    it('should update component when store state changes', async () => {
      const wrapper = mount(TestComponent);
      const store = usePIIPatternsStore();

      // Initial state
      expect(wrapper.find('[data-testid="pattern-count"]').text()).toBe('0');
      expect(wrapper.find('[data-testid="loading-state"]').text()).toBe('false');
      expect(wrapper.find('[data-testid="error-state"]').text()).toBe('');

      // Update loading state
      store.isLoading = true;
      await nextTick();
      expect(wrapper.find('[data-testid="loading-state"]').text()).toBe('true');

      // Add patterns
      store.patterns = [
        { id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true },
        { id: '2', name: 'Phone', dataType: 'phone', pattern: '\\d{10}', enabled: false }
      ];
      await nextTick();
      expect(wrapper.find('[data-testid="pattern-count"]').text()).toBe('2');
      expect(wrapper.find('[data-testid="enabled-patterns"]').text()).toBe('1');

      // Set error
      store.error = 'Test error';
      store.isLoading = false;
      await nextTick();
      expect(wrapper.find('[data-testid="error-state"]').text()).toBe('Test error');
      expect(wrapper.find('[data-testid="loading-state"]').text()).toBe('false');
    });

    it('should update computed properties reactively', async () => {
      const store = usePIIPatternsStore();

      // Initial state
      expect(store.enabledPatterns).toEqual([]);
      expect(store.customPatterns).toEqual([]);
      expect(store.patternsByDataType).toEqual({});

      // Add patterns
      store.patterns = [
        { id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true, isBuiltIn: true },
        { id: '2', name: 'Phone', dataType: 'phone', pattern: '\\d{10}', enabled: false, isBuiltIn: false },
        { id: '3', name: 'Custom Email', dataType: 'email', pattern: '.*@company\\.com', enabled: true, isBuiltIn: false }
      ];

      // Test computed properties
      expect(store.enabledPatterns).toHaveLength(2);
      expect(store.customPatterns).toHaveLength(2);
      expect(store.patternsByDataType['email']).toHaveLength(2);
      expect(store.patternsByDataType['phone']).toHaveLength(1);

      // Update pattern state
      store.patterns[1].enabled = true;
      expect(store.enabledPatterns).toHaveLength(3);
    });

    it('should handle filter changes reactively', async () => {
      const store = usePIIPatternsStore();

      // Add patterns
      store.patterns = [
        { id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true, category: 'contact' },
        { id: '2', name: 'Phone', dataType: 'phone', pattern: '\\d{10}', enabled: true, category: 'contact' },
        { id: '3', name: 'SSN', dataType: 'ssn', pattern: '\\d{3}-\\d{2}-\\d{4}', enabled: false, category: 'identity' }
      ];

      // Test initial filtered results
      expect(store.filteredAndSortedPatterns).toHaveLength(3);

      // Apply data type filter
      store.filters.dataType = 'email';
      expect(store.filteredAndSortedPatterns).toHaveLength(1);
      expect(store.filteredAndSortedPatterns[0].dataType).toBe('email');

      // Apply enabled filter
      store.filters.dataType = '';
      store.filters.enabled = 'true';
      expect(store.filteredAndSortedPatterns).toHaveLength(2);

      // Apply search filter
      store.filters.enabled = '';
      store.filters.search = 'phone';
      expect(store.filteredAndSortedPatterns).toHaveLength(1);
      expect(store.filteredAndSortedPatterns[0].name).toBe('Phone');

      // Clear filters
      store.clearFilters();
      expect(store.filteredAndSortedPatterns).toHaveLength(3);
    });
  });

  describe('Composable Reactivity', () => {
    it('should update component when composable state changes', async () => {
      const wrapper = mount(ComposableTestComponent);
      const { piiPatternsStore } = usePIIManagement();

      // Initial state
      expect(wrapper.find('[data-testid="is-loading"]').text()).toBe('false');
      expect(wrapper.find('[data-testid="has-error"]').text()).toBe('false');
      expect(wrapper.find('[data-testid="pattern-count"]').text()).toBe('0');

      // Simulate loading
      piiPatternsStore.isLoading = true;
      await nextTick();
      expect(wrapper.find('[data-testid="is-loading"]').text()).toBe('true');

      // Add data
      piiPatternsStore.patterns = [
        { id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true }
      ];
      piiPatternsStore.isLoading = false;
      await nextTick();
      expect(wrapper.find('[data-testid="is-loading"]').text()).toBe('false');
      expect(wrapper.find('[data-testid="pattern-count"]').text()).toBe('1');

      // Set error
      piiPatternsStore.error = 'Test error';
      await nextTick();
      expect(wrapper.find('[data-testid="has-error"]').text()).toBe('true');
    });

    it('should maintain reactivity across multiple stores in composables', async () => {
      const { 
        piiPatternsStore, 
        pseudonymStore, 
        isLoading, 
        hasError 
      } = usePIIManagement();

      // Initial state
      expect(isLoading.value).toBe(false);
      expect(hasError.value).toBe(false);

      // Set loading on one store
      piiPatternsStore.isLoading = true;
      expect(isLoading.value).toBe(true);

      // Set loading on both stores
      pseudonymStore.isLoading = true;
      expect(isLoading.value).toBe(true);

      // Clear loading from first store
      piiPatternsStore.isLoading = false;
      expect(isLoading.value).toBe(true); // Still true because pseudonym store is loading

      // Clear loading from second store
      pseudonymStore.isLoading = false;
      expect(isLoading.value).toBe(false);

      // Test error state
      piiPatternsStore.error = 'PII Error';
      expect(hasError.value).toBe(true);

      pseudonymStore.error = 'Pseudonym Error';
      expect(hasError.value).toBe(true);

      // Clear one error
      piiPatternsStore.error = null;
      expect(hasError.value).toBe(true); // Still has error from pseudonym store

      // Clear all errors
      pseudonymStore.error = null;
      expect(hasError.value).toBe(false);
    });

    it('should handle complex state updates in monitoring composables', async () => {
      const { 
        llmHealthStore, 
        dashboardData, 
        systemHealthStatus 
      } = useMonitoringAnalytics();

      // Initial state
      expect(dashboardData.value.systemHealth).toBeNull();
      expect(systemHealthStatus.value).toBe('unknown');

      // Update system health
      llmHealthStore.systemHealth = {
        totalModels: 5,
        healthyModels: 5,
        unhealthyModels: 0,
        memoryStats: { pressure: 'low', usagePercent: 30 }
      };

      expect(systemHealthStatus.value).toBe('healthy');

      // Update with some unhealthy models
      llmHealthStore.systemHealth.healthyModels = 3;
      llmHealthStore.systemHealth.unhealthyModels = 2;

      expect(systemHealthStatus.value).toBe('warning');

      // Update with mostly unhealthy models
      llmHealthStore.systemHealth.healthyModels = 1;
      llmHealthStore.systemHealth.unhealthyModels = 4;

      expect(systemHealthStatus.value).toBe('critical');

      // Update usage records
      llmHealthStore.usageRecords = [
        { id: '1', cost: 10, provider: 'openai' },
        { id: '2', cost: 5, provider: 'anthropic' },
        { id: '3', cost: 15, provider: 'openai' }
      ];

      expect(llmHealthStore.totalCost).toBe(30);
      expect(llmHealthStore.totalRequests).toBe(3);
    });
  });

  describe('Cross-Store Reactivity', () => {
    it('should maintain reactivity when stores interact', async () => {
      const piiStore = usePIIPatternsStore();
      const analyticsStore = useAnalyticsStore();

      // Track events when PII patterns are modified
      const trackEventSpy = vi.spyOn(analyticsStore, 'trackEvent');

      // Add a pattern
      piiStore.patterns = [
        { id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true }
      ];

      // Simulate tracking the pattern creation
      analyticsStore.trackEvent('pii_pattern_created', {
        patternId: '1',
        dataType: 'email',
        timestamp: new Date().toISOString()
      });

      expect(trackEventSpy).toHaveBeenCalledWith('pii_pattern_created', expect.any(Object));
      expect(analyticsStore.eventQueue).toHaveLength(1);

      // Test that analytics reflect PII store state
      const event = analyticsStore.eventQueue[0];
      expect(event.eventName).toBe('pii_pattern_created');
      expect(event.payload.patternId).toBe('1');
    });

    it('should handle concurrent updates across stores', async () => {
      const piiStore = usePIIPatternsStore();
      const analyticsStore = useAnalyticsStore();

      // Simulate concurrent updates
      const updates = Promise.all([
        new Promise(resolve => {
          piiStore.patterns = [{ id: '1', name: 'Test', dataType: 'email', enabled: true }];
          resolve(true);
        }),
        new Promise(resolve => {
          analyticsStore.trackEvent('test_event', { data: 'test' });
          resolve(true);
        })
      ]);

      await updates;

      // Verify both stores updated correctly
      expect(piiStore.patterns).toHaveLength(1);
      expect(analyticsStore.eventQueue).toHaveLength(1);
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should not create memory leaks with watchers', async () => {
      const store = usePIIPatternsStore();
      const watcherCallbacks: number[] = [];

      // Create multiple watchers
      for (let i = 0; i < 100; i++) {
        const unwatch = store.$subscribe((_mutation, _state) => {
          watcherCallbacks.push(i);
        });

        // Immediately unwatch to test cleanup
        unwatch();
      }

      // Update store state
      store.patterns = [{ id: '1', name: 'Test', dataType: 'email', enabled: true }];

      // Watchers should have been cleaned up, so no callbacks should be triggered
      expect(watcherCallbacks).toHaveLength(0);
    });

    it('should handle rapid state updates efficiently', async () => {
      const store = usePIIPatternsStore();
      const updateCount = ref(0);

      // Watch for state changes
      store.$subscribe(() => {
        updateCount.value++;
      });

      // Perform rapid updates
      for (let i = 0; i < 50; i++) {
        store.patterns = [
          { id: String(i), name: `Pattern ${i}`, dataType: 'email', enabled: i % 2 === 0 }
        ];
      }

      // Should have received all updates
      expect(updateCount.value).toBe(50);
      expect(store.patterns).toHaveLength(1);
      expect(store.patterns[0].id).toBe('49');
    });
  });

  describe('State Persistence and Hydration', () => {
    it('should maintain state consistency after store reset', () => {
      const store = usePIIPatternsStore();

      // Set initial state
      store.patterns = [
        { id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true }
      ];
      store.filters.dataType = 'email';
      store.selectedItems = ['1'];

      // Verify state
      expect(store.patterns).toHaveLength(1);
      expect(store.filters.dataType).toBe('email');
      expect(store.selectedItems).toEqual(['1']);

      // Reset store
      store.$reset();

      // Verify reset state
      expect(store.patterns).toEqual([]);
      expect(store.filters.dataType).toBe('');
      expect(store.selectedItems).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle state hydration correctly', () => {
      const store = usePIIPatternsStore();

      // Simulate hydrated state
      const hydratedState = {
        patterns: [
          { id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true },
          { id: '2', name: 'Phone', dataType: 'phone', pattern: '\\d{10}', enabled: false }
        ],
        filters: { dataType: 'email', enabled: 'true' },
        selectedItems: ['1']
      };

      // Apply hydrated state
      store.$patch(hydratedState);

      // Verify state
      expect(store.patterns).toHaveLength(2);
      expect(store.filters.dataType).toBe('email');
      expect(store.selectedItems).toEqual(['1']);

      // Verify computed properties work with hydrated state
      expect(store.enabledPatterns).toHaveLength(1);
      expect(store.filteredAndSortedPatterns).toHaveLength(1);
    });
  });
});
