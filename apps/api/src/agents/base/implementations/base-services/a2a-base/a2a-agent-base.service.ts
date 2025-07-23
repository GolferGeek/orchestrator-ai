import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {
  AgentRegistrationService,
  AgentInfo,
} from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { AgentType } from '../../../../../common/types/agent-conversations.types';
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
import { AuthService } from '@agents/base/sub-services/auth/auth.service';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { TaskStatusService } from '../../../../../tasks/task-status.service';

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
  protected taskStatusService?: TaskStatusService;

  constructor(
    protected readonly httpService: HttpService,
    @Optional()
    @Inject(TaskStatusService)
    taskStatusService?: TaskStatusService,
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
    this.taskStatusService = taskStatusService;
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

      // Note: Agent registration is now handled by AppService via AgentFactoryService
      // No longer self-registering here to avoid conflicts

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
    const card: any = {
      name: this.getAgentName(),
      type: this.getAgentType(),
      path: this.agentPath,
      id: this.getAgentId(),
      status: 'active',
      capabilities: [],
      skills: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        className: this.constructor.name,
      },
    };

    // Try to load YAML configuration if agent path is available
    if (this.agentPath) {
      try {
        const yamlConfig = await this.loadAgentYamlConfig();
        if (yamlConfig?.configuration) {
          card.configuration = yamlConfig.configuration;
        }
      } catch (error) {
        this.logger.debug(
          `Could not load YAML configuration for ${this.getAgentName()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Add task type and status schema if defined
    const taskType = this.getTaskType();
    if (taskType && taskType !== 'ephemeral') {
      card.taskType = taskType;
    }

    const statusSchema = this.getStatusSchema();
    if (statusSchema && Object.keys(statusSchema).length > 0) {
      card.statusSchema = statusSchema;
    }

    // Add timeout configuration
    const timeout = this.getTaskTimeout();
    if (timeout && timeout !== 300) {
      // Only include if different from default
      card.timeout = timeout;
    }

    return card;
  }

  /**
   * Get the task type for this agent
   * Override in subclasses to specify 'long_running' or 'swarm'
   * Default is 'ephemeral'
   */
  protected getTaskType(): 'ephemeral' | 'long_running' | 'swarm' {
    return 'ephemeral';
  }

  /**
   * Get the status schema for this agent's custom status updates
   * Override in subclasses to define agent-specific status fields
   * Returns empty object by default (no custom fields)
   */
  protected getStatusSchema(): Record<string, any> {
    return {};
  }

  /**
   * Get the timeout in seconds for this agent's tasks
   * Long-running workflows need much longer timeouts than simple tasks
   * Override in subclasses for custom timeout logic
   */
  protected getTaskTimeout(): number {
    const taskType = this.getTaskType();
    switch (taskType) {
      case 'long_running':
        return 3600; // 1 hour for long-running tasks
      case 'swarm':
        return 7200; // 2 hours for swarm tasks
      case 'ephemeral':
      default:
        // For workflow agents (like requirements_writer), use longer timeout even if ephemeral
        return this.isWorkflowAgent() ? 1800 : 300; // 30 minutes for workflows, 5 minutes for simple tasks
    }
  }

  /**
   * Determine if this agent uses workflow steps (override in subclass if needed)
   */
  protected isWorkflowAgent(): boolean {
    // Default check: if agent has workflow steps in status schema, it's a workflow agent
    const schema = this.getStatusSchema();
    return !!(schema.workflowSteps || schema.currentStep || schema.stepIndex);
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

  getAgentType(): AgentType {
    // Check for orchestrator first (special case)
    if (this.agentPath?.includes('orchestrator')) {
      return 'orchestrator';
    }

    // Check for organizational folders in file structure
    if (this.agentPath?.includes('/marketing/')) return 'marketing';
    if (this.agentPath?.includes('/finance/')) return 'finance';
    if (this.agentPath?.includes('/hr/')) return 'hr';
    if (this.agentPath?.includes('/operations/')) return 'operations';
    if (this.agentPath?.includes('/sales/')) return 'sales';
    if (this.agentPath?.includes('/legal/')) return 'legal';
    if (this.agentPath?.includes('/engineering/')) return 'engineering';
    if (this.agentPath?.includes('/product/')) return 'product';
    if (this.agentPath?.includes('/research/')) return 'research';

    // Legacy structure fallbacks
    if (
      this.agentPath?.includes('/specialists/') ||
      this.agentPath?.includes('/specialist/')
    ) {
      return 'specialist';
    }
    if (this.agentPath?.includes('/external/')) {
      return 'marketing'; // Default external agents to marketing for now
    }

    // Default fallback
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

  // ============================================================================
  // TASK STATUS MANAGEMENT (single source of truth)
  // ============================================================================

  /**
   * Create a task with initial status
   * This should be called at the start of task execution
   */
  protected async createTaskStatus(
    taskId: string,
    userId: string,
    taskType: 'ephemeral' | 'long_running' | 'swarm' = 'ephemeral',
  ): Promise<void> {
    if (!this.taskStatusService) {
      this.logger.warn(
        'TaskStatusService not available - task status will not be tracked',
      );
      return;
    }

    // Determine task type from agent card if not specified
    if (taskType === 'ephemeral') {
      const agentCard = await this.getAgentCard();
      taskType = agentCard.taskType || 'ephemeral';
    }

    await this.taskStatusService.createTask(taskId, userId, taskType, {
      agentName: this.getAgentName(),
      agentType: this.getAgentType(),
    });

    this.logger.debug(`Task ${taskId} created with type: ${taskType}`);
  }

  /**
   * Update task progress
   * Use this to emit progress updates during task execution
   */
  protected async updateTaskProgress(
    taskId: string,
    userId: string,
    progress: number,
    message?: string,
    additionalData?: Record<string, any>,
  ): Promise<void> {
    if (!this.taskStatusService) {
      this.logger.warn(
        'TaskStatusService not available - progress update ignored',
      );
      return;
    }

    await this.taskStatusService.updateTaskStatus(taskId, userId, {
      status: 'running',
      progress,
      progressMessage: message,
      ...additionalData,
    });
  }

  /**
   * Mark task as completed
   * This is the ONLY way tasks should be marked as completed
   */
  protected async completeTask(
    taskId: string,
    userId: string,
    result: any,
    additionalData?: Record<string, any>,
  ): Promise<void> {
    if (!this.taskStatusService) {
      this.logger.warn(
        'TaskStatusService not available - task completion not tracked',
      );
      return;
    }

    await this.taskStatusService.completeTask(taskId, userId, result);

    if (additionalData) {
      await this.taskStatusService.updateTaskStatus(
        taskId,
        userId,
        additionalData,
      );
    }

    this.logger.debug(`Task ${taskId} marked as completed`);
  }

  /**
   * Mark task as failed
   * This is the ONLY way tasks should be marked as failed
   */
  protected async failTask(
    taskId: string,
    userId: string,
    error: string,
    additionalData?: Record<string, any>,
  ): Promise<void> {
    if (!this.taskStatusService) {
      this.logger.warn(
        'TaskStatusService not available - task failure not tracked',
      );
      return;
    }

    await this.taskStatusService.failTask(taskId, userId, error);

    if (additionalData) {
      await this.taskStatusService.updateTaskStatus(
        taskId,
        userId,
        additionalData,
      );
    }

    this.logger.debug(`Task ${taskId} marked as failed: ${error}`);
  }

  /**
   * Update task with custom JSON data
   * Use this for agent-specific status updates (swarms, workflows, etc.)
   */
  protected async updateTaskStatus(
    taskId: string,
    userId: string,
    statusUpdate: Record<string, any>,
  ): Promise<void> {
    if (!this.taskStatusService) {
      this.logger.warn(
        'TaskStatusService not available - status update ignored',
      );
      return;
    }

    await this.taskStatusService.updateTaskStatus(taskId, userId, statusUpdate);
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
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    const agentType = this.getAgentType();
    const agentName = this.getAgentName().toLowerCase().replace(/\s+/g, '_');
    const url = `${baseUrl}/agents/${agentType}s/${agentName}/tasks`;
    return url;
  }

  /**
   * Load agent YAML configuration
   */
  private async loadAgentYamlConfig(): Promise<any | null> {
    if (!this.agentPath || this.agentPath === 'unknown') {
      return null;
    }

    // Construct the full path to agent.yaml
    const agentsBasePath = path.join(process.cwd(), 'src', 'agents', 'actual');
    const yamlPath = path.join(agentsBasePath, this.agentPath, 'agent.yaml');

    if (!fs.existsSync(yamlPath)) {
      this.logger.debug(`No agent.yaml found at: ${yamlPath}`);
      return null;
    }

    try {
      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      const parsed = yaml.load(yamlContent) as any;
      return parsed;
    } catch (error) {
      this.logger.warn(`Failed to parse agent.yaml at ${yamlPath}:`, error);
      return null;
    }
  }
}
