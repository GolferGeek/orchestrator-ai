/**
 * LLM Analytics Service
 *
 * Consolidated service for LLM usage analytics, metrics, and cost tracking.
 * Combines functionality from llmUsageService and llmMonitoringService.
 *
 * Domain: Analytics & Performance Metrics
 * - Usage records and analytics
 * - Cost analysis and tracking
 * - Performance metrics
 * - Active run monitoring
 */

import { apiService } from './apiService';
import {
  LLMUsageStatsRequest,
  LLMUsageStatsResponse,
  LLMUsageRecordsRequest,
  LLMUsageRecordsResponse,
  PerformanceMetricsResponse,
  CostAnalysisResponse,
} from '@/types/llm-monitoring';

// Re-export types from llmUsageService for compatibility
export interface LlmUsageRecord {
  id: string;
  run_id: string;
  user_id: string | null;
  caller_type: string;
  caller_name: string;
  conversation_id: string | null;
  provider_name: string;
  model_name: string;
  is_local: boolean;
  model_tier: string | null;
  route?: 'local' | 'remote' | null;
  fallback_used: boolean;
  routing_reason: string | null;
  complexity_level: string | null;
  complexity_score: number | null;
  data_classification: string | null;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  input_cost: number | null;
  output_cost: number | null;
  total_cost: number | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface LlmUsageFilters {
  userId?: string;
  callerType?: string;
  callerName?: string;
  conversationId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  route?: 'local' | 'remote';
}

export interface LlmAnalytics {
  date: string;
  caller_type: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_cost: number;
  avg_duration_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  unique_users: number;
  local_requests: number;
  external_requests: number;
}

export interface LlmStats {
  activeRuns: number;
  totalRunsToday: number;
  avgDuration: number;
  avgCost: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  filters?: any;
}

export interface ActiveRun {
  runId: string;
  startTime: number;
  provider: string;
  model: string;
  tier: 'local' | 'centralized' | 'external';
  inputTokens?: number;
  userId?: string;
  callerType?: string;
  callerName?: string;
  conversationId?: string;
  complexityLevel?: string;
  complexityScore?: number;
  dataClassification?: string;
  isLocal?: boolean;
  modelTier?: string;
  fallbackUsed?: boolean;
  routingReason?: string;
}

class LLMAnalyticsService {
  // =====================================
  // USAGE RECORDS & ANALYTICS
  // =====================================

  /**
   * Get LLM usage records with optional filtering
   */
  async getUsageRecords(filters?: LlmUsageFilters): Promise<LlmUsageRecord[]> {
    const queryParams = new URLSearchParams();

    if (filters?.userId) queryParams.append('userId', filters.userId);
    if (filters?.callerType) queryParams.append('callerType', filters.callerType);
    if (filters?.callerName) queryParams.append('callerName', filters.callerName);
    if (filters?.conversationId) queryParams.append('conversationId', filters.conversationId);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    if (filters?.route) queryParams.append('route', filters.route);

    const url = queryParams.toString()
      ? `/api/llm-usage/records?${queryParams.toString()}`
      : '/api/llm-usage/records';

    const response = await apiService.get<ApiResponse<LlmUsageRecord[]>>(url);
    return response.data;
  }

  /**
   * Get detailed usage records with pagination (monitoring API format)
   */
  async getUsageRecordsPaginated(
    request: LLMUsageRecordsRequest = {}
  ): Promise<LLMUsageRecordsResponse> {
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
          limit: request.limit || 10,
        },
      };
    } catch (error) {
      console.error('Error fetching paginated usage records:', error);
      throw error;
    }
  }

  /**
   * Get usage analytics with aggregation
   */
  async getUsageAnalytics(filters?: {
    startDate?: string;
    endDate?: string;
    callerType?: string;
    route?: 'local' | 'remote';
  }): Promise<LlmAnalytics[]> {
    const queryParams = new URLSearchParams();

    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.callerType) queryParams.append('callerType', filters.callerType);
    if (filters?.route) queryParams.append('route', filters.route);

    const url = queryParams.toString()
      ? `/api/llm-usage/analytics?${queryParams.toString()}`
      : '/api/llm-usage/analytics';

    const response = await apiService.get<ApiResponse<LlmAnalytics[]>>(url);
    return response.data;
  }

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
      if (request.includeDetails !== undefined)
        params.append('include_details', request.includeDetails.toString());
      if (request.granularity) params.append('granularity', request.granularity);

      const response = await apiService.get(`/usage/stats?${params.toString()}`);
      return {
        success: true,
        data: response,
      };
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      throw error;
    }
  }

  /**
   * Get current service statistics
   */
  async getStats(): Promise<LlmStats> {
    const response = await apiService.get<ApiResponse<LlmStats>>('/api/llm-usage/stats');
    return response.data;
  }

  /**
   * Get active/running LLM requests
   */
  async getActiveRuns(): Promise<ActiveRun[]> {
    const response = await apiService.get<ApiResponse<ActiveRun[]>>('/api/llm-usage/active');
    return response.data;
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

  // =====================================
  // PERFORMANCE METRICS
  // =====================================

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    startDate?: string,
    endDate?: string
  ): Promise<PerformanceMetricsResponse> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiService.get(`/usage/performance?${params.toString()}`);
      return {
        success: true,
        data: response.data || [],
      };
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      throw error;
    }
  }

  // =====================================
  // COST ANALYSIS
  // =====================================

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
        data: response,
      };
    } catch (error) {
      console.error('Error fetching cost analysis:', error);
      throw error;
    }
  }

  /**
   * Get cost summary by provider/model
   */
  async getCostSummary(
    groupBy: 'provider' | 'model' | 'date',
    startDate?: string,
    endDate?: string
  ): Promise<any> {
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
  // UTILITY METHODS
  // =====================================

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
export const llmAnalyticsService = new LLMAnalyticsService();
export default llmAnalyticsService;
