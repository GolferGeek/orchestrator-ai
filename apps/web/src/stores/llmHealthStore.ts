/**
 * LLM Health Store
 *
 * Manages system health monitoring, operational status, alerts, and compliance metrics.
 * This store is focused on health/monitoring concerns only.
 *
 * For usage analytics and cost tracking, see llmAnalyticsStore.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { llmHealthService } from '@/services/llmHealthService';
import {
  SystemHealthMetrics,
  OperationalStatus,
  ComplianceMetrics,
  Alert,
  LLMDashboardData,
  RealTimeMetrics,
  ModelHealthMetrics
} from '@/types/llm-monitoring';

// Alert-specific filters
interface AlertFilters {
  alertType: string;
  alertSeverity: string;
  search: string;
}

// Sort options for alerts
interface AlertSortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export const useLLMHealthStore = defineStore('llmHealth', () => {
  // =====================================
  // STATE
  // =====================================

  // System Health & Status
  const systemHealth = ref<SystemHealthMetrics | null>(null);
  const operationalStatus = ref<OperationalStatus | null>(null);
  const modelHealthMetrics = ref<ModelHealthMetrics[]>([]);
  const memoryStats = ref<SystemHealthMetrics['memoryStats'] | null>(null);

  // Alerts & Notifications
  const activeAlerts = ref<Alert[]>([]);
  const alertHistory = ref<Alert[]>([]);
  const alertsTotal = ref(0);

  // Compliance
  const complianceMetrics = ref<ComplianceMetrics | null>(null);

  // Dashboard & Overview
  const dashboardData = ref<LLMDashboardData | null>(null);
  const realTimeMetrics = ref<RealTimeMetrics | null>(null);

  // Loading States
  const isLoadingSystemHealth = ref(false);
  const isLoadingAlerts = ref(false);
  const isLoadingCompliance = ref(false);
  const isLoadingDashboard = ref(false);
  const isLoadingRealTime = ref(false);

  // Error States
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // Alert Filters and Sorting
  const filters = ref<AlertFilters>({
    alertType: 'all',
    alertSeverity: 'all',
    search: ''
  });

  const sortOptions = ref<AlertSortOptions>({
    field: 'timestamp',
    direction: 'desc'
  });

  // Auto-refresh settings
  const autoRefreshEnabled = ref(false);
  const autoRefreshInterval = ref(30000); // 30 seconds
  const autoRefreshTimer = ref<ReturnType<typeof setInterval> | null>(null);

  // =====================================
  // COMPUTED
  // =====================================

  /**
   * Filtered alerts based on current filter settings
   */
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

  /**
   * Critical alerts only
   */
  const criticalAlerts = computed(() =>
    activeAlerts.value.filter(alert => alert.severity === 'critical')
  );

  /**
   * Overall system health status
   */
  const systemHealthStatus = computed(() => {
    if (!systemHealth.value) return 'unknown';

    const { ollamaConnected, unhealthyModels } = systemHealth.value;
    const criticalAlertsCount = criticalAlerts.value.length;

    if (!ollamaConnected || criticalAlertsCount > 0) return 'critical';
    if (unhealthyModels > 0 || activeAlerts.value.length > 0) return 'warning';
    return 'healthy';
  });

  // =====================================
  // ACTIONS
  // =====================================

  /**
   * Load system health metrics
   */
  async function loadSystemHealth() {
    isLoadingSystemHealth.value = true;
    error.value = null;

    try {
      const [healthResponse, statusResponse, modelHealthResponse, memoryResponse] = await Promise.all([
        llmHealthService.getSystemHealth(),
        llmHealthService.getOperationalStatus(),
        llmHealthService.getModelHealthMetrics(),
        llmHealthService.getMemoryStats()
      ]);

      if (healthResponse.success) {
        systemHealth.value = healthResponse.data;
      }

      if (statusResponse.success) {
        operationalStatus.value = statusResponse.data;
      }

      modelHealthMetrics.value = modelHealthResponse;
      memoryStats.value = memoryResponse;

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
        llmHealthService.getActiveAlerts(),
        llmHealthService.getAlertHistory()
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
   * Load compliance metrics
   */
  async function loadComplianceMetrics(startDate?: string, endDate?: string) {
    isLoadingCompliance.value = true;
    error.value = null;

    try {
      const response = await llmHealthService.getComplianceMetrics(startDate, endDate);
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
      const response = await llmHealthService.getDashboardData(startDate, endDate);
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
      const metrics = await llmHealthService.getRealTimeMetrics();
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
      const response = await llmHealthService.acknowledgeAlert(alertId);
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
      const response = await llmHealthService.clearAlertHistory();
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

  function updateFilters(newFilters: Partial<AlertFilters>) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function updateSortOptions(newSortOptions: Partial<AlertSortOptions>) {
    sortOptions.value = { ...sortOptions.value, ...newSortOptions };
  }

  function clearFilters() {
    filters.value = {
      alertType: 'all',
      alertSeverity: 'all',
      search: ''
    };
  }

  function clearError() {
    error.value = null;
  }

  // =====================================
  // RETURN STORE INTERFACE
  // =====================================

  return {
    // State
    systemHealth,
    operationalStatus,
    modelHealthMetrics,
    memoryStats,
    activeAlerts,
    alertHistory,
    alertsTotal,
    complianceMetrics,
    dashboardData,
    realTimeMetrics,
    isLoadingSystemHealth,
    isLoadingAlerts,
    isLoadingCompliance,
    isLoadingDashboard,
    isLoadingRealTime,
    error,
    lastUpdated,
    filters,
    sortOptions,
    autoRefreshEnabled,
    autoRefreshInterval,

    // Computed
    filteredAlerts,
    criticalAlerts,
    systemHealthStatus,

    // Actions
    loadSystemHealth,
    loadAlerts,
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
    clearError
  };
});
