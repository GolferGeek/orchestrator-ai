import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
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
import { MCPClientService } from '@/mcp/client/mcp-client.service';
import { MCPRegistryService } from '@/mcp/mcp-registry.service';

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

  constructor(
    protected readonly httpService: HttpService,
    protected readonly llmService: LLMService,
    @Inject(forwardRef(() => TaskProgressGateway))
    protected readonly taskProgressGateway: TaskProgressGateway | undefined,
    @Inject(forwardRef(() => TasksService))
    protected readonly tasksService: TasksService | undefined,
    @Inject(forwardRef(() => TaskStatusService))
    protected readonly taskStatusService: TaskStatusService | undefined,
    protected readonly mcpClientService: MCPClientService | undefined,
    agentRegistrationService?: AgentRegistrationService,
    jsonRpcProtocolService?: JsonRpcProtocolService,
    loggingService?: LoggingService,
    authService?: AuthService,
    configurationService?: ConfigurationService,
  ) {
    super(
      httpService,
      undefined, // TaskStatusService will be injected automatically
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService,
      configurationService,
    );
    
    // Debug MCP client service injection
    this.functionLogger.debug(`MCP Client Service initialized: ${!!this.mcpClientService}`);
    if (this.mcpClientService) {
      this.functionLogger.debug(`MCP Client Service has isAvailable method: ${typeof this.mcpClientService.isAvailable === 'function'}`);
    }
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
    if (params.taskId) {
      this.currentTaskId = params.taskId;
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
        ...this.llmService,
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

          const result = await this.llmService.generateResponse(
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

      // Create MCP service wrapper for agent functions - use registry to get the singleton instance
      const registryMCPClient = MCPRegistryService.getMCPClient();
      const actualMCPClient = registryMCPClient || this.mcpClientService;
      
      this.functionLogger.debug(`Creating MCP service wrapper. Registry client: ${!!registryMCPClient}, Injected client: ${!!this.mcpClientService}, Using: ${actualMCPClient ? 'registry' : 'none'}`);
      
      const mcpService = actualMCPClient ? {
        isAvailable: () => {
          try {
            if (!actualMCPClient) {
              this.functionLogger.warn('MCP Client Service not available');
              return false;
            }
            if (typeof actualMCPClient.isAvailable !== 'function') {
              this.functionLogger.warn('MCP Client Service missing isAvailable method');
              return false;
            }
            
            const available = actualMCPClient.isAvailable();
            const serverCount = actualMCPClient.getAvailableServers?.()?.length || 0;
            const instanceId = (actualMCPClient as any).instanceId || 'unknown';
            
            this.functionLogger.debug(`MCP Service status: available=${available}, servers=${serverCount}, instanceId=${instanceId}, source=${registryMCPClient ? 'registry' : 'injection'}`);
            
            if (!available) {
              this.functionLogger.warn('MCP service reports as unavailable - no connected servers');
            }
            
            return available;
          } catch (error) {
            this.functionLogger.warn('MCP isAvailable check failed:', error);
            return false;
          }
        },
        
        // Database operations
        getSchema: async (options?: { table_name?: string; refresh_cache?: boolean }) => {
          if (!actualMCPClient) {
            throw new Error('MCP Client Service not available');
          }
          return await actualMCPClient.callTool('supabase', { 
            name: 'get-schema', 
            arguments: options || {} 
          });
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
          if (!actualMCPClient) {
            throw new Error('MCP Client Service not available');
          }
          return await actualMCPClient.callTool('supabase', { 
            name: 'read-data', 
            arguments: params 
          });
        },
        
        executeSQL: async (params: { 
          sql_query: string; 
          parameters?: any[]; 
          dry_run?: boolean; 
          max_rows?: number; 
          format?: 'detailed' | 'compact' | 'csv' | 'json';
        }) => {
          if (!actualMCPClient) {
            throw new Error('MCP Client Service not available');
          }
          return await actualMCPClient.callTool('supabase', { 
            name: 'execute-sql', 
            arguments: params 
          });
        },
        
        generateSQL: async (params: { 
          natural_language_query: string; 
          query_type?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'auto-detect';
          model_override?: string;
          include_explanation?: boolean;
          max_rows?: number;
          schema_tables?: string[];
        }) => {
          if (!actualMCPClient) {
            throw new Error('MCP Client Service not available');
          }
          return await actualMCPClient.callTool('supabase', { 
            name: 'generate-sql', 
            arguments: params 
          });
        },
        
        queryAndFormat: async (params: { 
          user_prompt: string; 
          output_format?: 'table' | 'json' | 'summary' | 'chart-data' | 'report';
          include_explanation?: boolean;
          model_override?: string;
          max_rows?: number;
          include_schema_context?: boolean;
          suggested_tables?: string[];
        }) => {
          if (!actualMCPClient) {
            throw new Error('MCP Client Service not available');
          }
          return await actualMCPClient.callTool('supabase', { 
            name: 'query-and-format', 
            arguments: params 
          });
        },
        
        // Generic tool call method for extensibility
        callTool: async (server: string, toolName: string, params: any) => {
          if (!actualMCPClient) {
            throw new Error('MCP Client Service not available');
          }
          return await actualMCPClient.callTool(server, { 
            name: toolName, 
            arguments: params 
          });
        }
      } : {
        // Fallback when MCP client service is not available
        isAvailable: () => false,
        getSchema: async () => ({ success: false, error: 'MCP Client Service not available' }),
        readData: async () => ({ success: false, error: 'MCP Client Service not available' }),
        executeSQL: async () => ({ success: false, error: 'MCP Client Service not available' }),
        generateSQL: async () => ({ success: false, error: 'MCP Client Service not available' }),
        queryAndFormat: async () => ({ success: false, error: 'MCP Client Service not available' }),
        callTool: async () => ({ success: false, error: 'MCP Client Service not available' })
      };

      // Prepare standardized parameters for the agent function
      const functionParams: AgentFunctionParams = {
        userMessage: this.extractUserMessage(params),
        sessionId: params.sessionId,
        conversationHistory: params.conversationHistory || [],
        currentUser: params.currentUser,
        authToken: params.authToken,
        llmService: wrappedLLMService,
        progressCallback,
        mcpService, // Add MCP service for database operations
        metadata: {
          method,
          originalParams: params,
          agentName: agentName,
          timestamp: new Date().toISOString(),
          taskId: this.currentTaskId,
          // Pass LLM preferences to agent function
          llmPreferences: {
            providerId: params.providerId,
            modelId: params.modelId,
            temperature: params.temperature,
            maxTokens: params.maxTokens,
            cidafmOptions: params.cidafmOptions,
          },
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

    // Store message in live cache for polling clients
    if (this.taskStatusService) {
      const messageContent = JSON.stringify({
        stepName,
        stepIndex,
        totalSteps: this.totalSteps,
        status,
        message,
      });

      this.taskStatusService.addTaskMessage(
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
    if (this.taskProgressGateway) {
      this.taskProgressGateway.broadcastWorkflowStepProgress(
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

    if (this.taskProgressGateway) {
      this.taskProgressGateway.broadcastTaskCompletion(
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
    if (!this.tasksService || !this.currentUserId || !this.currentTaskId) {
      this.functionLogger.debug(`Cannot save result - missing requirements:`, {
        tasksService: !!this.tasksService,
        currentUserId: this.currentUserId,
        taskId: this.currentTaskId,
      });
      return;
    }

    try {
      const updateData = {
        status: 'completed' as const,
        progress: 100,
        response: JSON.stringify(result),
        responseMetadata: result.metadata || {},
      };

      this.functionLogger.debug(`Saving task result to database:`, {
        taskId: this.currentTaskId,
        userId: this.currentUserId,
      });

      await this.tasksService.updateTask(
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
   * Test MCP service availability (debugging method)
   */
  testMCPService(): any {
    const registryClient = MCPRegistryService.getMCPClient();
    const injectedClient = this.mcpClientService;
    const actualClient = registryClient || injectedClient;
    
    if (!actualClient) {
      return {
        hasRegistryService: !!registryClient,
        hasInjectedService: !!injectedClient,
        error: 'No MCPClientService available'
      };
    }
    
    try {
      const available = actualClient.isAvailable();
      const serverCount = actualClient.getAvailableServers?.()?.length || 0;
      const availableServers = actualClient.getAvailableServers?.() || [];
      const instanceId = (actualClient as any)?.instanceId || 'unknown';
      
      return {
        hasRegistryService: !!registryClient,
        hasInjectedService: !!injectedClient,
        usingRegistry: !!registryClient,
        instanceId,
        available,
        serverCount,
        availableServers,
        hasIsAvailableMethod: typeof actualClient.isAvailable === 'function',
        hasGetAvailableServersMethod: typeof actualClient.getAvailableServers === 'function'
      };
    } catch (error) {
      return {
        hasRegistryService: !!registryClient,
        hasInjectedService: !!injectedClient,
        instanceId: (actualClient as any)?.instanceId || 'unknown',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get agent card with function status
   */
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();
    const mcpStatus = this.testMCPService();
    return {
      ...baseCard,
      functionStatus: this.agentFunction ? 'loaded' : 'not_loaded',
      loadedAt: this.agentFunction ? new Date().toISOString() : null,
      mcpStatus
    };
  }
}
