import axios, { AxiosInstance } from 'axios';
import { TaskResponse, AgentInfo } from '../types/chat';
import { LLMSelection, SendMessageRequest, SendMessageResponse } from '../types/llm';

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

    // Add response interceptor for error handling and automatic token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // If error is 401 and we haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Try to refresh the token
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              
              // Use a fresh axios instance to avoid interceptor loops
              const refreshResponse = await axios.post(`${this.axiosInstance.defaults.baseURL}/auth/refresh`, {
                refreshToken: refreshToken
              });
              
              const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;
              
              // Update stored tokens
              localStorage.setItem('authToken', accessToken);
              if (newRefreshToken) {
                localStorage.setItem('refreshToken', newRefreshToken);
              }
              
              // Update default headers
              this.setAuthToken(accessToken);
              
              // Retry the original request with the new token
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // Clear auth data and redirect to login would happen here
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            this.clearAuth();
            
            // You might want to emit an event or call a global auth handler here
            // For now, we'll just let the error propagate
          }
        }
        
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
                              result.metadata.respondingAgentName ||
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
            respondingAgentName: respondingAgentName,
            ...result.metadata
          },
          response_message: {
            role: 'assistant',
            parts: [{ 
              type: 'text',
              text: result.response || result.message || result.result || 'Task completed' 
            }],
            metadata: {
              respondingAgentName: respondingAgentName
            }
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          session_id: sessionId || null
        };
      }

      throw new Error('No result in JSON-RPC response');
    } catch (error) {
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
      throw error;
    }
  }

  async getAgentHierarchy(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/agents/.well-known/hierarchy');
      return response.data;
    } catch (error) {
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
      throw error;
    }
  }

  /**
   * Generic GET method
   */
  async get(url: string): Promise<any> {
    console.log(`ApiService.get: ${url}`);
    
    try {
      // Use axios default headers (set via setAuthToken) instead of manually fetching from localStorage
      const response = await this.axiosInstance.get(url);
      console.log(`ApiService.get response for ${url}:`, {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        dataType: typeof response.data
      });
      
      console.log('About to return response.data from GET:', response.data);
      console.log('GET response.data is undefined:', response.data === undefined);
      console.log('GET response.data is null:', response.data === null);
      
      return response.data;
    } catch (error) {
      console.error(`ApiService.get error for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Generic POST method
   */
  async post(url: string, data?: any): Promise<any> {
    console.log(`ApiService.post: ${url}`, data);
    
    try {
      // Use axios default headers (set via setAuthToken) instead of manually fetching from localStorage
      const response = await this.axiosInstance.post(url, data);
      console.log(`ApiService.post response for ${url}:`, {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        dataType: typeof response.data
      });
      
      console.log('About to return response.data:', response.data);
      console.log('response.data is undefined:', response.data === undefined);
      console.log('response.data is null:', response.data === null);
      console.log('Full response object:', response);
      
      return response.data;
    } catch (error) {
      console.error(`ApiService.post error for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Generic PUT method
   */
  async put(url: string, data?: any): Promise<any> {
    // Use axios default headers (set via setAuthToken) instead of manually fetching from localStorage
    const response = await this.axiosInstance.put(url, data);
    return response.data;
  }

  /**
   * Generic DELETE method
   */
  async delete(url: string): Promise<any> {
    // Use axios default headers (set via setAuthToken) instead of manually fetching from localStorage
    const response = await this.axiosInstance.delete(url);
    return response.data;
  }


  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return API_BASE_URL;
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Legacy export for backward compatibility
export const nestjsApiService = apiService;

// Default export for legacy compatibility
export default apiService; 