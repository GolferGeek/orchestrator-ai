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
import { TaskStatusService } from '@/tasks/task-status.service';
import { TasksService } from '@/tasks/tasks.service';

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
  requestTransform?: any; // Request transformation configuration (string template or object)
  responseTransform?: any; // Response transformation configuration (string or object)
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
export class ApiAgentBaseService
  extends A2AAgentBaseService
  implements OnModuleInit
{
  protected readonly apiLogger = new Logger(ApiAgentBaseService.name);
  private apiConfiguration: ApiConfiguration | null = null;
  protected readonly agentContextService = new AgentContextService();
  private currentUserId: string | null = null; // Store current user ID for task completion
  private currentTaskId: string | null = null; // Store current task ID for task completion

  constructor(
    protected readonly httpService: HttpService,
    protected readonly taskStatusService?: TaskStatusService,
    protected readonly tasksService?: TasksService,
    agentRegistrationService?: AgentRegistrationService,
    jsonRpcProtocolService?: JsonRpcProtocolService,
    loggingService?: LoggingService,
    authService?: AuthService,
    configurationService?: ConfigurationService,
  ) {
    super(
      httpService,
      taskStatusService, // Pass TaskStatusService to parent
      undefined, // No deliverablesService for API agents
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService,
      configurationService,
    );

    this.apiLogger.debug(`API Agent initialized with services:`, {
      hasTaskStatusService: !!taskStatusService,
      hasTasksService: !!tasksService,
    });
  }

  /**
   * Initialize the API agent and load configuration from agent.yaml
   */
  async onModuleInit() {
    this.apiLogger.debug(`onModuleInit called for ${this.getAgentName()}`);

    // Call parent initialization first
    await super.onModuleInit();

    this.apiLogger.debug(
      `Parent onModuleInit completed for ${this.getAgentName()}, loading API configuration...`,
    );

    // Load API configuration from agent.yaml
    await this.loadApiConfigurationFromYaml();
  }

  /**
   * Load API configuration from agent.yaml file using AgentContextService
   */
  private async loadApiConfigurationFromYaml(): Promise<void> {
    this.apiLogger.debug(
      `Loading API configuration from YAML for ${this.getAgentName()}`,
    );

    let agentPath = this.agentPath;

    // Fallback: If agent path is unknown, try to determine it from the agent name
    if (!agentPath || agentPath === 'unknown') {
      const agentName = this.getAgentName();
      this.apiLogger.debug(
        `Agent path is unknown, attempting to determine from agent name: ${agentName}`,
      );

      // Map known agent names to their paths
      const agentPathMap: Record<string, string> = {
        'Rules Of Golf Agent': 'specialists/golf_rules_agent',
        'Rules Of Golf Expert': 'specialists/golf_rules_agent',
        'Golf Rules Agent': 'specialists/golf_rules_agent',
        'Travel Planner': 'specialists/travel_planner',
        'Google Hello World': 'external/google_hello_world',
        // Add more mappings as needed
      };

      agentPath = agentPathMap[agentName];

      if (agentPath) {
        this.apiLogger.debug(
          `Mapped agent name "${agentName}" to path: ${agentPath}`,
        );
        this.agentPath = agentPath; // Update the stored path
      } else {
        this.apiLogger.warn(
          `Could not map agent name "${agentName}" to a known path`,
        );
        return;
      }
    }

    this.apiLogger.debug(`Using agent path: ${agentPath}`);
    this.apiLogger.debug(`Process CWD: ${process.cwd()}`);
    this.apiLogger.debug(`__dirname: ${__dirname}`);

    try {
      // Try multiple path resolution strategies
      const possibleDirectories = [
        // Strategy 1: Use process.cwd() + src/agents/actual/[agentPath]
        path.join(process.cwd(), 'src/agents/actual', agentPath),
        // Strategy 2: Use process.cwd() + dist/agents/actual/[agentPath]
        path.join(process.cwd(), 'dist/agents/actual', agentPath),
        // Strategy 3: Use relative from current file location
        path.join(process.cwd(), 'apps/api/src/agents/actual', agentPath),
        // Strategy 4: Use __dirname and navigate up to src
        path.join(__dirname, '../../../../../agents/actual', agentPath),
        // Strategy 5: Use absolute path from workspace root
        path.join(
          process.cwd(),
          '../../../apps/api/src/agents/actual',
          agentPath,
        ),
      ];

      let yamlPath: string | null = null;

      for (const dir of possibleDirectories) {
        const testPath = path.join(dir, 'agent.yaml');
        this.apiLogger.debug(`Trying directory: ${dir}`);

        if (fs.existsSync(testPath)) {
          yamlPath = testPath;
          this.apiLogger.debug(`Found agent.yaml at: ${yamlPath}`);
          break;
        } else {
          this.apiLogger.debug(`No agent.yaml found at: ${testPath}`);
        }
      }

      if (!yamlPath) {
        this.apiLogger.error(
          `Could not find agent.yaml in any of the expected locations for ${this.getAgentName()}`,
        );
        return;
      }

      this.apiLogger.debug(`Using agent directory: ${agentPath}`);

      if (fs.existsSync(yamlPath)) {
        this.apiLogger.debug(`Found agent.yaml at: ${yamlPath}`);

        // Extract the directory name for AgentContextService (it expects just the directory)
        const agentDirectory = path.dirname(yamlPath);
        this.apiLogger.debug(
          `Using agent directory for context service: ${agentDirectory}`,
        );

        try {
          // Load context using the absolute directory path
          await this.agentContextService.initialize(agentDirectory);

          // Extract API configuration from the loaded context
          const config = this.extractApiConfigurationFromContext();

          if (config) {
            this.apiLogger.debug(
              `API configuration found in YAML for ${this.getAgentName()}`,
            );

            // Use ConfigurationService for environment variable substitution if available
            if (this.configurationService) {
              const substitutionResult =
                this.configurationService.substituteEnvVars(
                  config,
                  'API_',
                  false, // not strict mode
                );

              this.setApiConfiguration(substitutionResult.data);

              if (substitutionResult.substitutedVars.length > 0) {
                this.apiLogger.debug(
                  `Environment variables substituted: ${substitutionResult.substitutedVars.join(', ')}`,
                );
              }
            } else {
              // Fallback: use config as-is without environment variable substitution
              this.apiLogger.debug(
                'ConfigurationService not available, using config without env var substitution',
              );
              this.setApiConfiguration(config);
            }

            this.apiLogger.debug(
              `API configuration loaded successfully for ${this.getAgentName()}`,
            );
            return;
          } else {
            this.apiLogger.warn(
              `No api_configuration section found in YAML for ${this.getAgentName()}`,
            );
          }
        } catch (error: any) {
          this.apiLogger.error(
            `Failed to load agent context from YAML for ${this.getAgentName()}: ${error.message}`,
          );
        }

        return; // Found the file, but couldn't load config
      } else {
        this.apiLogger.debug(`No agent.yaml found at: ${yamlPath}`);
      }
    } catch (error) {
      this.apiLogger.error(
        `Error loading API configuration for ${this.getAgentName()}:`,
        error,
      );
    }
  }

  /**
   * Extract API configuration from the loaded agent context
   */
  private extractApiConfigurationFromContext(): ApiConfiguration | null {
    try {
      const context = this.agentContextService;
      // Agent context available

      if (!context?.metadata?.api_configuration) {
        this.apiLogger.warn(
          'No api_configuration found in agent context metadata',
        );
        return null;
      }

      const apiConfig = context.metadata.api_configuration;
      this.apiLogger.debug(
        'Raw api_configuration from YAML:',
        JSON.stringify(apiConfig, null, 2),
      );

      const config: ApiConfiguration = {
        endpoint: apiConfig.endpoint,
        method: apiConfig.method || 'POST',
        timeout: apiConfig.timeout || 30000,
        headers: apiConfig.headers || {},
        authentication: apiConfig.authentication || null,
        retry: apiConfig.retry || {
          attempts: 3,
          delay: 1000,
          backoff: 'linear',
        },
        requestTransform: apiConfig.request_transform || undefined,
        responseTransform: apiConfig.response_transform || undefined,
      };

      this.apiLogger.debug(
        'Extracted API configuration:',
        JSON.stringify(config, null, 2),
      );
      this.apiLogger.debug(
        'Request transform extracted:',
        config.requestTransform,
      );
      this.apiLogger.debug(
        'Response transform extracted:',
        config.responseTransform,
      );

      return config;
    } catch (error) {
      this.apiLogger.error(
        'Error extracting API configuration from context:',
        error,
      );
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
    this.apiLogger.debug(
      `ExecuteTask called for ${agentName}, method: ${method}`,
    );

    // Store current user ID and task ID for task completion
    if (params.currentUser?.id) {
      this.currentUserId = params.currentUser.id;
    }
    if (params.taskId) {
      this.currentTaskId = params.taskId;
    }

    this.apiLogger.debug(`Task execution context:`, {
      taskId: this.currentTaskId,
      userId: this.currentUserId,
      hasTasksService: !!this.tasksService,
      hasTaskStatusService: !!this.taskStatusService,
      agentName: this.getAgentName(),
    });

    // Log what services were injected during construction
    this.apiLogger.debug(`API Agent services status:`, {
      hasTasksService: !!this.tasksService,
      hasTaskStatusService: !!this.taskStatusService,
      tasksServiceType: this.tasksService
        ? this.tasksService.constructor.name
        : 'undefined',
      taskStatusServiceType: this.taskStatusService
        ? this.taskStatusService.constructor.name
        : 'undefined',
    });

    try {
      // Lazy loading: If no API configuration, try to load it now
      if (!this.apiConfiguration) {
        this.apiLogger.debug(
          `No API configuration found, attempting lazy loading for ${agentName}...`,
        );
        await this.loadApiConfigurationFromYaml();
      }

      // If still no API configuration, fall back to simple response
      if (!this.apiConfiguration) {
        this.apiLogger.debug(
          `No API configuration for ${agentName}, using fallback`,
        );
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
          timestamp: new Date().toISOString(),
        },
      };

      // Execute the API call
      const result = await this.callExternalApi(apiParams);

      this.apiLogger.debug(`API call executed successfully for ${agentName}`);

      const response = {
        success: true,
        response: result.response,
        metadata: {
          agentType: this.getAgentType(),
          apiStatus: 'executed',
          processedAt: new Date().toISOString(),
          rawApiResponse: result.rawApiResponse,
          ...apiParams.metadata,
        },
      };

      // Save the task result to the database for async tasks
      this.apiLogger.debug(`About to save API task result...`);
      await this.saveApiTaskResult(result);
      this.apiLogger.debug(`API task result save completed`);

      return response;
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
          processedAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Call external API with retry logic
   */
  private async callExternalApi(
    params: ApiAgentParams,
  ): Promise<ApiAgentResponse> {
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

        this.apiLogger.debug(
          `Making HTTP ${config.method} request to: ${config.endpoint}`,
        );
        this.apiLogger.debug(`Request headers:`, headers);
        this.apiLogger.debug(`Request data:`, requestData);

        // Make the HTTP request
        const response = await firstValueFrom(
          this.httpService.request({
            method: config.method,
            url: config.endpoint,
            data: ['POST', 'PUT', 'PATCH'].includes(config.method)
              ? requestData
              : undefined,
            params: ['GET', 'DELETE'].includes(config.method)
              ? requestData
              : undefined,
            headers,
            timeout: config.timeout || 30000,
          }),
        );

        this.apiLogger.debug(`HTTP response status: ${response.status}`);
        this.apiLogger.debug(`HTTP response headers:`, response.headers);
        this.apiLogger.debug(
          `HTTP response data type: ${typeof response.data}`,
        );
        this.apiLogger.debug(`HTTP response data:`, response.data);

        // Transform response
        const transformedResponse = this.transformResponse(
          response.data,
          params,
        );

        return {
          response: transformedResponse,
          rawApiResponse: response.data,
          metadata: {
            statusCode: response.status,
            attempt,
            responseTime: Date.now(),
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.apiLogger.warn(
          `API call attempt ${attempt}/${maxAttempts} failed:`,
          lastError.message,
        );

        if (attempt < maxAttempts) {
          const delay =
            backoffType === 'exponential'
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
      const defaultData = {
        message: params.userMessage,
        sessionId: params.sessionId,
        user: params.currentUser,
        timestamp: params.metadata.timestamp,
      };
      this.apiLogger.debug(`Using default request transform:`, defaultData);
      return defaultData;
    }

    // Handle specific transformation formats
    if (
      typeof config.requestTransform === 'object' &&
      config.requestTransform.format === 'n8n'
    ) {
      const n8nData = {
        sessionId: params.sessionId,
        prompt: params.userMessage,
        user: params.currentUser?.email || 'anonymous',
        timestamp: params.metadata.timestamp,
      };
      this.apiLogger.debug(`Using N8N request transform:`, n8nData);
      return n8nData;
    }

    // Handle custom template format
    if (
      typeof config.requestTransform === 'object' &&
      config.requestTransform.format === 'custom' &&
      config.requestTransform.template
    ) {
      try {
        let templateString = config.requestTransform.template;

        // Replace template variables
        templateString = templateString.replace(
          /\{\{sessionId\}\}/g,
          params.sessionId,
        );
        templateString = templateString.replace(
          /\{\{userMessage\}\}/g,
          params.userMessage,
        );
        templateString = templateString.replace(
          /\{\{userId\}\}/g,
          params.currentUser?.id || 'anonymous',
        );
        templateString = templateString.replace(
          /\{\{userEmail\}\}/g,
          params.currentUser?.email || 'anonymous',
        );
        templateString = templateString.replace(
          /\{\{timestamp\}\}/g,
          params.metadata.timestamp,
        );

        const customData = JSON.parse(templateString);
        this.apiLogger.debug(
          `Using custom template request transform:`,
          customData,
        );
        return customData;
      } catch (error) {
        this.apiLogger.error(`Error parsing custom template:`, error);
        // Fall back to default
        const defaultData = {
          message: params.userMessage,
          sessionId: params.sessionId,
        };
        this.apiLogger.debug(
          `Falling back to default request transform:`,
          defaultData,
        );
        return defaultData;
      }
    }

    // If transform format is a JSON template string, parse and use it
    if (typeof config.requestTransform === 'string') {
      try {
        // First do template substitution
        let templateString = config.requestTransform;
        templateString = templateString.replace(
          /\{\{sessionId\}\}/g,
          `"${params.sessionId}"`,
        );
        templateString = templateString.replace(
          /\{\{userMessage\}\}/g,
          `"${params.userMessage}"`,
        );
        templateString = templateString.replace(
          /\{\{userId\}\}/g,
          `"${params.currentUser?.id || 'anonymous'}"`,
        );
        templateString = templateString.replace(
          /\{\{userEmail\}\}/g,
          `"${params.currentUser?.email || 'anonymous'}"`,
        );
        templateString = templateString.replace(
          /\{\{timestamp\}\}/g,
          `"${params.metadata.timestamp}"`,
        );

        const template = JSON.parse(templateString);
        this.apiLogger.debug(
          `Using JSON template request transform:`,
          template,
        );
        return template;
      } catch (error) {
        this.apiLogger.error(
          `Error parsing request transform template:`,
          error,
        );
      }
    }

    // Default fallback
    const defaultData = {
      message: params.userMessage,
      sessionId: params.sessionId,
      user: params.currentUser,
      timestamp: params.metadata.timestamp,
    };
    this.apiLogger.debug(`Using fallback request transform:`, defaultData);
    return defaultData;
  }

  /**
   * Transform API response to A2A format
   */
  private transformResponse(apiResponse: any, _params: ApiAgentParams): string {
    const config = this.apiConfiguration;

    this.apiLogger.debug(`Raw API response received:`, apiResponse);
    this.apiLogger.debug(
      `Response transform config:`,
      config?.responseTransform,
    );

    // If no transform specified, use default extraction
    if (!config?.responseTransform) {
      this.apiLogger.debug(
        'No response transform specified, using default extraction',
      );

      // Try common response field names
      if (typeof apiResponse === 'string') {
        this.apiLogger.debug('Response is already a string, returning as-is');
        return apiResponse;
      }

      const commonFields = [
        'output',
        'response',
        'message',
        'result',
        'content',
        'text',
      ];
      for (const field of commonFields) {
        if (apiResponse[field] && typeof apiResponse[field] === 'string') {
          this.apiLogger.debug(
            `Found response in field '${field}':`,
            apiResponse[field],
          );
          return apiResponse[field];
        }
      }

      // Fallback to stringified response
      this.apiLogger.debug(
        'No suitable field found, stringifying entire response',
      );
      return JSON.stringify(apiResponse);
    }

    // Handle field extraction format
    if (
      typeof config.responseTransform === 'object' &&
      config.responseTransform.format === 'field_extraction'
    ) {
      const fieldName = config.responseTransform.field;
      this.apiLogger.debug(`Using field extraction for field '${fieldName}'`);

      if (
        typeof apiResponse === 'object' &&
        apiResponse !== null &&
        apiResponse[fieldName] !== undefined
      ) {
        this.apiLogger.debug(
          `Extracted field '${fieldName}':`,
          apiResponse[fieldName],
        );
        return String(apiResponse[fieldName]);
      } else {
        this.apiLogger.warn(
          `Field '${fieldName}' not found in response, falling back to default extraction`,
        );
        return String(apiResponse);
      }
    }

    // Handle specific transformation formats
    if (config.responseTransform === 'standard') {
      this.apiLogger.debug('Using standard response transform');
      // For standard format, look for common fields
      if (typeof apiResponse === 'string') {
        return apiResponse;
      }

      const standardFields = ['output', 'response', 'message', 'result'];
      for (const field of standardFields) {
        if (apiResponse[field] && typeof apiResponse[field] === 'string') {
          this.apiLogger.debug(
            `Standard transform found response in field '${field}':`,
            apiResponse[field],
          );
          return apiResponse[field];
        }
      }

      return JSON.stringify(apiResponse);
    }

    // Simple transformation logic
    try {
      // For now, implement basic field extraction
      if (config.responseTransform.startsWith('$.')) {
        // Simple JSONPath-like extraction
        const fieldPath = config.responseTransform.slice(2);
        const fieldValue = this.extractNestedField(apiResponse, fieldPath);
        this.apiLogger.debug(
          `JSONPath extraction for '${fieldPath}':`,
          fieldValue,
        );
        return fieldValue || JSON.stringify(apiResponse);
      }

      // Direct field name
      const directValue = apiResponse[config.responseTransform];
      this.apiLogger.debug(
        `Direct field extraction for '${config.responseTransform}':`,
        directValue,
      );
      return directValue || JSON.stringify(apiResponse);
    } catch (error) {
      this.apiLogger.warn(
        'Response transformation failed, using default format:',
        error,
      );
      return JSON.stringify(apiResponse);
    }
  }

  /**
   * Prepare HTTP headers including authentication
   */
  private prepareHeaders(
    config: ApiConfiguration,
    _params: ApiAgentParams,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `A2A-Agent/${this.getAgentName()}`,
      ...config.headers,
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
            const credentials = Buffer.from(
              `${auth.username}:${auth.password}`,
            ).toString('base64');
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
      const messageProps = [
        'message',
        'userMessage',
        'prompt',
        'input',
        'content',
        'text',
      ];

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
  private async fallbackResponse(method: string, _params: any): Promise<any> {
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
        processedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Save API task result to database (matching context agent pattern)
   */
  protected async saveApiTaskResult(result: any): Promise<void> {
    if (!this.tasksService) {
      this.apiLogger.debug(`Cannot save result - TasksService not available`);
      return;
    }

    if (!this.currentUserId || !this.currentTaskId) {
      this.apiLogger.debug(`Cannot save result - missing user or task ID:`, {
        userId: this.currentUserId,
        taskId: this.currentTaskId,
      });
      return;
    }

    try {
      const updateData = {
        status: 'completed' as const,
        progress: 100,
        response: typeof result === 'string' ? result : JSON.stringify(result),
        responseMetadata: {
          ...result.metadata,
          agentName: this.getAgentName(),
          agentType: this.getAgentType(),
          apiStatus: 'executed',
          processedAt: new Date().toISOString(),
          taskId: this.currentTaskId,
          userId: this.currentUserId,
        },
      };

      this.apiLogger.debug(`Saving API task result to database:`, {
        taskId: this.currentTaskId,
        userId: this.currentUserId,
        agentName: this.getAgentName(),
      });

      await this.tasksService.updateTask(
        this.currentTaskId,
        this.currentUserId,
        updateData,
      );

      this.apiLogger.debug(
        `✅ API Task ${this.currentTaskId} result saved to database successfully`,
      );
    } catch (error) {
      this.apiLogger.error(
        `❌ Failed to save API task ${this.currentTaskId} result:`,
        error,
      );
      throw error;
    }
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
      configuredAt: this.apiConfiguration ? new Date().toISOString() : null,
    };
  }
}
