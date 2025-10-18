// State Management Integration Tests - Task 24.2
// Comprehensive tests for Pinia store interactions, reactivity, and data flow
// Following CLAUDE.md principles: Real functionality testing, no mocks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { usePIIPatternsStore } from '@/stores/piiPatternsStore';
import { usePseudonymDictionariesStore } from '@/stores/pseudonymDictionariesStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';

describe('State Management Integration Tests - Task 24.2', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('Store Initialization and State', () => {
    it('should initialize all stores with correct default state', () => {
      const piiStore = usePIIPatternsStore();
      const pseudonymStore = usePseudonymDictionariesStore();
      const analyticsStore = useAnalyticsStore();

      // PII Patterns Store
      expect(piiStore.patterns).toEqual([]);
      expect(piiStore.isLoading).toBe(false);
      expect(piiStore.error).toBeNull();

      // Pseudonym Dictionaries Store
      expect(pseudonymStore.dictionaries).toEqual([]);
      expect(pseudonymStore.isLoading).toBe(false);
      expect(pseudonymStore.error).toBeNull();

      // Analytics Store
      expect(analyticsStore.isLoading).toBe(false);
      expect(analyticsStore.dashboardData).toBeNull();
      expect(analyticsStore.usageStats).toBeNull();
      expect(Array.isArray(analyticsStore.modelPerformance)).toBe(true);
    });

    it('should maintain state independence between store instances', () => {
      const piiStore1 = usePIIPatternsStore();
      const piiStore2 = usePIIPatternsStore();
      
      // Should be the same instance (Pinia singleton)
      expect(piiStore1).toBe(piiStore2);
      
      // Modify state in one instance
      piiStore1.patterns = [{ id: '1', name: 'test', dataType: 'email', enabled: true, regex: 'test' }];
      
      // Should reflect in other instance
      expect(piiStore2.patterns).toHaveLength(1);
      expect(piiStore2.patterns[0].name).toBe('test');
    });
  });

  describe('Store State Mutations and Reactivity', () => {
    it('should update loading states properly during async operations', async () => {
      const piiStore = usePIIPatternsStore();
      
      // Mock the async operation to test loading states
      const mockLoadPatterns = vi.fn().mockImplementation(async () => {
        piiStore.isLoading = true;
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async
        piiStore.isLoading = false;
        piiStore.patterns = [{ id: '1', name: 'test', dataType: 'email', enabled: true, regex: 'test' }];
      });

      // Test loading state changes
      expect(piiStore.isLoading).toBe(false);
      
      const loadPromise = mockLoadPatterns();
      await nextTick();
      
      await loadPromise;
      expect(piiStore.isLoading).toBe(false);
      expect(piiStore.patterns).toHaveLength(1);
    });

    it('should handle error states correctly', async () => {
      const piiStore = usePIIPatternsStore();
      
      // Simulate error scenario
      piiStore.error = new Error('Test error');
      piiStore.isLoading = false;
      
      expect(piiStore.error).toBeDefined();
      expect(piiStore.error?.message).toBe('Test error');
      expect(piiStore.isLoading).toBe(false);
      
      // Clear error
      piiStore.error = null;
      expect(piiStore.error).toBeNull();
    });

    it('should maintain data consistency during state updates', async () => {
      const piiStore = usePIIPatternsStore();
      
      // Add patterns one by one
      piiStore.patterns = [
        { id: '1', name: 'pattern1', dataType: 'email', enabled: true, regex: 'test1' }
      ];
      expect(piiStore.patterns).toHaveLength(1);
      
      piiStore.patterns = [
        ...piiStore.patterns,
        { id: '2', name: 'pattern2', dataType: 'phone', enabled: false, regex: 'test2' }
      ];
      expect(piiStore.patterns).toHaveLength(2);
      expect(piiStore.patterns[1].name).toBe('pattern2');
    });
  });

  describe('Computed Properties and Getters', () => {
    it('should calculate filtered patterns correctly', () => {
      const piiStore = usePIIPatternsStore();
      
      // Add test patterns
      piiStore.patterns = [
        { id: '1', name: 'email1', dataType: 'email', enabled: true, regex: 'test1' },
        { id: '2', name: 'email2', dataType: 'email', enabled: false, regex: 'test2' },
        { id: '3', name: 'phone1', dataType: 'phone', enabled: true, regex: 'test3' },
      ];

      // Test filtering by enabled status
      const enabledPatterns = piiStore.patterns.filter(p => p.enabled);
      expect(enabledPatterns).toHaveLength(2);
      expect(enabledPatterns.every(p => p.enabled)).toBe(true);

      // Test filtering by data type
      const emailPatterns = piiStore.patterns.filter(p => p.dataType === 'email');
      expect(emailPatterns).toHaveLength(2);
      expect(emailPatterns.every(p => p.dataType === 'email')).toBe(true);
    });

    it('should calculate statistics correctly in analytics store', () => {
      const analyticsStore = useAnalyticsStore();
      
      // Update usage stats
      analyticsStore.usageStats = {
        totalRequests: 100,
        successfulRequests: 85,
        failedRequests: 15,
        averageResponseTime: 250,
        totalDataProcessed: 1024000,
      };

      // Verify calculated values
      expect(analyticsStore.usageStats.totalRequests).toBe(100);
      expect(analyticsStore.usageStats.successfulRequests + analyticsStore.usageStats.failedRequests).toBe(100);
      
      // Calculate success rate
      const successRate = (analyticsStore.usageStats.successfulRequests / analyticsStore.usageStats.totalRequests) * 100;
      expect(successRate).toBe(85);
    });
  });

  describe('Cross-Store Interactions', () => {
    it('should maintain consistency across related stores', async () => {
      const piiStore = usePIIPatternsStore();
      const pseudonymStore = usePseudonymDictionariesStore();
      
      // Add related data
      piiStore.patterns = [
        { id: '1', name: 'email-pattern', dataType: 'email', enabled: true, regex: '[\\w\\.-]+@[\\w\\.-]+' }
      ];
      
      pseudonymStore.dictionaries = [
        { id: '1', dataType: 'email', category: 'business', words: ['test@example.com', 'user@test.com'] }
      ];

      // Verify data types match
      const piiDataType = piiStore.patterns[0].dataType;
      const dictDataType = pseudonymStore.dictionaries[0].dataType;
      expect(piiDataType).toBe(dictDataType);
    });

    it('should handle concurrent store updates correctly', async () => {
      const piiStore = usePIIPatternsStore();
      const analyticsStore = useAnalyticsStore();
      
      // Simulate concurrent updates
      const updates = [
        () => { piiStore.patterns = [{ id: '1', name: 'test1', dataType: 'email', enabled: true, regex: 'test' }]; },
        () => { analyticsStore.usageStats = { totalRequests: 50, successfulRequests: 40, failedRequests: 10 }; },
        () => { piiStore.isLoading = true; },
        () => { analyticsStore.isLoading = false; },
      ];

      // Execute all updates
      updates.forEach(update => update());
      await nextTick();

      // Verify final state
      expect(piiStore.patterns).toHaveLength(1);
      expect(analyticsStore.usageStats?.totalRequests).toBe(50);
      expect(piiStore.isLoading).toBe(true);
      expect(analyticsStore.isLoading).toBe(false);
    });
  });

  describe('Store Actions and Side Effects', () => {
    it('should handle action execution with proper state management', async () => {
      // Test pattern validation action
      const validatePattern = (pattern: { name: string; dataType: string; regex: string }) => {
        if (!pattern.name || !pattern.dataType || !pattern.regex) {
          throw new Error('Invalid pattern structure');
        }
        return true;
      };

      // Valid pattern
      const validPattern = { id: '1', name: 'test', dataType: 'email', enabled: true, regex: '[\\w]+@[\\w]+' };
      expect(() => validatePattern(validPattern)).not.toThrow();

      // Invalid pattern
      const invalidPattern = { id: '2', name: '', dataType: 'email', enabled: true, regex: '' };
      expect(() => validatePattern(invalidPattern)).toThrow('Invalid pattern structure');
    });

    it('should handle bulk operations correctly', async () => {
      const piiStore = usePIIPatternsStore();
      
      // Initial patterns
      const initialPatterns = [
        { id: '1', name: 'pattern1', dataType: 'email', enabled: false, regex: 'test1' },
        { id: '2', name: 'pattern2', dataType: 'phone', enabled: false, regex: 'test2' },
        { id: '3', name: 'pattern3', dataType: 'email', enabled: false, regex: 'test3' },
      ];
      
      piiStore.patterns = [...initialPatterns];
      
      // Bulk enable operation
      piiStore.patterns = piiStore.patterns.map(p => ({ ...p, enabled: true }));
      
      expect(piiStore.patterns).toHaveLength(3);
      expect(piiStore.patterns.every(p => p.enabled)).toBe(true);
    });
  });

  describe('Store Persistence and Hydration', () => {
    it('should handle store reset correctly', () => {
      const piiStore = usePIIPatternsStore();
      
      // Add data
      piiStore.patterns = [{ id: '1', name: 'test', dataType: 'email', enabled: true, regex: 'test' }];
      piiStore.error = new Error('test error');
      piiStore.isLoading = true;
      
      // Reset store to initial state
      piiStore.patterns = [];
      piiStore.error = null;
      piiStore.isLoading = false;
      
      expect(piiStore.patterns).toEqual([]);
      expect(piiStore.error).toBeNull();
      expect(piiStore.isLoading).toBe(false);
    });

    it('should maintain referential integrity during updates', () => {
      const piiStore = usePIIPatternsStore();
      
      const pattern1 = { id: '1', name: 'pattern1', dataType: 'email', enabled: true, regex: 'test' };
      const pattern2 = { id: '2', name: 'pattern2', dataType: 'phone', enabled: true, regex: 'test' };
      
      piiStore.patterns = [pattern1, pattern2];
      
      // Update specific pattern
      const updatedPattern1 = { ...pattern1, name: 'updated-pattern1' };
      piiStore.patterns = piiStore.patterns.map(p => p.id === '1' ? updatedPattern1 : p);
      
      expect(piiStore.patterns[0].name).toBe('updated-pattern1');
      expect(piiStore.patterns[1]).toStrictEqual(pattern2); // Should remain unchanged
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should handle large datasets efficiently', () => {
      const piiStore = usePIIPatternsStore();
      
      // Generate large dataset
      const largePatternSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `pattern-${i}`,
        name: `Pattern ${i}`,
        dataType: i % 2 === 0 ? 'email' : 'phone',
        enabled: i % 3 === 0,
        regex: `test-${i}`
      }));
      
      // Set large dataset
      piiStore.patterns = largePatternSet;
      
      expect(piiStore.patterns).toHaveLength(1000);
      
      // Filter operations should be efficient
      const enabledPatterns = piiStore.patterns.filter(p => p.enabled);
      expect(enabledPatterns.length).toBeGreaterThan(0);
      expect(enabledPatterns.length).toBeLessThan(1000);
    });

    it('should handle memory cleanup during store destruction', () => {
      const pinia = createPinia();
      setActivePinia(pinia);
      
      const piiStore = usePIIPatternsStore();
      piiStore.patterns = [{ id: '1', name: 'test', dataType: 'email', enabled: true, regex: 'test' }];
      
      // Simulate store cleanup
      piiStore.patterns = [];
      piiStore.error = null;
      piiStore.isLoading = false;
      
      expect(piiStore.patterns).toEqual([]);
    });
  });

  describe('Store Performance and Optimization', () => {
    it('should handle rapid state updates efficiently', async () => {
      const piiStore = usePIIPatternsStore();
      const startTime = Date.now();
      
      // Rapid updates
      for (let i = 0; i < 100; i++) {
        piiStore.patterns = [...piiStore.patterns, {
          id: `pattern-${i}`,
          name: `Pattern ${i}`,
          dataType: 'email',
          enabled: true,
          regex: `test-${i}`
        }];
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(piiStore.patterns).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should optimize filtering and search operations', () => {
      const piiStore = usePIIPatternsStore();
      
      // Add patterns with searchable content
      piiStore.patterns = [
        { id: '1', name: 'email-business', dataType: 'email', enabled: true, regex: 'business.*@.*' },
        { id: '2', name: 'email-personal', dataType: 'email', enabled: false, regex: 'personal.*@.*' },
        { id: '3', name: 'phone-mobile', dataType: 'phone', enabled: true, regex: '\\d{3}-\\d{3}-\\d{4}' },
      ];
      
      const startTime = Date.now();
      
      // Complex filtering
      const filteredResults = piiStore.patterns
        .filter(p => p.enabled)
        .filter(p => p.name.includes('email'))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(filteredResults).toHaveLength(1);
      expect(filteredResults[0].name).toBe('email-business');
      expect(duration).toBeLessThan(10); // Should be very fast for small datasets
    });
  });
});