console.log('🔍 [DEBUG] PII Patterns Store: Starting imports');
import { defineStore } from 'pinia';
console.log('🔍 [DEBUG] PII Patterns Store: Pinia imported');
import { ref, computed } from 'vue';
console.log('🔍 [DEBUG] PII Patterns Store: Vue imports completed');
import { piiService } from '@/services/piiService';
console.log('🔍 [DEBUG] PII Patterns Store: piiService imported');
import {
  PIIPattern,
  PIIDataType,
  PIIPatternFilters,
  PIIPatternSortOptions,
  PIIPatternBulkOperation,
  PIITestRequest,
  PIITestResponse,
  PIIStatsResponse
} from '@/types/pii';

export const usePIIPatternsStore = defineStore('piiPatterns', () => {
  console.log('🔍 [DEBUG] PII Patterns Store: Starting initialization');
  
  // =====================================
  // STATE
  // =====================================
  
  const patterns = ref<PIIPattern[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  
  // Filter and sort state
  const filters = ref<PIIPatternFilters>({
    dataType: 'all',
    enabled: 'all',
    isBuiltIn: 'all',
    category: 'all',
    search: ''
  });
  
  const sortOptions = ref<PIIPatternSortOptions>({
    field: 'name',
    direction: 'asc'
  });
  
  // Selection state for bulk operations
  const selectedPatternIds = ref<string[]>([]);
  
  // Testing state
  const testResult = ref<PIITestResponse | null>(null);
  const isTestingPII = ref(false);
  
  // Stats state
  const stats = ref<PIIStatsResponse | null>(null);

  // =====================================
  // GETTERS
  // =====================================
  
  const filteredAndSortedPatterns = computed(() => {
    let filtered = [...patterns.value];
    
    // Apply filters
    if (filters.value.dataType && filters.value.dataType !== 'all') {
      filtered = filtered.filter(p => p.dataType === filters.value.dataType);
    }
    
    if (filters.value.enabled !== 'all') {
      filtered = filtered.filter(p => p.enabled === filters.value.enabled);
    }
    
    if (filters.value.isBuiltIn !== 'all') {
      filtered = filtered.filter(p => p.isBuiltIn === filters.value.isBuiltIn);
    }
    
    if (filters.value.category && filters.value.category !== 'all') {
      filtered = filtered.filter(p => p.category === filters.value.category);
    }
    
    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm) ||
        p.pattern.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const { field, direction } = sortOptions.value;
      let aVal: any = a[field];
      let bVal: any = b[field];
      
      // Handle special cases
      if (field === 'createdAt' && aVal && bVal) {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  });
  
  const enabledPatterns = computed(() => 
    patterns.value.filter(p => p.enabled !== false)
  );
  
  const customPatterns = computed(() => 
    patterns.value.filter(p => !p.isBuiltIn)
  );
  
  const builtInPatterns = computed(() => 
    patterns.value.filter(p => p.isBuiltIn)
  );
  
  const patternsByDataType = computed(() => {
    const grouped: Record<PIIDataType, PIIPattern[]> = {} as any;
    patterns.value.forEach(pattern => {
      if (!grouped[pattern.dataType]) {
        grouped[pattern.dataType] = [];
      }
      grouped[pattern.dataType].push(pattern);
    });
    return grouped;
  });
  
  const availableCategories = computed(() => {
    const categories = new Set<string>();
    patterns.value.forEach(p => {
      if (p.category) categories.add(p.category);
    });
    return Array.from(categories).sort();
  });
  
  const isPatternSelected = computed(() => (patternId: string) => 
    selectedPatternIds.value.includes(patternId)
  );
  
  const selectedPatternsCount = computed(() => selectedPatternIds.value.length);
  
  const selectedPatterns = computed(() => 
    patterns.value.filter(pattern => 
      selectedPatternIds.value.includes(pattern.id || pattern.name)
    )
  );

  // =====================================
  // ACTIONS
  // =====================================
  
  /**
   * Load all PII patterns from the API
   */
  async function loadPatterns(force = false) {
    if (isLoading.value && !force) return;
    if (patterns.value.length > 0 && !force) return;
    
    isLoading.value = true;
    error.value = null;
    
    try {
      const loadedPatterns = await piiService.getPIIPatterns();
      patterns.value = loadedPatterns;
      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load PII patterns';
      console.error('Error loading PII patterns:', err);
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Create a new PII pattern
   */
  async function createPattern(patternData: Omit<PIIPattern, 'id' | 'createdAt' | 'updatedAt'>) {
    isLoading.value = true;
    error.value = null;
    
    try {
      const newPattern = await piiService.createPIIPattern(patternData);
      patterns.value.push(newPattern);
      lastUpdated.value = new Date();
      return newPattern;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create PII pattern';
      console.error('Error creating PII pattern:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Update an existing PII pattern
   */
  async function updatePattern(id: string, patternData: Partial<PIIPattern>) {
    isLoading.value = true;
    error.value = null;
    
    try {
      const updatedPattern = await piiService.updatePIIPattern(id, patternData);
      const index = patterns.value.findIndex(p => p.id === id);
      if (index !== -1) {
        patterns.value[index] = updatedPattern;
      }
      lastUpdated.value = new Date();
      return updatedPattern;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update PII pattern';
      console.error('Error updating PII pattern:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Delete a PII pattern
   */
  async function deletePattern(id: string) {
    isLoading.value = true;
    error.value = null;
    
    try {
      await piiService.deletePIIPattern(id);
      patterns.value = patterns.value.filter(p => p.id !== id);
      selectedPatternIds.value = selectedPatternIds.value.filter(pid => pid !== id);
      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete PII pattern';
      console.error('Error deleting PII pattern:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Perform bulk operations on selected patterns
   */
  async function bulkOperation(operation: PIIPatternBulkOperation['operation']) {
    if (selectedPatternIds.value.length === 0) {
      throw new Error('No patterns selected for bulk operation');
    }
    
    isLoading.value = true;
    error.value = null;
    
    try {
      const bulkOp: PIIPatternBulkOperation = {
        operation,
        patternIds: selectedPatternIds.value
      };
      
      const result = await piiService.bulkOperationPIIPatterns(bulkOp);
      
      if (result.success) {
        // Refresh patterns to reflect changes
        await loadPatterns(true);
        clearSelection();
      }
      
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : `Failed to perform bulk ${operation}`;
      console.error(`Error performing bulk ${operation}:`, err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Test PII detection on text
   */
  async function testPIIDetection(request: PIITestRequest) {
    isTestingPII.value = true;
    error.value = null;
    
    try {
      const result = await piiService.testPIIDetection(request);
      testResult.value = result;
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to test PII detection';
      console.error('Error testing PII detection:', err);
      throw err;
    } finally {
      isTestingPII.value = false;
    }
  }
  
  /**
   * Load PII management statistics
   */
  async function loadStats() {
    try {
      const loadedStats = await piiService.getPIIStats();
      stats.value = loadedStats;
      return loadedStats;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load PII stats';
      console.error('Error loading PII stats:', err);
      throw err;
    }
  }
  
  // =====================================
  // FILTER AND SELECTION ACTIONS
  // =====================================
  
  function updateFilters(newFilters: Partial<PIIPatternFilters>) {
    filters.value = { ...filters.value, ...newFilters };
  }
  
  function updateSortOptions(newSortOptions: Partial<PIIPatternSortOptions>) {
    sortOptions.value = { ...sortOptions.value, ...newSortOptions };
  }
  
  function clearFilters() {
    filters.value = {
      dataType: 'all',
      enabled: 'all',
      isBuiltIn: 'all',
      category: 'all',
      search: ''
    };
  }
  
  function togglePatternSelection(patternId: string) {
    const index = selectedPatternIds.value.indexOf(patternId);
    if (index === -1) {
      selectedPatternIds.value.push(patternId);
    } else {
      selectedPatternIds.value.splice(index, 1);
    }
  }
  
  function selectAllVisiblePatterns() {
    const visibleIds = filteredAndSortedPatterns.value
      .map(p => p.id)
      .filter(id => id) as string[];
    selectedPatternIds.value = [...new Set([...selectedPatternIds.value, ...visibleIds])];
  }
  
  function clearSelection() {
    selectedPatternIds.value = [];
  }
  
  function clearError() {
    error.value = null;
  }
  
  function clearTestResult() {
    testResult.value = null;
  }

  // =====================================
  // RETURN STORE INTERFACE
  // =====================================
  
  return {
    // State
    patterns,
    isLoading,
    error,
    lastUpdated,
    filters,
    sortOptions,
    selectedPatternIds,
    testResult,
    isTestingPII,
    stats,
    
    // Getters
    filteredAndSortedPatterns,
    enabledPatterns,
    customPatterns,
    builtInPatterns,
    patternsByDataType,
    availableCategories,
    isPatternSelected,
    selectedPatternsCount,
    selectedPatterns,
    
    // Actions
    loadPatterns,
    fetchPatterns: loadPatterns, // Alias for compatibility
    createPattern,
    updatePattern,
    deletePattern,
    bulkOperation,
    testPIIDetection,
    loadStats,
    updateFilters,
    updateSortOptions,
    clearFilters,
    togglePatternSelection,
    selectAllVisiblePatterns,
    clearSelection,
    clearError,
    clearTestResult
  };
});
