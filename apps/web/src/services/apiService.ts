import axios, { AxiosInstance } from 'axios';
import { TaskResponse, AgentInfo } from '../types/chat';
import { LLMSelection, SendMessageRequest, SendMessageResponse } from '../types/llm';
import { convertLLMSelectionToAPI, convertAPIResponseToFrontend } from '../utils/caseConverter';

// API endpoint configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:4000';

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

class ApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[API] Request failed:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send enhanced message with LLM preferences to sessions API
   */
  async sendEnhancedMessage(
    sessionId: string,
    messageRequest: SendMessageRequest
  ): Promise<SendMessageResponse> {
    try {
      const authToken = localStorage.getItem('authToken');
      
      // API now expects camelCase directly
      const apiRequest = {
        content: messageRequest.content,
        llmSelection: messageRequest.llmSelection
      };
      
      const response = await this.axiosInstance.post<any>(
        `/sessions/${sessionId}/messages`,
        apiRequest,
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined
          }
        }
      );
      
      // API now returns camelCase directly
      return response.data;
    } catch (error) {
      console.error('Error sending enhanced message:', error);
      throw error;
    }
  }

  /**
   * Post a task to the NestJS orchestrator (legacy method)
   */
  async postTaskToOrchestrator(
    userInputText: string, 
    sessionId?: string | null,
    conversationHistory?: Array<{role: string, content: string, metadata?: any}>,
    llmSelection?: LLMSelection
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
          currentUser: currentUser, // Pass current user for database RLS
          // Add LLM preferences if provided (API expects camelCase)
          ...(llmSelection && { llmSelection })
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

  /**
   * Create a new session
   */
  async createSession(name: string): Promise<any> {
    try {
      const authToken = localStorage.getItem('authToken');
      
      const response = await this.axiosInstance.post('/sessions', 
        { name },
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get session messages with LLM evaluation data
   */
  async getSessionMessages(
    sessionId: string, 
    options: {
      skip?: number;
      limit?: number;
      includeEvaluations?: boolean;
      includeLlmData?: boolean;
    } = {}
  ): Promise<SendMessageResponse[]> {
    try {
      const authToken = localStorage.getItem('authToken');
      
      const queryParams = new URLSearchParams();
      if (options.skip !== undefined) queryParams.append('skip', options.skip.toString());
      if (options.limit !== undefined) queryParams.append('limit', options.limit.toString());
      if (options.includeEvaluations) queryParams.append('include_evaluations', 'true');
      if (options.includeLlmData) queryParams.append('include_llm_data', 'true');
      
      const response = await this.axiosInstance.get(
        `/sessions/${sessionId}/messages/enhanced?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching session messages:', error);
      throw error;
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(skip: number = 0, limit: number = 100): Promise<any> {
    try {
      const authToken = localStorage.getItem('authToken');
      
      const response = await this.axiosInstance.get(
        `/sessions?skip=${skip}&limit=${limit}`,
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      throw error;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const authToken = localStorage.getItem('authToken');
      
      await this.axiosInstance.delete(`/sessions/${sessionId}`, {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : undefined
        }
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Get agents list for modal display (UI endpoint)
   */
  async getAgentsList(): Promise<any> {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await this.axiosInstance.get('/orchestrator/ui/agents-list', {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : undefined
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching agents list for modal:', error);
      throw error;
    }
  }

  /**
   * Get agent capabilities for modal display (UI endpoint)
   */
  async getAgentCapabilities(agentName: string): Promise<any> {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await this.axiosInstance.get(`/orchestrator/ui/agent-capabilities/${encodeURIComponent(agentName)}`, {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : undefined
        }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching capabilities for ${agentName}:`, error);
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<any> {
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await this.axiosInstance.get('/auth/me', {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : undefined
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw error;
    }
  }

  /**
   * Login with email and password
   */
  async login(credentials: { email: string; password: string }): Promise<any> {
    try {
      const response = await this.axiosInstance.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }

  /**
   * Sign up with email and password
   */
  async signup(credentials: { email: string; password: string }): Promise<any> {
    try {
      const response = await this.axiosInstance.post('/auth/signup', credentials);
      return response.data;
    } catch (error) {
      console.error('Error during signup:', error);
      throw error;
    }
  }

  /**
   * Refresh auth token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.post('/auth/refresh', { 
        refreshToken 
      });
      return response.data;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Legacy export for backward compatibility
export const nestjsApiService = apiService;

// Default export for legacy compatibility
export default apiService; 