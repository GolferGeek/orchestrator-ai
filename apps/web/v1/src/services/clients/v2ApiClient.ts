import { BaseApiClient } from './baseApiClient';
import { ApiEndpoint } from '../../types/api';
import { TaskCreationRequest, TaskResponse, AgentInfo } from '../../types/chat';

// V2-specific types (these will eventually come from generated types)
export interface V2AgentInfo extends AgentInfo {
  parent_id?: string;
  children?: V2AgentInfo[];
  agent_type: 'parent' | 'child' | 'standalone';
  capabilities: string[];
}

export interface V2TaskResponse extends TaskResponse {
  // V2 might have additional fields
  agent_hierarchy?: string[];
  processing_chain?: string[];
}

export class V2ApiClient extends BaseApiClient {
  constructor(endpoint: ApiEndpoint) {
    super(endpoint);
  }

  async postTaskToOrchestrator(
    userInputText: string, 
    sessionId?: string | null
  ): Promise<V2TaskResponse> {
    try {
      // V2 API should use the proper V2 TaskSendParams format with task object
      const taskId = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const userId = crypto.randomUUID(); // In real implementation, this would come from auth
      
      const requestPayload = {
        task: {
          id: taskId,
          title: "User Query",
          description: userInputText,
          status: "pending",
          priority: "normal",
          created_at: timestamp,
          created_by: userId,
          metadata: {
            user_input: userInputText,
            session_id: sessionId || null
          }
        },
        target_agent_id: crypto.randomUUID(), // Must be UUID, not string
        timeout: 3600,
        metadata: {
          session_id: sessionId || null,
          user_input: userInputText
        }
      };

      const response = await this.axiosInstance.post<V2TaskResponse>(
        '/agents/system/orchestrator/tasks', 
        requestPayload
      );
      
      return response.data;
    } catch (error) {
      console.error('Error posting task to orchestrator (V2):', error);
      throw error;
    }
  }

  async getAvailableAgents(): Promise<V2AgentInfo[]> {
    try {
      const response = await this.axiosInstance.get<{ agents: V2AgentInfo[] }>('/agents');
      return response.data.agents || [];
    } catch (error) {
      console.error('Error fetching available agents (V2):', error);
      throw error;
    }
  }

  // V2-specific methods for hierarchical agents
  async getAgentHierarchy(): Promise<V2AgentInfo[]> {
    try {
      const response = await this.axiosInstance.get<{ hierarchy: V2AgentInfo[] }>('/agents/hierarchy');
      return response.data.hierarchy || [];
    } catch (error) {
      console.error('Error fetching agent hierarchy (V2):', error);
      throw error;
    }
  }

  async getParentAgents(): Promise<V2AgentInfo[]> {
    try {
      const response = await this.axiosInstance.get<{ agents: V2AgentInfo[] }>('/agents/parents');
      return response.data.agents || [];
    } catch (error) {
      console.error('Error fetching parent agents (V2):', error);
      throw error;
    }
  }

  async getChildAgents(parentId: string): Promise<V2AgentInfo[]> {
    try {
      const response = await this.axiosInstance.get<{ agents: V2AgentInfo[] }>(`/agents/${parentId}/children`);
      return response.data.agents || [];
    } catch (error) {
      console.error(`Error fetching child agents for ${parentId} (V2):`, error);
      throw error;
    }
  }

  async executeAgentTask(agentId: string, taskData: any): Promise<V2TaskResponse> {
    try {
      const response = await this.axiosInstance.post<V2TaskResponse>(
        `/agents/${agentId}/tasks`,
        taskData
      );
      return response.data;
    } catch (error) {
      console.error(`Error executing task for agent ${agentId} (V2):`, error);
      throw error;
    }
  }

  // Feature detection specific to V2
  async getApiCapabilities(): Promise<string[]> {
    try {
      const response = await this.axiosInstance.get<{ capabilities: string[] }>('/capabilities');
      return response.data.capabilities || [];
    } catch (error) {
      console.error('Error fetching API capabilities (V2):', error);
      return [];
    }
  }
} 