import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../../a2a-base/a2a-agent-base.service';
import { LLMService } from '@/llms/llm.service';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { AuthService } from '@agents/base/sub-services/auth/auth.service';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { AgentFunctionParams } from '../../a2a-base/interfaces';
import { TaskProgressGateway } from '@/websocket/task-progress.gateway';
import { TasksService } from '@/tasks/tasks.service';
import { TaskStatusService } from '@/tasks/task-status.service';
import { DeliverablesService } from '@/deliverables/deliverables.service';
import { FunctionAgentServicesContext } from '@agents/base/services/function-agent-services-context';
// MCPClientService removed - using LangChain.js services instead

export interface AgentFunctionResponse {
  response: string;
  metadata?: any;
}

/**
 * Function Agent Base Service that uses pre-loaded functions from AgentDiscoveryService
 * This provides clean function execution with proper error handling and fallback capabilities
 */
@Injectable()
export class FunctionAgentBaseService extends A2AAgentBaseService {
  protected readonly functionLogger = new Logger(FunctionAgentBaseService.name);
  private agentFunction: any = null;
  private currentUserId: string | null = null; // Store current user ID for task completion
  protected currentTaskId: string | null = null; // Store current task ID for progress tracking
  protected totalSteps: number = 1; // Default to 1 step, can be overridden by agents
  protected mcpClientService?: any; // MCPClientService removed
  protected completedWorkflowSteps: string[] = []; // Track completed workflow steps
  protected currentUserEmail: string | null = null; // Store current user email

  constructor(
    // Pure service container pattern - only accepts FunctionAgentServicesContext
    private readonly services: FunctionAgentServicesContext,
  ) {
    super(
      services.httpService,
      services.taskStatusService,
      services.deliverablesService,
      undefined, // No tasksService for TypeScript function agents
      services.agentRegistrationService,
      services.jsonRpcProtocolService,
      services.loggingService,
      services.authService,
      services.configurationService,
    );

    // MCPClientService is no longer needed - using LangChain.js services
    this.mcpClientService = undefined;
  }

  /**
   * Set the pre-loaded agent function from AgentDiscoveryService
   */
  setAgentFunction(agentFunction: any): void {
    this.agentFunction = agentFunction;
    this.functionLogger.debug(
      `Pre-loaded function set for ${this.getAgentName()}`,
    );
  }

  /**
   * Enhanced task execution with progress tracking and state management
   */
  public async executeTask(method: string, params: any): Promise<any> {
    const agentName = this.getAgentName();

    // Store current user ID and task ID for progress tracking and completion handling
    if (params.currentUser?.id) {
      this.currentUserId = params.currentUser.id;
    }
    if (params.currentUser?.email) {
      this.currentUserEmail = params.currentUser.email;
    }
    if (params.taskId) {
      this.currentTaskId = params.taskId;
      // Reset workflow steps for new task
      this.completedWorkflowSteps = [];
    }

    try {
      // If no pre-loaded function, fall back to context processing
      if (!this.agentFunction || typeof this.agentFunction !== 'function') {
        this.functionLogger.debug(
          `No pre-loaded function for ${agentName}, using context fallback`,
        );
        return this.processWithContext(method, params);
      }

      // Create a wrapper LLM service that tracks metadata and applies user preferences
      const llmMetadataTracker = {
        calls: [] as any[],
        totalCost: 0,
        totalTokens: { input: 0, output: 0 },
      };

      const wrappedLLMService = {
        ...this.services.llmService,
        generateResponse: async (
          systemPrompt: string,
          userMessage: string,
          options?: any,
        ) => {
          // Merge user preferences with function options
          const mergedOptions = {
            ...options,
            providerId: params.providerId || options?.providerId,
            modelId: params.modelId || options?.modelId,
            temperature: params.temperature ?? options?.temperature,
            maxTokens: params.maxTokens || options?.maxTokens,
            cidafmOptions: params.cidafmOptions || options?.cidafmOptions,
            authToken: params.authToken || options?.authToken,
            sessionId: params.sessionId || options?.sessionId,
          };

          const result = await this.services.llmService.generateResponse(
            systemPrompt,
            userMessage,
            mergedOptions,
          );

          // Track metadata if this was an enhanced response
          if (typeof result === 'object' && result.llmMetadata) {
            llmMetadataTracker.calls.push(result.llmMetadata);
            if (result.costCalculation) {
              llmMetadataTracker.totalCost += result.costCalculation.totalCost;
            }
            if (result.usage) {
              llmMetadataTracker.totalTokens.input +=
                result.usage.inputTokens || 0;
              llmMetadataTracker.totalTokens.output +=
                result.usage.outputTokens || 0;
            }
          }

          return result;
        },
      };

      // Create progress callback that agent functions can use
      const progressCallback = (
        stepName: string,
        stepIndex: number,
        status: string,
        message?: string,
      ) => {
        this.emitProgress(stepName, stepIndex, status as any, message);
      };

      // Create MCP service wrapper from the inherited A2A base service MCP pool
      const mcpService = this.mcpClientService
        ? {
            isAvailable: () => {
              try {
                if (!this.mcpClientService) {
                  this.functionLogger.warn('MCP Client Service not available');
                  return false;
                }

                // Check if client has active servers
                const availableServers =
                  this.mcpClientService.getAvailableServers();
                const hasSupabase = availableServers.includes('supabase');

                this.functionLogger.debug(
                  `MCP Client Service status: servers=${availableServers.length}, supabase=${hasSupabase}`,
                );

                return hasSupabase && this.mcpClientService.isAvailable();
              } catch (error) {
                this.functionLogger.warn(
                  'MCP Client isAvailable check failed:',
                  error,
                );
                return false;
              }
            },

            // Database operations - KPI-focused with table filtering
            getSchema: async (options?: {
              table_name?: string;
              refresh_cache?: boolean;
              focus_tables?: string[];
            }) => {
              if (!this.mcpClientService) {
                throw new Error('MCP Client Service not available');
              }
              // Add KPI table focus for metrics agent
              const kpiOptions = {
                ...options,
                focus_tables: options?.focus_tables || [
                  'kpi_data',
                  'kpi_metrics',
                  'kpi_goals',
                  'departments',
                  'companies',
                ],
              };
              const toolRequest = { name: 'get-schema', arguments: kpiOptions };
              return await this.mcpClientService.callTool(
                'supabase',
                toolRequest,
              );
            },

            readData: async (params: {
              table_name: string;
              columns?: string[];
              filters?: Record<string, any>;
              limit?: number;
              offset?: number;
              order_by?: { column: string; ascending?: boolean };
              format?: 'json' | 'table' | 'csv';
            }) => {
              if (!this.mcpClientService) {
                throw new Error('MCP Client Service not available');
              }
              const toolRequest = { name: 'read-data', arguments: params };
              return await this.mcpClientService.callTool(
                'supabase',
                toolRequest,
              );
            },

            executeSQL: async (params: {
              sql_query: string;
              parameters?: any[];
              dry_run?: boolean;
              max_rows?: number;
              format?: 'detailed' | 'compact' | 'csv' | 'json';
            }) => {
              if (!this.mcpClientService) {
                throw new Error('MCP Client Service not available');
              }
              const toolRequest = { name: 'execute-sql', arguments: params };
              return await this.mcpClientService.callTool(
                'supabase',
                toolRequest,
              );
            },

            generateSQL: async (params: {
              natural_language_query: string;
              query_type?:
                | 'SELECT'
                | 'INSERT'
                | 'UPDATE'
                | 'DELETE'
                | 'auto-detect';
              model_override?: string;
              include_explanation?: boolean;
              max_rows?: number;
              schema_tables?: string[];
            }) => {
              if (!this.mcpClientService) {
                throw new Error('MCP Client Service not available');
              }
              // Add KPI table focus for better SQL generation
              const kpiParams = {
                ...params,
                schema_tables: params.schema_tables || [
                  'kpi_data',
                  'kpi_metrics',
                  'kpi_goals',
                  'departments',
                  'companies',
                ],
              };
              const toolRequest = {
                name: 'generate-sql',
                arguments: kpiParams,
              };
              return await this.mcpClientService.callTool(
                'supabase',
                toolRequest,
              );
            },

            queryAndFormat: async (params: {
              user_prompt: string;
              output_format?:
                | 'table'
                | 'json'
                | 'summary'
                | 'chart-data'
                | 'report';
              include_explanation?: boolean;
              model_override?: string;
              max_rows?: number;
              include_schema_context?: boolean;
              suggested_tables?: string[];
            }) => {
              if (!this.mcpClientService) {
                throw new Error('MCP Client Service not available');
              }
              // Add KPI table suggestions for focused analysis
              const kpiParams = {
                ...params,
                suggested_tables: params.suggested_tables || [
                  'kpi_data',
                  'kpi_metrics',
                  'kpi_goals',
                  'departments',
                  'companies',
                ],
              };
              const toolRequest = {
                name: 'query-and-format',
                arguments: kpiParams,
              };
              return await this.mcpClientService.callTool(
                'supabase',
                toolRequest,
              );
            },

            // Generic tool call method for extensibility
            callTool: async (server: string, toolName: string, params: any) => {
              if (!this.mcpClientService) {
                throw new Error('MCP Client Service not available');
              }

              // Map server names from agent function expectations to MCPClientService format
              let actualServerName = server;
              if (server === 'supabase-mcp') {
                actualServerName = 'supabase';
              }

              this.functionLogger.debug(
                `MCP Tool call: ${server} -> ${actualServerName}, tool: ${toolName}`,
              );

              const toolRequest = { name: toolName, arguments: params };
              return await this.mcpClientService.callTool(
                actualServerName,
                toolRequest,
              );
            },
          }
        : null;

      // Prepare standardized parameters for the agent function
      const functionParams: AgentFunctionParams = {
        userMessage: this.extractUserMessage(params),
        sessionId: params.sessionId,
        conversationHistory: params.conversationHistory || [],
        currentUser: params.currentUser,
        authToken: params.authToken,
        llmService: wrappedLLMService,
        progressCallback,
        mcpService, // MCP service from A2A base service
        metadata: {
          method,
          originalParams: params,
          agentName: agentName,
          timestamp: new Date().toISOString(),
          taskId: this.currentTaskId,
        },
      };

      // Execute the pre-loaded agent function with progress tracking
      this.emitProgress('Starting task execution', 0, 'in_progress');
      const result = await this.agentFunction(functionParams);
      this.emitProgress(
        'Task execution completed',
        this.totalSteps - 1,
        'completed',
      );

      this.functionLogger.debug(
        `Function executed successfully for ${agentName}`,
      );

      // Aggregate LLM metadata from all calls
      const aggregatedLLMMetadata =
        llmMetadataTracker.calls.length > 0
          ? {
              primaryLLM: llmMetadataTracker.calls[0], // First/main LLM call
              totalCalls: llmMetadataTracker.calls.length,
              totalCost: llmMetadataTracker.totalCost,
              totalTokens: llmMetadataTracker.totalTokens,
              allCalls: llmMetadataTracker.calls,
            }
          : undefined;

      // Save the result to the task in database for async tasks
      await this.saveTaskResult(result);

      // Broadcast task completion
      this.broadcastTaskCompletion('completed', 'Task completed successfully');

      // Return structured response format to match ContextAgentBaseService
      return {
        success: true,
        response: result.response || result,
        metadata: {
          agentType: this.getAgentType(),
          functionStatus: 'executed',
          processedAt: new Date().toISOString(),
          ...functionParams.metadata,
          ...(result.metadata || {}),
          // Include aggregated LLM metadata
          ...(aggregatedLLMMetadata && {
            llmUsed: aggregatedLLMMetadata.primaryLLM,
            usage: {
              inputTokens: aggregatedLLMMetadata.totalTokens.input,
              outputTokens: aggregatedLLMMetadata.totalTokens.output,
              totalCost: aggregatedLLMMetadata.totalCost,
            },
            llmCallsSummary: {
              totalCalls: aggregatedLLMMetadata.totalCalls,
              totalCost: aggregatedLLMMetadata.totalCost,
              allModelsUsed: aggregatedLLMMetadata.allCalls.map(
                (call) => call.modelName,
              ),
            },
          }),
        },
      };
    } catch (error) {
      this.functionLogger.error(
        `Function execution error for ${agentName}:`,
        error,
      );

      // Broadcast error status
      this.broadcastTaskCompletion(
        'failed',
        error instanceof Error ? error.message : String(error),
      );

      // Return structured error response
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response: `I apologize, but I encountered an error while processing your request. Falling back to basic processing.`,
        metadata: {
          agentName: agentName,
          agentType: this.getAgentType(),
          functionStatus: 'error',
          errorDetails: error instanceof Error ? error.message : String(error),
          processedAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Emit progress event for step tracking (matching Python pattern)
   */
  protected emitProgress(
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ): void {
    if (!this.currentTaskId) {
      this.functionLogger.debug(
        'No current task ID, skipping progress emission',
      );
      return;
    }

    // Track completed workflow steps
    if (
      status === 'completed' &&
      !this.completedWorkflowSteps.includes(stepName)
    ) {
      this.completedWorkflowSteps.push(stepName);
      this.functionLogger.debug(
        `Added completed workflow step: ${stepName} (${this.completedWorkflowSteps.length}/${this.totalSteps})`,
      );
    }

    // Store message in live cache for polling clients
    if (this.services.taskStatusService) {
      const messageContent = JSON.stringify({
        stepName,
        stepIndex,
        totalSteps: this.totalSteps,
        status,
        message,
      });

      this.services.taskStatusService.addTaskMessage(
        this.currentTaskId,
        messageContent,
        'progress',
        {
          progress: Math.round(((stepIndex + 1) / this.totalSteps) * 100),
          stepName,
          stepIndex,
          totalSteps: this.totalSteps,
          stepStatus: status,
        },
      );

      this.functionLogger.debug(
        `Stored progress message in live cache for task ${this.currentTaskId}`,
      );
    }

    // Broadcast workflow step progress via WebSocket
    if (this.services.taskProgressGateway) {
      this.services.taskProgressGateway.broadcastWorkflowStepProgress(
        this.currentTaskId,
        stepName,
        stepIndex,
        this.totalSteps,
        status,
        message,
      );
      this.functionLogger.debug(
        `Broadcast workflow step progress: ${stepName} (${status})`,
      );
    } else {
      this.functionLogger.error(
        'TaskProgressGateway is not available for broadcasting progress events',
      );
    }
  }

  /**
   * Broadcast task completion event (matching Python pattern)
   */
  protected broadcastTaskCompletion(
    status: 'completed' | 'failed',
    message: string,
  ): void {
    if (!this.currentTaskId) {
      this.functionLogger.debug(
        'No current task ID, skipping completion broadcast',
      );
      return;
    }

    if (this.services.taskProgressGateway) {
      this.services.taskProgressGateway.broadcastTaskCompletion(
        this.currentTaskId,
        status,
        message,
      );
      this.functionLogger.debug(
        `Broadcast task completion: ${this.currentTaskId} (${status})`,
      );
    } else {
      this.functionLogger.error(
        'TaskProgressGateway is not available for broadcasting completion events',
      );
    }
  }

  /**
   * Save task result to database (matching Python pattern)
   */
  protected async saveTaskResult(result: any): Promise<void> {
    if (
      !this.services.tasksService ||
      !this.currentUserId ||
      !this.currentTaskId
    ) {
      this.functionLogger.debug(`Cannot save result - missing requirements:`, {
        tasksService: !!this.services.tasksService,
        currentUserId: this.currentUserId,
        taskId: this.currentTaskId,
      });
      return;
    }

    try {
      // Enhanced metadata like Python agents
      const enhancedMetadata = {
        ...(result.metadata || {}),
        agentName: this.getAgentName(),
        agentType: this.getAgentType(),
        workflowStepsCompleted: [...this.completedWorkflowSteps],
        totalSteps: this.totalSteps,
        userEmail: this.currentUserEmail,
        processedAt: new Date().toISOString(),
        taskId: this.currentTaskId,
        userId: this.currentUserId,
      };

      const updateData = {
        status: 'completed' as const,
        progress: 100,
        response: JSON.stringify(result),
        responseMetadata: enhancedMetadata,
      };

      this.functionLogger.debug(`Saving task result to database:`, {
        taskId: this.currentTaskId,
        userId: this.currentUserId,
        userEmail: this.currentUserEmail,
        workflowStepsCompleted: this.completedWorkflowSteps.length,
        enhancedMetadataKeys: Object.keys(enhancedMetadata),
      });

      await this.services.tasksService.updateTask(
        this.currentTaskId,
        this.currentUserId,
        updateData,
      );

      this.functionLogger.debug(
        `✅ Task ${this.currentTaskId} result saved to database successfully`,
      );
    } catch (error) {
      this.functionLogger.error(
        `❌ Failed to save task ${this.currentTaskId} result:`,
        error,
      );
    }
  }

  /**
   * Set the total number of steps for progress tracking
   */
  protected setTotalSteps(totalSteps: number): void {
    this.totalSteps = totalSteps;
    this.functionLogger.debug(
      `Total steps set to ${totalSteps} for ${this.getAgentName()}`,
    );
  }

  /**
   * Execute workflow with automatic progress tracking
   */
  protected async executeWorkflowWithProgress<T>(
    steps: Array<{
      name: string;
      execute: () => Promise<T>;
    }>,
  ): Promise<T[]> {
    this.setTotalSteps(steps.length);
    const results: T[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      this.emitProgress(step.name, i, 'in_progress');

      try {
        const result = await step.execute();
        results.push(result);
        this.emitProgress(step.name, i, 'completed');
      } catch (error) {
        this.emitProgress(
          step.name,
          i,
          'failed',
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
    }

    return results;
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
   * Simple context-based fallback processing
   */
  private async processWithContext(method: string, _params: any): Promise<any> {
    this.functionLogger.debug(
      `Using context fallback for ${this.getAgentName()}`,
    );

    return {
      success: true,
      response: `Hello! I'm the ${this.getAgentName()} agent. I'm ready to help, but my function isn't loaded yet. Please check back soon!`,
      metadata: {
        agentName: this.getAgentName(),
        agentType: this.getAgentType(),
        functionStatus: 'fallback',
        reason: 'No pre-loaded function available',
        method,
        processedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Set the discovered agent path (called by AgentDiscoveryService)
   * Delegates to appropriate sub-services as needed
   */
  setDiscoveredPath(path: string): void {
    this.agentPath = path;
    this.functionLogger.debug(`Agent path set to: ${path}`);

    // If we need to notify sub-services about the path change, we could do it here
    // For now, just setting the path is sufficient
  }

  /**
   * Get agent card with function status
   */
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();
    return {
      ...baseCard,
      functionStatus: this.agentFunction ? 'loaded' : 'not_loaded',
      loadedAt: this.agentFunction ? new Date().toISOString() : null,
    };
  }
}
