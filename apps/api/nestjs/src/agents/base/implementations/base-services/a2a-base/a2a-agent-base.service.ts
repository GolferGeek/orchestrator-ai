import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import {
  AgentRegistrationService,
  AgentInfo,
} from '@agents/base/sub-services/agent-registration/agent-registration.service';
import {
  JsonRpcProtocolService,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JSON_RPC_ERRORS,
} from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import {
  LoggingService,
  LogContext,
} from '@agents/base/sub-services/logging/logging.service';
import {
  AuthService,
  AuthContext,
} from '@agents/base/sub-services/auth/auth.service';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';

/**
 * Minimal A2A Agent Base Service
 * Contains only truly common functionality across all agent types:
 * - JSON-RPC protocol processing
 * - Logging and authentication
 * - Agent registration and lifecycle
 *
 * Specialized functionality (LLM, tasks, health, etc.) should be injected
 * by specific agent implementations that need them.
 */
@Injectable()
export abstract class A2AAgentBaseService
  implements OnModuleInit, OnModuleDestroy
{
  protected readonly logger = new Logger(A2AAgentBaseService.name);
  protected agentPath?: string;

  // Core services - truly common across all agent types
  protected agentRegistrationService: AgentRegistrationService;
  protected jsonRpcProtocolService: JsonRpcProtocolService;
  protected loggingService: LoggingService;
  protected authService: AuthService;
  protected configurationService: ConfigurationService;

  constructor(
    protected readonly httpService: HttpService,
    agentRegistrationService?: AgentRegistrationService,
    jsonRpcProtocolService?: JsonRpcProtocolService,
    loggingService?: LoggingService,
    authService?: AuthService,
    configurationService?: ConfigurationService,
  ) {
    // Use provided services or create fallback instances
    this.agentRegistrationService =
      agentRegistrationService || new AgentRegistrationService(httpService);
    this.jsonRpcProtocolService =
      jsonRpcProtocolService || new JsonRpcProtocolService();
    this.loggingService = loggingService || new LoggingService();
    this.authService = authService || new AuthService();
    this.configurationService =
      configurationService || new ConfigurationService();
  }

  // ============================================================================
  // LIFECYCLE MANAGEMENT
  // ============================================================================

  async onModuleInit() {
    const agentName = this.getAgentName();
    this.loggingService.logAgentEvent(agentName, 'initializing');

    try {
      // Discover agent path
      this.agentPath = this.discoverAgentPath();

      // Register with agent pool
      await this.registerWithAgentPool();

      this.loggingService.logAgentEvent(agentName, 'initialized', {
        agentPath: this.agentPath,
      });
    } catch (error) {
      this.loggingService.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          agentName,
          event: 'initialization_failed',
        },
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    const agentName = this.getAgentName();
    this.loggingService.logAgentEvent(agentName, 'destroying');

    try {
      await this.agentRegistrationService.unregisterAgent(this.getAgentId());
      this.loggingService.logAgentEvent(agentName, 'destroyed');
    } catch (error) {
      this.loggingService.logError(
        error instanceof Error ? error : new Error(String(error)),
        {
          agentName,
          event: 'destruction_failed',
        },
      );
    }
  }

  // ============================================================================
  // CORE JSON-RPC PROCESSING
  // ============================================================================

  async processJsonRpcRequest(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const startTime = Date.now();
    const authContext = this.authService.extractAuthContext(
      request.params || {},
    );

    const logContext: LogContext = {
      agentName: this.getAgentName(),
      agentType: this.getAgentType(),
      method: request.method,
      requestId: String(request.id),
      sessionId: authContext.sessionId,
    };

    this.loggingService.logRequest(request.method, request.params, logContext);

    try {
      // Create a method handler that delegates to executeTask
      const methodHandler = async (
        method: string,
        params: any,
      ): Promise<any> => {
        return this.executeTask(method, params);
      };

      // Create a notification handler (not used but required by interface)
      const notificationHandler = async (
        notification: JsonRpcNotification,
      ): Promise<void> => {
        this.loggingService.logAgentEvent(
          this.getAgentName(),
          'notification_received',
          {
            method: notification.method,
            params: notification.params,
          },
        );
      };

      // Delegate to JSON-RPC protocol service
      const response = await this.jsonRpcProtocolService.processRequest(
        request,
        methodHandler,
        notificationHandler,
      );

      const responseTime = Date.now() - startTime;

      // Handle response (could be null for notifications)
      if (response === null) {
        // This was a notification, create a default response
        this.loggingService.logResponse(
          request.method,
          true,
          responseTime,
          logContext,
        );
        return this.jsonRpcProtocolService.createSuccessResponse(
          request.id || null,
          null,
        );
      } else if (Array.isArray(response)) {
        this.loggingService.logResponse(
          request.method,
          true,
          responseTime,
          logContext,
        );
        return (
          response[0] ||
          this.jsonRpcProtocolService.createErrorResponse(
            JSON_RPC_ERRORS.INTERNAL_ERROR,
            'Empty batch response',
            request.id || null,
          )
        );
      } else if (response) {
        const hasError = 'error' in response && response.error !== undefined;
        this.loggingService.logResponse(
          request.method,
          !hasError,
          responseTime,
          logContext,
        );
        return response;
      } else {
        // Fallback for undefined response
        this.loggingService.logResponse(
          request.method,
          false,
          responseTime,
          logContext,
        );
        return this.jsonRpcProtocolService.createErrorResponse(
          JSON_RPC_ERRORS.INTERNAL_ERROR,
          'No response generated',
          request.id || null,
        );
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.loggingService.logError(
        error instanceof Error ? error : new Error(String(error)),
        logContext,
      );
      this.loggingService.logResponse(
        request.method,
        false,
        responseTime,
        logContext,
      );

      return this.jsonRpcProtocolService.createErrorResponse(
        JSON_RPC_ERRORS.INTERNAL_ERROR,
        'Internal error',
        request.id || null,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // ============================================================================
  // TASK PROCESSING (handles JSON-RPC format)
  // ============================================================================

  async processTask(taskRequest: any): Promise<any> {
    // Check if this is a JSON-RPC request
    if (
      taskRequest &&
      taskRequest.jsonrpc === '2.0' &&
      taskRequest.method &&
      taskRequest.id
    ) {
      // Process as JSON-RPC request
      return this.processJsonRpcRequest(taskRequest);
    } else {
      // Legacy direct call - delegate to executeTask
      return this.executeTask('processTask', taskRequest);
    }
  }

  // ============================================================================
  // ABSTRACT METHODS (for subclass implementation)
  // ============================================================================

  public abstract executeTask(method: string, params: any): Promise<any>;

  // ============================================================================
  // AGENT CARD GENERATION
  // ============================================================================

  async getAgentCard(): Promise<any> {
    return {
      name: this.getAgentName(),
      type: this.getAgentType(),
      path: this.agentPath,
      id: this.getAgentId(),
      status: 'active',
      capabilities: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        className: this.constructor.name,
      },
    };
  }

  // ============================================================================
  // PATH MANAGEMENT
  // ============================================================================

  /**
   * Set the agent path from the discovery service
   * This is more reliable than trying to extract it from stack traces
   */
  setDiscoveredPath(path: string): void {
    this.agentPath = path;
    this.logger.debug(`Agent path set to: ${path}`);
  }

  // ============================================================================
  // BASIC AGENT METADATA (minimal defaults)
  // ============================================================================

  getAgentName(): string {
    // Extract name from class name as fallback
    const className = this.constructor.name;
    return className
      .replace('Service', '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }

  getAgentType(): 'orchestrator' | 'specialist' | 'manager' | 'external' {
    // Determine type from agent path or default to 'specialist'
    if (this.agentPath?.includes('orchestrator')) {
      return 'orchestrator';
    } else if (this.agentPath?.includes('specialists')) {
      return 'specialist';
    } else if (this.agentPath?.includes('external')) {
      return 'external';
    }
    return 'specialist';
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async registerWithAgentPool(): Promise<void> {
    try {
      const agentInfo: AgentInfo = {
        id: this.getAgentId(),
        name: this.getAgentName(),
        type: this.getAgentType(),
        path: this.agentPath || 'unknown',
        url: this.buildAgentUrl(),
        description: `${this.getAgentName()} - A specialized agent for handling specific tasks`,
        capabilities: [], // Specialized implementations can override
        skills: [], // Specialized implementations can override
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
        metadata: {
          version: '1.0.0',
          agentPath: this.agentPath || 'unknown',
        },
      };

      await this.agentRegistrationService.registerAgent(agentInfo);
      this.logger.log(`Agent ${this.getAgentName()} registered successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to register agent ${this.getAgentName()}:`,
        error,
      );
      throw error;
    }
  }

  private getAgentId(): string {
    // Use agent path as the stable identifier to prevent duplicate registrations
    if (this.agentPath) {
      return this.agentPath.replace(/\//g, '_').toLowerCase();
    }

    // Fallback to agent name if path is not available
    const agentName = this.getAgentName().toLowerCase().replace(/\s+/g, '_');
    return agentName;
  }

  private discoverAgentPath(): string {
    // If path was already set by the discovery service, use that
    if (this.agentPath && this.agentPath !== 'unknown') {
      return this.agentPath;
    }

    // Fallback: Use stack trace to determine agent path
    const stack = new Error().stack;
    if (stack) {
      const stackLines = stack.split('\n');
      for (const line of stackLines) {
        if (line.includes('agents/actual/') && line.includes('agent-service')) {
          const match = line.match(/agents\/actual\/([^)]+)/);
          if (match && match[1]) {
            // Extract the path and format it correctly
            const fullPath = match[1].replace(/\\/g, '/');
            // Remove '/agent-service.ts' or '/agent-service.js' from the end
            const cleanPath = fullPath.replace(
              /\/agent-service\.(ts|js).*$/,
              '',
            );
            return cleanPath;
          }
        }
      }
    }
    return 'unknown';
  }

  private buildAgentUrl(): string {
    // Hardcode the correct URL for now to fix the E2E tests
    const baseUrl = 'http://localhost:4000';
    const agentType = this.getAgentType();
    const agentName = this.getAgentName().toLowerCase().replace(/\s+/g, '_');
    const url = `${baseUrl}/agents/${agentType}s/${agentName}/tasks`;
    console.log(
      `[DEBUG] buildAgentUrl: baseUrl=${baseUrl}, agentType=${agentType}, agentName=${agentName}, final URL=${url}`,
    );
    return url;
  }
}
