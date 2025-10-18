import { apiService } from './apiService';
import {
  AnalyticsFilters,
  // AnalyticsRequest,
  EvaluationAnalyticsResponse,
  WorkflowAnalyticsResponse,
  ProjectAnalyticsResponse,
  UsageStatsResponse,
  CostSummaryResponse,
  ModelPerformanceResponse,
  TaskAnalyticsResponse,
  SystemAnalyticsResponse,
  // BusinessMetricsResponse,
  DashboardDataResponse,
  RealTimeAnalyticsResponse,
  ReportConfig,
  GeneratedReport,
  AnalyticsEvent,
  TimeRange,
  ExportConfig
} from '@/types/analytics';

class AnalyticsService {
  // =====================================
  // EVALUATION ANALYTICS
  // =====================================

  /**
   * Get comprehensive evaluation analytics (Admin only)
   */
  async getEvaluationAnalytics(filters: AnalyticsFilters = {}): Promise<EvaluationAnalyticsResponse> {
    try {
      const params = new URLSearchParams();
      if (filters.timeRange?.startDate) params.append('startDate', filters.timeRange.startDate);
      if (filters.timeRange?.endDate) params.append('endDate', filters.timeRange.endDate);
      if (filters.userRole) params.append('userRole', filters.userRole);

      const response = await apiService.get(`/evaluation/admin/analytics/overview?${params.toString()}`);
      return {
        success: true,
        data: response,
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching evaluation analytics:', error);
      throw error;
    }
  }

  /**
   * Get workflow-specific analytics
   */
  async getWorkflowAnalytics(filters: AnalyticsFilters = {}): Promise<WorkflowAnalyticsResponse> {
    try {
      const params = new URLSearchParams();
      if (filters.timeRange?.startDate) params.append('startDate', filters.timeRange.startDate);
      if (filters.timeRange?.endDate) params.append('endDate', filters.timeRange.endDate);

      const response = await apiService.get(`/evaluation/admin/analytics/workflow?${params.toString()}`);
      return {
        success: true,
        data: response,
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching workflow analytics:', error);
      throw error;
    }
  }

  /**
   * Get constraint effectiveness analytics
   */
  async getConstraintAnalytics(filters: AnalyticsFilters = {}): Promise<unknown> {
    try {
      const params = new URLSearchParams();
      if (filters.timeRange?.startDate) params.append('startDate', filters.timeRange.startDate);
      if (filters.timeRange?.endDate) params.append('endDate', filters.timeRange.endDate);

      const response = await apiService.get(`/evaluation/admin/analytics/constraints?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error fetching constraint analytics:', error);
      throw error;
    }
  }

  // =====================================
  // PROJECT ANALYTICS
  // =====================================

  /**
   * Get analytics for a specific project
   */
  async getProjectAnalytics(projectId: string): Promise<ProjectAnalyticsResponse> {
    try {
      const response = await apiService.get(`/projects/${projectId}/analytics`);
      return {
        success: true,
        data: response,
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching project analytics:', error);
      throw error;
    }
  }

  /**
   * Get aggregated project metrics
   */
  async getProjectMetrics(filters: AnalyticsFilters = {}): Promise<unknown> {
    try {
      const params = new URLSearchParams();
      if (filters.timeRange?.startDate) params.append('startDate', filters.timeRange.startDate);
      if (filters.timeRange?.endDate) params.append('endDate', filters.timeRange.endDate);
      if (filters.userId) params.append('userId', filters.userId);

      const response = await apiService.get(`/projects/analytics/metrics?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error fetching project metrics:', error);
      throw error;
    }
  }

  // =====================================
  // USAGE ANALYTICS
  // =====================================

  /**
   * Get user usage statistics
   */
  async getUserUsageStats(filters: AnalyticsFilters = {}): Promise<UsageStatsResponse> {
    try {
      const params = new URLSearchParams();
      if (filters.timeRange?.startDate) params.append('start_date', filters.timeRange.startDate);
      if (filters.timeRange?.endDate) params.append('end_date', filters.timeRange.endDate);
      if (filters.providerName) params.append('provider_name', filters.providerName);
      if (filters.modelName) params.append('model_name', filters.modelName);
      if (filters.includeDetails !== undefined) params.append('include_details', filters.includeDetails.toString());
      if (filters.granularity) params.append('granularity', filters.granularity);

      const response = await apiService.get(`/usage/stats?${params.toString()}`);
      return {
        success: true,
        data: response,
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      throw error;
    }
  }

  /**
   * Get cost summary and breakdown
   */
  async getCostSummary(filters: AnalyticsFilters & { groupBy?: 'provider' | 'model' | 'date' } = {}): Promise<CostSummaryResponse> {
    try {
      const params = new URLSearchParams();
      if (filters.timeRange?.startDate) params.append('start_date', filters.timeRange.startDate);
      if (filters.timeRange?.endDate) params.append('end_date', filters.timeRange.endDate);
      if (filters.groupBy) params.append('group_by', filters.groupBy);

      const response = await apiService.get(`/usage/costs/summary?${params.toString()}`);
      return {
        success: true,
        data: response,
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching cost summary:', error);
      throw error;
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelPerformance(filters: AnalyticsFilters & { 
    minUsage?: number; 
    sortBy?: 'rating' | 'speed' | 'cost' | 'usage' 
  } = {}): Promise<ModelPerformanceResponse> {
    try {
      const params = new URLSearchParams();
      if (filters.timeRange?.startDate) params.append('start_date', filters.timeRange.startDate);
      if (filters.timeRange?.endDate) params.append('end_date', filters.timeRange.endDate);
      if (filters.minUsage) params.append('min_usage', filters.minUsage.toString());
      if (filters.sortBy) params.append('sort_by', filters.sortBy);

      const response = await apiService.get(`/usage/performance/models?${params.toString()}`);
      return {
        success: true,
        data: response,
        metadata: {
          totalRecords: response.length || 0,
          filteredRecords: response.length || 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching model performance:', error);
      throw error;
    }
  }

  // =====================================
  // LLM USAGE ANALYTICS
  // =====================================

  /**
   * Get LLM usage records
   */
  async getLLMUsageRecords(filters: AnalyticsFilters & { 
    userId?: string;
    callerType?: string;
    callerName?: string;
    conversationId?: string;
    limit?: number;
  } = {}): Promise<unknown> {
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.callerType) params.append('callerType', filters.callerType);
      if (filters.callerName) params.append('callerName', filters.callerName);
      if (filters.conversationId) params.append('conversationId', filters.conversationId);
      if (filters.timeRange?.startDate) params.append('startDate', filters.timeRange.startDate);
      if (filters.timeRange?.endDate) params.append('endDate', filters.timeRange.endDate);
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await apiService.get(`/api/llm-usage/records?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error fetching LLM usage records:', error);
      throw error;
    }
  }

  /**
   * Get LLM usage analytics
   */
  async getLLMUsageAnalytics(filters: AnalyticsFilters & { callerType?: string } = {}): Promise<unknown> {
    try {
      const params = new URLSearchParams();
      if (filters.timeRange?.startDate) params.append('startDate', filters.timeRange.startDate);
      if (filters.timeRange?.endDate) params.append('endDate', filters.timeRange.endDate);
      if (filters.callerType) params.append('callerType', filters.callerType);

      const response = await apiService.get(`/api/llm-usage/analytics?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error fetching LLM usage analytics:', error);
      throw error;
    }
  }

  /**
   * Get LLM service statistics
   */
  async getLLMServiceStats(): Promise<unknown> {
    try {
      const response = await apiService.get('/api/llm-usage/stats');
      return response;
    } catch (error) {
      console.error('Error fetching LLM service stats:', error);
      throw error;
    }
  }

  // =====================================
  // TASK ANALYTICS
  // =====================================

  /**
   * Get task execution metrics
   */
  async getTaskMetrics(): Promise<TaskAnalyticsResponse> {
    try {
      // This would need to be implemented in the backend
      const response = await apiService.get('/tasks/metrics');
      return {
        success: true,
        data: response,
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching task metrics:', error);
      // Return empty data structure when API fails
      return {
        success: true,
        data: {
          totalTasks: 0,
          tasksByStatus: {},
          averageTaskDuration: 0,
          taskCompletionRate: 0,
          taskFailureRate: 0,
          taskTrends: [],
          topFailureReasons: [],
          performanceMetrics: {
            averageResponseTime: 0,
            p95ResponseTime: 0,
            throughput: 0,
            errorRate: 0
          }
        },
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    }
  }

  // =====================================
  // SYSTEM ANALYTICS
  // =====================================

  /**
   * Get system health and performance analytics
   */
  async getSystemAnalytics(): Promise<SystemAnalyticsResponse> {
    try {
      // This would need to be implemented in the backend
      const response = await apiService.get('/system/analytics');
      return {
        success: true,
        data: response,
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching system analytics:', error);
      // Return empty data structure when API fails
      return {
        success: true,
        data: {
          systemHealth: {
            status: 'healthy' as const,
            uptime: 0,
            lastHealthCheck: new Date().toISOString(),
            issues: []
          },
          resourceUtilization: {
            cpu: 0,
            memory: 0,
            disk: 0,
            network: 0
          },
          serviceStatus: [],
          errorRates: []
        },
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    }
  }

  // =====================================
  // DASHBOARD ANALYTICS
  // =====================================

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(filters: AnalyticsFilters = {}): Promise<DashboardDataResponse> {
    try {
      const [
        _evaluationAnalytics,
        usageStats,
        _projectMetrics,
        _taskMetrics,
        systemAnalytics
      ] = await Promise.allSettled([
        this.getEvaluationAnalytics(filters),
        this.getUserUsageStats(filters),
        this.getProjectMetrics(filters),
        this.getTaskMetrics(),
        this.getSystemAnalytics()
      ]);

      // Aggregate data from multiple sources
      const dashboardData = {
        overview: {
          totalUsers: 0, // Would need user analytics endpoint
          totalProjects: 0,
          totalTasks: 0,
          totalCost: 0,
          systemHealth: 'healthy' as const,
          activeAlerts: 0
        },
        keyMetrics: [
          {
            name: 'Average Response Time',
            value: 0,
            unit: 'ms',
            trend: 'stable' as const,
            changePercentage: 0,
            status: 'good' as const
          }
        ],
        recentActivity: [],
        trends: {
          userGrowth: [],
          costTrends: [],
          performanceTrends: [],
          errorRates: []
        },
        topPerformers: {
          models: [],
          users: [],
          projects: []
        }
      };

      // Populate data from successful API calls
      if (usageStats.status === 'fulfilled') {
        dashboardData.overview.totalCost = usageStats.value.data.totalCost || 0;
      }

      if (systemAnalytics.status === 'fulfilled') {
        dashboardData.overview.systemHealth = systemAnalytics.value.data.health?.status as 'healthy' | 'warning' | 'critical' || 'warning';
      }

      return {
        success: true,
        data: dashboardData,
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }

  // =====================================
  // REAL-TIME ANALYTICS
  // =====================================

  /**
   * Get real-time analytics data
   */
  async getRealTimeAnalytics(): Promise<RealTimeAnalyticsResponse> {
    try {
      const [_llmStats, taskMetrics] = await Promise.allSettled([
        this.getLLMServiceStats(),
        this.getTaskMetrics()
      ]);

      const realTimeData = {
        currentStats: {
          activeUsers: 0, // Would need real-time user tracking
          runningTasks: 0,
          requestsPerMinute: 0,
          averageResponseTime: 0,
          errorRate: 0,
          systemLoad: 0
        },
        liveMetrics: [],
        recentEvents: [],
        alerts: []
      };

      // Populate from available data
      if (taskMetrics.status === 'fulfilled') {
        realTimeData.currentStats.runningTasks = taskMetrics.value.data.performanceMetrics?.activeTasks || 0;
        realTimeData.currentStats.averageResponseTime = taskMetrics.value.data.averageTaskDuration || 0;
      }

      return {
        success: true,
        data: realTimeData,
        metadata: {
          totalRecords: 0,
          filteredRecords: 0,
          processingTime: 0,
          cacheHit: false,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching real-time analytics:', error);
      throw error;
    }
  }

  // =====================================
  // EVENT TRACKING
  // =====================================

  /**
   * Track an analytics event
   */
  async trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<{ success: boolean; eventId?: string }> {
    try {
      const fullEvent: AnalyticsEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: new Date().toISOString()
      };

      // Send to backend analytics endpoint
      const _response = await apiService.post('/analytics/events', fullEvent);
      return {
        success: true,
        eventId: fullEvent.id
      };
    } catch (error) {
      console.error('Error tracking event:', error);
      // Don't throw error for analytics tracking to avoid breaking user experience
      return { success: false };
    }
  }

  /**
   * Track multiple events in batch
   */
  async trackEventBatch(events: Array<Omit<AnalyticsEvent, 'id' | 'timestamp'>>): Promise<{ success: boolean; eventIds?: string[] }> {
    try {
      const fullEvents = events.map(event => ({
        ...event,
        id: this.generateEventId(),
        timestamp: new Date().toISOString()
      }));

      const _response = await apiService.post('/analytics/events/batch', { events: fullEvents });
      return {
        success: true,
        eventIds: fullEvents.map(e => e.id)
      };
    } catch (error) {
      console.error('Error tracking event batch:', error);
      return { success: false };
    }
  }

  // =====================================
  // REPORTING
  // =====================================

  /**
   * Get available report configurations
   */
  async getReportConfigs(): Promise<ReportConfig[]> {
    try {
      const response = await apiService.get('/analytics/reports/configs');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching report configs:', error);
      return [];
    }
  }

  /**
   * Create a new report configuration
   */
  async createReportConfig(config: Omit<ReportConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReportConfig> {
    try {
      const response = await apiService.post('/analytics/reports/configs', config);
      return response.data;
    } catch (error) {
      console.error('Error creating report config:', error);
      throw error;
    }
  }

  /**
   * Generate a report
   */
  async generateReport(configId: string, filters?: AnalyticsFilters): Promise<GeneratedReport> {
    try {
      const response = await apiService.post(`/analytics/reports/generate/${configId}`, { filters });
      return response.data;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Get generated reports
   */
  async getGeneratedReports(configId?: string): Promise<GeneratedReport[]> {
    try {
      const params = configId ? `?configId=${configId}` : '';
      const response = await apiService.get(`/analytics/reports/generated${params}`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching generated reports:', error);
      return [];
    }
  }

  // =====================================
  // EXPORT FUNCTIONALITY
  // =====================================

  /**
   * Export analytics data
   */
  async exportData(config: ExportConfig): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
    try {
      const response = await apiService.post('/analytics/export', config);

      if (config.format === 'json') {
        return {
          success: true,
          downloadUrl: URL.createObjectURL(new Blob([JSON.stringify(response.data)], { type: 'application/json' }))
        };
      } else {
        return {
          success: true,
          downloadUrl: URL.createObjectURL(response.data)
        };
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  // =====================================
  // UTILITY METHODS
  // =====================================

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get date range for common periods
   */
  getDateRange(period: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth'): TimeRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'today':
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0]
        };
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: yesterday.toISOString().split('T')[0],
          endDate: yesterday.toISOString().split('T')[0]
        };
      }
      case 'last7days': {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return {
          startDate: sevenDaysAgo.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0]
        };
      }
      case 'last30days': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return {
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0]
        };
      }
      case 'thisMonth': {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: firstOfMonth.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0]
        };
      }
      case 'lastMonth': {
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          startDate: firstOfLastMonth.toISOString().split('T')[0],
          endDate: lastOfLastMonth.toISOString().split('T')[0]
        };
      }
      default:
        return this.getDateRange('last30days');
    }
  }

  /**
   * Format metrics for display
   */
  formatMetric(value: number, unit: string): string {
    if (unit === 'ms') {
      return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
    }
    if (unit === 'bytes') {
      if (value < 1024) return `${value}B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
      if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)}MB`;
      return `${(value / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    }
    if (unit === 'currency') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }
    if (unit === 'percentage') {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value.toLocaleString();
  }

  /**
   * Calculate trend from data points
   */
  calculateTrend(current: number, previous: number): { trend: 'up' | 'down' | 'stable'; changePercentage: number } {
    if (previous === 0) {
      return { trend: current > 0 ? 'up' : 'stable', changePercentage: 0 };
    }
    
    const changePercentage = ((current - previous) / previous) * 100;
    const trend = Math.abs(changePercentage) < 1 ? 'stable' : changePercentage > 0 ? 'up' : 'down';
    
    return { trend, changePercentage: Math.round(changePercentage * 10) / 10 };
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
export default analyticsService;
