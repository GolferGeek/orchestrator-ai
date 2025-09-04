// Enhanced Store Composables
// Provides easy access to our new Pinia stores with integrated functionality

import { computed } from 'vue';
import { usePIIPatternsStore } from '@/stores/piiPatternsStore';
import { usePseudonymDictionariesStore } from '@/stores/pseudonymDictionariesStore';
import { useLLMMonitoringStore } from '@/stores/llmMonitoringStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { createUnifiedStoreInterface, useStoreAutoRefresh } from './useStoreIntegration';

/**
 * Composable for PII management functionality
 * Combines PII patterns and pseudonym dictionaries stores
 */
export function usePIIManagement() {
  const piiPatternsStore = usePIIPatternsStore();
  const pseudonymStore = usePseudonymDictionariesStore();

  // Unified loading state
  const isLoading = computed(() => {
    return piiPatternsStore.isLoading || pseudonymStore.isLoading;
  });

  // Unified error state
  const hasError = computed(() => {
    return piiPatternsStore.error !== null || pseudonymStore.error !== null;
  });

  const firstError = computed(() => {
    return piiPatternsStore.error || pseudonymStore.error;
  });

  // Combined refresh function
  const refreshAll = async () => {
    await Promise.all([
      piiPatternsStore.loadPatterns(),
      pseudonymStore.loadDictionaries()
    ]);
  };

  // Combined clear errors
  const clearAllErrors = () => {
    piiPatternsStore.clearError();
    pseudonymStore.clearError();
  };

  // PII testing functionality
  const testPIIDetection = async (input: string) => {
    return await piiPatternsStore.testPattern('', input);
  };

  // Pseudonym generation
  const generatePseudonyms = async (values: string[], dataType: string) => {
    return await pseudonymStore.generatePseudonym({
      values,
      dataType,
      preserveFormat: true,
      context: 'user_input'
    });
  };

  // Get statistics for both stores
  const getStatistics = async () => {
    await Promise.all([
      piiPatternsStore.loadStatistics(),
      pseudonymStore.loadStatistics()
    ]);

    return {
      piiPatterns: piiPatternsStore.statistics,
      pseudonymDictionaries: pseudonymStore.statistics
    };
  };

  return {
    // Stores
    piiPatternsStore,
    pseudonymStore,
    
    // Combined state
    isLoading,
    hasError,
    firstError,
    
    // Actions
    refreshAll,
    clearAllErrors,
    testPIIDetection,
    generatePseudonyms,
    getStatistics
  };
}

/**
 * Composable for monitoring and analytics
 * Combines LLM monitoring and analytics stores
 */
export function useMonitoringAnalytics() {
  const llmMonitoringStore = useLLMMonitoringStore();
  const analyticsStore = useAnalyticsStore();

  // Unified interface
  const unified = createUnifiedStoreInterface({
    monitoring: llmMonitoringStore,
    analytics: analyticsStore
  });

  // Auto-refresh functionality
  const { isAutoRefreshEnabled, toggleAutoRefresh, refreshNow } = useStoreAutoRefresh([
    () => llmMonitoringStore.loadUsageRecords(),
    () => llmMonitoringStore.loadSystemHealth(),
    () => analyticsStore.fetchDashboardData(),
    () => analyticsStore.fetchRealTimeAnalytics()
  ], 30000); // 30 second refresh

  // Combined dashboard data
  const dashboardData = computed(() => {
    return {
      systemHealth: llmMonitoringStore.systemHealth,
      usageStats: {
        totalRequests: llmMonitoringStore.totalRequests,
        totalCost: llmMonitoringStore.totalCost,
        averageResponseTime: llmMonitoringStore.averageResponseTime,
        successRate: llmMonitoringStore.successRate
      },
      analytics: analyticsStore.dashboardData,
      alerts: llmMonitoringStore.activeAlerts,
      recentActivity: analyticsStore.recentActivity
    };
  });

  // System health status
  const systemHealthStatus = computed(() => {
    const health = llmMonitoringStore.systemHealth;
    if (!health) return 'unknown';
    
    if (health.healthyModels === health.totalModels) return 'healthy';
    if (health.healthyModels / health.totalModels > 0.7) return 'warning';
    return 'critical';
  });

  // Cost analysis
  const costAnalysis = computed(() => {
    const analytics = analyticsStore.dashboardData;
    const monitoring = llmMonitoringStore.usageRecords;
    
    if (!analytics || !monitoring.length) return null;

    const totalCost = monitoring.reduce((sum, record) => sum + (record.cost || 0), 0);
    const avgCostPerRequest = totalCost / monitoring.length;
    
    return {
      totalCost,
      avgCostPerRequest,
      costTrend: analytics.overview?.costTrend || 0,
      topCostProviders: monitoring
        .reduce((acc, record) => {
          const provider = record.provider || 'unknown';
          acc[provider] = (acc[provider] || 0) + (record.cost || 0);
          return acc;
        }, {} as Record<string, number>)
    };
  });

  return {
    // Stores
    llmMonitoringStore,
    analyticsStore,
    
    // Unified interface
    ...unified,
    
    // Auto-refresh
    isAutoRefreshEnabled,
    toggleAutoRefresh,
    refreshNow,
    
    // Combined data
    dashboardData,
    systemHealthStatus,
    costAnalysis
  };
}

/**
 * Composable for comprehensive system overview
 * Combines all stores for a complete system view
 */
export function useSystemOverview() {
  const piiManagement = usePIIManagement();
  const monitoringAnalytics = useMonitoringAnalytics();

  // Overall system health
  const systemHealth = computed(() => {
    const components = {
      piiPatterns: !piiManagement.piiPatternsStore.error,
      pseudonymDictionaries: !piiManagement.pseudonymStore.error,
      llmMonitoring: !monitoringAnalytics.llmMonitoringStore.error,
      analytics: !monitoringAnalytics.analyticsStore.error
    };

    const healthyComponents = Object.values(components).filter(Boolean).length;
    const totalComponents = Object.keys(components).length;
    const healthPercentage = (healthyComponents / totalComponents) * 100;

    let status: 'healthy' | 'warning' | 'critical';
    if (healthPercentage === 100) status = 'healthy';
    else if (healthPercentage >= 75) status = 'warning';
    else status = 'critical';

    return {
      status,
      healthPercentage,
      components,
      healthyComponents,
      totalComponents
    };
  });

  // System metrics summary
  const systemMetrics = computed(() => {
    return {
      piiPatterns: {
        total: piiManagement.piiPatternsStore.patterns.length,
        enabled: piiManagement.piiPatternsStore.enabledPatterns.length,
        custom: piiManagement.piiPatternsStore.customPatterns.length
      },
      pseudonymDictionaries: {
        total: piiManagement.pseudonymStore.dictionaries.length,
        active: piiManagement.pseudonymStore.activeDictionaries.length,
        totalWords: piiManagement.pseudonymStore.totalWords
      },
      llmUsage: {
        totalRequests: monitoringAnalytics.llmMonitoringStore.totalRequests,
        totalCost: monitoringAnalytics.llmMonitoringStore.totalCost,
        averageResponseTime: monitoringAnalytics.llmMonitoringStore.averageResponseTime,
        successRate: monitoringAnalytics.llmMonitoringStore.successRate
      },
      analytics: {
        recentEvents: monitoringAnalytics.analyticsStore.eventQueue.length,
        reportCount: monitoringAnalytics.analyticsStore.reportConfigs.length
      }
    };
  });

  // Overall loading state
  const isLoading = computed(() => {
    return piiManagement.isLoading || monitoringAnalytics.isLoading;
  });

  // Overall error state
  const hasError = computed(() => {
    return piiManagement.hasError || monitoringAnalytics.hasError;
  });

  // Refresh everything
  const refreshAll = async () => {
    await Promise.all([
      piiManagement.refreshAll(),
      monitoringAnalytics.refreshAll()
    ]);
  };

  // Initialize all stores
  const initializeAll = async () => {
    await Promise.all([
      piiManagement.piiPatternsStore.loadPatterns(),
      piiManagement.pseudonymStore.loadDictionaries(),
      monitoringAnalytics.llmMonitoringStore.loadUsageRecords(),
      monitoringAnalytics.llmMonitoringStore.loadSystemHealth(),
      monitoringAnalytics.analyticsStore.fetchDashboardData()
    ]);
  };

  return {
    // Sub-composables
    piiManagement,
    monitoringAnalytics,
    
    // System overview
    systemHealth,
    systemMetrics,
    
    // Combined state
    isLoading,
    hasError,
    
    // Actions
    refreshAll,
    initializeAll
  };
}

/**
 * Composable for admin dashboard functionality
 * Provides everything needed for administrative views
 */
export function useAdminDashboard() {
  const systemOverview = useSystemOverview();
  const { monitoringAnalytics } = systemOverview;

  // Dashboard-specific auto-refresh (more frequent for admin views)
  const { isAutoRefreshEnabled, toggleAutoRefresh, refreshNow } = useStoreAutoRefresh([
    () => systemOverview.refreshAll()
  ], 15000); // 15 second refresh for admin dashboard

  // Admin metrics
  const adminMetrics = computed(() => {
    const metrics = systemOverview.systemMetrics;
    const health = systemOverview.systemHealth;
    const dashboard = monitoringAnalytics.dashboardData;

    return {
      systemHealth: health.status,
      healthPercentage: health.healthPercentage,
      
      // Usage metrics
      totalRequests: metrics.llmUsage.totalRequests,
      totalCost: metrics.llmUsage.totalCost,
      averageResponseTime: metrics.llmUsage.averageResponseTime,
      successRate: metrics.llmUsage.successRate,
      
      // PII metrics
      totalPIIPatterns: metrics.piiPatterns.total,
      enabledPatterns: metrics.piiPatterns.enabled,
      customPatterns: metrics.piiPatterns.custom,
      
      // Pseudonym metrics
      totalDictionaries: metrics.pseudonymDictionaries.total,
      activeDictionaries: metrics.pseudonymDictionaries.active,
      totalWords: metrics.pseudonymDictionaries.totalWords,
      
      // Analytics
      eventQueueSize: metrics.analytics.recentEvents,
      reportCount: metrics.analytics.reportCount,
      
      // Additional admin data
      activeAlerts: monitoringAnalytics.llmMonitoringStore.activeAlerts.length,
      criticalAlerts: monitoringAnalytics.llmMonitoringStore.activeAlerts.filter(
        alert => alert.severity === 'critical'
      ).length,
      
      // Cost analysis
      costAnalysis: monitoringAnalytics.costAnalysis
    };
  });

  // Admin actions
  const adminActions = {
    // System actions
    refreshSystem: systemOverview.refreshAll,
    initializeSystem: systemOverview.initializeAll,
    
    // PII actions
    refreshPIIData: systemOverview.piiManagement.refreshAll,
    testPIIDetection: systemOverview.piiManagement.testPIIDetection,
    
    // Analytics actions
    generateReport: monitoringAnalytics.analyticsStore.generateReport,
    exportData: async (type: string, format: string) => {
      // Implementation would depend on the specific export requirements
      console.log(`Exporting ${type} data in ${format} format`);
    },
    
    // Monitoring actions
    acknowledgeAlert: (alertId: string) => {
      monitoringAnalytics.llmMonitoringStore.acknowledgeAlert(alertId);
    },
    dismissAlert: (alertId: string) => {
      monitoringAnalytics.llmMonitoringStore.dismissAlert(alertId);
    }
  };

  return {
    // System overview
    ...systemOverview,
    
    // Admin-specific data
    adminMetrics,
    
    // Auto-refresh for admin dashboard
    isAutoRefreshEnabled,
    toggleAutoRefresh,
    refreshNow,
    
    // Admin actions
    ...adminActions
  };
}

/**
 * Composable for user-facing PII tools
 * Provides simplified interface for end users
 */
export function usePIITools() {
  const { piiPatternsStore, pseudonymStore, testPIIDetection, generatePseudonyms } = usePIIManagement();

  // Simplified PII detection
  const detectPII = async (text: string) => {
    const results = await testPIIDetection(text);
    return {
      hasPII: results.matches.length > 0,
      matches: results.matches,
      sanitizedText: results.sanitized,
      detectedTypes: [...new Set(results.matches.map(match => match.dataType))]
    };
  };

  // Simplified pseudonymization
  const pseudonymizeText = async (text: string, preserveFormat: boolean = true) => {
    // First detect PII
    const detection = await detectPII(text);
    
    if (!detection.hasPII) {
      return {
        originalText: text,
        pseudonymizedText: text,
        hasChanges: false,
        replacements: []
      };
    }

    // Extract unique values by type
    const valuesByType = detection.matches.reduce((acc, match) => {
      if (!acc[match.dataType]) {
        acc[match.dataType] = new Set();
      }
      acc[match.dataType].add(match.value);
      return acc;
    }, {} as Record<string, Set<string>>);

    // Generate pseudonyms for each type
    const replacements: Array<{ original: string; pseudonym: string; type: string }> = [];
    let pseudonymizedText = text;

    for (const [dataType, values] of Object.entries(valuesByType)) {
      const valuesArray = Array.from(values);
      const pseudonymResults = await generatePseudonyms(valuesArray, dataType);
      
      for (const result of pseudonymResults.results) {
        replacements.push({
          original: result.originalValue,
          pseudonym: result.pseudonym,
          type: dataType
        });
        
        // Replace all occurrences in text
        const regex = new RegExp(escapeRegExp(result.originalValue), 'g');
        pseudonymizedText = pseudonymizedText.replace(regex, result.pseudonym);
      }
    }

    return {
      originalText: text,
      pseudonymizedText,
      hasChanges: replacements.length > 0,
      replacements,
      detectedTypes: detection.detectedTypes
    };
  };

  // Helper function to escape regex special characters
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Get available data types for UI
  const availableDataTypes = computed(() => {
    return piiPatternsStore.availableDataTypes || [];
  });

  // Get available categories for UI
  const availableCategories = computed(() => {
    return piiPatternsStore.availableCategories || [];
  });

  return {
    // Simplified functions
    detectPII,
    pseudonymizeText,
    
    // UI helpers
    availableDataTypes,
    availableCategories,
    
    // Store access for advanced users
    piiPatternsStore,
    pseudonymStore
  };
}
