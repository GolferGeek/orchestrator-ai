import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { pseudonymService } from '@/services/pseudonymService';
import {
  PseudonymDictionaryEntry,
  PseudonymDictionaryFilters,
  PseudonymDictionarySortOptions,
  PseudonymDictionaryBulkOperation,
  PseudonymDictionaryImportData,
  PseudonymDictionaryExportData,
  PseudonymGenerateRequest,
  PseudonymGenerateResponse,
  PseudonymLookupRequest,
  PseudonymLookupResponse,
  PseudonymStatsResponse,
  PIIDataType
} from '@/types/pii';

export const usePseudonymDictionariesStore = defineStore('pseudonymDictionaries', () => {
  // =====================================
  // STATE
  // =====================================
  
  const dictionaries = ref<PseudonymDictionaryEntry[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  
  // Filter and sort state
  const filters = ref<PseudonymDictionaryFilters>({
    category: 'all',
    dataType: 'all',
    isActive: 'all',
    search: ''
  });
  
  const sortOptions = ref<PseudonymDictionarySortOptions>({
    field: 'category',
    direction: 'asc'
  });
  
  // Selection state for bulk operations
  const selectedDictionaryIds = ref<string[]>([]);
  
  // Pseudonym generation state
  const generationResult = ref<PseudonymGenerateResponse | null>(null);
  const lookupResult = ref<PseudonymLookupResponse | null>(null);
  const isGenerating = ref(false);
  
  // Statistics state
  const stats = ref<PseudonymStatsResponse | null>(null);
  
  // Import/Export state
  const importProgress = ref<{ imported: number; total: number; errors: string[] } | null>(null);
  const isImporting = ref(false);
  const isExporting = ref(false);

  // =====================================
  // GETTERS
  // =====================================
  
  const filteredAndSortedDictionaries = computed(() => {
    let filtered = [...dictionaries.value];
    
    // Apply filters
    if (filters.value.category && filters.value.category !== 'all') {
      filtered = filtered.filter(d => d.category === filters.value.category);
    }
    
    if (filters.value.dataType && filters.value.dataType !== 'all') {
      filtered = filtered.filter(d => d.dataType === filters.value.dataType);
    }
    
    if (filters.value.isActive !== 'all') {
      filtered = filtered.filter(d => d.isActive === filters.value.isActive);
    }
    
    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase();
      filtered = filtered.filter(d =>
        d.category.toLowerCase().includes(searchTerm) ||
        (d.description && d.description.toLowerCase().includes(searchTerm)) ||
        d.words.some(word => word.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const { field, direction } = sortOptions.value;
      let aVal: any = a[field];
      let bVal: any = b[field];
      
      // Handle special cases
      if (field === 'wordsCount') {
        aVal = a.words.length;
        bVal = b.words.length;
      } else if (field === 'createdAt' && aVal && bVal) {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  });
  
  const activeDictionaries = computed(() => 
    dictionaries.value.filter(d => d.isActive)
  );
  
  const dictionariesByCategory = computed(() => {
    const grouped: Record<string, PseudonymDictionaryEntry[]> = {};
    dictionaries.value.forEach(dictionary => {
      if (!grouped[dictionary.category]) {
        grouped[dictionary.category] = [];
      }
      grouped[dictionary.category].push(dictionary);
    });
    return grouped;
  });
  
  const dictionariesByDataType = computed(() => {
    const grouped: Record<PIIDataType, PseudonymDictionaryEntry[]> = {} as any;
    dictionaries.value.forEach(dictionary => {
      if (!grouped[dictionary.dataType]) {
        grouped[dictionary.dataType] = [];
      }
      grouped[dictionary.dataType].push(dictionary);
    });
    return grouped;
  });
  
  const availableCategories = computed(() => {
    const categories = new Set<string>();
    dictionaries.value.forEach(d => categories.add(d.category));
    return Array.from(categories).sort();
  });
  
  const totalWordsCount = computed(() => 
    dictionaries.value.reduce((total, dict) => total + dict.words.length, 0)
  );
  
  const isDictionarySelected = computed(() => (dictionaryId: string) => 
    selectedDictionaryIds.value.includes(dictionaryId)
  );
  
  const selectedDictionariesCount = computed(() => selectedDictionaryIds.value.length);

  // =====================================
  // ACTIONS
  // =====================================
  
  /**
   * Load all pseudonym dictionaries from the API
   */
  async function loadDictionaries(force = false) {
    if (isLoading.value && !force) return;
    if (dictionaries.value.length > 0 && !force) return;
    
    isLoading.value = true;
    error.value = null;
    
    try {
      const loadedDictionaries = await pseudonymService.getPseudonymDictionaries();
      dictionaries.value = loadedDictionaries;
      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load pseudonym dictionaries';
      console.error('Error loading pseudonym dictionaries:', err);
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Create a new pseudonym dictionary
   */
  async function createDictionary(dictionaryData: Omit<PseudonymDictionaryEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    isLoading.value = true;
    error.value = null;
    
    try {
      const newDictionary = await pseudonymService.createPseudonymDictionary(dictionaryData);
      dictionaries.value.push(newDictionary);
      lastUpdated.value = new Date();
      return newDictionary;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create pseudonym dictionary';
      console.error('Error creating pseudonym dictionary:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Update an existing pseudonym dictionary
   */
  async function updateDictionary(id: string, dictionaryData: Partial<PseudonymDictionaryEntry>) {
    isLoading.value = true;
    error.value = null;
    
    try {
      const updatedDictionary = await pseudonymService.updatePseudonymDictionary(id, dictionaryData);
      const index = dictionaries.value.findIndex(d => d.id === id);
      if (index !== -1) {
        dictionaries.value[index] = updatedDictionary;
      }
      lastUpdated.value = new Date();
      return updatedDictionary;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update pseudonym dictionary';
      console.error('Error updating pseudonym dictionary:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Delete a pseudonym dictionary
   */
  async function deleteDictionary(id: string) {
    isLoading.value = true;
    error.value = null;
    
    try {
      await pseudonymService.deletePseudonymDictionary(id);
      dictionaries.value = dictionaries.value.filter(d => d.id !== id);
      selectedDictionaryIds.value = selectedDictionaryIds.value.filter(did => did !== id);
      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete pseudonym dictionary';
      console.error('Error deleting pseudonym dictionary:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Perform bulk operations on selected dictionaries
   */
  async function bulkOperation(operation: PseudonymDictionaryBulkOperation['operation']) {
    if (selectedDictionaryIds.value.length === 0) {
      throw new Error('No dictionaries selected for bulk operation');
    }
    
    isLoading.value = true;
    error.value = null;
    
    try {
      const bulkOp: PseudonymDictionaryBulkOperation = {
        operation,
        dictionaryIds: selectedDictionaryIds.value
      };
      
      const result = await pseudonymService.bulkOperationPseudonymDictionaries(bulkOp);
      
      if (result.success) {
        // Refresh dictionaries to reflect changes
        await loadDictionaries(true);
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
  
  // =====================================
  // PSEUDONYM GENERATION ACTIONS
  // =====================================
  
  /**
   * Generate a pseudonym for a specific value
   */
  async function generatePseudonym(request: PseudonymGenerateRequest) {
    isGenerating.value = true;
    error.value = null;
    
    try {
      const result = await pseudonymService.generatePseudonym(request);
      generationResult.value = result;
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to generate pseudonym';
      console.error('Error generating pseudonym:', err);
      throw err;
    } finally {
      isGenerating.value = false;
    }
  }
  
  /**
   * Lookup existing pseudonym for a value
   */
  async function lookupPseudonym(request: PseudonymLookupRequest) {
    isGenerating.value = true;
    error.value = null;
    
    try {
      const result = await pseudonymService.lookupPseudonym(request);
      lookupResult.value = result;
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to lookup pseudonym';
      console.error('Error looking up pseudonym:', err);
      throw err;
    } finally {
      isGenerating.value = false;
    }
  }
  
  /**
   * Load pseudonym statistics
   */
  async function loadStats() {
    try {
      const loadedStats = await pseudonymService.getPseudonymStats();
      stats.value = loadedStats;
      return loadedStats;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load pseudonym stats';
      console.error('Error loading pseudonym stats:', err);
      throw err;
    }
  }
  
  // =====================================
  // IMPORT/EXPORT ACTIONS
  // =====================================
  
  /**
   * Import dictionaries from JSON data
   */
  async function importFromJSON(data: PseudonymDictionaryImportData[]) {
    isImporting.value = true;
    error.value = null;
    importProgress.value = { imported: 0, total: data.length, errors: [] };
    
    try {
      const result = await pseudonymService.importPseudonymDictionaries(data);
      
      if (result.success) {
        importProgress.value.imported = result.imported;
        if (result.errors) {
          importProgress.value.errors = result.errors;
        }
        
        // Refresh dictionaries to show imported ones
        await loadDictionaries(true);
      }
      
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to import dictionaries';
      console.error('Error importing dictionaries:', err);
      throw err;
    } finally {
      isImporting.value = false;
    }
  }
  
  /**
   * Import dictionaries from CSV file
   */
  async function importFromCSV(file: File) {
    isImporting.value = true;
    error.value = null;
    
    try {
      const result = await pseudonymService.importFromCSV(file);
      
      if (result.success) {
        // Refresh dictionaries to show imported ones
        await loadDictionaries(true);
      }
      
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to import from CSV';
      console.error('Error importing from CSV:', err);
      throw err;
    } finally {
      isImporting.value = false;
    }
  }
  
  /**
   * Export all dictionaries to JSON
   */
  async function exportToJSON(): Promise<PseudonymDictionaryExportData> {
    isExporting.value = true;
    error.value = null;
    
    try {
      const exportData = await pseudonymService.exportPseudonymDictionaries();
      return exportData;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to export dictionaries';
      console.error('Error exporting dictionaries:', err);
      throw err;
    } finally {
      isExporting.value = false;
    }
  }
  
  /**
   * Export dictionaries to CSV file
   */
  async function exportToCSV(): Promise<Blob> {
    isExporting.value = true;
    error.value = null;
    
    try {
      const csvBlob = await pseudonymService.exportToCSV();
      return csvBlob;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to export to CSV';
      console.error('Error exporting to CSV:', err);
      throw err;
    } finally {
      isExporting.value = false;
    }
  }
  
  /**
   * Parse CSV content for preview before import
   */
  function parseCSVForPreview(csvContent: string): PseudonymDictionaryImportData[] {
    try {
      return pseudonymService.parseCSVContent(csvContent);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to parse CSV content';
      return [];
    }
  }
  
  /**
   * Validate dictionary data before import
   */
  function validateImportData(data: PseudonymDictionaryImportData[]): { isValid: boolean; errors: string[] } {
    return pseudonymService.validateDictionaryData(data);
  }
  
  // =====================================
  // FILTER AND SELECTION ACTIONS
  // =====================================
  
  function updateFilters(newFilters: Partial<PseudonymDictionaryFilters>) {
    filters.value = { ...filters.value, ...newFilters };
  }
  
  function updateSortOptions(newSortOptions: Partial<PseudonymDictionarySortOptions>) {
    sortOptions.value = { ...sortOptions.value, ...newSortOptions };
  }
  
  function clearFilters() {
    filters.value = {
      category: 'all',
      dataType: 'all',
      isActive: 'all',
      search: ''
    };
  }
  
  function toggleDictionarySelection(dictionaryId: string) {
    const index = selectedDictionaryIds.value.indexOf(dictionaryId);
    if (index === -1) {
      selectedDictionaryIds.value.push(dictionaryId);
    } else {
      selectedDictionaryIds.value.splice(index, 1);
    }
  }
  
  function selectAllVisibleDictionaries() {
    const visibleIds = filteredAndSortedDictionaries.value
      .map(d => d.id)
      .filter(id => id) as string[];
    selectedDictionaryIds.value = [...new Set([...selectedDictionaryIds.value, ...visibleIds])];
  }
  
  function clearSelection() {
    selectedDictionaryIds.value = [];
  }
  
  function clearError() {
    error.value = null;
  }
  
  function clearResults() {
    generationResult.value = null;
    lookupResult.value = null;
    importProgress.value = null;
  }

  // =====================================
  // RETURN STORE INTERFACE
  // =====================================
  
  return {
    // State
    dictionaries,
    isLoading,
    error,
    lastUpdated,
    filters,
    sortOptions,
    selectedDictionaryIds,
    generationResult,
    lookupResult,
    isGenerating,
    stats,
    importProgress,
    isImporting,
    isExporting,
    
    // Getters
    filteredAndSortedDictionaries,
    activeDictionaries,
    dictionariesByCategory,
    dictionariesByDataType,
    availableCategories,
    totalWordsCount,
    isDictionarySelected,
    selectedDictionariesCount,
    
    // Actions
    loadDictionaries,
    fetchDictionaries: loadDictionaries, // Alias for compatibility
    createDictionary,
    updateDictionary,
    deleteDictionary,
    bulkOperation,
    generatePseudonym,
    lookupPseudonym,
    loadStats,
    importFromJSON,
    importFromCSV,
    exportToJSON,
    exportToCSV,
    parseCSVForPreview,
    validateImportData,
    updateFilters,
    updateSortOptions,
    clearFilters,
    toggleDictionarySelection,
    selectAllVisibleDictionaries,
    clearSelection,
    clearError,
    clearResults
  };
});
