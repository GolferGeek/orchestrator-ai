import { apiService } from './apiService';
import {
  LLMUsageStatsRequest,
  LLMUsageStatsResponse,
  LLMUsageRecordsRequest,
  LLMUsageRecordsResponse,
  SystemHealthResponse,
  OperationalStatusResponse,
  PerformanceMetricsResponse,
  CostAnalysisResponse,
  ComplianceMetricsResponse,
  AlertsResponse,
  LLMDashboardResponse,
  RealTimeMetrics
} from '@/types/llm-monitoring';

class LLMMonitoringService {
  // =====================================
  // USAGE ANALYTICS ENDPOINTS
  // =====================================

  /**
   * Get user usage statistics with filtering options
   */
  async getUsageStats(request: LLMUsageStatsRequest = {}): Promise<LLMUsageStatsResponse> {
    try {
      const params = new URLSearchParams();
      if (request.startDate) params.append('start_date', request.startDate);
      if (request.endDate) params.append('end_date', request.endDate);
      if (request.providerName) params.append('provider_name', request.providerName);
      if (request.modelName) params.append('model_name', request.modelName);
      if (request.includeDetails !== undefined) params.append('include_details', request.includeDetails.toString());
      if (request.granularity) params.append('granularity', request.granularity);

      const response = await apiService.get(`/usage/stats?${params.toString()}`);
      return {
        success: true,
        data: response
      };
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      throw error;
    }
  }

  /**
   * Get detailed usage records with filtering
   */
  async getUsageRecords(request: LLMUsageRecordsRequest = {}): Promise<LLMUsageRecordsResponse> {
    try {
      const params = new URLSearchParams();
      if (request.startDate) params.append('startDate', request.startDate);
      if (request.endDate) params.append('endDate', request.endDate);
      if (request.callerType) params.append('callerType', request.callerType);
      if (request.provider) params.append('provider', request.provider);
      if (request.model) params.append('model', request.model);
      if (request.status) params.append('status', request.status);
      if (request.dataClassification) params.append('dataClassification', request.dataClassification);
      if (request.limit) params.append('limit', request.limit.toString());
      if (request.offset) params.append('offset', request.offset.toString());

      const response = await apiService.get(`/api/llm-usage/records?${params.toString()}`);
      return {
        success: true,
        data: {
          records: response.data || [],
          total: response.total || 0,
          page: Math.floor((request.offset || 0) / (request.limit || 10)) + 1,
          limit: request.limit || 10
        }
      };
    } catch (error) {
      console.error('Error fetching usage records:', error);
      throw error;
    }
  }

  /**
   * Get usage analytics with aggregation
   */
  async getUsageAnalytics(request: LLMUsageStatsRequest = {}): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (request.startDate) params.append('startDate', request.startDate);
      if (request.endDate) params.append('endDate', request.endDate);

      const response = await apiService.get(`/api/llm-usage/analytics?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error fetching usage analytics:', error);
      throw error;
    }
  }

  /**
   * Get current LLM service statistics
   */
  async getLLMServiceStats(): Promise<any> {
    try {
      const response = await apiService.get('/api/llm-usage/stats');
      return response;
    } catch (error) {
      console.error('Error fetching LLM service stats:', error);
      throw error;
    }
  }

  /**
   * Get active/running LLM requests
   */
  async getActiveRuns(): Promise<any> {
    try {
      const response = await apiService.get('/api/llm-usage/active');
      return response;
    } catch (error) {
      console.error('Error fetching active runs:', error);
      throw error;
    }
  }

  // =====================================
  // SYSTEM HEALTH & MONITORING
  // =====================================

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<SystemHealthResponse> {
    try {
      const response = await apiService.get('/llm/production/health/system');
      return {
        success: true,
        data: response
      };
    } catch (error) {
      console.error('Error fetching system health:', error);
      throw error;
    }
  }

  /**
   * Get operational status overview
   */
  async getOperationalStatus(): Promise<OperationalStatusResponse> {
    try {
      const response = await apiService.get('/llm/production/operations/status');
      return {
        success: true,
        data: response
      };
    } catch (error) {
      console.error('Error fetching operational status:', error);
      throw error;
    }
  }

  /**
   * Get model health metrics
   */
  async getModelHealthMetrics(): Promise<any> {
    try {
      const response = await apiService.get('/llm/production/health/models');
      return response;
    } catch (error) {
      console.error('Error fetching model health metrics:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<any> {
    try {
      const response = await apiService.get('/llm/production/memory/stats');
      return response;
    } catch (error) {
      console.error('Error fetching memory stats:', error);
      throw error;
    }
  }

  // =====================================
  // ALERTS & NOTIFICATIONS
  // =====================================

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<AlertsResponse> {
    try {
      const response = await apiService.get('/llm/production/alerts');
      return {
        success: true,
        data: {
          alerts: response.alerts || [],
          total: response.total || 0,
          active: response.active || 0,
          resolved: response.resolved || 0
        }
      };
    } catch (error) {
      console.error('Error fetching active alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert history
   */
  async getAlertHistory(startDate?: string, endDate?: string): Promise<AlertsResponse> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiService.get(`/llm/production/alerts/history?${params.toString()}`);
      return {
        success: true,
        data: {
          alerts: response.alerts || [],
          total: response.total || 0,
          active: 0,
          resolved: response.total || 0
        }
      };
    } catch (error) {
      console.error('Error fetching alert history:', error);
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<{ success: boolean; message?: string }> {
    try {
      await apiService.post(`/llm/production/alerts/${alertId}/acknowledge`);
      return { success: true };
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  /**
   * Clear alert history
   */
  async clearAlertHistory(): Promise<{ success: boolean; message?: string }> {
    try {
      await apiService.delete('/llm/production/alerts/history');
      return { success: true };
    } catch (error) {
      console.error('Error clearing alert history:', error);
      throw error;
    }
  }

  // =====================================
  // PERFORMANCE & COST ANALYTICS
  // =====================================

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(startDate?: string, endDate?: string): Promise<PerformanceMetricsResponse> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiService.get(`/usage/performance?${params.toString()}`);
      return {
        success: true,
        data: response.data || []
      };
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      throw error;
    }
  }

  /**
   * Get cost analysis
   */
  async getCostAnalysis(startDate?: string, endDate?: string): Promise<CostAnalysisResponse> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiService.get(`/usage/costs/analysis?${params.toString()}`);
      return {
        success: true,
        data: response
      };
    } catch (error) {
      console.error('Error fetching cost analysis:', error);
      throw error;
    }
  }

  /**
   * Get cost summary by provider/model
   */
  async getCostSummary(groupBy: 'provider' | 'model' | 'date', startDate?: string, endDate?: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.append('groupBy', groupBy);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiService.get(`/usage/costs/summary?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error fetching cost summary:', error);
      throw error;
    }
  }

  // =====================================
  // COMPLIANCE & AUDIT
  // =====================================

  /**
   * Get compliance metrics
   */
  async getComplianceMetrics(startDate?: string, endDate?: string): Promise<ComplianceMetricsResponse> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      // This endpoint might not exist yet, so we'll construct compliance data from available sources
      try {
        const [piiStats, usageStats] = await Promise.all([
          apiService.get('/sanitization/stats'),
          this.getUsageStats({ startDate, endDate })
        ]);

        const complianceData = {
          dataClassificationBreakdown: this.calculateDataClassificationBreakdown(usageStats.data),
          piiDetectionStats: {
            totalScanned: piiStats.totalProcessed || 0,
            piiDetected: piiStats.totalDetections || 0,
            sanitizationRate: piiStats.sanitizationRate || 0,
            byDataType: piiStats.detectionsByType || {}
          },
          auditTrail: {
            totalEvents: 0,
            byEventType: {},
            recentEvents: []
          },
          complianceScore: this.calculateComplianceScore(piiStats, usageStats.data),
          violations: []
        };

        return {
          success: true,
          data: complianceData
        };
      } catch (error) {
        // Fallback to empty compliance data if services aren't available
        return {
          success: true,
          data: {
            dataClassificationBreakdown: {},
            piiDetectionStats: {
              totalScanned: 0,
              piiDetected: 0,
              sanitizationRate: 0,
              byDataType: {}
            },
            auditTrail: {
              totalEvents: 0,
              byEventType: {},
              recentEvents: []
            },
            complianceScore: 0,
            violations: []
          }
        };
      }
    } catch (error) {
      console.error('Error fetching compliance metrics:', error);
      throw error;
    }
  }

  // =====================================
  // DASHBOARD & OVERVIEW
  // =====================================

  /**
   * Get dashboard data (aggregated overview)
   */
  async getDashboardData(startDate?: string, endDate?: string): Promise<LLMDashboardResponse> {
    try {
      const [
        usageStats,
        operationalStatus,
        activeAlerts,
        performanceMetrics,
        costAnalysis
      ] = await Promise.all([
        this.getUsageStats({ startDate, endDate }),
        this.getOperationalStatus(),
        this.getActiveAlerts(),
        this.getPerformanceMetrics(startDate, endDate),
        this.getCostAnalysis(startDate, endDate)
      ]);

      const dashboardData = {
        summary: {
          totalRequests: usageStats.data.totalRequests,
          totalCost: usageStats.data.totalCost,
          averageResponseTime: usageStats.data.averageResponseTime,
          successRate: usageStats.data.successRate,
          activeAlerts: activeAlerts.data.active,
          systemHealth: operationalStatus.data.system.healthy ? 
            (activeAlerts.data.active > 0 ? 'warning' : 'healthy') : 'critical'
        },
        recentActivity: [], // Would need to be populated from usage records
        costTrends: costAnalysis.data.costTrends || [],
        performanceMetrics: performanceMetrics.data,
        alerts: activeAlerts.data.alerts.slice(0, 5), // Latest 5 alerts
        complianceStatus: {
          score: 85, // Placeholder
          violations: 0,
          piiDetectionRate: 0.95
        }
      };

      return {
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }

  // =====================================
  // REAL-TIME MONITORING
  // =====================================

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    try {
      const [activeRuns, systemHealth, memoryStats] = await Promise.all([
        this.getActiveRuns(),
        this.getSystemHealth(),
        this.getMemoryStats()
      ]);

      return {
        currentRequests: activeRuns.data?.length || 0,
        requestsPerMinute: 0, // Would need to calculate from recent activity
        averageResponseTime: systemHealth.data.averageResponseTime,
        errorRate: 0, // Would need to calculate from recent errors
        systemLoad: systemHealth.data.systemLoad,
        memoryUsage: systemHealth.data.memoryStats.currentUsage,
        activeModels: systemHealth.data.memoryStats.loadedModels || [],
        recentErrors: []
      };
    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
      throw error;
    }
  }

  // =====================================
  // UTILITY METHODS
  // =====================================

  /**
   * Calculate data classification breakdown from usage stats
   */
  private calculateDataClassificationBreakdown(usageStats: any): Record<string, any> {
    // This would analyze the usage data to provide classification breakdown
    // For now, return a placeholder structure
    return {
      public: { requests: 0, percentage: 0, averageResponseTime: 0, errorRate: 0 },
      internal: { requests: 0, percentage: 0, averageResponseTime: 0, errorRate: 0 },
      confidential: { requests: 0, percentage: 0, averageResponseTime: 0, errorRate: 0 },
      restricted: { requests: 0, percentage: 0, averageResponseTime: 0, errorRate: 0 }
    };
  }

  /**
   * Calculate compliance score based on PII and usage stats
   */
  private calculateComplianceScore(piiStats: any, usageStats: any): number {
    // Simple compliance score calculation
    // In reality, this would be more complex based on various compliance factors
    let score = 100;
    
    // Deduct points for low sanitization rate
    if (piiStats.sanitizationRate && piiStats.sanitizationRate < 0.95) {
      score -= (0.95 - piiStats.sanitizationRate) * 100;
    }
    
    // Deduct points for high error rate
    if (usageStats.successRate && usageStats.successRate < 0.99) {
      score -= (0.99 - usageStats.successRate) * 50;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Format date for API requests
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get date range for common periods
   */
  getDateRange(period: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth'): { startDate: string; endDate: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'today':
        return {
          startDate: this.formatDate(today),
          endDate: this.formatDate(now)
        };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: this.formatDate(yesterday),
          endDate: this.formatDate(yesterday)
        };
      case 'last7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return {
          startDate: this.formatDate(sevenDaysAgo),
          endDate: this.formatDate(now)
        };
      case 'last30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return {
          startDate: this.formatDate(thirtyDaysAgo),
          endDate: this.formatDate(now)
        };
      case 'thisMonth':
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: this.formatDate(firstOfMonth),
          endDate: this.formatDate(now)
        };
      case 'lastMonth':
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          startDate: this.formatDate(firstOfLastMonth),
          endDate: this.formatDate(lastOfLastMonth)
        };
      default:
        return this.getDateRange('last30days');
    }
  }

  /**
   * Get detailed LLM usage information for a specific run
   */
  async getUsageDetails(runId: string): Promise<any> {
    try {
      const response = await apiService.get(`/api/llm-usage/details/${runId}`);
      return response;
    } catch (error) {
      console.error('Error fetching usage details:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const llmMonitoringService = new LLMMonitoringService();
export default llmMonitoringService;
