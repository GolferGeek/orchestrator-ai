// Store Integration Tests
// Tests for validating Pinia store functionality and component integration

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePIIPatternsStore } from '@/stores/piiPatternsStore';
import { usePseudonymDictionariesStore } from '@/stores/pseudonymDictionariesStore';
import { useLLMMonitoringStore } from '@/stores/llmMonitoringStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { usePIIManagement, useMonitoringAnalytics, useSystemOverview } from '@/composables/useEnhancedStores';

// Mock API services
vi.mock('@/services/piiService', () => ({
  piiService: {
    getPIIPatterns: vi.fn().mockResolvedValue([
      { id: '1', name: 'Email Pattern', dataType: 'email', pattern: '[\\w.-]+@[\\w.-]+\\.[A-Za-z]{2,}', enabled: true }
    ]),
    testPIIPattern: vi.fn().mockResolvedValue({
      matches: [{ value: 'test@example.com', dataType: 'email', patternName: 'Email Pattern', confidence: 95 }],
      sanitized: '[EMAIL]'
    }),
    getPIIStatistics: vi.fn().mockResolvedValue({
      totalPatterns: 10,
      enabledPatterns: 8,
      customPatterns: 3
    })
  }
}));

vi.mock('@/services/pseudonymService', () => ({
  pseudonymService: {
    getDictionaries: vi.fn().mockResolvedValue([
      { id: '1', category: 'names', dataType: 'name', words: ['John', 'Jane'], isActive: true }
    ]),
    generatePseudonym: vi.fn().mockResolvedValue({
      results: [{ originalValue: 'John Doe', pseudonym: 'Alex Smith', dataType: 'name', isNew: false }]
    }),
    getStatistics: vi.fn().mockResolvedValue({
      totalDictionaries: 5,
      activeDictionaries: 4,
      totalWords: 1000
    })
  }
}));

vi.mock('@/services/llmMonitoringService', () => ({
  llmMonitoringService: {
    getUsageRecords: vi.fn().mockResolvedValue([
      { id: '1', modelName: 'gpt-4', provider: 'openai', cost: 0.05, responseTimeMs: 1200, status: 'success' }
    ]),
    getSystemHealth: vi.fn().mockResolvedValue({
      totalModels: 3,
      healthyModels: 3,
      unhealthyModels: 0,
      memoryStats: { pressure: 'low', usagePercent: 45 }
    }),
    getActiveAlerts: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('@/services/analyticsService', () => ({
  analyticsService: {
    getDashboardData: vi.fn().mockResolvedValue({
      overview: { totalRequests: 1000, totalCost: 50.0, systemHealth: 'healthy' },
      keyMetrics: [{ name: 'Total Requests', value: 1000, trend: 5.2 }]
    }),
    getRealTimeAnalytics: vi.fn().mockResolvedValue({
      currentStats: { runningTasks: 2, queuedTasks: 5 },
      recentEvents: []
    })
  }
}));

describe('Store Integration Tests', () => {
  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('PII Patterns Store', () => {
    it('should initialize and load patterns', async () => {
      const store = usePIIPatternsStore();
      
      expect(store.patterns).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      
      await store.loadPatterns();
      
      expect(store.patterns).toHaveLength(1);
      expect(store.patterns[0].name).toBe('Email Pattern');
      expect(store.enabledPatterns).toHaveLength(1);
    });

    it('should test PII pattern detection', async () => {
      const store = usePIIPatternsStore();
      
      const result = await store.testPattern('', 'Contact me at test@example.com');
      
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].value).toBe('test@example.com');
      expect(result.sanitized).toBe('[EMAIL]');
    });

    it('should load and display statistics', async () => {
      const store = usePIIPatternsStore();
      
      await store.loadStatistics();
      
      expect(store.statistics).toBeDefined();
      expect(store.statistics.totalPatterns).toBe(10);
      expect(store.statistics.enabledPatterns).toBe(8);
    });
  });

  describe('Pseudonym Dictionaries Store', () => {
    it('should initialize and load dictionaries', async () => {
      const store = usePseudonymDictionariesStore();
      
      expect(store.dictionaries).toEqual([]);
      expect(store.isLoading).toBe(false);
      
      await store.loadDictionaries();
      
      expect(store.dictionaries).toHaveLength(1);
      expect(store.dictionaries[0].category).toBe('names');
      expect(store.activeDictionaries).toHaveLength(1);
    });

    it('should generate pseudonyms', async () => {
      const store = usePseudonymDictionariesStore();
      
      const result = await store.generatePseudonym({
        values: ['John Doe'],
        dataType: 'name',
        preserveFormat: true
      });
      
      expect(result.results).toHaveLength(1);
      expect(result.results[0].originalValue).toBe('John Doe');
      expect(result.results[0].pseudonym).toBe('Alex Smith');
    });

    it('should calculate total words correctly', async () => {
      const store = usePseudonymDictionariesStore();
      
      await store.loadDictionaries();
      
      expect(store.totalWords).toBe(2); // From the mock dictionary with ['John', 'Jane']
    });
  });

  describe('LLM Monitoring Store', () => {
    it('should initialize and load usage records', async () => {
      const store = useLLMMonitoringStore();
      
      expect(store.usageRecords).toEqual([]);
      expect(store.isLoading).toBe(false);
      
      await store.loadUsageRecords();
      
      expect(store.usageRecords).toHaveLength(1);
      expect(store.usageRecords[0].modelName).toBe('gpt-4');
    });

    it('should load system health metrics', async () => {
      const store = useLLMMonitoringStore();
      
      await store.loadSystemHealth();
      
      expect(store.systemHealth).toBeDefined();
      expect(store.systemHealth.totalModels).toBe(3);
      expect(store.systemHealth.healthyModels).toBe(3);
    });

    it('should calculate metrics correctly', async () => {
      const store = useLLMMonitoringStore();
      
      await store.loadUsageRecords();
      
      expect(store.totalCost).toBe(0.05);
      expect(store.totalRequests).toBe(1);
      expect(store.averageResponseTime).toBe(1200);
      expect(store.successRate).toBe(100); // 1 successful out of 1 total
    });
  });

  describe('Analytics Store', () => {
    it('should initialize and load dashboard data', async () => {
      const store = useAnalyticsStore();
      
      expect(store.dashboardData).toBeNull();
      expect(store.isLoading).toBe(false);
      
      await store.fetchDashboardData();
      
      expect(store.dashboardData).toBeDefined();
      expect(store.dashboardData.overview.totalRequests).toBe(1000);
    });

    it('should load real-time analytics', async () => {
      const store = useAnalyticsStore();
      
      await store.fetchRealTimeAnalytics();
      
      expect(store.realTimeAnalytics).toBeDefined();
      expect(store.realTimeAnalytics.currentStats.runningTasks).toBe(2);
    });

    it('should manage event queue', () => {
      const store = useAnalyticsStore();
      
      store.trackEvent('test_event', { data: 'test' });
      
      expect(store.eventQueue).toHaveLength(1);
      expect(store.eventQueueSize).toBe(1);
      
      store.clearEventQueue();
      
      expect(store.eventQueue).toHaveLength(0);
      expect(store.eventQueueSize).toBe(0);
    });
  });

  describe('Composable Integration', () => {
    it('should integrate PII management stores correctly', async () => {
      const {
        piiPatternsStore,
        pseudonymStore,
        isLoading,
        hasError,
        refreshAll,
        testPIIDetection
      } = usePIIManagement();
      
      // Test initial state
      expect(isLoading.value).toBe(false);
      expect(hasError.value).toBe(false);
      
      // Test refresh all functionality
      await refreshAll();
      
      expect(piiPatternsStore.patterns).toHaveLength(1);
      expect(pseudonymStore.dictionaries).toHaveLength(1);
      
      // Test PII detection
      const result = await testPIIDetection('test@example.com');
      expect(result.hasPII).toBe(true);
      expect(result.matches).toHaveLength(1);
    });

    it('should integrate monitoring and analytics stores correctly', async () => {
      const {
        llmMonitoringStore,
        analyticsStore,
        dashboardData,
        systemHealthStatus,
        isLoading,
        refreshAll
      } = useMonitoringAnalytics();
      
      // Test initial state
      expect(isLoading.value).toBe(false);
      
      // Test refresh all functionality
      await refreshAll();
      
      expect(llmMonitoringStore.usageRecords).toHaveLength(1);
      expect(analyticsStore.dashboardData).toBeDefined();
      
      // Test computed properties
      expect(dashboardData.value).toBeDefined();
      expect(systemHealthStatus.value).toBeDefined();
    });

    it('should provide system overview correctly', async () => {
      const {
        systemHealth,
        systemMetrics,
        isLoading,
        initializeAll
      } = useSystemOverview();
      
      // Initialize all stores
      await initializeAll();
      
      // Test system health calculation
      expect(systemHealth.value.status).toBeDefined();
      expect(systemHealth.value.healthPercentage).toBeGreaterThan(0);
      
      // Test system metrics
      expect(systemMetrics.value.piiPatterns.total).toBe(1);
      expect(systemMetrics.value.pseudonymDictionaries.total).toBe(1);
      expect(systemMetrics.value.llmUsage.totalRequests).toBe(1);
    });
  });

  describe('Store Reactivity', () => {
    it('should maintain reactive state across stores', async () => {
      const piiStore = usePIIPatternsStore();
      const pseudonymStore = usePseudonymDictionariesStore();
      
      // Initial state
      expect(piiStore.patterns).toEqual([]);
      expect(pseudonymStore.dictionaries).toEqual([]);
      
      // Load data
      await Promise.all([
        piiStore.loadPatterns(),
        pseudonymStore.loadDictionaries()
      ]);
      
      // Verify reactive updates
      expect(piiStore.patterns).toHaveLength(1);
      expect(pseudonymStore.dictionaries).toHaveLength(1);
      
      // Test computed properties reactivity
      expect(piiStore.enabledPatterns).toHaveLength(1);
      expect(pseudonymStore.activeDictionaries).toHaveLength(1);
    });

    it('should handle error states reactively', async () => {
      const store = usePIIPatternsStore();
      
      // Mock an error
      vi.mocked(store.loadPatterns).mockRejectedValueOnce(new Error('Test error'));
      
      try {
        await store.loadPatterns();
      } catch (error) {
        // Error should be handled by store
      }
      
      expect(store.error).toBe('Test error');
      expect(store.isLoading).toBe(false);
      
      // Clear error
      store.clearError();
      expect(store.error).toBeNull();
    });

    it('should handle loading states reactively', async () => {
      const store = usePIIPatternsStore();
      
      // Mock a slow loading operation
      let resolvePromise: () => void;
      const slowPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      
      vi.mocked(store.loadPatterns).mockImplementationOnce(() => slowPromise);
      
      // Start loading
      const loadingPromise = store.loadPatterns();
      
      // Check loading state
      expect(store.isLoading).toBe(true);
      
      // Resolve the promise
      resolvePromise!();
      await loadingPromise;
      
      // Check final state
      expect(store.isLoading).toBe(false);
    });
  });

  describe('Store Integration with Components', () => {
    it('should provide correct data for PII management components', async () => {
      const {
        piiPatternsStore,
        pseudonymStore,
        testPIIDetection,
        getStatistics
      } = usePIIManagement();
      
      // Initialize stores
      await Promise.all([
        piiPatternsStore.loadPatterns(),
        pseudonymStore.loadDictionaries()
      ]);
      
      // Test data availability for components
      expect(piiPatternsStore.patterns).toHaveLength(1);
      expect(piiPatternsStore.enabledPatterns).toHaveLength(1);
      expect(pseudonymStore.dictionaries).toHaveLength(1);
      expect(pseudonymStore.activeDictionaries).toHaveLength(1);
      
      // Test functionality for components
      const piiResult = await testPIIDetection('test@example.com');
      expect(piiResult.hasPII).toBe(true);
      
      const stats = await getStatistics();
      expect(stats.piiPatterns).toBeDefined();
      expect(stats.pseudonymDictionaries).toBeDefined();
    });

    it('should provide correct data for analytics dashboard components', async () => {
      const {
        analyticsStore,
        llmMonitoringStore,
        dashboardData,
        systemHealthStatus
      } = useMonitoringAnalytics();
      
      // Initialize stores
      await Promise.all([
        analyticsStore.fetchDashboardData(),
        llmMonitoringStore.loadUsageRecords(),
        llmMonitoringStore.loadSystemHealth()
      ]);
      
      // Test data availability for dashboard components
      expect(analyticsStore.dashboardData).toBeDefined();
      expect(llmMonitoringStore.usageRecords).toHaveLength(1);
      expect(llmMonitoringStore.systemHealth).toBeDefined();
      
      // Test computed properties for components
      expect(dashboardData.value).toBeDefined();
      expect(systemHealthStatus.value).toBeDefined();
      
      // Test metrics calculations
      expect(llmMonitoringStore.totalCost).toBe(0.05);
      expect(llmMonitoringStore.successRate).toBe(100);
    });
  });
});

describe('Store Error Handling', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  it('should handle API errors gracefully', async () => {
    const store = usePIIPatternsStore();
    
    // Mock API error
    const mockError = new Error('API Error');
    vi.mocked(store.loadPatterns).mockRejectedValueOnce(mockError);
    
    await expect(store.loadPatterns()).rejects.toThrow('API Error');
    
    expect(store.error).toBe('API Error');
    expect(store.isLoading).toBe(false);
    expect(store.patterns).toEqual([]);
  });

  it('should handle network errors gracefully', async () => {
    const store = useAnalyticsStore();
    
    // Mock network error
    const networkError = new Error('Network Error');
    vi.mocked(store.fetchDashboardData).mockRejectedValueOnce(networkError);
    
    await expect(store.fetchDashboardData()).rejects.toThrow('Network Error');
    
    expect(store.error).toBe('Network Error');
    expect(store.isLoading).toBe(false);
  });

  it('should recover from errors after successful operations', async () => {
    const store = usePIIPatternsStore();
    
    // First, cause an error
    vi.mocked(store.loadPatterns).mockRejectedValueOnce(new Error('Test error'));
    
    try {
      await store.loadPatterns();
    } catch (error) {
      // Expected to fail
    }
    
    expect(store.error).toBe('Test error');
    
    // Then, succeed
    vi.mocked(store.loadPatterns).mockResolvedValueOnce(undefined);
    
    await store.loadPatterns();
    
    expect(store.error).toBeNull();
    expect(store.isLoading).toBe(false);
  });
});
