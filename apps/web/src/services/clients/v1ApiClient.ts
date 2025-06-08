import { BaseApiClient } from './baseApiClient';
import { ApiEndpoint } from '../../types/api';
import { TaskCreationRequest, TaskResponse, AgentInfo } from '../../types/chat';

export class V1ApiClient extends BaseApiClient {
  constructor(endpoint: ApiEndpoint) {
    super(endpoint);
  }

  async postTaskToOrchestrator(
    userInputText: string, 
    sessionId?: string | null
  ): Promise<TaskResponse> {
    try {
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
      console.error('Error posting task to orchestrator (V1):', error);
      throw error; // Re-throw as it's already processed by the interceptor
    }
  }

  async getAvailableAgents(): Promise<AgentInfo[]> {
    try {
      const response = await this.axiosInstance.get<{ agents: AgentInfo[] }>('/agents');
      return response.data.agents || [];
    } catch (error) {
      console.error('Error fetching available agents (V1):', error);
      throw error; // Re-throw as it's already processed by the interceptor
    }
  }

  // V1-specific methods can be added here
  async getAgentDetails(agentId: string): Promise<AgentInfo> {
    try {
      const response = await this.axiosInstance.get<AgentInfo>(`/agents/${agentId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching agent details for ${agentId} (V1):`, error);
      throw error;
    }
  }

  async getTaskHistory(sessionId: string): Promise<TaskResponse[]> {
    try {
      const response = await this.axiosInstance.get<TaskResponse[]>(`/sessions/${sessionId}/tasks`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching task history for session ${sessionId} (V1):`, error);
      throw error;
    }
  }
} 