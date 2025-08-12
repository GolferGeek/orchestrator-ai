import type { EvaluationRequest, EvaluationResponse, AllEvaluationsFilters, AllEvaluationsResponse } from '../types/evaluation';

class EvaluationService {
  /**
   * Rate a message
   */
  async rateMessage(messageId: string, evaluation: EvaluationRequest): Promise<EvaluationResponse> {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get evaluation for a message
   */
  async getMessageRating(messageId: string): Promise<EvaluationResponse | null> {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing evaluation
   */
  async updateRating(messageId: string, evaluation: EvaluationRequest): Promise<EvaluationResponse> {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get aggregated evaluations for analytics
   */
  async getEvaluationAnalytics(filters?: {
    agentName?: string;
    dateFrom?: string;
    dateTo?: string;
    sessionId?: string;
  }): Promise<any> {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all evaluations for the current user
   */
  async getAllUserEvaluations(filters?: AllEvaluationsFilters): Promise<AllEvaluationsResponse> {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  private getBaseUrl(): string {
    return import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:9000';
  }
}

// Export singleton instance
export const evaluationService = new EvaluationService();
export default evaluationService;