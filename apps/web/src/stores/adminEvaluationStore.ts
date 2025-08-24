import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiService } from '@/services/apiService';
export interface AdminEvaluationFilters {
  page?: number;
  limit?: number;
  minRating?: number;
  maxRating?: number;
  agentName?: string;
  userEmail?: string;
  startDate?: string;
  endDate?: string;
  hasNotes?: boolean;
  hasWorkflowSteps?: boolean;
  hasConstraints?: boolean;
  workflowStepStatus?: string;
  constraintType?: string;
  minResponseTime?: number;
  maxResponseTime?: number;
  provider?: string;
  model?: string;
}
export interface EvaluationAnalytics {
  totalEvaluations: number;
  averageRating: number;
  averageSpeedRating: number;
  averageAccuracyRating: number;
  averageWorkflowCompletionRate: number;
  averageResponseTime: number;
  averageCost: number;
  ratingDistribution: Record<string, number>;
  topPerformingAgents: Array<{
    agentName: string;
    averageRating: number;
    evaluationCount: number;
  }>;
  topConstraints: Array<{
    constraintName: string;
    effectivenessScore: number;
    usageCount: number;
  }>;
  workflowFailurePoints: Array<{
    stepName: string;
    failureRate: number;
    averageDuration: number;
  }>;
}
export interface EnhancedEvaluationMetadata {
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
  };
  evaluation: {
    userRating: number;
    speedRating?: number;
    accuracyRating?: number;
    userNotes?: string;
    evaluationTimestamp: string;
    evaluationDetails?: any;
  };
  task: {
    id: string;
    prompt: string;
    response?: string;
    agentName: string;
    method: string;
    status: string;
    createdAt: string;
    completedAt?: string;
    progress?: number;
    metadata?: any;
  };
  workflowSteps?: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    progressPercent: number;
    stepDetails: Array<{
      name: string;
      status: string;
      duration?: number;
      error?: string;
      metadata?: any;
      startTime?: string;
      endTime?: string;
    }>;
    totalDuration?: number;
    failedStep?: string;
  };
  llmConstraints?: {
    activeStateModifiers: string[];
    responseModifiers: string[];
    executedCommands: string[];
    constraintEffectiveness?: {
      modifierCompliance: number;
      constraintImpact: string;
      overallEffectiveness?: number;
    };
    processingNotes?: any;
  };
  llmInfo: {
    provider: string;
    model: string;
    responseTimeMs: number;
    cost: number;
    tokenUsage: {
      input: number;
      output: number;
    };
    modelVersion?: string;
    temperature?: number;
    maxTokens?: number;
  };
  systemMetadata?: any;
}
export const useAdminEvaluationStore = defineStore('adminEvaluation', () => {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const evaluations = ref<EnhancedEvaluationMetadata[]>([]);
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const analytics = ref<EvaluationAnalytics | null>(null);
  const workflowAnalytics = ref<any>(null);
  const constraintAnalytics = ref<any>(null);
  /**
   * Fetch all evaluations with admin filters
   */
  async function fetchAllEvaluations(filters: AdminEvaluationFilters = {}) {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      // Add filter parameters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, value.toString());
        }
      });
      const response = await apiService.get(`/evaluation/admin/all?${params.toString()}`);
      evaluations.value = response.evaluations || [];
      pagination.value = response.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      };
      return {
        evaluations: evaluations.value,
        pagination: pagination.value
      };
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch evaluations';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Fetch evaluation analytics overview
   */
  async function fetchAnalytics(filters: { startDate?: string; endDate?: string; userRole?: string } = {}) {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, value.toString());
        }
      });
      const response = await apiService.get(`/evaluation/admin/analytics/overview?${params.toString()}`);
      analytics.value = response;
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch analytics';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Fetch workflow analytics
   */
  async function fetchWorkflowAnalytics(filters: { stepName?: string; agentName?: string; startDate?: string; endDate?: string } = {}) {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, value.toString());
        }
      });
      const response = await apiService.get(`/evaluation/admin/analytics/workflow?${params.toString()}`);
      workflowAnalytics.value = response;
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch workflow analytics';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Fetch constraint analytics
   */
  async function fetchConstraintAnalytics(filters: { constraintType?: string; minEffectiveness?: number; startDate?: string; endDate?: string } = {}) {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, value.toString());
        }
      });
      const response = await apiService.get(`/evaluation/admin/analytics/constraints?${params.toString()}`);
      constraintAnalytics.value = response;
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch constraint analytics';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Export evaluations data
   */
  async function exportEvaluations(options: {
    format?: 'json' | 'csv';
    includeUserData?: boolean;
    includeContent?: boolean;
    startDate?: string;
    endDate?: string;
    userRole?: string;
  } = {}) {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, String(value));
        }
      });
      const response = await apiService.get(`/evaluation/admin/export?${params.toString()}`);
      // Handle different export formats
      if (options.format === 'csv') {
        // Create and download CSV file
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `evaluations-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // JSON format - create and download JSON file
        const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `evaluations-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to export evaluations';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Get evaluations for a specific user (admin only)
   */
  async function fetchUserEvaluations(userId: string, options: { page?: number; limit?: number; includeDetails?: boolean } = {}) {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, String(value));
        }
      });
      const response = await apiService.get(`/evaluation/admin/users/${userId}/evaluations?${params.toString()}`);
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch user evaluations';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Get agent performance comparison
   */
  async function fetchAgentPerformance(filters: { startDate?: string; endDate?: string; minEvaluations?: number } = {}) {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, value.toString());
        }
      });
      const response = await apiService.get(`/evaluation/admin/performance/agents?${params.toString()}`);
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch agent performance';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Get evaluation trends over time
   */
  async function fetchEvaluationTrends(filters: {
    timeframe?: 'daily' | 'weekly' | 'monthly';
    startDate?: string;
    endDate?: string;
    metric?: 'rating' | 'volume' | 'cost' | 'response_time';
  } = {}) {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, value.toString());
        }
      });
      const response = await apiService.get(`/evaluation/admin/trends/time-series?${params.toString()}`);
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch evaluation trends';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Clear all data and reset state
   */
  function clearData() {
    evaluations.value = [];
    pagination.value = { page: 1, limit: 20, total: 0, totalPages: 0 };
    analytics.value = null;
    workflowAnalytics.value = null;
    constraintAnalytics.value = null;
    error.value = null;
  }
  return {
    // State
    isLoading,
    error,
    evaluations,
    pagination,
    analytics,
    workflowAnalytics,
    constraintAnalytics,
    // Actions
    fetchAllEvaluations,
    fetchAnalytics,
    fetchWorkflowAnalytics,
    fetchConstraintAnalytics,
    exportEvaluations,
    fetchUserEvaluations,
    fetchAgentPerformance,
    fetchEvaluationTrends,
    clearData
  };
});