import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { pseudonymService } from '@/services/pseudonymService';
import { PseudonymMapping, PIIDataType, PseudonymStatsResponse } from '@/types/pii';

export interface PseudonymMappingFilters {
  dataType?: PIIDataType | 'all';
  context?: string;
  search?: string;
}

export interface PseudonymMappingSortOptions {
  field: 'usageCount' | 'lastUsedAt' | 'createdAt' | 'dataType' | 'pseudonym';
  direction: 'asc' | 'desc';
}

export const usePseudonymMappingsStore = defineStore('pseudonymMappings', () => {
  // State
  const mappings = ref<PseudonymMapping[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastFetched = ref<Date | null>(null);
  
  // Filters and sorting
  const filters = ref<PseudonymMappingFilters>({
    dataType: 'all',
    context: undefined,
    search: ''
  });
  
  const sortOptions = ref<PseudonymMappingSortOptions>({
    field: 'usageCount',
    direction: 'desc'
  });

  // Statistics
  const stats = ref<PseudonymStatsResponse['stats'] | null>(null);
  const statsLoading = ref(false);
  const statsError = ref<string | null>(null);

  // Computed properties
  const totalMappings = computed(() => mappings.value.length);

  const availableDataTypes = computed(() => {
    const types = new Set(mappings.value.map(m => m.dataType));
    return Array.from(types).sort();
  });

  const availableContexts = computed(() => {
    const contexts = new Set(mappings.value.map(m => m.context).filter(Boolean));
    return Array.from(contexts).sort();
  });

  const filteredMappings = computed(() => {
    let filtered = [...mappings.value];

    // Apply search filter
    if (filters.value.search) {
      const search = filters.value.search.toLowerCase();
      filtered = filtered.filter(mapping => 
        mapping.pseudonym.toLowerCase().includes(search) ||
        mapping.dataType.toLowerCase().includes(search) ||
        (mapping.context && mapping.context.toLowerCase().includes(search))
      );
    }

    // Apply data type filter
    if (filters.value.dataType && filters.value.dataType !== 'all') {
      filtered = filtered.filter(mapping => mapping.dataType === filters.value.dataType);
    }

    // Apply context filter
    if (filters.value.context) {
      filtered = filtered.filter(mapping => mapping.context === filters.value.context);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortOptions.value.field) {
        case 'usageCount':
          aVal = a.usageCount;
          bVal = b.usageCount;
          break;
        case 'lastUsedAt':
          aVal = new Date(a.lastUsedAt);
          bVal = new Date(b.lastUsedAt);
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
          break;
        case 'dataType':
          aVal = a.dataType;
          bVal = b.dataType;
          break;
        case 'pseudonym':
          aVal = a.pseudonym.toLowerCase();
          bVal = b.pseudonym.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOptions.value.direction === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      } else {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
    });

    return filtered;
  });

  const mappingsByDataType = computed(() => {
    const byType: Record<PIIDataType, PseudonymMapping[]> = {} as Record<PIIDataType, PseudonymMapping[]>;
    
    mappings.value.forEach(mapping => {
      if (!byType[mapping.dataType]) {
        byType[mapping.dataType] = [];
      }
      byType[mapping.dataType].push(mapping);
    });

    return byType;
  });

  const totalUsage = computed(() => {
    return mappings.value.reduce((sum, mapping) => sum + mapping.usageCount, 0);
  });

  const averageUsage = computed(() => {
    const total = totalUsage.value;
    const count = totalMappings.value;
    return count > 0 ? Math.round(total / count) : 0;
  });

  const recentMappings = computed(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return mappings.value.filter(mapping => {
      const lastUsed = new Date(mapping.lastUsedAt);
      return lastUsed >= sevenDaysAgo;
    });
  });

  const highUsageMappings = computed(() => {
    const threshold = 10; // Consider high usage if used 10+ times
    return mappings.value.filter(mapping => mapping.usageCount >= threshold);
  });

  // Actions
  const fetchMappings = async (force = false) => {
    // Skip if already loading or recently fetched (unless forced)
    if (isLoading.value) return;
    
    if (!force && lastFetched.value) {
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
      if (lastFetched.value > fiveMinutesAgo) {
        return;
      }
    }

    isLoading.value = true;
    error.value = null;

    try {
      const fetchedMappings = await pseudonymService.getPseudonymMappings();
      mappings.value = fetchedMappings;
      lastFetched.value = new Date();
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch pseudonym mappings';
      console.error('Error fetching pseudonym mappings:', err);
      
      // If API endpoint doesn't exist yet, return empty array
      if (err.response?.status === 404) {
        console.warn('Pseudonym mappings endpoint not available');
        mappings.value = [];
        lastFetched.value = new Date();
        error.value = 'Pseudonym mappings API endpoint not yet implemented';
      }
    } finally {
      isLoading.value = false;
    }
  };

  const fetchMappingsFiltered = async (filterOptions: {
    dataType?: PIIDataType | 'all';
    context?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await pseudonymService.getPseudonymMappingsFiltered(filterOptions);
      mappings.value = result.mappings;
      lastFetched.value = new Date();
      return result;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch filtered pseudonym mappings';
      console.error('Error fetching filtered pseudonym mappings:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchMapping = async (id: string): Promise<PseudonymMapping | null> => {
    try {
      const mapping = await pseudonymService.getPseudonymMapping(id);
      
      // Update the mapping in our local state if it exists
      const index = mappings.value.findIndex(m => m.id === id);
      if (index !== -1) {
        mappings.value[index] = mapping;
      } else {
        mappings.value.push(mapping);
      }
      
      return mapping;
    } catch (err: any) {
      console.error(`Error fetching pseudonym mapping ${id}:`, err);
      return null;
    }
  };

  const fetchStats = async (force = false) => {
    // Skip if already loading or recently fetched (unless forced)
    if (statsLoading.value) return;

    statsLoading.value = true;
    statsError.value = null;

    try {
      const response = await pseudonymService.getPseudonymStats();
      stats.value = response.stats;
    } catch (err: any) {
      statsError.value = err.message || 'Failed to fetch pseudonym statistics';
      console.error('Error fetching pseudonym stats:', err);
    } finally {
      statsLoading.value = false;
    }
  };

  const updateFilters = (newFilters: Partial<PseudonymMappingFilters>) => {
    filters.value = { ...filters.value, ...newFilters };
  };

  const updateSortOptions = (newSortOptions: Partial<PseudonymMappingSortOptions>) => {
    sortOptions.value = { ...sortOptions.value, ...newSortOptions };
  };

  const clearFilters = () => {
    filters.value = {
      dataType: 'all',
      context: undefined,
      search: ''
    };
  };

  const refreshData = async () => {
    await Promise.all([
      fetchMappings(true),
      fetchStats(true)
    ]);
  };

  /**
   * Fetch pseudonym mappings for a specific run ID
   */
  const getMappingsByRunId = async (runId: string): Promise<PseudonymMapping[]> => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await pseudonymService.getMappingsByRunId(runId);
      return response || [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch mappings by run ID';
      console.error('Error fetching mappings by run ID:', err);
      return [];
    } finally {
      isLoading.value = false;
    }
  };


  return {
    // State
    mappings,
    isLoading,
    error,
    lastFetched,
    filters,
    sortOptions,
    stats,
    statsLoading,
    statsError,

    // Computed
    totalMappings,
    availableDataTypes,
    availableContexts,
    filteredMappings,
    mappingsByDataType,
    totalUsage,
    averageUsage,
    recentMappings,
    highUsageMappings,

    // Actions
    fetchMappings,
    fetchMappingsFiltered,
    fetchMapping,
    fetchStats,
    updateFilters,
    updateSortOptions,
    clearFilters,
    refreshData,
    getMappingsByRunId
  };
});
