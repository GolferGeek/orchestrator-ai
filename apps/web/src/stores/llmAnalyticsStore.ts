/**
 * LLM Analytics Store
 *
 * Consolidated store for LLM usage analytics, cost tracking, and performance metrics.
 * This store handles all analytics-related functionality including:
 * - Usage records and statistics
 * - Cost analysis and trends
 * - Performance metrics and monitoring
 * - Analytics filters and pagination
 * - Auto-refresh capabilities
 *
 * Health monitoring, alerts, and compliance tracking are handled by llmHealthStore.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { llmAnalyticsService, type ActiveRun } from '@/services/llmAnalyticsService';
import {
  LLMUsageStats,
  PerformanceMetrics,
  CostAnalysis,
  LLMUsageStatsRequest,
  LLMUsageRecordsRequest
} from '@/types/llm-monitoring';

// Legacy types from llmUsageService (to be deprecated)
import type {
  LlmUsageRecord,
  LlmUsageFilters,
  LlmAnalytics,
  LlmStats
} from '@/services/llmUsageService';

export const useLLMAnalyticsStore = defineStore('llmAnalytics', () => {
  // =====================================
  // STATE
  // =====================================

  // Usage Records (merged from both stores)
  const usageRecords = ref<LlmUsageRecord[]>([]);
  const usageRecordsTotal = ref(0);
  const usageRecordsPage = ref(1);
  const usageRecordsLimit = ref(50);

  // Analytics Data
  const analytics = ref<LlmAnalytics[]>([]);
  const stats = ref<LlmStats | null>(null);
  const activeRuns = ref<ActiveRun[]>([]);

  // Usage Statistics
  const usageStats = ref<LLMUsageStats | null>(null);

  // Performance & Cost
  const performanceMetrics = ref<PerformanceMetrics[]>([]);
  const costAnalysis = ref<CostAnalysis | null>(null);

  // Loading States
  const loading = ref(false);
  const isLoadingUsageStats = ref(false);
  const isLoadingUsageRecords = ref(false);
  const isLoadingPerformance = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // Filters
  const filters = ref<LlmUsageFilters>({
    limit: 100,
    route: undefined,
  });

  const analyticsFilters = ref<{
    startDate?: string;
    endDate?: string;
    callerType?: string;
    route?: 'local' | 'remote'
  }>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
    endDate: new Date().toISOString().split('T')[0], // today
    route: undefined,
  });

  // Auto-refresh functionality
  const autoRefreshInterval = ref<number | null>(null);

  // =====================================
  // COMPUTED PROPERTIES
  // =====================================

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

  // Additional computed properties from llmMonitoringStore
  const availableProviders = computed(() => {
    const providerSet = new Set<string>();
    usageRecords.value.forEach(record => {
      if (record.provider_name) {
        providerSet.add(record.provider_name);
      }
    });
    return Array.from(providerSet).sort();
  });

  const availableModels = computed(() => {
    const modelSet = new Set<string>();
    usageRecords.value.forEach(record => {
      if (record.model_name) {
        modelSet.add(record.model_name);
      }
    });
    return Array.from(modelSet).sort();
  });

  const totalCostToday = computed(() => {
    if (!usageStats.value) return 0;
    return usageStats.value.totalCost;
  });

  const averageResponseTime = computed(() => {
    if (!usageStats.value) return 0;
    return usageStats.value.averageResponseTime;
  });

  // =====================================
  // ACTIONS - LEGACY USAGE (from llmUsageStore)
  // =====================================

  async function fetchUsageRecords(customFilters?: LlmUsageFilters) {
    loading.value = true;
    error.value = null;

    try {
      const filtersToUse = customFilters || filters.value;
      const records = await llmAnalyticsService.getUsageRecords(filtersToUse);
      usageRecords.value = records;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch usage records';
      console.error('Error fetching usage records:', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchAnalytics(customFilters?: {
    startDate?: string;
    endDate?: string;
    callerType?: string;
    route?: 'local' | 'remote'
  }) {
    loading.value = true;
    error.value = null;

    try {
      const filtersToUse = customFilters || analyticsFilters.value;
      analytics.value = await llmAnalyticsService.getUsageAnalytics(filtersToUse);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch analytics';
      console.error('Error fetching analytics:', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchStats() {
    try {
      stats.value = await llmAnalyticsService.getStats();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch stats';
      console.error('Error fetching stats:', err);
    }
  }

  async function fetchActiveRuns() {
    try {
      activeRuns.value = await llmAnalyticsService.getActiveRuns();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch active runs';
      console.error('Error fetching active runs:', err);
    }
  }

  // =====================================
  // ACTIONS - NEW USAGE STATS (from llmMonitoringStore)
  // =====================================

  /**
   * Load usage statistics
   */
  async function loadUsageStats(request: LLMUsageStatsRequest = {}) {
    isLoadingUsageStats.value = true;
    error.value = null;

    try {
      const response = await llmAnalyticsService.getUsageStatsNew(request);
      if (response.success) {
        usageStats.value = response.data;
        lastUpdated.value = new Date();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load usage stats';
      console.error('Error loading usage stats:', err);
    } finally {
      isLoadingUsageStats.value = false;
    }
  }

  /**
   * Load usage records with pagination
   */
  async function loadUsageRecords(request: LLMUsageRecordsRequest = {}) {
    isLoadingUsageRecords.value = true;
    error.value = null;

    try {
      const response = await llmAnalyticsService.getUsageRecordsNew({
        ...request,
        limit: usageRecordsLimit.value,
        offset: (usageRecordsPage.value - 1) * usageRecordsLimit.value
      });

      if (response.success) {
        // Map new format to legacy format for compatibility
        usageRecords.value = response.data.records.map((record): LlmUsageRecord => ({
          id: record.id,
          run_id: record.id,
          user_id: record.userId ?? null,
          caller_type: record.callerType ?? '',
          caller_name: record.callerName ?? '',
          conversation_id: record.sessionId ?? null,
          provider_name: record.metrics.provider,
          model_name: record.metrics.model,
          is_local: record.metrics.provider.toLowerCase().includes('ollama'),
          model_tier: null,
          route: null,
          fallback_used: false,
          routing_reason: null,
          complexity_level: null,
          complexity_score: null,
          data_classification: record.dataClassification ?? null,
          status: record.status,
          input_tokens: record.metrics.inputTokens ?? null,
          output_tokens: record.metrics.outputTokens ?? null,
          input_cost: null,
          output_cost: null,
          total_cost: record.metrics.cost ?? null,
          duration_ms: record.metrics.responseTime ?? null,
          started_at: record.createdAt,
          completed_at: record.completedAt,
          error_message: record.errorMessage ?? null,
          created_at: record.createdAt,
          updated_at: record.completedAt ?? record.createdAt,
        }));
        usageRecordsTotal.value = response.data.total;
        lastUpdated.value = new Date();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load usage records';
      console.error('Error loading usage records:', err);
    } finally {
      isLoadingUsageRecords.value = false;
    }
  }

  /**
   * Load performance metrics
   */
  async function loadPerformanceMetrics(startDate?: string, endDate?: string) {
    isLoadingPerformance.value = true;
    error.value = null;

    try {
      const [performanceResponse, costResponse] = await Promise.all([
        llmAnalyticsService.getPerformanceMetrics(startDate, endDate),
        llmAnalyticsService.getCostAnalysis(startDate, endDate)
      ]);

      if (performanceResponse.success) {
        performanceMetrics.value = performanceResponse.data;
      }

      if (costResponse.success) {
        costAnalysis.value = costResponse.data;
      }

      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load performance metrics';
      console.error('Error loading performance metrics:', err);
    } finally {
      isLoadingPerformance.value = false;
    }
  }

  /**
   * Get cost summary
   */
  function getCostSummary() {
    if (!costAnalysis.value) return null;
    return {
      totalCost: costAnalysis.value.totalCost,
      projectedMonthlyCost: costAnalysis.value.projectedMonthlyCost,
      costByProvider: costAnalysis.value.costByProvider,
      costByModel: costAnalysis.value.costByModel,
      costTrends: costAnalysis.value.costTrends,
      optimizationSuggestions: costAnalysis.value.costOptimizationSuggestions
    };
  }

  // =====================================
  // FILTER ACTIONS
  // =====================================

  function updateFilters(newFilters: Partial<LlmUsageFilters>) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function updateAnalyticsFilters(newFilters: Partial<{
    startDate?: string;
    endDate?: string;
    callerType?: string;
    route?: 'local' | 'remote'
  }>) {
    analyticsFilters.value = { ...analyticsFilters.value, ...newFilters };
  }

  function clearFilters() {
    filters.value = { limit: 100 };
  }

  function clearError() {
    error.value = null;
  }

  // =====================================
  // PAGINATION ACTIONS
  // =====================================

  function setUsageRecordsPage(page: number) {
    usageRecordsPage.value = page;
  }

  function setUsageRecordsLimit(limit: number) {
    usageRecordsLimit.value = limit;
    usageRecordsPage.value = 1; // Reset to first page
  }

  // =====================================
  // AUTO-REFRESH FUNCTIONALITY
  // =====================================

  function startAutoRefresh(intervalMs: number = 30000) { // 30 seconds default
    if (autoRefreshInterval.value) {
      clearInterval(autoRefreshInterval.value);
    }

    autoRefreshInterval.value = setInterval(() => {
      fetchStats();
      fetchActiveRuns();
      if (usageStats.value) {
        loadUsageStats();
      }
    }, intervalMs);
  }

  function stopAutoRefresh() {
    if (autoRefreshInterval.value) {
      clearInterval(autoRefreshInterval.value);
      autoRefreshInterval.value = null;
    }
  }

  // =====================================
  // UTILITY ACTIONS
  // =====================================

  /**
   * Get date range for common periods
   */
  function getDateRange(period: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth') {
    return llmAnalyticsService.getDateRange(period);
  }

  // =====================================
  // INITIALIZATION
  // =====================================

  /**
   * Initialize the store with all data
   */
  async function initialize() {
    await Promise.all([
      fetchUsageRecords(),
      fetchAnalytics(),
      fetchStats(),
      fetchActiveRuns()
    ]);
  }

  /**
   * Refresh all analytics data
   */
  async function refreshAllData() {
    const dateRange = getDateRange('last30days');

    await Promise.all([
      loadUsageStats(dateRange),
      loadUsageRecords(dateRange),
      loadPerformanceMetrics(dateRange.startDate, dateRange.endDate)
    ]);
  }

  // =====================================
  // RETURN STORE INTERFACE
  // =====================================

  return {
    // State
    usageRecords,
    usageRecordsTotal,
    usageRecordsPage,
    usageRecordsLimit,
    analytics,
    stats,
    activeRuns,
    usageStats,
    performanceMetrics,
    costAnalysis,
    loading,
    isLoadingUsageStats,
    isLoadingUsageRecords,
    isLoadingPerformance,
    error,
    lastUpdated,
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
    availableProviders,
    availableModels,
    totalCostToday,
    averageResponseTime,

    // Actions - Legacy
    fetchUsageRecords,
    fetchAnalytics,
    fetchStats,
    fetchActiveRuns,

    // Actions - New
    loadUsageStats,
    loadUsageRecords,
    loadPerformanceMetrics,
    getCostSummary,

    // Filter Actions
    updateFilters,
    updateAnalyticsFilters,
    clearFilters,
    clearError,

    // Pagination Actions
    setUsageRecordsPage,
    setUsageRecordsLimit,

    // Auto-refresh
    startAutoRefresh,
    stopAutoRefresh,

    // Utility
    getDateRange,
    initialize,
    refreshAllData
  };
});
