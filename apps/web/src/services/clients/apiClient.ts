import { BaseApiClient } from './baseApiClient';
import { ApiEndpoint } from '../../types/api';
import { TaskCreationRequest, TaskResponse, AgentInfo } from '../../types/chat';

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

export class ApiClient extends BaseApiClient {
  constructor(endpoint: ApiEndpoint) {
    super(endpoint);
  }

  async postTaskToOrchestrator(
    userInputText: string, 
    sessionId?: string | null,
    conversationHistory?: Array<{role: string, content: string, metadata?: any}> 
  ): Promise<TaskResponse> {
    try {
      // Different endpoints for different API technologies
      const orchestratorPath = this.endpoint.technology === 'typescript-nestjs' 
        ? '/agents/orchestrator/orchestrator/tasks'
        : '/agents/orchestrator/tasks';

      let requestPayload: any;

      if (this.endpoint.technology === 'typescript-nestjs') {
        // NestJS expects JSON-RPC 2.0 format
        requestPayload = {
          jsonrpc: '2.0',
          method: 'handle_request',
          params: {
            message: userInputText,
            session_id: sessionId,
            conversation_history: conversationHistory || []
          },
          id: Date.now() // Use timestamp as unique ID
        };
      } else {
        // FastAPI expects the original format
        requestPayload = {
          message: {
            role: 'user',
            parts: [{ text: userInputText }]
          }
        } as TaskCreationRequest;
        
        if (sessionId) {
          requestPayload.session_id = sessionId;
        }
      }

      const response = await this.axiosInstance.post<TaskResponse | JsonRpcResponse>(
        orchestratorPath, 
        requestPayload
      );
      
      // For NestJS JSON-RPC responses, extract the result field and convert to TaskResponse
      if (this.endpoint.technology === 'typescript-nestjs') {
        const jsonRpcResponse = response.data as JsonRpcResponse;
        
        if (jsonRpcResponse.error) {
          throw new Error(`JSON-RPC Error ${jsonRpcResponse.error.code}: ${jsonRpcResponse.error.message}`);
        }

        if (jsonRpcResponse.result) {
          const result = jsonRpcResponse.result;
          
          // Extract agent name from various possible metadata fields
          let respondingAgentName = 'NestJS Agent'; // default
          if (result.metadata) {
            // Try different fields where agent name might be
            respondingAgentName = result.metadata.delegatedTo || 
                                result.metadata.originalAgent?.agentName ||
                                result.metadata.agentName ||
                                result.metadata.responding_agent_name ||
                                'NestJS Agent';
          }

          return {
            id: jsonRpcResponse.id?.toString() || Date.now().toString(),
            status: {
              state: result.success ? 'completed' : 'failed',
              timestamp: new Date().toISOString(),
              message: result.success ? 'Task completed successfully' : 'Task failed'
            },
            result: result.response || result.result || 'Success',
            metadata: {
              agentName: respondingAgentName,
              responding_agent_name: respondingAgentName,
              ...result.metadata
            },
            response_message: {
              role: 'assistant',
              parts: [{ 
                type: 'text',
                text: result.response || result.message || result.result || 'Task completed' 
              }],
              metadata: {
                responding_agent_name: respondingAgentName
              }
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            session_id: sessionId || null
          };
        }
      }
      
      return response.data as TaskResponse;
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