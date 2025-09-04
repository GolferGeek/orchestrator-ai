import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { llmMonitoringService } from '@/services/llmMonitoringService';
import {
  LLMUsageStats,
  LLMUsageRecord,
  SystemHealthMetrics,
  OperationalStatus,
  PerformanceMetrics,
  CostAnalysis,
  ComplianceMetrics,
  Alert,
  LLMDashboardData,
  RealTimeMetrics,
  LLMMonitoringFilters,
  LLMMonitoringSortOptions,
  LLMUsageStatsRequest,
  LLMUsageRecordsRequest
} from '@/types/llm-monitoring';

export const useLLMMonitoringStore = defineStore('llmMonitoring', () => {
  // =====================================
  // STATE
  // =====================================
  
  // Usage Analytics
  const usageStats = ref<LLMUsageStats | null>(null);
  const usageRecords = ref<LLMUsageRecord[]>([]);
  const usageRecordsTotal = ref(0);
  const usageRecordsPage = ref(1);
  const usageRecordsLimit = ref(50);
  
  // System Health & Status
  const systemHealth = ref<SystemHealthMetrics | null>(null);
  const operationalStatus = ref<OperationalStatus | null>(null);
  const modelHealthMetrics = ref<any[]>([]);
  const memoryStats = ref<any>(null);
  
  // Alerts & Notifications
  const activeAlerts = ref<Alert[]>([]);
  const alertHistory = ref<Alert[]>([]);
  const alertsTotal = ref(0);
  
  // Performance & Cost
  const performanceMetrics = ref<PerformanceMetrics[]>([]);
  const costAnalysis = ref<CostAnalysis | null>(null);
  const complianceMetrics = ref<ComplianceMetrics | null>(null);
  
  // Dashboard & Overview
  const dashboardData = ref<LLMDashboardData | null>(null);
  const realTimeMetrics = ref<RealTimeMetrics | null>(null);
  
  // Loading States
  const isLoadingUsageStats = ref(false);
  const isLoadingUsageRecords = ref(false);
  const isLoadingSystemHealth = ref(false);
  const isLoadingAlerts = ref(false);
  const isLoadingPerformance = ref(false);
  const isLoadingCompliance = ref(false);
  const isLoadingDashboard = ref(false);
  const isLoadingRealTime = ref(false);
  
  // Error States
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  
  // Filters and Sorting
  const filters = ref<LLMMonitoringFilters>({
    provider: 'all',
    model: 'all',
    status: 'all',
    dataClassification: 'all',
    alertType: 'all',
    alertSeverity: 'all',
    search: ''
  });
  
  const sortOptions = ref<LLMMonitoringSortOptions>({
    field: 'timestamp',
    direction: 'desc'
  });
  
  // Auto-refresh settings
  const autoRefreshEnabled = ref(false);
  const autoRefreshInterval = ref(30000); // 30 seconds
  const autoRefreshTimer = ref<NodeJS.Timeout | null>(null);

  // =====================================
  // GETTERS
  // =====================================
  
  const filteredUsageRecords = computed(() => {
    let filtered = [...usageRecords.value];
    
    // Apply filters
    if (filters.value.provider && filters.value.provider !== 'all') {
      filtered = filtered.filter(record => 
        record.metrics.provider === filters.value.provider
      );
    }
    
    if (filters.value.model && filters.value.model !== 'all') {
      filtered = filtered.filter(record => 
        record.metrics.model === filters.value.model
      );
    }
    
    if (filters.value.status && filters.value.status !== 'all') {
      filtered = filtered.filter(record => record.status === filters.value.status);
    }
    
    if (filters.value.dataClassification && filters.value.dataClassification !== 'all') {
      filtered = filtered.filter(record => 
        record.dataClassification === filters.value.dataClassification
      );
    }
    
    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase();
      filtered = filtered.filter(record =>
        record.id.toLowerCase().includes(searchTerm) ||
        record.metrics.provider.toLowerCase().includes(searchTerm) ||
        record.metrics.model.toLowerCase().includes(searchTerm) ||
        (record.callerType && record.callerType.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const { field, direction } = sortOptions.value;
      let aVal: any;
      let bVal: any;
      
      switch (field) {
        case 'timestamp':
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
          break;
        case 'responseTime':
          aVal = a.metrics.responseTime;
          bVal = b.metrics.responseTime;
          break;
        case 'cost':
          aVal = a.metrics.cost;
          bVal = b.metrics.cost;
          break;
        case 'tokens':
          aVal = a.metrics.totalTokens;
          bVal = b.metrics.totalTokens;
          break;
        case 'provider':
          aVal = a.metrics.provider;
          bVal = b.metrics.provider;
          break;
        case 'model':
          aVal = a.metrics.model;
          bVal = b.metrics.model;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  });
  
  const filteredAlerts = computed(() => {
    let filtered = [...activeAlerts.value];
    
    if (filters.value.alertType && filters.value.alertType !== 'all') {
      filtered = filtered.filter(alert => alert.type === filters.value.alertType);
    }
    
    if (filters.value.alertSeverity && filters.value.alertSeverity !== 'all') {
      filtered = filtered.filter(alert => alert.severity === filters.value.alertSeverity);
    }
    
    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase();
      filtered = filtered.filter(alert =>
        alert.message.toLowerCase().includes(searchTerm) ||
        (alert.modelName && alert.modelName.toLowerCase().includes(searchTerm))
      );
    }
    
    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });
  
  const criticalAlerts = computed(() => 
    activeAlerts.value.filter(alert => alert.severity === 'critical')
  );
  
  const systemHealthStatus = computed(() => {
    if (!systemHealth.value) return 'unknown';
    
    const { ollamaConnected, unhealthyModels } = systemHealth.value;
    const criticalAlertsCount = criticalAlerts.value.length;
    
    if (!ollamaConnected || criticalAlertsCount > 0) return 'critical';
    if (unhealthyModels > 0 || activeAlerts.value.length > 0) return 'warning';
    return 'healthy';
  });
  
  const availableProviders = computed(() => {
    const providers = new Set<string>();
    usageRecords.value.forEach(record => providers.add(record.metrics.provider));
    return Array.from(providers).sort();
  });
  
  const availableModels = computed(() => {
    const models = new Set<string>();
    usageRecords.value.forEach(record => models.add(record.metrics.model));
    return Array.from(models).sort();
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
  // ACTIONS
  // =====================================
  
  /**
   * Load usage statistics
   */
  async function loadUsageStats(request: LLMUsageStatsRequest = {}) {
    isLoadingUsageStats.value = true;
    error.value = null;
    
    try {
      const response = await llmMonitoringService.getUsageStats(request);
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
      const response = await llmMonitoringService.getUsageRecords({
        ...request,
        limit: usageRecordsLimit.value,
        offset: (usageRecordsPage.value - 1) * usageRecordsLimit.value
      });
      
      if (response.success) {
        usageRecords.value = response.data.records;
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
   * Load system health metrics
   */
  async function loadSystemHealth() {
    isLoadingSystemHealth.value = true;
    error.value = null;
    
    try {
      const [healthResponse, statusResponse, modelHealthResponse, memoryResponse] = await Promise.all([
        llmMonitoringService.getSystemHealth(),
        llmMonitoringService.getOperationalStatus(),
        llmMonitoringService.getModelHealthMetrics(),
        llmMonitoringService.getMemoryStats()
      ]);
      
      if (healthResponse.success) {
        systemHealth.value = healthResponse.data;
      }
      
      if (statusResponse.success) {
        operationalStatus.value = statusResponse.data;
      }
      
      modelHealthMetrics.value = modelHealthResponse.data || [];
      memoryStats.value = memoryResponse.data || null;
      
      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load system health';
      console.error('Error loading system health:', err);
    } finally {
      isLoadingSystemHealth.value = false;
    }
  }
  
  /**
   * Load alerts
   */
  async function loadAlerts() {
    isLoadingAlerts.value = true;
    error.value = null;
    
    try {
      const [activeResponse, historyResponse] = await Promise.all([
        llmMonitoringService.getActiveAlerts(),
        llmMonitoringService.getAlertHistory()
      ]);
      
      if (activeResponse.success) {
        activeAlerts.value = activeResponse.data.alerts;
        alertsTotal.value = activeResponse.data.total;
      }
      
      if (historyResponse.success) {
        alertHistory.value = historyResponse.data.alerts;
      }
      
      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load alerts';
      console.error('Error loading alerts:', err);
    } finally {
      isLoadingAlerts.value = false;
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
        llmMonitoringService.getPerformanceMetrics(startDate, endDate),
        llmMonitoringService.getCostAnalysis(startDate, endDate)
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
   * Load compliance metrics
   */
  async function loadComplianceMetrics(startDate?: string, endDate?: string) {
    isLoadingCompliance.value = true;
    error.value = null;
    
    try {
      const response = await llmMonitoringService.getComplianceMetrics(startDate, endDate);
      if (response.success) {
        complianceMetrics.value = response.data;
        lastUpdated.value = new Date();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load compliance metrics';
      console.error('Error loading compliance metrics:', err);
    } finally {
      isLoadingCompliance.value = false;
    }
  }
  
  /**
   * Load dashboard data (aggregated overview)
   */
  async function loadDashboardData(startDate?: string, endDate?: string) {
    isLoadingDashboard.value = true;
    error.value = null;
    
    try {
      const response = await llmMonitoringService.getDashboardData(startDate, endDate);
      if (response.success) {
        dashboardData.value = response.data;
        lastUpdated.value = new Date();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load dashboard data';
      console.error('Error loading dashboard data:', err);
    } finally {
      isLoadingDashboard.value = false;
    }
  }
  
  /**
   * Load real-time metrics
   */
  async function loadRealTimeMetrics() {
    isLoadingRealTime.value = true;
    
    try {
      const metrics = await llmMonitoringService.getRealTimeMetrics();
      realTimeMetrics.value = metrics;
    } catch (err) {
      console.error('Error loading real-time metrics:', err);
      // Don't set error for real-time metrics as they're optional
    } finally {
      isLoadingRealTime.value = false;
    }
  }
  
  /**
   * Acknowledge an alert
   */
  async function acknowledgeAlert(alertId: string) {
    try {
      const response = await llmMonitoringService.acknowledgeAlert(alertId);
      if (response.success) {
        // Remove from active alerts or mark as acknowledged
        const alertIndex = activeAlerts.value.findIndex(alert => alert.id === alertId);
        if (alertIndex !== -1) {
          activeAlerts.value[alertIndex].resolved = true;
          activeAlerts.value[alertIndex].resolvedAt = new Date().toISOString();
        }
      }
      return response;
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      throw err;
    }
  }
  
  /**
   * Clear alert history
   */
  async function clearAlertHistory() {
    try {
      const response = await llmMonitoringService.clearAlertHistory();
      if (response.success) {
        alertHistory.value = [];
      }
      return response;
    } catch (err) {
      console.error('Error clearing alert history:', err);
      throw err;
    }
  }
  
  // =====================================
  // AUTO-REFRESH FUNCTIONALITY
  // =====================================
  
  function startAutoRefresh() {
    if (autoRefreshTimer.value) {
      clearInterval(autoRefreshTimer.value);
    }
    
    autoRefreshEnabled.value = true;
    autoRefreshTimer.value = setInterval(async () => {
      try {
        await Promise.all([
          loadRealTimeMetrics(),
          loadSystemHealth(),
          loadAlerts()
        ]);
      } catch (err) {
        console.error('Error during auto-refresh:', err);
      }
    }, autoRefreshInterval.value);
  }
  
  function stopAutoRefresh() {
    if (autoRefreshTimer.value) {
      clearInterval(autoRefreshTimer.value);
      autoRefreshTimer.value = null;
    }
    autoRefreshEnabled.value = false;
  }
  
  function setAutoRefreshInterval(interval: number) {
    autoRefreshInterval.value = interval;
    if (autoRefreshEnabled.value) {
      startAutoRefresh(); // Restart with new interval
    }
  }
  
  // =====================================
  // FILTER AND SORT ACTIONS
  // =====================================
  
  function updateFilters(newFilters: Partial<LLMMonitoringFilters>) {
    filters.value = { ...filters.value, ...newFilters };
  }
  
  function updateSortOptions(newSortOptions: Partial<LLMMonitoringSortOptions>) {
    sortOptions.value = { ...sortOptions.value, ...newSortOptions };
  }
  
  function clearFilters() {
    filters.value = {
      provider: 'all',
      model: 'all',
      status: 'all',
      dataClassification: 'all',
      alertType: 'all',
      alertSeverity: 'all',
      search: ''
    };
  }
  
  function setUsageRecordsPage(page: number) {
    usageRecordsPage.value = page;
  }
  
  function setUsageRecordsLimit(limit: number) {
    usageRecordsLimit.value = limit;
    usageRecordsPage.value = 1; // Reset to first page
  }
  
  function clearError() {
    error.value = null;
  }
  
  // =====================================
  // UTILITY ACTIONS
  // =====================================
  
  /**
   * Get date range for common periods
   */
  function getDateRange(period: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth') {
    return llmMonitoringService.getDateRange(period);
  }
  
  /**
   * Refresh all data
   */
  async function refreshAllData() {
    const dateRange = getDateRange('last30days');
    
    await Promise.all([
      loadUsageStats(dateRange),
      loadUsageRecords(dateRange),
      loadSystemHealth(),
      loadAlerts(),
      loadPerformanceMetrics(dateRange.startDate, dateRange.endDate),
      loadComplianceMetrics(dateRange.startDate, dateRange.endDate),
      loadDashboardData(dateRange.startDate, dateRange.endDate)
    ]);
  }

  // =====================================
  // RETURN STORE INTERFACE
  // =====================================
  
  return {
    // State
    usageStats,
    usageRecords,
    usageRecordsTotal,
    usageRecordsPage,
    usageRecordsLimit,
    systemHealth,
    operationalStatus,
    modelHealthMetrics,
    memoryStats,
    activeAlerts,
    alertHistory,
    alertsTotal,
    performanceMetrics,
    costAnalysis,
    complianceMetrics,
    dashboardData,
    realTimeMetrics,
    isLoadingUsageStats,
    isLoadingUsageRecords,
    isLoadingSystemHealth,
    isLoadingAlerts,
    isLoadingPerformance,
    isLoadingCompliance,
    isLoadingDashboard,
    isLoadingRealTime,
    error,
    lastUpdated,
    filters,
    sortOptions,
    autoRefreshEnabled,
    autoRefreshInterval,
    
    // Getters
    filteredUsageRecords,
    filteredAlerts,
    criticalAlerts,
    systemHealthStatus,
    availableProviders,
    availableModels,
    totalCostToday,
    averageResponseTime,
    
    // Actions
    loadUsageStats,
    loadUsageRecords,
    loadSystemHealth,
    loadAlerts,
    loadPerformanceMetrics,
    loadComplianceMetrics,
    loadDashboardData,
    loadRealTimeMetrics,
    acknowledgeAlert,
    clearAlertHistory,
    startAutoRefresh,
    stopAutoRefresh,
    setAutoRefreshInterval,
    updateFilters,
    updateSortOptions,
    clearFilters,
    setUsageRecordsPage,
    setUsageRecordsLimit,
    clearError,
    getDateRange,
    refreshAllData
  };
});
