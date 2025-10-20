import type {
  EvaluationRequest,
  EvaluationResponse,
  AllEvaluationsFilters,
  AllEvaluationsResponse,
  AgentLLMRecommendation,
} from '../types/evaluation';
import { getSecureApiBaseUrl } from '../utils/securityConfig';

class EvaluationService {
  /**
   * Rate a message
   */
  async rateMessage(messageId: string, evaluation: EvaluationRequest): Promise<EvaluationResponse> {
    const authToken = localStorage.getItem('authToken');
    const response = await fetch(`${this.getBaseUrl()}/evaluation/messages/${messageId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify(evaluation),
    });
    if (!response.ok) {
      throw new Error(`Failed to rate message: ${response.statusText}`);
    }
    return await response.json();
  }
  /**
   * Get evaluation for a message
   */
  async getMessageRating(messageId: string): Promise<EvaluationResponse | null> {
    const authToken = localStorage.getItem('authToken');
    const response = await fetch(`${this.getBaseUrl()}/evaluation/messages/${messageId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
    });
    if (response.status === 404) {
      return null; // No evaluation exists
    }
    if (!response.ok) {
      throw new Error(`Failed to get message rating: ${response.statusText}`);
    }
    return await response.json();
  }
  /**
   * Update an existing evaluation
   */
  async updateRating(messageId: string, evaluation: EvaluationRequest): Promise<EvaluationResponse> {
    const authToken = localStorage.getItem('authToken');
    const response = await fetch(`${this.getBaseUrl()}/evaluation/messages/${messageId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify(evaluation),
    });
    if (!response.ok) {
      throw new Error(`Failed to update rating: ${response.statusText}`);
    }
    return await response.json();
  }
  /**
   * Get aggregated evaluations for analytics
   */
  async getEvaluationAnalytics(filters?: {
    agentName?: string;
    dateFrom?: string;
    dateTo?: string;
    sessionId?: string;
  }): Promise<unknown> {
    const authToken = localStorage.getItem('authToken');
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }
    const response = await fetch(`${this.getBaseUrl()}/evaluation/analytics?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to get evaluation analytics: ${response.statusText}`);
    }
    return await response.json();
  }
  /**
   * Get all evaluations for the current user
   */
  async getAllUserEvaluations(filters?: AllEvaluationsFilters): Promise<AllEvaluationsResponse> {
    const authToken = localStorage.getItem('authToken');
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const response = await fetch(`${this.getBaseUrl()}/evaluation/user/all?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to get user evaluations: ${response.statusText}`);
    }
    return await response.json();
  }

  async getAgentLLMRecommendations(
    agentIdentifier: string,
    minRating: number = 3,
  ): Promise<AgentLLMRecommendation[]> {
    if (!agentIdentifier) {
      return [];
    }

    const authToken = localStorage.getItem('authToken');
    const queryParams = new URLSearchParams();
    if (minRating !== undefined) {
      queryParams.append('minRating', minRating.toString());
    }

    const response = await fetch(
      `${this.getBaseUrl()}/evaluation/agents/${encodeURIComponent(
        agentIdentifier,
      )}/llm-recommendations?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to load agent recommendations: ${response.statusText}`,
      );
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn(`[EvaluationService] Received non-JSON response for agent ${agentIdentifier}:`, contentType);
      return [];
    }

    return await response.json();
  }
  private getBaseUrl(): string {
    return getSecureApiBaseUrl();
  }
}
// Export singleton instance
export const evaluationService = new EvaluationService();
export default evaluationService;
