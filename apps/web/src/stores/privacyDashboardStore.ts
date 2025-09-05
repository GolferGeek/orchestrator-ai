import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  sanitizationAnalyticsService, 
  type PrivacyDashboardData, 
  type DashboardFilters,
  type PrivacyMetrics,
  type DetectionStats,
  type PatternUsageStats,
  type SanitizationMethodStats,
  type PerformanceDataPoint,
  type SystemHealth,
  type ActivityLog
} from '@/services/sanitizationAnalyticsService';

export const usePrivacyDashboardStore = defineStore('privacyDashboard', () => {
  // State
  const dashboardData = ref<PrivacyDashboardData | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const autoRefreshInterval = ref<NodeJS.Timeout | null>(null);
  
  // Filters
  const filters = ref<DashboardFilters>({
    timeRange: '7d',
    dataType: ['all'],
    includeSystemEvents: true
  });

  // Computed properties
  const metrics = computed<PrivacyMetrics | null>(() => dashboardData.value?.metrics || null);
  const detectionStats = computed<DetectionStats[]>(() => dashboardData.value?.detectionStats || []);
  const patternUsage = computed<PatternUsageStats[]>(() => dashboardData.value?.patternUsage || []);
  const sanitizationMethods = computed<SanitizationMethodStats[]>(() => dashboardData.value?.sanitizationMethods || []);
  const performanceData = computed<PerformanceDataPoint[]>(() => dashboardData.value?.performanceData || []);
  const systemHealth = computed<SystemHealth | null>(() => dashboardData.value?.systemHealth || null);
  const recentActivity = computed<ActivityLog[]>(() => dashboardData.value?.recentActivity || []);
  
  const hasData = computed(() => dashboardData.value !== null);
  const isHealthy = computed(() => {
    if (!systemHealth.value) return false;
    return systemHealth.value.apiStatus === 'operational' && 
           systemHealth.value.dbStatus === 'operational';
  });

  // Actions
  async function fetchDashboardData(forceRefresh: boolean = false): Promise<void> {
    if (isLoading.value && !forceRefresh) return;

    isLoading.value = true;
    error.value = null;

    try {
      const data = await sanitizationAnalyticsService.getPrivacyDashboardData(filters.value);
      dashboardData.value = data;
      lastUpdated.value = new Date();
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      error.value = err.message || 'Failed to fetch dashboard data';
      
      // Don't clear existing data on error, just show error state
      if (!dashboardData.value) {
        dashboardData.value = null;
      }
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshData(): Promise<void> {
    await fetchDashboardData(true);
  }

  async function updateFilters(newFilters: Partial<DashboardFilters>): Promise<void> {
    // Update filters
    filters.value = {
      ...filters.value,
      ...newFilters
    };

    // Fetch new data with updated filters
    await fetchDashboardData(true);
  }

  function startAutoRefresh(intervalMs: number = 30000): void {
    stopAutoRefresh(); // Clear any existing interval
    
    autoRefreshInterval.value = setInterval(async () => {
      if (!isLoading.value) {
        await fetchDashboardData(true);
      }
    }, intervalMs);
  }

  function stopAutoRefresh(): void {
    if (autoRefreshInterval.value) {
      clearInterval(autoRefreshInterval.value);
      autoRefreshInterval.value = null;
    }
  }

  async function getSystemHealth(): Promise<SystemHealth | null> {
    try {
      const health = await sanitizationAnalyticsService.getSystemHealth();
      
      // Update the system health in dashboard data if it exists
      if (dashboardData.value) {
        dashboardData.value.systemHealth = health;
      }
      
      return health;
    } catch (err: any) {
      console.error('Failed to fetch system health:', err);
      return null;
    }
  }

  async function getRecentActivity(limit: number = 10): Promise<ActivityLog[]> {
    try {
      const activity = await sanitizationAnalyticsService.getRecentActivity(limit);
      
      // Update the recent activity in dashboard data if it exists
      if (dashboardData.value) {
        dashboardData.value.recentActivity = activity;
      }
      
      return activity;
    } catch (err: any) {
      console.error('Failed to fetch recent activity:', err);
      return [];
    }
  }

  function clearError(): void {
    error.value = null;
  }

  function clearData(): void {
    dashboardData.value = null;
    lastUpdated.value = null;
    error.value = null;
  }

  // Utility functions for formatting data
  function formatNumber(value: number): string {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(value);
  }

  function formatDateTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString();
  }

  function formatRelativeTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return dateObj.toLocaleDateString();
  }

  // Return store interface
  return {
    // State
    dashboardData,
    isLoading,
    error,
    lastUpdated,
    filters,
    
    // Computed
    metrics,
    detectionStats,
    patternUsage,
    sanitizationMethods,
    performanceData,
    systemHealth,
    recentActivity,
    hasData,
    isHealthy,
    
    // Actions
    fetchDashboardData,
    refreshData,
    updateFilters,
    startAutoRefresh,
    stopAutoRefresh,
    getSystemHealth,
    getRecentActivity,
    clearError,
    clearData,
    
    // Utilities
    formatNumber,
    formatCurrency,
    formatDateTime,
    formatRelativeTime
  };
});
