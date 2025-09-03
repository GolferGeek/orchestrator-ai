import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  llmUsageService, 
  type LlmUsageRecord, 
  type LlmUsageFilters, 
  type LlmAnalytics,
  type LlmStats 
} from '@/services/llmUsageService';

export const useLlmUsageStore = defineStore('llmUsage', () => {
  // State
  const usageRecords = ref<LlmUsageRecord[]>([]);
  const analytics = ref<LlmAnalytics[]>([]);
  const stats = ref<LlmStats | null>(null);
  const activeRuns = ref<any[]>([]);
  
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // Filters
  const filters = ref<LlmUsageFilters>({
    limit: 100
  });
  
  const analyticsFilters = ref({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
    endDate: new Date().toISOString().split('T')[0] // today
  });

  // Computed
  const totalCost = computed(() => {
    return usageRecords.value.reduce((sum, record) => {
      return sum + (record.total_cost || 0);
    }, 0);
  });

  const successRate = computed(() => {
    if (usageRecords.value.length === 0) return 0;
    const successful = usageRecords.value.filter(r => r.status === 'completed').length;
    return (successful / usageRecords.value.length) * 100;
  });

  const avgDuration = computed(() => {
    const recordsWithDuration = usageRecords.value.filter(r => r.duration_ms !== null);
    if (recordsWithDuration.length === 0) return 0;
    
    const totalDuration = recordsWithDuration.reduce((sum, r) => sum + (r.duration_ms || 0), 0);
    return totalDuration / recordsWithDuration.length;
  });

  const callerTypes = computed(() => {
    const types = new Set(usageRecords.value.map(r => r.caller_type));
    return Array.from(types).sort();
  });

  const callerNames = computed(() => {
    const names = new Set(usageRecords.value.map(r => r.caller_name));
    return Array.from(names).sort();
  });

  const providers = computed(() => {
    const providers = new Set(usageRecords.value.map(r => r.provider_name));
    return Array.from(providers).sort();
  });

  const models = computed(() => {
    const models = new Set(usageRecords.value.map(r => r.model_name));
    return Array.from(models).sort();
  });

  // Actions
  async function fetchUsageRecords(customFilters?: LlmUsageFilters) {
    loading.value = true;
    error.value = null;
    
    try {
      const filtersToUse = customFilters || filters.value;
      usageRecords.value = await llmUsageService.getUsageRecords(filtersToUse);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch usage records';
      console.error('Error fetching usage records:', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchAnalytics(customFilters?: { startDate?: string; endDate?: string; callerType?: string }) {
    loading.value = true;
    error.value = null;
    
    try {
      const filtersToUse = customFilters || analyticsFilters.value;
      analytics.value = await llmUsageService.getUsageAnalytics(filtersToUse);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch analytics';
      console.error('Error fetching analytics:', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchStats() {
    try {
      stats.value = await llmUsageService.getStats();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch stats';
      console.error('Error fetching stats:', err);
    }
  }

  async function fetchActiveRuns() {
    try {
      activeRuns.value = await llmUsageService.getActiveRuns();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch active runs';
      console.error('Error fetching active runs:', err);
    }
  }

  function updateFilters(newFilters: Partial<LlmUsageFilters>) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function updateAnalyticsFilters(newFilters: Partial<{ startDate?: string; endDate?: string; callerType?: string }>) {
    analyticsFilters.value = { ...analyticsFilters.value, ...newFilters };
  }

  function clearFilters() {
    filters.value = { limit: 100 };
  }

  function clearError() {
    error.value = null;
  }

  // Auto-refresh functionality
  const autoRefreshInterval = ref<number | null>(null);

  function startAutoRefresh(intervalMs: number = 30000) { // 30 seconds default
    if (autoRefreshInterval.value) {
      clearInterval(autoRefreshInterval.value);
    }
    
    autoRefreshInterval.value = setInterval(() => {
      fetchStats();
      fetchActiveRuns();
    }, intervalMs);
  }

  function stopAutoRefresh() {
    if (autoRefreshInterval.value) {
      clearInterval(autoRefreshInterval.value);
      autoRefreshInterval.value = null;
    }
  }

  // Initialize
  async function initialize() {
    await Promise.all([
      fetchUsageRecords(),
      fetchAnalytics(),
      fetchStats(),
      fetchActiveRuns()
    ]);
  }

  return {
    // State
    usageRecords,
    analytics,
    stats,
    activeRuns,
    loading,
    error,
    filters,
    analyticsFilters,
    
    // Computed
    totalCost,
    successRate,
    avgDuration,
    callerTypes,
    callerNames,
    providers,
    models,
    
    // Actions
    fetchUsageRecords,
    fetchAnalytics,
    fetchStats,
    fetchActiveRuns,
    updateFilters,
    updateAnalyticsFilters,
    clearFilters,
    clearError,
    startAutoRefresh,
    stopAutoRefresh,
    initialize
  };
});
