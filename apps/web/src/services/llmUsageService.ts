import { apiService } from './apiService';
import { 
  codeOutline, 
  personOutline, 
  settingsOutline, 
  serverOutline, 
  helpOutline,
  hardwareChipOutline
} from 'ionicons/icons';

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

class LlmUsageService {
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

    const url = queryParams.toString() 
      ? `/api/llm-usage/records?${queryParams.toString()}`
      : '/api/llm-usage/records';

    const response = await apiService.get<ApiResponse<LlmUsageRecord[]>>(url);
    return response.data;
  }

  /**
   * Get LLM usage analytics
   */
  async getUsageAnalytics(filters?: {
    startDate?: string;
    endDate?: string;
    callerType?: string;
  }): Promise<LlmAnalytics[]> {
    const queryParams = new URLSearchParams();
    
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.callerType) queryParams.append('callerType', filters.callerType);

    const url = queryParams.toString()
      ? `/api/llm-usage/analytics?${queryParams.toString()}`
      : '/api/llm-usage/analytics';

    const response = await apiService.get<ApiResponse<LlmAnalytics[]>>(url);
    return response.data;
  }

  /**
   * Get current service statistics
   */
  async getStats(): Promise<LlmStats> {
    const response = await apiService.get<ApiResponse<LlmStats>>('/api/llm-usage/stats');
    return response.data;
  }

  /**
   * Get active runs
   */
  async getActiveRuns(): Promise<any[]> {
    const response = await apiService.get<ApiResponse<any[]>>('/api/llm-usage/active');
    return response.data;
  }

  /**
   * Helper methods for formatting and calculations
   */
  
  formatCost(cost: number | null): string {
    if (cost === null || cost === undefined) return '$0.00';
    return `$${cost.toFixed(4)}`;
  }

  formatDuration(durationMs: number | null): string {
    if (durationMs === null || durationMs === undefined) return '-';
    if (durationMs < 1000) return `${durationMs}ms`;
    return `${(durationMs / 1000).toFixed(2)}s`;
  }

  formatTokens(tokens: number | null): string {
    if (tokens === null || tokens === undefined) return '-';
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return tokens.toString();
  }

  getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'success';
      case 'failed':
      case 'error':
        return 'danger';
      case 'running':
      case 'in_progress':
        return 'warning';
      default:
        return 'medium';
    }
  }

  getCallerTypeIcon(callerType: string): any {
    switch (callerType.toLowerCase()) {
      case 'agent':
        return hardwareChipOutline;
      case 'api':
        return codeOutline;
      case 'user':
        return personOutline;
      case 'system':
        return settingsOutline;
      case 'service':
        return serverOutline;
      default:
        return helpOutline;
    }
  }
}

export const llmUsageService = new LlmUsageService();
