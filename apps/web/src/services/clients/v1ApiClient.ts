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

      // Different endpoints for different API technologies
      const orchestratorPath = this.endpoint.technology === 'typescript-nestjs' 
        ? '/agents/orchestrator/orchestrator/tasks'
        : '/agents/orchestrator/tasks';

      const response = await this.axiosInstance.post<TaskResponse>(
        orchestratorPath, 
        requestPayload
      );
      
      return response.data;
    } catch (error) {
      console.error(`Error posting task to orchestrator (${this.endpoint.technology}):`, error);
      throw error; // Re-throw as it's already processed by the interceptor
    }
  }

  async getAvailableAgents(): Promise<AgentInfo[]> {
    try {
      const response = await this.axiosInstance.get<{ agents: AgentInfo[] }>('/agents');
      return response.data.agents || [];
    } catch (error) {
      console.error(`Error fetching available agents (${this.endpoint.technology}):`, error);
      throw error; // Re-throw as it's already processed by the interceptor
    }
  }

  // V1-specific methods can be added here
  async getAgentDetails(agentId: string): Promise<AgentInfo> {
    try {
      const response = await this.axiosInstance.get<AgentInfo>(`/agents/${agentId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching agent details for ${agentId} (${this.endpoint.technology}):`, error);
      throw error;
    }
  }

  async getTaskHistory(sessionId: string): Promise<TaskResponse[]> {
    try {
      const response = await this.axiosInstance.get<TaskResponse[]>(`/sessions/${sessionId}/tasks`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching task history for session ${sessionId} (${this.endpoint.technology}):`, error);
      throw error;
    }
  }
} 