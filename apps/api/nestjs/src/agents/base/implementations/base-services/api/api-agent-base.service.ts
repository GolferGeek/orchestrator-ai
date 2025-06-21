import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs-extra';
import * as path from 'path';

import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { AgentRegistrationService } from '../../../sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '../../../sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '../../../sub-services/logging/logging.service';
import { AuthService } from '../../../sub-services/auth/auth.service';
import { ConfigurationService } from '../../../sub-services/configuration/configuration.service';
import { AgentContextService } from '../a2a-base/agent-context.service';

export interface ApiConfiguration {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  timeout?: number;
  headers?: Record<string, string>;
  authentication?: {
    type: 'api_key' | 'bearer' | 'basic' | 'oauth';
    key?: string;
    value?: string;
    username?: string;
    password?: string;
    header?: string;
  } | null;
  retry?: {
    attempts: number;
    delay: number;
    backoff: 'linear' | 'exponential';
  };
  requestTransform?: string; // JSONPath or simple mapping instructions
  responseTransform?: string; // JSONPath or simple mapping instructions
}

export interface ApiAgentParams {
  userMessage: string;
  sessionId?: string;
  conversationHistory?: any[];
  currentUser?: any;
  authToken?: string;
  metadata: {
    method: string;
    originalParams: any;
    agentName: string;
    timestamp: string;
  };
}

export interface ApiAgentResponse {
  response: string;
  rawApiResponse?: any;
  metadata?: any;
}

/**
 * API Agent Base Service that handles external API endpoint integrations
 * This provides clean API integration with proper error handling, authentication, and retry logic
 */
@Injectable()
export class ApiAgentBaseService extends A2AAgentBaseService implements OnModuleInit {
  protected readonly apiLogger = new Logger(ApiAgentBaseService.name);
  private apiConfiguration: ApiConfiguration | null = null;
  protected readonly agentContextService = new AgentContextService();

  constructor(
    protected readonly httpService: HttpService,
    agentRegistrationService?: AgentRegistrationService,
    jsonRpcProtocolService?: JsonRpcProtocolService,
    loggingService?: LoggingService,
    authService?: AuthService,
    configurationService?: ConfigurationService
  ) {
    super(
      httpService,
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService,
      configurationService
    );
  }

  /**
   * Initialize the API agent and load configuration from agent.yaml
   */
  async onModuleInit() {
    this.apiLogger.debug(`onModuleInit called for ${this.getAgentName()}`);
    
    // Call parent initialization first
    await super.onModuleInit();
    
    this.apiLogger.debug(`Parent onModuleInit completed for ${this.getAgentName()}, loading API configuration...`);
    
    // Load API configuration from agent.yaml
    await this.loadApiConfigurationFromYaml();
  }

  /**
   * Load API configuration from agent.yaml file using AgentContextService
   */
  private async loadApiConfigurationFromYaml(): Promise<void> {
    this.apiLogger.debug(`Loading API configuration from YAML for ${this.getAgentName()}`);
    
    if (!this.agentPath) {
      this.apiLogger.warn(`Agent path not set for ${this.getAgentName()}, cannot load configuration`);
      return;
    }

    this.apiLogger.debug(`Agent path: ${this.agentPath}`);
    
    try {
      const agentDirectory = path.join(
        process.cwd(),
        'src/agents/actual',
        this.agentPath
      );
      
      this.apiLogger.debug(`Looking for agent.yaml in directory: ${agentDirectory}`);
      
      // Initialize the AgentContextService with the agent directory
      await this.agentContextService.initialize(agentDirectory);
      
      if (!this.agentContextService.isLoaded) {
        this.apiLogger.warn(`Failed to load agent context from YAML for ${this.getAgentName()}`);
        return;
      }
      
      this.apiLogger.debug(`Agent context loaded successfully, extracting API configuration...`);
      
      // Extract API configuration from the loaded context metadata
      const config = this.extractApiConfigurationFromContext();
      if (config) {
        this.apiLogger.debug(`Extracted API configuration successfully:`, {
          endpoint: config.endpoint,
          method: config.method,
          hasAuthentication: !!config.authentication,
          authType: config.authentication?.type
        });
        
        // Use ConfigurationService for environment variable substitution
        const substitutionResult = this.configurationService.substituteEnvVars(
          config,
          'API_',
          false // not strict mode
        );
        
        this.setApiConfiguration(substitutionResult.data);
        this.apiLogger.log(`API configuration loaded successfully for ${this.getAgentName()}`);
        
        if (substitutionResult.substitutedVars.length > 0) {
          this.apiLogger.debug(`Environment variables substituted: ${substitutionResult.substitutedVars.join(', ')}`);
        }
      } else {
        this.apiLogger.warn(`No API configuration found in YAML for ${this.getAgentName()}`);
      }
    } catch (error) {
      this.apiLogger.error(`Error loading API configuration for ${this.getAgentName()}:`, error);
    }
  }

  /**
   * Extract API configuration from the loaded agent context
   */
  private extractApiConfigurationFromContext(): ApiConfiguration | null {
    try {
      // Check if there's api_configuration in the metadata
      const apiConfig = this.agentContextService.metadata?.api_configuration;
      
      if (!apiConfig) {
        this.apiLogger.debug('No api_configuration found in agent metadata');
        return null;
      }

      const config: ApiConfiguration = {
        endpoint: apiConfig.endpoint || '',
        method: (apiConfig.method || 'POST').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        timeout: apiConfig.timeout || 30000,
        headers: apiConfig.headers || { 'Content-Type': 'application/json' },
        authentication: apiConfig.authentication || null,
        retry: apiConfig.retry || { attempts: 3, delay: 1000, backoff: 'linear' },
        requestTransform: apiConfig.request_transform?.format || undefined,
        responseTransform: apiConfig.response_transform?.format || undefined
      };

      // Validate required fields
      if (!config.endpoint) {
        this.apiLogger.warn('API configuration missing required endpoint');
        return null;
      }

      return config;
    } catch (error) {
      this.apiLogger.error('Error extracting API configuration from context:', error);
      return null;
    }
  }

  /**
   * Set the API configuration (loaded from agent.md or agent-config.json)
   */
  setApiConfiguration(config: ApiConfiguration): void {
    // Environment variable substitution is handled by ConfigurationService in loadApiConfigurationFromContext
    this.apiConfiguration = config;
    this.apiLogger.debug(`API configuration set for ${this.getAgentName()}`);
  }

  /**
   * Main task execution using API endpoint
   */
  public async executeTask(method: string, params: any): Promise<any> {
    const agentName = this.getAgentName();
    this.apiLogger.debug(`ExecuteTask called for ${agentName}, method: ${method}`);
    
    try {
      // If no API configuration, fall back to simple response
      if (!this.apiConfiguration) {
        this.apiLogger.debug(`No API configuration for ${agentName}, using fallback`);
        return this.fallbackResponse(method, params);
      }

      // Prepare standardized parameters
      const apiParams: ApiAgentParams = {
        userMessage: this.extractUserMessage(params),
        sessionId: params.sessionId,
        conversationHistory: params.conversationHistory || [],
        currentUser: params.currentUser,
        authToken: params.authToken,
        metadata: {
          method,
          originalParams: params,
          agentName: agentName,
          timestamp: new Date().toISOString()
        }
      };

      // Execute the API call
      const result = await this.callExternalApi(apiParams);
      
      this.apiLogger.debug(`API call executed successfully for ${agentName}`);
      
      return {
        success: true,
        response: result.response,
        metadata: {
          agentType: this.getAgentType(),
          apiStatus: 'executed',
          processedAt: new Date().toISOString(),
          rawApiResponse: result.rawApiResponse,
          ...apiParams.metadata
        }
      };
      
    } catch (error) {
      this.apiLogger.error(`API execution error for ${agentName}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response: `I apologize, but I encountered an error while calling the external API. Please try again later.`,
        metadata: {
          agentName: agentName,
          agentType: this.getAgentType(),
          apiStatus: 'error',
          errorDetails: error instanceof Error ? error.message : String(error),
          processedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Call external API with retry logic
   */
  private async callExternalApi(params: ApiAgentParams): Promise<ApiAgentResponse> {
    if (!this.apiConfiguration) {
      throw new Error('API configuration not set');
    }

    const config = this.apiConfiguration;
    const maxAttempts = config.retry?.attempts || 3;
    const baseDelay = config.retry?.delay || 1000;
    const backoffType = config.retry?.backoff || 'exponential';

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Prepare request data
        const requestData = this.transformRequest(params);
        
        // Prepare headers
        const headers = this.prepareHeaders(config, params);
        
        // Make the HTTP request
        const response = await firstValueFrom(
          this.httpService.request({
            method: config.method,
            url: config.endpoint,
            data: ['POST', 'PUT', 'PATCH'].includes(config.method) ? requestData : undefined,
            params: ['GET', 'DELETE'].includes(config.method) ? requestData : undefined,
            headers,
            timeout: config.timeout || 30000,
          })
        );

        // Transform response
        const transformedResponse = this.transformResponse(response.data, params);

        return {
          response: transformedResponse,
          rawApiResponse: response.data,
          metadata: {
            statusCode: response.status,
            attempt,
            responseTime: Date.now()
          }
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.apiLogger.warn(`API call attempt ${attempt}/${maxAttempts} failed:`, lastError.message);

        if (attempt < maxAttempts) {
          const delay = backoffType === 'exponential' 
            ? baseDelay * Math.pow(2, attempt - 1)
            : baseDelay * attempt;
          
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('All API call attempts failed');
  }

  /**
   * Transform A2A request to API-specific format
   */
  private transformRequest(params: ApiAgentParams): any {
    const config = this.apiConfiguration;
    
    // If no transform specified, use default mapping
    if (!config?.requestTransform) {
      return {
        message: params.userMessage,
        session_id: params.sessionId,
        user: params.currentUser,
        timestamp: params.metadata.timestamp
      };
    }

    // Simple transformation logic (can be enhanced with JSONPath)
    try {
      // For now, implement basic field mapping
      const baseData = {
        userMessage: params.userMessage,
        sessionId: params.sessionId,
        conversationHistory: params.conversationHistory,
        currentUser: params.currentUser,
        metadata: params.metadata
      };

      // Simple string replacement for common patterns
      let transformedData = JSON.parse(
        config.requestTransform
          .replace(/\{\{userMessage\}\}/g, JSON.stringify(params.userMessage))
          .replace(/\{\{sessionId\}\}/g, JSON.stringify(params.sessionId))
          .replace(/\{\{timestamp\}\}/g, JSON.stringify(params.metadata.timestamp))
      );

      return transformedData;
    } catch (error) {
      this.apiLogger.warn('Request transformation failed, using default format:', error);
      return { message: params.userMessage };
    }
  }

  /**
   * Transform API response to A2A format
   */
  private transformResponse(apiResponse: any, params: ApiAgentParams): string {
    const config = this.apiConfiguration;
    
    // If no transform specified, use default extraction
    if (!config?.responseTransform) {
      // Try common response field names
      if (typeof apiResponse === 'string') {
        return apiResponse;
      }
      
      const commonFields = ['response', 'message', 'result', 'content', 'text', 'output'];
      for (const field of commonFields) {
        if (apiResponse[field] && typeof apiResponse[field] === 'string') {
          return apiResponse[field];
        }
      }
      
      // Fallback to stringified response
      return JSON.stringify(apiResponse);
    }

    // Simple transformation logic
    try {
      // For now, implement basic field extraction
      if (config.responseTransform.startsWith('$.')) {
        // Simple JSONPath-like extraction
        const fieldPath = config.responseTransform.slice(2);
        const fieldValue = this.extractNestedField(apiResponse, fieldPath);
        return fieldValue || JSON.stringify(apiResponse);
      }

      // Direct field name
      return apiResponse[config.responseTransform] || JSON.stringify(apiResponse);
    } catch (error) {
      this.apiLogger.warn('Response transformation failed, using default format:', error);
      return JSON.stringify(apiResponse);
    }
  }

  /**
   * Prepare HTTP headers including authentication
   */
  private prepareHeaders(config: ApiConfiguration, params: ApiAgentParams): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `A2A-Agent/${this.getAgentName()}`,
      ...config.headers
    };

    // Add authentication headers
    if (config.authentication) {
      const auth = config.authentication;
      
      switch (auth.type) {
        case 'api_key':
          if (auth.header && auth.value) {
            headers[auth.header] = auth.value;
          }
          break;
        case 'bearer':
          if (auth.value) {
            headers['Authorization'] = `Bearer ${auth.value}`;
          }
          break;
        case 'basic':
          if (auth.username && auth.password) {
            const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
        case 'oauth':
          // OAuth implementation would go here
          // For now, use bearer token if available
          if (auth.value) {
            headers['Authorization'] = `Bearer ${auth.value}`;
          }
          break;
      }
    }

    return headers;
  }

  // Environment variable substitution is now handled by ConfigurationService

  /**
   * Extract nested field from object using dot notation
   */
  private extractNestedField(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * Extract user message from parameters
   */
  private extractUserMessage(params: any): string {
    if (typeof params === 'string') {
      return params;
    }
    
    if (params && typeof params === 'object') {
      const messageProps = ['message', 'userMessage', 'prompt', 'input', 'content', 'text'];
      
      for (const prop of messageProps) {
        if (params[prop] && typeof params[prop] === 'string') {
          return params[prop];
        }
      }
      
      return JSON.stringify(params);
    }
    
    return String(params || '');
  }

  /**
   * Fallback response when no API configuration is available
   */
  private async fallbackResponse(method: string, params: any): Promise<any> {
    this.apiLogger.debug(`Using fallback response for ${this.getAgentName()}`);
    
    return {
      success: true,
      response: `Hello! I'm the ${this.getAgentName()} API agent. I'm ready to connect to external APIs, but my configuration isn't loaded yet. Please check back soon!`,
      metadata: {
        agentName: this.getAgentName(),
        agentType: this.getAgentType(),
        apiStatus: 'fallback',
        reason: 'No API configuration available',
        method,
        processedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set the discovered agent path (called by AgentDiscoveryService)
   */
  setDiscoveredPath(path: string): void {
    this.agentPath = path;
    this.apiLogger.debug(`Agent path set to: ${path}`);
  }

  /**
   * Get agent card with API status
   */
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();
    return {
      ...baseCard,
      apiStatus: this.apiConfiguration ? 'configured' : 'not_configured',
      endpoint: this.apiConfiguration?.endpoint || null,
      configuredAt: this.apiConfiguration ? new Date().toISOString() : null
    };
  }
} 