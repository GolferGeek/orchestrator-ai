import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { analyticsService } from '@/services/analyticsService';
import {
  AnalyticsFilters,
  AnalyticsFiltersUI,
  AnalyticsSortOptions,
  EvaluationAnalytics,
  WorkflowAnalytics,
  ConstraintAnalytics,
  ProjectAnalytics,
  ProjectMetrics,
  UsageStats,
  CostSummary,
  ModelPerformance,
  TaskAnalytics,
  SystemAnalytics,
  BusinessMetrics,
  DashboardData,
  RealTimeAnalytics,
  ReportConfig,
  GeneratedReport,
  AnalyticsEvent,
  TimeRange,
  PerformanceMetric
} from '@/types/analytics';
import type { UnknownRecord } from '@/types';

export const useAnalyticsStore = defineStore('analytics', () => {
  // =====================================
  // STATE
  // =====================================
  
  // Dashboard Data
  const dashboardData = ref<DashboardData | null>(null);
  const realTimeAnalytics = ref<RealTimeAnalytics | null>(null);
  
  // Evaluation Analytics
  const evaluationAnalytics = ref<EvaluationAnalytics | null>(null);
  const workflowAnalytics = ref<WorkflowAnalytics | null>(null);
  const constraintAnalytics = ref<ConstraintAnalytics | null>(null);
  
  // Project Analytics
  const projectAnalytics = ref<Record<string, ProjectAnalytics>>({});
  const projectMetrics = ref<ProjectMetrics | null>(null);
  
  // Usage Analytics
  const usageStats = ref<UsageStats | null>(null);
  const costSummary = ref<CostSummary | null>(null);
  const modelPerformance = ref<ModelPerformance[]>([]);
  
  // Task & System Analytics
  const taskAnalytics = ref<TaskAnalytics | null>(null);
  const systemAnalytics = ref<SystemAnalytics | null>(null);
  const businessMetrics = ref<BusinessMetrics | null>(null);
  
  // Reporting
  const reportConfigs = ref<ReportConfig[]>([]);
  const generatedReports = ref<GeneratedReport[]>([]);
  
  // Event Tracking
  const eventQueue = ref<AnalyticsEvent[]>([]);
  const eventTrackingEnabled = ref(true);
  
  // Loading States
  const isLoadingDashboard = ref(false);
  const isLoadingEvaluation = ref(false);
  const isLoadingProjects = ref(false);
  const isLoadingUsage = ref(false);
  const isLoadingTasks = ref(false);
  const isLoadingSystem = ref(false);
  const isLoadingReports = ref(false);
  const isLoadingRealTime = ref(false);
  
  // Error States
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  
  // Filters and Settings
  const filters = ref<AnalyticsFiltersUI>({
    timeRange: 'last30days',
    userRole: 'all',
    provider: 'all',
    model: 'all',
    project: 'all',
    status: 'all',
    granularity: 'daily',
    includeDetails: false,
    search: ''
  });
  
  const sortOptions = ref<AnalyticsSortOptions>({
    field: 'timestamp',
    direction: 'desc'
  });
  
  // Auto-refresh settings
  const autoRefreshEnabled = ref(false);
  const autoRefreshInterval = ref(30000); // 30 seconds
  const autoRefreshTimer = ref<ReturnType<typeof setInterval> | null>(null);

  // =====================================
  // GETTERS
  // =====================================
  
  const currentTimeRange = computed((): TimeRange => {
    if (filters.value.timeRange === 'custom' && filters.value.customTimeRange) {
      return filters.value.customTimeRange;
    }
    return analyticsService.getDateRange(filters.value.timeRange as 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' || 'last30days');
  });
  
  const isLoading = computed(() => 
    isLoadingDashboard.value || 
    isLoadingEvaluation.value || 
    isLoadingProjects.value || 
    isLoadingUsage.value || 
    isLoadingTasks.value || 
    isLoadingSystem.value
  );
  
  const keyMetrics = computed((): PerformanceMetric[] => {
    if (!dashboardData.value) return [];
    return dashboardData.value.keyMetrics || [];
  });
  
  const systemHealthStatus = computed(() => {
    if (!systemAnalytics.value) return 'unknown';
    return systemAnalytics.value.systemHealth.status;
  });
  
  const totalCostToday = computed(() => {
    if (!usageStats.value) return 0;
    return usageStats.value.totalCost;
  });
  
  const averageResponseTime = computed(() => {
    if (!usageStats.value) return 0;
    return usageStats.value.averageResponseTime;
  });
  
  const topPerformingModels = computed(() => {
    return modelPerformance.value
      .sort((a, b) => b.metrics.performanceScore - a.metrics.performanceScore)
      .slice(0, 5);
  });
  
  const recentActivity = computed(() => {
    if (!dashboardData.value) return [];
    return dashboardData.value.recentActivity || [];
  });
  
  const availableProjects = computed(() => {
    return Object.keys(projectAnalytics.value);
  });
  
  const availableReportTypes = computed(() => {
    const types = new Set<string>();
    reportConfigs.value.forEach(config => types.add(config.type));
    return Array.from(types);
  });

  // =====================================
  // ACTIONS
  // =====================================
  
  /**
   * Load dashboard data (aggregated overview)
   */
  async function loadDashboardData(customFilters?: Partial<AnalyticsFilters>) {
    isLoadingDashboard.value = true;
    error.value = null;
    
    try {
      const filterParams = {
        timeRange: currentTimeRange.value,
        ...customFilters
      };
      
      const response = await analyticsService.getDashboardData(filterParams);
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
   * Load evaluation analytics
   */
  async function loadEvaluationAnalytics(customFilters?: Partial<AnalyticsFilters>) {
    isLoadingEvaluation.value = true;
    error.value = null;
    
    try {
      const filterParams = {
        timeRange: currentTimeRange.value,
        userRole: filters.value.userRole !== 'all' ? filters.value.userRole : undefined,
        ...customFilters
      };
      
      const [evalResponse, workflowResponse, constraintResponse] = await Promise.allSettled([
        analyticsService.getEvaluationAnalytics(filterParams),
        analyticsService.getWorkflowAnalytics(filterParams),
        analyticsService.getConstraintAnalytics(filterParams)
      ]);
      
      if (evalResponse.status === 'fulfilled' && evalResponse.value.success) {
        evaluationAnalytics.value = evalResponse.value.data;
      }
      
      if (workflowResponse.status === 'fulfilled' && workflowResponse.value.success) {
        workflowAnalytics.value = workflowResponse.value.data;
      }
      
      if (constraintResponse.status === 'fulfilled') {
        constraintAnalytics.value = constraintResponse.value;
      }
      
      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load evaluation analytics';
      console.error('Error loading evaluation analytics:', err);
    } finally {
      isLoadingEvaluation.value = false;
    }
  }
  
  /**
   * Load project analytics
   */
  async function loadProjectAnalytics(projectId?: string) {
    isLoadingProjects.value = true;
    error.value = null;
    
    try {
      if (projectId) {
        const response = await analyticsService.getProjectAnalytics(projectId);
        if (response.success) {
          projectAnalytics.value[projectId] = response.data;
        }
      } else {
        const metricsResponse = await analyticsService.getProjectMetrics({
          timeRange: currentTimeRange.value
        });
        projectMetrics.value = metricsResponse;
      }
      
      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load project analytics';
      console.error('Error loading project analytics:', err);
    } finally {
      isLoadingProjects.value = false;
    }
  }
  
  /**
   * Load usage analytics
   */
  async function loadUsageAnalytics(customFilters?: Partial<AnalyticsFilters>) {
    isLoadingUsage.value = true;
    error.value = null;
    
    try {
      const filterParams = {
        timeRange: currentTimeRange.value,
        providerName: filters.value.provider !== 'all' ? filters.value.provider : undefined,
        modelName: filters.value.model !== 'all' ? filters.value.model : undefined,
        granularity: filters.value.granularity,
        includeDetails: filters.value.includeDetails,
        ...customFilters
      };
      
      const [usageResponse, costResponse, modelResponse] = await Promise.allSettled([
        analyticsService.getUserUsageStats(filterParams),
        analyticsService.getCostSummary({ ...filterParams, groupBy: 'provider' }),
        analyticsService.getModelPerformance({ ...filterParams, sortBy: 'rating' })
      ]);
      
      if (usageResponse.status === 'fulfilled' && usageResponse.value.success) {
        usageStats.value = usageResponse.value.data;
      }
      
      if (costResponse.status === 'fulfilled' && costResponse.value.success) {
        costSummary.value = costResponse.value.data;
      }
      
      if (modelResponse.status === 'fulfilled' && modelResponse.value.success) {
        modelPerformance.value = modelResponse.value.data;
      }
      
      lastUpdated.value = new Date();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load usage analytics';
      console.error('Error loading usage analytics:', err);
    } finally {
      isLoadingUsage.value = false;
    }
  }
  
  /**
   * Load task analytics
   */
  async function loadTaskAnalytics() {
    isLoadingTasks.value = true;
    error.value = null;
    
    try {
      const response = await analyticsService.getTaskMetrics();
      if (response.success) {
        taskAnalytics.value = response.data;
        lastUpdated.value = new Date();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load task analytics';
      console.error('Error loading task analytics:', err);
    } finally {
      isLoadingTasks.value = false;
    }
  }
  
  /**
   * Load system analytics
   */
  async function loadSystemAnalytics() {
    isLoadingSystem.value = true;
    error.value = null;
    
    try {
      const response = await analyticsService.getSystemAnalytics();
      if (response.success) {
        systemAnalytics.value = response.data;
        lastUpdated.value = new Date();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load system analytics';
      console.error('Error loading system analytics:', err);
    } finally {
      isLoadingSystem.value = false;
    }
  }
  
  /**
   * Load real-time analytics
   */
  async function loadRealTimeAnalytics() {
    isLoadingRealTime.value = true;
    
    try {
      const response = await analyticsService.getRealTimeAnalytics();
      if (response.success) {
        realTimeAnalytics.value = response.data;
      }
    } catch (err) {
      console.error('Error loading real-time analytics:', err);
      // Don't set error for real-time data as it's optional
    } finally {
      isLoadingRealTime.value = false;
    }
  }
  
  // =====================================
  // REPORTING ACTIONS
  // =====================================
  
  /**
   * Load report configurations
   */
  async function loadReportConfigs() {
    isLoadingReports.value = true;
    error.value = null;
    
    try {
      const configs = await analyticsService.getReportConfigs();
      reportConfigs.value = configs;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load report configs';
      console.error('Error loading report configs:', err);
    } finally {
      isLoadingReports.value = false;
    }
  }
  
  /**
   * Create a new report configuration
   */
  async function createReportConfig(config: Omit<ReportConfig, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const newConfig = await analyticsService.createReportConfig(config);
      reportConfigs.value.push(newConfig);
      return newConfig;
    } catch (err) {
      console.error('Error creating report config:', err);
      throw err;
    }
  }
  
  /**
   * Generate a report
   */
  async function generateReport(configId: string, customFilters?: AnalyticsFilters) {
    try {
      const report = await analyticsService.generateReport(configId, customFilters);
      generatedReports.value.push(report);
      return report;
    } catch (err) {
      console.error('Error generating report:', err);
      throw err;
    }
  }
  
  /**
   * Load generated reports
   */
  async function loadGeneratedReports(configId?: string) {
    try {
      const reports = await analyticsService.getGeneratedReports(configId);
      generatedReports.value = reports;
    } catch (err) {
      console.error('Error loading generated reports:', err);
      throw err;
    }
  }
  
  // =====================================
  // EVENT TRACKING ACTIONS
  // =====================================
  
  /**
   * Track an analytics event
   */
  async function trackEvent(
    eventType: string,
    category: string,
    action: string,
    label?: string,
    value?: number,
    properties?: UnknownRecord
  ) {
    if (!eventTrackingEnabled.value) return;
    
    const event: Omit<AnalyticsEvent, 'id' | 'timestamp'> = {
      eventType,
      category,
      action,
      label,
      value,
      properties: properties ?? {},
      context: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer
      }
    };
    
    try {
      const result = await analyticsService.trackEvent(event);
      if (!result.success) {
        console.warn('Failed to track event:', event);
      }
    } catch (err) {
      console.error('Error tracking event:', err);
      // Add to queue for retry
      eventQueue.value.push({
        ...event,
        id: `queued_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Track page view
   */
  async function trackPageView(pageName: string, additionalProperties?: UnknownRecord) {
    await trackEvent('page_view', 'navigation', 'view', pageName, undefined, {
      page: pageName,
      ...additionalProperties
    });
  }
  
  /**
   * Track user action
   */
  async function trackUserAction(action: string, category: string, label?: string, value?: number) {
    await trackEvent('user_action', category, action, label, value);
  }
  
  /**
   * Track performance metric
   */
  async function trackPerformance(metricName: string, value: number, unit: string) {
    await trackEvent('performance', 'metrics', metricName, unit, value, {
      metric: metricName,
      value,
      unit
    });
  }
  
  /**
   * Flush event queue (retry failed events)
   */
  async function flushEventQueue() {
    if (eventQueue.value.length === 0) return;
    
    const events = [...eventQueue.value];
    eventQueue.value = [];
    
    try {
      const result = await analyticsService.trackEventBatch(events);
      if (!result.success) {
        // Put events back in queue
        eventQueue.value.push(...events);
      }
    } catch (err) {
      console.error('Error flushing event queue:', err);
      // Put events back in queue
      eventQueue.value.push(...events);
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
          loadRealTimeAnalytics(),
          loadSystemAnalytics(),
          flushEventQueue()
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
  
  function updateFilters(newFilters: Partial<AnalyticsFiltersUI>) {
    filters.value = { ...filters.value, ...newFilters };
  }
  
  function updateSortOptions(newSortOptions: Partial<AnalyticsSortOptions>) {
    sortOptions.value = { ...sortOptions.value, ...newSortOptions };
  }
  
  function clearFilters() {
    filters.value = {
      timeRange: 'last30days',
      userRole: 'all',
      provider: 'all',
      model: 'all',
      project: 'all',
      status: 'all',
      granularity: 'daily',
      includeDetails: false,
      search: ''
    };
  }
  
  function setTimeRange(timeRange: AnalyticsFiltersUI['timeRange'], customRange?: TimeRange) {
    filters.value.timeRange = timeRange;
    if (timeRange === 'custom' && customRange) {
      filters.value.customTimeRange = customRange;
    }
  }
  
  function clearError() {
    error.value = null;
  }
  
  // =====================================
  // UTILITY ACTIONS
  // =====================================
  
  /**
   * Refresh all analytics data
   */
  async function refreshAllData() {
    await Promise.all([
      loadDashboardData(),
      loadEvaluationAnalytics(),
      loadUsageAnalytics(),
      loadTaskAnalytics(),
      loadSystemAnalytics(),
      loadProjectAnalytics()
    ]);
  }
  
  /**
   * Export analytics data
   */
  async function exportData(format: 'pdf' | 'excel' | 'csv' | 'json' = 'json') {
    try {
      const result = await analyticsService.exportData({
        format,
        includeCharts: true,
        includeRawData: true,
        dateRange: currentTimeRange.value,
        filters: {
          timeRange: currentTimeRange.value,
          userRole: filters.value.userRole !== 'all' ? filters.value.userRole : undefined,
          providerName: filters.value.provider !== 'all' ? filters.value.provider : undefined,
          modelName: filters.value.model !== 'all' ? filters.value.model : undefined
        },
        sections: ['dashboard', 'evaluation', 'usage', 'projects', 'tasks']
      });
      
      if (result.success && result.downloadUrl) {
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = `analytics_export_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(result.downloadUrl);
      }
      
      return result;
    } catch (err) {
      console.error('Error exporting data:', err);
      throw err;
    }
  }
  
  /**
   * Get formatted date range string
   */
  function getFormattedDateRange(): string {
    const range = currentTimeRange.value;
    const start = new Date(range.startDate).toLocaleDateString();
    const end = new Date(range.endDate).toLocaleDateString();
    return `${start} - ${end}`;
  }

  // =====================================
  // RETURN STORE INTERFACE
  // =====================================
  
  return {
    // State
    dashboardData,
    realTimeAnalytics,
    evaluationAnalytics,
    workflowAnalytics,
    constraintAnalytics,
    projectAnalytics,
    projectMetrics,
    usageStats,
    costSummary,
    modelPerformance,
    taskAnalytics,
    systemAnalytics,
    businessMetrics,
    reportConfigs,
    generatedReports,
    eventQueue,
    eventTrackingEnabled,
    isLoadingDashboard,
    isLoadingEvaluation,
    isLoadingProjects,
    isLoadingUsage,
    isLoadingTasks,
    isLoadingSystem,
    isLoadingReports,
    isLoadingRealTime,
    error,
    lastUpdated,
    filters,
    sortOptions,
    autoRefreshEnabled,
    autoRefreshInterval,
    
    // Getters
    currentTimeRange,
    isLoading,
    keyMetrics,
    systemHealthStatus,
    totalCostToday,
    averageResponseTime,
    topPerformingModels,
    recentActivity,
    availableProjects,
    availableReportTypes,
    
    // Actions
    loadDashboardData,
    loadEvaluationAnalytics,
    loadProjectAnalytics,
    loadUsageAnalytics,
    loadTaskAnalytics,
    loadSystemAnalytics,
    loadRealTimeAnalytics,
    loadReportConfigs,
    createReportConfig,
    generateReport,
    loadGeneratedReports,
    trackEvent,
    trackPageView,
    trackUserAction,
    trackPerformance,
    flushEventQueue,
    startAutoRefresh,
    stopAutoRefresh,
    setAutoRefreshInterval,
    updateFilters,
    updateSortOptions,
    clearFilters,
    setTimeRange,
    clearError,
    refreshAllData,
    exportData,
    getFormattedDateRange
  };
});
