import axios, { AxiosInstance } from 'axios';
import { TaskResponse, AgentInfo } from '../types/chat';

// NestJS-specific endpoint configuration
const NESTJS_BASE_URL = import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:4000';

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

class NestJSApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: NESTJS_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[NestJS API] Request failed:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Post a task to the NestJS orchestrator
   */
  async postTaskToOrchestrator(
    userInputText: string, 
    sessionId?: string | null,
    conversationHistory?: Array<{role: string, content: string, metadata?: any}> 
  ): Promise<TaskResponse> {
    try {
      // Get the current auth token from localStorage to pass to orchestrator
      const authToken = localStorage.getItem('authToken');
      
      // Get current user information for proper database RLS
      let currentUser = null;
      if (authToken) {
        try {
          // Ensure auth token is set in headers for the /auth/me request
          const userResponse = await this.axiosInstance.get('/auth/me', {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          currentUser = userResponse.data;
        } catch (error) {
          console.warn('Failed to fetch current user for orchestrator:', error);
        }
      }
      
      // NestJS expects JSON-RPC 2.0 format
      const requestPayload = {
        jsonrpc: '2.0',
        method: 'handle_request',
        params: {
          message: userInputText,
          session_id: sessionId,
          conversation_history: conversationHistory || [],
          authToken: authToken, // Pass auth token to orchestrator for agent pool refresh
          currentUser: currentUser // Pass current user for database RLS
        },
        id: Date.now() // Use timestamp as unique ID
      };

      const response = await this.axiosInstance.post<JsonRpcResponse>(
        '/agents/orchestrator/orchestrator/tasks', 
        requestPayload,
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined
          }
        }
      );
      
      const jsonRpcResponse = response.data;
      
      if (jsonRpcResponse.error) {
        throw new Error(`JSON-RPC Error ${jsonRpcResponse.error.code}: ${jsonRpcResponse.error.message}`);
      }

      if (jsonRpcResponse.result) {
        const result = jsonRpcResponse.result;
        
        // Extract agent name from metadata
        let respondingAgentName = 'Agent'; // default for NestJS
        if (result.metadata) {
          respondingAgentName = result.metadata.delegatedTo || 
                              result.metadata.originalAgent?.agentName ||
                              result.metadata.agentName ||
                              result.metadata.responding_agent_name ||
                              'Agent';
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

      throw new Error('No result in JSON-RPC response');
    } catch (error) {
      console.error('Error posting task to NestJS orchestrator:', error);
      throw error;
    }
  }

  /**
   * Get available NestJS agents
   */
  async getAvailableAgents(): Promise<AgentInfo[]> {
    try {
      const response = await this.axiosInstance.get<{ agents: AgentInfo[] }>('/agents');
      return response.data.agents || [];
    } catch (error) {
      console.error('Error fetching NestJS available agents:', error);
      throw error;
    }
  }

  /**
   * Health check for NestJS API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('NestJS health check failed:', error);
      return false;
    }
  }

  /**
   * Get NestJS agent pool statistics
   */
  async getAgentPoolStats(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/agent-pool/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching NestJS agent pool stats:', error);
      throw error;
    }
  }

  /**
   * Get NestJS registered agents
   */
  async getRegisteredAgents(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/agent-pool/agents');
      return response.data;
    } catch (error) {
      console.error('Error fetching NestJS registered agents:', error);
      throw error;
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
      console.error(`Error fetching NestJS agent details for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a feature is supported
   */
  isFeatureSupported(feature: string): boolean {
    // NestJS supports all current features
    const supportedFeatures = [
      'orchestrator',
      'agent_discovery', 
      'session_management',
      'agent_pool_stats'
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
export const nestjsApiService = new NestJSApiService(); 