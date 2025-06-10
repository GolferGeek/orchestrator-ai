import axios, { AxiosInstance } from 'axios';
import { TaskResponse, AgentInfo, TaskCreationRequest } from '../types/chat';

// FastAPI-specific endpoint configuration
const FASTAPI_BASE_URL = import.meta.env.VITE_API_V1_BASE_URL || 'http://localhost:8000';

class FastAPIApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: FASTAPI_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[FastAPI] Request failed:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Post a task to the FastAPI orchestrator
   */
  async postTaskToOrchestrator(
    userInputText: string, 
    sessionId?: string | null,
    conversationHistory?: Array<{role: string, content: string, metadata?: any}> 
  ): Promise<TaskResponse> {
    try {
      // FastAPI expects the original format
      const requestPayload: TaskCreationRequest = {
        message: {
          role: 'user',
          parts: [{ text: userInputText }]
        }
      };
      
      if (sessionId) {
        requestPayload.session_id = sessionId;
      }

      const response = await this.axiosInstance.post<TaskResponse>(
        '/agents/orchestrator/tasks', 
        requestPayload
      );
      
      return response.data;
    } catch (error) {
      console.error('Error posting task to FastAPI orchestrator:', error);
      throw error;
    }
  }

  /**
   * Get available FastAPI agents
   */
  async getAvailableAgents(): Promise<AgentInfo[]> {
    try {
      const response = await this.axiosInstance.get<{ agents: AgentInfo[] }>('/agents');
      return response.data.agents || [];
    } catch (error) {
      console.error('Error fetching FastAPI available agents:', error);
      throw error;
    }
  }

  /**
   * Health check for FastAPI
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('FastAPI health check failed:', error);
      return false;
    }
  }

  /**
   * Get agent details by ID
   */
  async getAgentDetails(agentId: string): Promise<AgentInfo> {
    try {
      const response = await this.axiosInstance.get<AgentInfo>(`/agents/${agentId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching FastAPI agent details for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get task history for a session
   */
  async getTaskHistory(sessionId: string): Promise<TaskResponse[]> {
    try {
      const response = await this.axiosInstance.get<TaskResponse[]>(`/sessions/${sessionId}/tasks`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching FastAPI task history for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a feature is supported
   */
  isFeatureSupported(feature: string): boolean {
    // FastAPI supports all current features
    const supportedFeatures = [
      'orchestrator',
      'agent_discovery', 
      'session_management',
      'task_history'
    ];
    return supportedFeatures.includes(feature);
  }

  /**
   * Update authorization token
   */
  setAuthToken(token: string | null): void {
    if (token) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.axiosInstance.defaults.headers.common['Authorization'];
    }
  }

  /**
   * Clear authorization
   */
  clearAuth(): void {
    delete this.axiosInstance.defaults.headers.common['Authorization'];
  }
}

// Export singleton instance
export const fastapiApiService = new FastAPIApiService(); 