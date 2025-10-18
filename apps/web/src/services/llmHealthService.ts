/**
 * LLM Health Service
 *
 * Service for LLM system health monitoring, alerts, and compliance.
 * Extracted from llmMonitoringService for focused health/operational concerns.
 *
 * Domain: Health & Operational Status
 * - System health metrics
 * - Operational status
 * - Alerts and notifications
 * - Compliance metrics
 * - Real-time monitoring
 */

import { apiService } from './apiService';
import {
  SystemHealthResponse,
  OperationalStatusResponse,
  AlertsResponse,
  ComplianceMetricsResponse,
  LLMDashboardResponse,
  RealTimeMetrics,
  LLMUsageStatsRequest,
  LLMUsageStatsResponse,
  LLMUsageStats,
  ModelHealthMetrics,
  SystemHealthMetrics,
} from '@/types/llm-monitoring';

const isMemoryStats = (value: unknown): value is SystemHealthMetrics['memoryStats'] => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SystemHealthMetrics['memoryStats']>;
  return (
    typeof candidate.memoryPressure === 'string'
    && typeof candidate.currentUsage === 'number'
    && typeof candidate.totalAllocated === 'number'
    && typeof candidate.loadedModels === 'number'
    && typeof candidate.threeTierModels === 'number'
  );
};

class LLMHealthService {
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
        data: response,
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
        data: response,
      };
    } catch (error) {
      console.error('Error fetching operational status:', error);
      throw error;
    }
  }

  /**
   * Get model health metrics
   */
  async getModelHealthMetrics(): Promise<ModelHealthMetrics[]> {
    try {
      const response = await apiService.get('/llm/production/health/models');
      if (Array.isArray(response)) {
        return response as ModelHealthMetrics[];
      }
      if (response && Array.isArray(response.data)) {
        return response.data as ModelHealthMetrics[];
      }
      return [];
    } catch (error) {
      console.error('Error fetching model health metrics:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<SystemHealthMetrics['memoryStats'] | null> {
    try {
      const response = await apiService.get<
        SystemHealthMetrics['memoryStats'] | { data?: SystemHealthMetrics['memoryStats'] | null } | null
      >('/llm/production/memory/stats');

      if (!response) {
        return null;
      }

      if (isMemoryStats(response)) {
        return response;
      }

      if (typeof response === 'object' && 'data' in response && response.data && isMemoryStats(response.data)) {
        return response.data;
      }

      return null;
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
          resolved: response.resolved || 0,
        },
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
          resolved: response.total || 0,
        },
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
        const [piiStats, usageStatsResponse] = await Promise.all([
          apiService.getQuiet404('/llm/sanitization/stats').catch(() => ({})),
          this.getUsageStatsForCompliance({ startDate, endDate }),
        ]);

        const usageStats = usageStatsResponse.data;

        const complianceData = {
          dataClassificationBreakdown: this.calculateDataClassificationBreakdown(usageStats),
          piiDetectionStats: {
            totalScanned: piiStats.totalProcessed || 0,
            piiDetected: piiStats.totalDetections || 0,
            sanitizationRate: piiStats.sanitizationRate || 0,
            byDataType: piiStats.detectionsByType || {},
          },
          auditTrail: {
            totalEvents: 0,
            byEventType: {},
            recentEvents: [],
          },
          complianceScore: this.calculateComplianceScore(piiStats, usageStats),
          violations: [],
        };

        return {
          success: true,
          data: complianceData,
        };
      } catch {
        // Fallback to empty compliance data if services aren't available
        return {
          success: true,
          data: {
            dataClassificationBreakdown: {},
            piiDetectionStats: {
              totalScanned: 0,
              piiDetected: 0,
              sanitizationRate: 0,
              byDataType: {},
            },
            auditTrail: {
              totalEvents: 0,
              byEventType: {},
              recentEvents: [],
            },
            complianceScore: 0,
            violations: [],
          },
        };
      }
    } catch (error) {
      console.error('Error fetching compliance metrics:', error);
      throw error;
    }
  }

  /**
   * Helper to get usage stats for compliance calculations
   */
  private async getUsageStatsForCompliance(
    request: LLMUsageStatsRequest
  ): Promise<LLMUsageStatsResponse> {
    try {
      const params = new URLSearchParams();
      if (request.startDate) params.append('start_date', request.startDate);
      if (request.endDate) params.append('end_date', request.endDate);

      const response = await apiService.get<LLMUsageStatsResponse | LLMUsageStats>(
        `/usage/stats?${params.toString()}`
      );

      if ('success' in (response as LLMUsageStatsResponse)) {
        return response as LLMUsageStatsResponse;
      }

      return {
        success: true,
        data: response as LLMUsageStats,
      };
    } catch {
      const fallbackStats: LLMUsageStats = {
        userId: 'unknown',
        dateRange: {
          startDate: request.startDate ?? '',
          endDate: request.endDate ?? '',
        },
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageResponseTime: 0,
        successRate: 0,
        byProvider: {},
        byModel: {},
        byDataClassification: {},
      };

      return {
        success: false,
        data: fallbackStats,
      };
    }
  }

  // =====================================
  // DASHBOARD & OVERVIEW
  // =====================================

  /**
   * Get dashboard data (aggregated health overview)
   * Note: For full dashboard with analytics, use llmAnalyticsService
   */
  async getDashboardData(_startDate?: string, _endDate?: string): Promise<LLMDashboardResponse> {
    try {
      const [operationalStatus, activeAlerts] = await Promise.all([
        this.getOperationalStatus(),
        this.getActiveAlerts(),
      ]);

      const dashboardData = {
        summary: {
          totalRequests: 0, // Should come from analytics service
          totalCost: 0, // Should come from analytics service
          averageResponseTime: 0, // Should come from analytics service
          successRate: 0, // Should come from analytics service
          activeAlerts: activeAlerts.data.active,
          systemHealth: operationalStatus.data.system.healthy
            ? activeAlerts.data.active > 0
              ? 'warning'
              : 'healthy'
            : 'critical',
        },
        recentActivity: [],
        costTrends: [],
        performanceMetrics: [],
        alerts: activeAlerts.data.alerts.slice(0, 5), // Latest 5 alerts
        complianceStatus: {
          score: 85, // Placeholder
          violations: 0,
          piiDetectionRate: 0.95,
        },
      };

      return {
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString(),
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
      const [systemHealth, _memoryStats] = await Promise.all([
        this.getSystemHealth(),
        this.getMemoryStats(),
      ]);

      return {
        currentRequests: 0, // Would need active runs from analytics service
        requestsPerMinute: 0, // Would need to calculate from recent activity
        averageResponseTime: systemHealth.data.averageResponseTime,
        errorRate: 0, // Would need to calculate from recent errors
        systemLoad: systemHealth.data.systemLoad,
        memoryUsage: systemHealth.data.memoryStats.currentUsage,
        activeModels: systemHealth.data.memoryStats.loadedModels || [],
        recentErrors: [],
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
  private calculateDataClassificationBreakdown(usageStats: LLMUsageStats): Record<string, { requests: number; cost: number; percentage: number }> {
    // This would analyze the usage data to provide classification breakdown
    // For now, return a placeholder structure
    const breakdown = usageStats.byDataClassification ?? {};
    const totalRequests = usageStats.totalRequests || 1;

    return Object.entries(breakdown).reduce<Record<string, { requests: number; cost: number; percentage: number }>>(
      (acc, [classification, stats]) => {
        const requests = stats.requests ?? 0;
        const cost = stats.cost ?? 0;
        acc[classification] = {
          requests,
          cost,
          percentage: requests ? Math.round((requests / totalRequests) * 100) : 0,
        };
        return acc;
      },
      {}
    );
  }

  /**
   * Calculate compliance score based on PII and usage stats
   */
  private calculateComplianceScore(piiStats: { sanitizationRate?: number; successRate?: number }, usageStats: LLMUsageStats): number {
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
   * Get date range for common periods
   */
  getDateRange(
    period: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth'
  ): { startDate: string; endDate: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case 'today':
        return {
          startDate: this.formatDate(today),
          endDate: this.formatDate(now),
        };
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: this.formatDate(yesterday),
          endDate: this.formatDate(yesterday),
        };
      }
      case 'last7days': {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return {
          startDate: this.formatDate(sevenDaysAgo),
          endDate: this.formatDate(now),
        };
      }
      case 'last30days': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return {
          startDate: this.formatDate(thirtyDaysAgo),
          endDate: this.formatDate(now),
        };
      }
      case 'thisMonth': {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: this.formatDate(firstOfMonth),
          endDate: this.formatDate(now),
        };
      }
      case 'lastMonth': {
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          startDate: this.formatDate(firstOfLastMonth),
          endDate: this.formatDate(lastOfLastMonth),
        };
      }
      default:
        return this.getDateRange('last30days');
    }
  }

  /**
   * Format date for API requests
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

// Export singleton instance
export const llmHealthService = new LLMHealthService();
export default llmHealthService;
