import axios, { AxiosInstance, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { TaskResponse, AgentInfo } from '../types/chat';
import { LLMSelection, SendMessageRequest, SendMessageResponse } from '../types/llm';
import { getSecureApiBaseUrl, getSecureHeaders, validateSecureContext, logSecurityConfig } from '../utils/securityConfig';
import { useApiSanitization } from '@/composables/useApiSanitization';
import { useErrorStore } from '@/stores/errorStore';
import { trackAPI } from '../utils/performanceMonitor';

// Validate security context on startup
validateSecureContext();

// API endpoint configuration with HTTPS enforcement
const API_BASE_URL = getSecureApiBaseUrl();

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
  private apiSanitization = useApiSanitization();
  private _errorStore?: ReturnType<typeof useErrorStore>;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: getSecureHeaders(),
      timeout: 60000,
      // Additional security settings
      withCredentials: false, // Don't send credentials cross-origin unless explicitly needed
      maxRedirects: 0, // Prevent redirect attacks
    });

    // Log security configuration in development
    if (import.meta.env.DEV) {
      logSecurityConfig();
    }

    // Configure retry logic for failed requests
    axiosRetry(this.axiosInstance, {
      retries: 3, // Number of retry attempts
      retryDelay: axiosRetry.exponentialDelay, // Exponential backoff
      retryCondition: (error) => {
        // Retry on network errors or 5xx server errors
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response?.status ? error.response.status >= 500 : false) ||
               error.response?.status === 429; // Rate limiting
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.log(`🔄 API Retry attempt ${retryCount} for ${requestConfig.url}:`, error.message);
      }
    });

    // Add request interceptor for performance tracking
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add start time for performance tracking
        config.metadata = { startTime: performance.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling, automatic token refresh, and performance tracking
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Track API performance
        const config = response.config as any;
        if (config.metadata?.startTime) {
          const responseTime = performance.now() - config.metadata.startTime;
          const endpoint = config.url || 'unknown';
          const method = (config.method || 'GET').toUpperCase();
          trackAPI(endpoint, method, responseTime, response.status);
        }
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // Track API performance for errors too
        if (originalRequest.metadata?.startTime) {
          const responseTime = performance.now() - originalRequest.metadata.startTime;
          const endpoint = originalRequest.url || 'unknown';
          const method = (originalRequest.method || 'GET').toUpperCase();
          const status = error.response?.status || 0;
          trackAPI(endpoint, method, responseTime, status);
        }
        
        // Global API failure detection - log all API errors
        this.logApiFailure(error, originalRequest);
        
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
            
            // Log the refresh token failure as a critical error
            this.logApiFailure(refreshError, { url: '/auth/refresh', method: 'POST' });
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get error store instance (lazy-loaded)
   */
  private get errorStore() {
    if (!this._errorStore) {
      this._errorStore = useErrorStore();
    }
    return this._errorStore;
  }

  /**
   * Global API failure detection and logging
   */
  private logApiFailure(error: any, requestConfig: any) {
    try {
      // Skip logging for optional endpoints when explicitly requested
      const status = error?.response?.status;
      const suppressed: number[] = Array.isArray(requestConfig?._suppressStatuses)
        ? (requestConfig._suppressStatuses as number[])
        : [];
      if ((requestConfig?._suppress404Logging && status === 404) || (suppressed.length && status && suppressed.includes(status))) {
        return;
      }
      // Determine error type and severity
      const errorType = this.determineErrorType(error);
      const severity = this.determineErrorSeverity(error);
      
      // Create comprehensive error context
      const context = {
        url: requestConfig?.url || 'unknown',
        method: requestConfig?.method?.toUpperCase() || 'unknown',
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        requestData: requestConfig?.data,
        timeout: error.code === 'ECONNABORTED',
        networkError: !error.response,
        retryCount: requestConfig?._retryCount || 0,
        timestamp: Date.now()
      };

      // Log to error store
      const apiError = new Error(this.formatErrorMessage(error, context));
      apiError.stack = error.stack;
      apiError.name = 'ApiError';
      
      this.errorStore.addError(apiError, {
        component: 'ApiService',
        url: context.url,
        additionalContext: {
          ...context,
          originalErrorType: errorType,
          originalSeverity: severity
        }
      });

      // Console logging for development
      if (import.meta.env.DEV) {
        console.group(`🚨 API Failure Detected [${severity.toUpperCase()}]`);
        console.error('Error:', error.message);
        console.log('Request:', context);
        console.log('Full Error:', error);
        console.groupEnd();
      }

      // Check for critical patterns that need immediate attention
      this.checkForCriticalPatterns(error, context);

    } catch (loggingError) {
      console.error('Failed to log API failure:', loggingError);
    }
  }

  /**
   * Determine the type of error for categorization
   */
  private determineErrorType(error: any): 'network' | 'api' | 'permission' | 'validation' | 'unknown' {
    if (!error.response) {
      return 'network'; // Network/connection errors
    }
    
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return 'permission';
    }
    if (status >= 400 && status < 500) {
      return 'validation'; // Client errors
    }
    if (status >= 500) {
      return 'api'; // Server errors
    }
    
    return 'unknown';
  }

  /**
   * Determine error severity based on status and context
   */
  private determineErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    const status = error.response?.status;
    
    // Network errors are always high severity
    if (!error.response) {
      return 'high';
    }
    
    // Critical server errors
    if (status >= 500) {
      return 'critical';
    }
    
    // Auth errors are high priority
    if (status === 401 || status === 403) {
      return 'high';
    }
    
    // Client errors are medium
    if (status >= 400 && status < 500) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Format a user-friendly error message
   */
  private formatErrorMessage(error: any, context: any): string {
    const { status, method, url } = context;
    
    if (!error.response) {
      return `Network connection failed for ${method} ${url}`;
    }
    
    switch (status) {
      case 401:
        return 'Authentication required - please log in again';
      case 403:
        return 'Access denied - insufficient permissions';
      case 404:
        return `Resource not found: ${method} ${url}`;
      case 429:
        return 'Too many requests - please wait and try again';
      case 500:
        return 'Server error - our team has been notified';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable - please try again';
      default:
        return `API request failed: ${method} ${url} (${status})`;
    }
  }

  /**
   * Check for patterns that indicate critical system issues
   */
  private checkForCriticalPatterns(error: any, context: any) {
    // Pattern 1: Multiple 5xx errors in short time frame
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentServerErrors = this.errorStore.recentErrors
      .filter((e: any) => e.timestamp > fiveMinutesAgo && e.context?.status >= 500);
    
    if (recentServerErrors.length >= 3) {
      const outageError = new Error('Critical: Multiple server errors detected - possible system outage');
      outageError.name = 'SystemOutageError';
      this.errorStore.addError(outageError, {
        component: 'ApiService',
        additionalContext: { 
          pattern: 'server_outage', 
          errorCount: recentServerErrors.length,
          severity: 'critical'
        }
      });
    }

    // Pattern 2: Network connectivity issues
    if (!error.response && context.retryCount >= 2) {
      const networkError = new Error('Critical: Persistent network connectivity issues detected');
      networkError.name = 'NetworkOutageError';
      this.errorStore.addError(networkError, {
        component: 'ApiService',
        additionalContext: { 
          pattern: 'network_outage', 
          retryCount: context.retryCount,
          severity: 'critical'
        }
      });
    }

    // Pattern 3: Auth system failures
    if (context.status === 401 && context.url.includes('/auth/')) {
      const authError = new Error('Critical: Authentication system failure detected');
      authError.name = 'AuthSystemFailureError';
      this.errorStore.addError(authError, {
        component: 'ApiService',
        url: context.url,
        additionalContext: { 
          pattern: 'auth_system_failure',
          severity: 'critical'
        }
      });
    }
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
      
      // Create and sanitize the request payload
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

      // Sanitize the orchestrator request params
      const paramsToSanitize = {
        ...requestPayload.params,
        session_id: requestPayload.params.session_id || undefined // Convert null to undefined
      };
      const sanitizedParams = this.apiSanitization.sanitizeOrchestratorRequest(paramsToSanitize);
      const sanitizedPayload = { ...requestPayload, params: sanitizedParams };

      const response = await this.axiosInstance.post<JsonRpcResponse>(
        '/agents/orchestrator/orchestrator/tasks', 
        sanitizedPayload,
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

    
    try {
      // Use axios default headers (set via setAuthToken) instead of manually fetching from localStorage
      const response = await this.axiosInstance.get(url);

      

      

      
      return response.data;
    } catch (error) {
console.error(`ApiService.get error for ${url}:`, error);
      throw error;
    }
  }

  /**
   * GET but suppress error-store logging for 404s (for optional/demo endpoints)
   */
  async getQuiet404(url: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(url, { _suppress404Logging: true } as any);
      return response.data;
    } catch (error) {
      // Bubble up so caller can handle 404s; interceptor will skip logging
      throw error;
    }
  }

  /**
   * Generic POST method
   */
  async post(url: string, data?: any): Promise<any> {

    
    try {
      // Use axios default headers (set via setAuthToken) instead of manually fetching from localStorage
      const response = await this.axiosInstance.post(url, data);

      

      
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

  /**
   * Process conversation with audio input via A2A tasks endpoint
   * IMPORTANT: This must match the exact format that normal text messages use
   */
  async processConversation(data: {
    conversationId: string;
    audioData: string;
    encoding: string;
    sampleRate: number;
    agentName?: string;
    agentType?: string;
    llmSelection?: any;
  }): Promise<{
    transcript: string;
    response: string;
    responseAudio?: string;
  }> {
    try {
      const authToken = localStorage.getItem('authToken');
      
      // Use default agent if not specified
      const agentName = data.agentName || 'assistant';
      const agentType = data.agentType || 'generalists';
      
      // Build conversation history (simplified for speech - we don't have access to the full chat store here)
      // In a real implementation, this should come from the ConversationalSpeechButton component
      const conversationHistory: any[] = [];
      
      // Debug: Log the incoming LLM selection
      console.log('🎤 [apiService.processConversation] Received llmSelection:', data.llmSelection);

      // Use the LLM selection as-is - no fallbacks, let errors surface
      const llmSelection = data.llmSelection;

      console.log('🎤 [apiService.processConversation] Using llmSelection:', llmSelection);
      
      // Generate unique task ID
      const taskId = crypto.randomUUID();
      
      // Send audio directly to A2A tasks endpoint with EXACT same format as normal text
      const taskRequest = {
        method: 'process',
        prompt: data.audioData, // Send base64 audio as the prompt
        conversationId: data.conversationId,
        conversationHistory: conversationHistory,
        llmSelection: llmSelection,
        executionMode: 'immediate', // Use immediate mode for speech
        taskId: taskId,
        metadata: {
          speechInput: true,
          originalEncoding: data.encoding,
          originalSampleRate: data.sampleRate,
          audioInput: true,
          encoding: data.encoding,
          sampleRate: data.sampleRate,
        }
      };
      
      const response = await this.axiosInstance.post(
        `/agents/${agentType}/${agentName}/tasks`,
        taskRequest,
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const result = response.data;
      
      // Extract the response from the A2A task result
      const taskResponse = result.result;
      const transcribedText = result.audioInput?.transcribedText || 'Audio transcription not available';
      const responseText = taskResponse?.message || taskResponse?.response || taskResponse?.content || 'No response available';
      const responseAudio = result.responseAudio; // Audio synthesis result if available
      
      return {
        transcript: transcribedText,
        response: responseText,
        responseAudio: responseAudio
      };
    } catch (error) {
      console.error('A2A Audio processing error:', error);
      throw error;
    }
  }

  /**
   * Start a speech conversation session
   */
  async startSpeechConversation(conversationId: string): Promise<{
    sessionId: string;
    status: string;
  }> {
    try {
      const authToken = localStorage.getItem('authToken');
      
      const response = await this.axiosInstance.post(
        '/speech/start-conversation',
        { conversationId },
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Speech start conversation error:', error);
      throw error;
    }
  }

  /**
   * End a speech conversation session
   */
  async endSpeechConversation(conversationId: string): Promise<void> {
    try {
      const authToken = localStorage.getItem('authToken');
      
      await this.axiosInstance.post(
        '/speech/end-conversation',
        { conversationId },
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined
          }
        }
      );
    } catch (error) {
      console.error('Speech end conversation error:', error);
      throw error;
    }
  }

  /**
   * Process audio stream for speech
   */
  async processSpeechAudio(audioBlob: Blob, conversationId: string): Promise<{
    transcript: string;
    response: string;
    responseAudio?: string;
  }> {
    try {
      const authToken = localStorage.getItem('authToken');
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('conversationId', conversationId);
      
      const response = await this.axiosInstance.post(
        '/speech/process-audio',
        formData,
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Speech audio processing error:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio to text only
   */
  async transcribeAudio(
    audioData: string,
    encoding?: string,
    sampleRate?: number
  ): Promise<{
    text: string;
    confidence: number;
  }> {
    try {
      const authToken = localStorage.getItem('authToken');
      
      const response = await this.axiosInstance.post(
        '/speech/transcribe',
        {
          audioData,
          encoding,
          sampleRate
        },
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Audio transcription error:', error);
      throw error;
    }
  }

  /**
   * Convert text to speech audio
   */
  async synthesizeText(
    text: string,
    voiceName?: string,
    speakingRate?: number
  ): Promise<{
    audioData: string;
    format: string;
  }> {
    try {
      const authToken = localStorage.getItem('authToken');
      
      const response = await this.axiosInstance.post(
        '/speech/synthesize',
        {
          text,
          voiceName,
          speakingRate
        },
        {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : undefined,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Text-to-speech synthesis error:', error);
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
