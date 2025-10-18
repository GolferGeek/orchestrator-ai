import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ConstraintAnalytics, WorkflowAnalytics } from '@/types/analytics';
import type { JsonObject } from '@/types';
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
interface AdminEvaluationAnalytics {
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
    evaluationDetails?: JsonObject;
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
    metadata?: JsonObject;
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
      metadata?: JsonObject;
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
    processingNotes?: JsonObject;
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
  systemMetadata?: JsonObject;
}
const resolveErrorMessage = (error: unknown, fallback: string): string => (
  error instanceof Error && error.message ? error.message : fallback
);

const normalizeError = (error: unknown): Error => (
  error instanceof Error ? error : new Error(String(error))
);

const isAdminEvaluationAnalytics = (
  value: unknown,
): value is AdminEvaluationAnalytics => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AdminEvaluationAnalytics>;

  return (
    typeof candidate.totalEvaluations === 'number'
    && typeof candidate.averageRating === 'number'
    && typeof candidate.averageSpeedRating === 'number'
    && typeof candidate.averageAccuracyRating === 'number'
    && typeof candidate.averageWorkflowCompletionRate === 'number'
    && typeof candidate.averageResponseTime === 'number'
    && typeof candidate.averageCost === 'number'
    && candidate.ratingDistribution != null
    && typeof candidate.ratingDistribution === 'object'
    && Array.isArray(candidate.topPerformingAgents)
    && Array.isArray(candidate.topConstraints)
    && Array.isArray(candidate.workflowFailurePoints)
  );
};

const isWorkflowAnalytics = (value: unknown): value is WorkflowAnalytics => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<WorkflowAnalytics>;

  return (
    Array.isArray(candidate.workflowPerformance)
    && Array.isArray(candidate.commonFailurePatterns)
    && Array.isArray(candidate.workflowEfficiencyTrends)
  );
};

const isConstraintAnalytics = (value: unknown): value is ConstraintAnalytics => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ConstraintAnalytics>;

  return (
    Array.isArray(candidate.constraintUsage)
    && Array.isArray(candidate.constraintCombinations)
    && Array.isArray(candidate.constraintImpactOnPerformance)
  );
};

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
  const analytics = ref<AdminEvaluationAnalytics | null>(null);
  const workflowAnalytics = ref<WorkflowAnalytics | null>(null);
  const constraintAnalytics = ref<ConstraintAnalytics | null>(null);
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
    } catch (err) {
      error.value = resolveErrorMessage(err, 'Failed to fetch evaluations');
      throw normalizeError(err);
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Fetch evaluation analytics overview
   */
  async function fetchAnalytics(
    filters: { startDate?: string; endDate?: string; userRole?: string } = {},
  ): Promise<AdminEvaluationAnalytics> {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, value.toString());
        }
      });
      const response = await apiService.get<AdminEvaluationAnalytics | null>(
        `/evaluation/admin/analytics/overview?${params.toString()}`
      );
      if (!response || !isAdminEvaluationAnalytics(response)) {
        throw new Error('Received malformed admin evaluation analytics response');
      }
      analytics.value = response;
      return response;
    } catch (err) {
      error.value = resolveErrorMessage(err, 'Failed to fetch analytics');
      throw normalizeError(err);
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Fetch workflow analytics
   */
  async function fetchWorkflowAnalytics(
    filters: { stepName?: string; agentName?: string; startDate?: string; endDate?: string } = {},
  ): Promise<WorkflowAnalytics> {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, value.toString());
        }
      });
      const response = await apiService.get<WorkflowAnalytics | null>(
        `/evaluation/admin/analytics/workflow?${params.toString()}`
      );
      if (!response || !isWorkflowAnalytics(response)) {
        throw new Error('Received malformed workflow analytics response');
      }
      workflowAnalytics.value = response;
      return response;
    } catch (err) {
      error.value = resolveErrorMessage(err, 'Failed to fetch workflow analytics');
      throw normalizeError(err);
    } finally {
      isLoading.value = false;
    }
  }
  /**
   * Fetch constraint analytics
   */
  async function fetchConstraintAnalytics(
    filters: { constraintType?: string; minEffectiveness?: number; startDate?: string; endDate?: string } = {},
  ): Promise<ConstraintAnalytics> {
    isLoading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
          params.append(key, value.toString());
        }
      });
      const response = await apiService.get<ConstraintAnalytics | null>(
        `/evaluation/admin/analytics/constraints?${params.toString()}`
      );
      if (!response || !isConstraintAnalytics(response)) {
        throw new Error('Received malformed constraint analytics response');
      }
      constraintAnalytics.value = response;
      return response;
    } catch (err) {
      error.value = resolveErrorMessage(err, 'Failed to fetch constraint analytics');
      throw normalizeError(err);
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
    } catch (err) {
      error.value = resolveErrorMessage(err, 'Failed to export evaluations');
      throw normalizeError(err);
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
    } catch (err) {
      error.value = resolveErrorMessage(err, 'Failed to fetch user evaluations');
      throw normalizeError(err);
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
    } catch (err) {
      error.value = resolveErrorMessage(err, 'Failed to fetch agent performance');
      throw normalizeError(err);
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
    } catch (err) {
      error.value = resolveErrorMessage(err, 'Failed to fetch evaluation trends');
      throw normalizeError(err);
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
