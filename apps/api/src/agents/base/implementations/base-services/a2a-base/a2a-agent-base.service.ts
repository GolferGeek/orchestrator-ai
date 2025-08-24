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
import { DeliverablesService } from '../../../../../deliverables/deliverables.service';
import { DeliverableVersionsService } from '../../../../../deliverables/deliverable-versions.service';
import { TasksService } from '../../../../../tasks/tasks.service';
import { DeliverableVersionCreationType } from '../../../../../deliverables/dto';
import {
  DeliverableType,
  DeliverableFormat,
} from '../../../../../deliverables/dto';

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
  protected deliverablesService?: DeliverablesService;
  protected deliverableVersionsService?: DeliverableVersionsService;
  protected tasksService?: TasksService;

  constructor(
    protected readonly httpService: HttpService,
    @Optional()
    @Inject(TaskStatusService)
    taskStatusService?: TaskStatusService,
    @Optional()
    @Inject(DeliverablesService)
    deliverablesService?: DeliverablesService,
    @Optional()
    @Inject(DeliverableVersionsService)
    deliverableVersionsService?: DeliverableVersionsService,
    @Optional()
    @Inject(TasksService)
    tasksService?: TasksService,
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
    this.deliverablesService = deliverablesService;
    this.deliverableVersionsService = deliverableVersionsService;
    this.tasksService = tasksService;
    
    // Debug logging to track service injection

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

        if (yamlConfig) {
          // Use displayName from YAML if available
          if (yamlConfig.displayName) {
            card.name = yamlConfig.displayName;
          }

          // Use description from YAML if available
          if (yamlConfig.description) {
            card.description = yamlConfig.description;
          }

          // Keep configuration as well
          if (yamlConfig.configuration) {
            card.configuration = yamlConfig.configuration;
          }
        }
      } catch (error) {

      }
    }

    // Add task type and status schema if defined
    // Task type is handled in memory, not stored in card

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

  // Task type is no longer used - all tasks are handled as ephemeral

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
    // For workflow agents (like requirements_writer), use longer timeout
    return this.isWorkflowAgent() ? 1800 : 300; // 30 minutes for workflows, 5 minutes for simple tasks
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
  ): Promise<void> {
    if (!this.taskStatusService) {
      this.logger.warn(
        'TaskStatusService not available - task status will not be tracked',
      );
      return;
    }

    // Use agent identifier for task status tracking
    const agentIdentifier = `${this.getAgentType()}/${this.getAgentName()}`;

    await this.taskStatusService.createTask(taskId, userId, agentIdentifier, {
      agentName: this.getAgentName(),
      agentType: this.getAgentType(),
    });


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
   * Mark task as completed with optional deliverable enhancement context
   * This is the ONLY way tasks should be marked as completed
   */
  protected async completeTask(
    taskId: string,
    userId: string,
    result: any,
    additionalData?: Record<string, any>,
    enhanceDeliverableId?: string,
  ): Promise<void> {
    if (!this.taskStatusService) {
      this.logger.warn(
        'TaskStatusService not available - task completion not tracked',
      );
      return;
    }

    // Auto-persist deliverable if result contains deliverable content
    // This must happen BEFORE marking task complete so we can attach deliverable ID


    
    const deliverableId = await this.persistDeliverableIfPresent(
      result,
      userId,
      taskId,
      enhanceDeliverableId,
    );
    


    if (deliverableId) {
      this.logger.log(`📄 Deliverable ${deliverableId} created for task ${taskId}`);
    } else {

    }

    // If deliverable was created, attach ID to the result
    if (deliverableId && typeof result === 'object' && result !== null) {
      result.deliverableId = deliverableId;

      // If this was an enhancement, also include the original deliverable ID
      if (enhanceDeliverableId) {
        result.enhancedFrom = enhanceDeliverableId;
      }
    }
    
    // If version was created (check result metadata), promote to top level
    if (typeof result === 'object' && result !== null && result.metadata) {
      if (result.metadata.newVersionId) {
        result.newVersionId = result.metadata.newVersionId;
        result.versionNumber = result.metadata.versionNumber;
        // Ensure deliverable ID is also available for version operations
        if (!result.deliverableId && enhanceDeliverableId) {
          result.deliverableId = enhanceDeliverableId;
        }
      }
    }

    await this.taskStatusService.completeTask(taskId, userId, result);

    if (additionalData) {
      await this.taskStatusService.updateTaskStatus(
        taskId,
        userId,
        additionalData,
      );
    }


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

  // ============================================================================
  // DELIVERABLE AUTO-PERSISTENCE - All agents can create deliverables
  // ============================================================================

  /**
   * Get conversation and project context from a task ID
   */
  private async getTaskContext(
    taskId: string,
    userId: string,
  ): Promise<{ conversationId?: string; projectStepId?: string }> {
    if (!this.tasksService) {

      return {};
    }

    try {
      const task = await this.tasksService.getTaskById(taskId, userId);
      if (!task) {

        return {};
      }

      // Check for project step ID in task params (for project-based tasks)
      let projectStepId: string | undefined;
      if (task.params && typeof task.params === 'object') {
        projectStepId = 
          task.params.projectStepId || 
          task.params.project_step_id ||
          task.params.workProduct?.id; // WorkProductContext.id might be project step
      }

      return {
        conversationId: task.agentConversationId || undefined,
        projectStepId,
      };
    } catch (error) {
      this.logger.warn(`Failed to get task context for ${taskId}:`, error);
      return {};
    }
  }

  /**
   * Auto-persist deliverable if content contains deliverable markers
   * This runs for ALL agents when they complete tasks
   * @returns deliverable ID if created, null otherwise
   */
  private async persistDeliverableIfPresent(
    result: any,
    userId: string,
    taskId?: string,
    enhanceDeliverableId?: string,
  ): Promise<string | null> {

    
    if (!this.deliverablesService) {


      return null;
    }

    try {
      // Extract content from various result formats

      const content = this.extractContentFromResult(result);

      if (!content) {


        return null;
      }



      // Check if content contains deliverable markers
      if (!this.isDeliverableContent(content)) {

        return null;
      }



      // Extract deliverable information
      const deliverableData = this.extractDeliverableFromContent(content);
      if (!deliverableData) {

        return null;
      }



      // Get conversation context from task if available
      let taskContext: { conversationId?: string; projectStepId?: string } = {};
      if (taskId) {
        taskContext = await this.getTaskContext(taskId, userId);

      }

      // Create new deliverable or enhance existing one
      let deliverable;

      if (enhanceDeliverableId) {
        // Creating a new version of an existing deliverable
        if (!this.deliverableVersionsService) {
          throw new Error('DeliverableVersionsService not available for creating deliverable versions');
        }
        const deliverableVersion = await this.deliverableVersionsService.createVersion(
          enhanceDeliverableId,
          {
            content: deliverableData.content,
            format: deliverableData.format || 'markdown',
            createdByType: DeliverableVersionCreationType.AI_ENHANCEMENT,
            taskId: taskId || 'unknown',
            metadata: {
              agentName: this.getAgentName(),
              agentType: this.getAgentType(),
              taskId: taskId || 'unknown',
              generatedAt: new Date().toISOString(),
              enhancedFrom: enhanceDeliverableId,
              ...deliverableData.metadata,
            },
          },
          userId,
        );

        this.logger.log(
          `📄 Deliverable enhanced: Version ${deliverableVersion.versionNumber} (Version ID: ${deliverableVersion.id}, Enhanced from: ${enhanceDeliverableId})`,
        );
        
        return enhanceDeliverableId; // Return the deliverable ID, not the version ID
      } else {
        // Creating a new deliverable
        // Require either conversationId or projectStepId (deliverable must belong to something)
        if (!taskContext.conversationId && !taskContext.projectStepId) {
          this.logger.warn(
            `Cannot create deliverable without conversationId or projectStepId. Task ${taskId} has no context.`,
          );
          return null;
        }

        // Check if deliverable already exists for this conversation
        let existingDeliverable = null;
        if (taskContext.conversationId) {
          try {
            const existingDeliverables = await this.deliverablesService.findByConversationId(taskContext.conversationId, userId);
            if (existingDeliverables && existingDeliverables.length > 0) {
              existingDeliverable = existingDeliverables[0];
            }
          } catch (error) {
            // Continue with creating new deliverable
          }
        }

        if (existingDeliverable) {
          // Create a new version of the existing deliverable
          if (!this.deliverableVersionsService) {
            throw new Error('DeliverableVersionsService not available for creating deliverable versions');
          }

          const deliverableVersion = await this.deliverableVersionsService.createVersion(
            existingDeliverable.id,
            {
              content: deliverableData.content,
              format: deliverableData.format || 'markdown',
              createdByType: DeliverableVersionCreationType.AI_RESPONSE,
              taskId: taskId || 'unknown',
              metadata: {
                agentName: this.getAgentName(),
                agentType: this.getAgentType(),
                taskId: taskId || 'unknown',
                generatedAt: new Date().toISOString(),
                conversationId: taskContext.conversationId,
                projectStepId: taskContext.projectStepId,
              },
            },
            userId,
          );
          
          this.logger.log(
            `📄 Deliverable version created: Version ${deliverableVersion.versionNumber} for existing deliverable ${existingDeliverable.id}`,
          );
          
          return existingDeliverable.id; // Return the deliverable ID, not the version ID
        }

        // Create a new deliverable if none exists
        deliverable = await this.deliverablesService.create(
          {
            title: deliverableData.title,
            type: deliverableData.type,
            conversationId: taskContext.conversationId,
            projectStepId: taskContext.projectStepId,
            // Initial version data
            initialContent: deliverableData.content,
            initialFormat: deliverableData.format || 'markdown',
            initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
            initialTaskId: taskId || 'unknown',
            initialMetadata: {
              agentName: this.getAgentName(),
              agentType: this.getAgentType(),
              taskId: taskId || 'unknown',
              generatedAt: new Date().toISOString(),
              // Include description in metadata instead since it's not in the main table
              description: deliverableData.description,
              ...deliverableData.metadata,
            },
          },
          userId,
        );

        this.logger.log(
          `📄 Deliverable auto-persisted: ${deliverable.title} (ID: ${deliverable.id})`,
        );
      }

      return deliverable.id;
    } catch (error) {
      this.logger.error('Failed to auto-persist deliverable:', error);
      // Don't throw - deliverable persistence shouldn't break task completion
      return null;
    }
  }

  /**
   * Extract content from various result formats
   */
  private extractContentFromResult(result: any): string | null {
    if (!result) {
      return null;
    }

    // Handle different result formats
    if (typeof result === 'string') {
      return result;
    }

    if (typeof result === 'object') {
      // Try common response fields
      const content =
        result.response || result.message || result.content || result.data;

      if (typeof content === 'string') {

        return content;
      }

      // If it's still an object, stringify it for analysis
      if (typeof content === 'object') {
        const stringified = JSON.stringify(content, null, 2);

        return stringified;
      }
    }


    return null;
  }

  /**
   * Check if content contains deliverable markers
   * Looks for common deliverable indicators like headers, sections, etc.
   */
  private isDeliverableContent(content: string): boolean {
    // Look for deliverable markers
    const deliverableMarkers = [
      /^#\s+(.+)/m, // Markdown headers
      /^##\s+(.+)/m,
      /^\*\*([^*]+)\*\*$/m, // Bold titles (including emojis)
      /DELIVERABLE:/i,
      /DOCUMENT:/i,
      /REPORT:/i,
      /ANALYSIS:/i,
      /PLAN:/i,
      /REQUIREMENTS:/i,
    ];

    // Check for structured content (multiple sections OR substantial length)
    // Lowered threshold to catch more content as deliverables
    const hasStructure = content.includes('\n\n') || content.length > 300;
    const hasMarkers = deliverableMarkers.some(marker => marker.test(content));



    return hasStructure || hasMarkers;
  }

  /**
   * Extract deliverable information from content
   */
  private extractDeliverableFromContent(content: string): {
    title: string;
    content: string;
    type: DeliverableType;
    format: DeliverableFormat;
    description?: string;
    metadata?: Record<string, any>;
  } | null {
    try {
      // Extract title from first header or use agent name + timestamp
      const title =
        this.extractTitleFromContent(content) ||
        `${this.getAgentName()} Output - ${new Date().toLocaleDateString()}`;

      // Determine type based on content analysis
      const type = this.determineDeliverableType(content);

      // Determine format (markdown if it has markdown syntax, otherwise text)
      const format = this.hasMarkdownSyntax(content)
        ? DeliverableFormat.MARKDOWN
        : DeliverableFormat.TEXT;

      // Generate description from first paragraph or truncated content
      const description =
        this.extractDescriptionFromContent(content) || undefined;

      return {
        title,
        content,
        type,
        format,
        description,
        metadata: {
          autoGenerated: true,
          originalLength: content.length,
          extractedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to extract deliverable from content:', error);
      return null;
    }
  }

  /**
   * Extract title from content (first header, bold text, etc.)
   */
  private extractTitleFromContent(content: string): string | null {
    // Try markdown headers first
    const headerMatch = content.match(/^#\s+(.+)$/m);
    if (headerMatch && headerMatch[1]) {
      return headerMatch[1].trim();
    }

    // Try second-level headers
    const h2Match = content.match(/^##\s+(.+)$/m);
    if (h2Match && h2Match[1]) {
      return h2Match[1].trim();
    }

    // Try bold text at the beginning (including emojis and special characters)
    const boldMatch = content.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch && boldMatch[1]) {
      return boldMatch[1].trim();
    }

    // Try deliverable markers
    const deliverableMatch = content.match(
      /(?:DELIVERABLE|DOCUMENT|REPORT|ANALYSIS|PLAN|REQUIREMENTS):\s*(.+)/i,
    );
    if (deliverableMatch && deliverableMatch[1]) {
      return deliverableMatch[1].trim();
    }

    return null;
  }

  /**
   * Determine deliverable type based on content analysis
   */
  private determineDeliverableType(content: string): DeliverableType {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('requirement') || lowerContent.includes('spec')) {
      return DeliverableType.REQUIREMENTS;
    }
    if (lowerContent.includes('analysis') || lowerContent.includes('analyze')) {
      return DeliverableType.ANALYSIS;
    }
    if (lowerContent.includes('plan') || lowerContent.includes('strategy')) {
      return DeliverableType.PLAN;
    }
    if (lowerContent.includes('report') || lowerContent.includes('summary')) {
      return DeliverableType.REPORT;
    }

    // Default to document
    return DeliverableType.DOCUMENT;
  }

  /**
   * Check if content has markdown syntax
   */
  private hasMarkdownSyntax(content: string): boolean {
    const markdownPatterns = [
      /^#+ /m, // Headers
      /\*\*.*?\*\*/, // Bold
      /\*.*?\*/, // Italic
      /```/, // Code blocks
      /^- |^\d+\. /m, // Lists
    ];

    return markdownPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Extract description from content (first paragraph or truncated)
   */
  private extractDescriptionFromContent(content: string): string | null {
    // Remove title/header if present
    const contentWithoutTitle = content.replace(/^#+ .+$/m, '').trim();

    // Get first paragraph
    const firstParagraph = contentWithoutTitle.split('\n\n')[0];

    if (firstParagraph && firstParagraph.length > 20) {
      // Truncate if too long
      return firstParagraph.length > 200
        ? firstParagraph.substring(0, 197) + '...'
        : firstParagraph;
    }

    return null;
  }

  /**
   * Extract deliverable ID from task parameters for enhancement workflows
   */
  protected extractDeliverableIdFromParams(params: any): string | null {
    if (!params || typeof params !== 'object') {
      return null;
    }

    // Check various parameter formats for deliverable ID
    return (
      params.deliverableId ||
      params.enhance_deliverable_id ||
      params.enhanceDeliverableId ||
      params.metadata?.deliverableId ||
      params.metadata?.enhance_deliverable_id ||
      null
    );
  }

  /**
   * Helper method for agents to complete tasks with deliverable enhancement context
   * This should be used by agents in their executeTask implementations
   */
  protected async completeTaskWithDeliverableContext(
    taskId: string,
    userId: string,
    result: any,
    taskParams: any,
    additionalData?: Record<string, any>,
  ): Promise<void> {
    // Extract deliverable ID from task parameters if present
    const enhanceDeliverableId =
      this.extractDeliverableIdFromParams(taskParams) || undefined;

    // Complete task with deliverable context
    await this.completeTask(
      taskId,
      userId,
      result,
      additionalData,
      enhanceDeliverableId,
    );
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
    // Handle both monorepo (from root) and app-specific (from apps/api) working directories
    let agentsBasePath = path.join(process.cwd(), 'src', 'agents', 'actual');

    // If running from monorepo root, adjust path to apps/api
    if (!fs.existsSync(agentsBasePath)) {
      agentsBasePath = path.join(
        process.cwd(),
        'apps',
        'api',
        'src',
        'agents',
        'actual',
      );
    }

    const yamlPath = path.join(
      agentsBasePath,
      this.agentPath,
      'agent.yaml',
    );

    if (!fs.existsSync(yamlPath)) {

      return null;
    }

    try {
      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      const parsed = yaml.load(yamlContent) as any;

      return parsed;
    } catch (error) {
      this.logger.warn(
        `Failed to parse agent.yaml at ${yamlPath}:`,
        error,
      );
      return null;
    }
  }
}
