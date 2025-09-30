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
      services.deliverableVersionsService,
      services.tasksService,
      services.llmService,
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
  }

  /**
   * Enhanced task execution with progress tracking and state management
   */
  public async executeTask(method: string, params: any): Promise<any> {
    const agentName = this.getAgentName();

    // NEW ARCHITECTURE: Check for PII blocking first
    if (this.shouldBlockForPII(params)) {
      this.functionLogger.warn(
        `🛑 [${agentName}] Request blocked due to PII policy violation`,
      );
      return this.generatePIIBlockedResponse(params);
    }

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
            // Accept either flat params or nested llmSelection
            providerName:
              params?.providerName ||
              params?.llmSelection?.providerName ||
              options?.providerName,
            modelName:
              params?.modelName ||
              params?.llmSelection?.modelName ||
              options?.modelName,
            temperature:
              params?.temperature ??
              params?.llmSelection?.temperature ??
              options?.temperature,
            maxTokens:
              params?.maxTokens ||
              params?.llmSelection?.maxTokens ||
              options?.maxTokens,
            // Honor quick path for converse/plan to bypass pseudonymization
            quick: params?.quick === true || options?.quick === true,
            cidafmOptions: params.cidafmOptions || options?.cidafmOptions,
            authToken: params.authToken || options?.authToken,
            sessionId: params.sessionId || options?.sessionId,
            callerType: 'agent',
            callerName: agentName,
            conversationId: params.conversationId || options?.conversationId, // Use proper conversation ID, not legacy sessionId
            userId: params.currentUser?.id || params.userId, // Add user ID for LLM usage tracking
            dataClassification: 'internal', // Default for function agents
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

      // Use the direct MCP service from the app module instead of HTTP client
      // The HTTP-based MCPClientService creates circular dependencies when used internally
      // Import the MCPService directly for in-process usage
      const mcpService = this.services.mcpService;

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
        // NEW ARCHITECTURE: Include PII metadata for function agents
        piiMetadata: this.extractPIIMetadata(params),
        routingDecision: this.extractRoutingDecision(params),
        originalPrompt: this.extractOriginalPrompt(params),
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

      // Use parent class completeTask method which includes deliverable creation
      if (this.currentTaskId && this.currentUserId) {
        await this.completeTask(this.currentTaskId, this.currentUserId, result);
      }

      // Broadcast final response to WebSocket clients
      if (this.services.taskProgressGateway && this.currentTaskId) {
        this.services.taskProgressGateway.broadcastTaskCompletionWithResponse(
          this.currentTaskId,
          'completed',
          'Task completed successfully with response',
          result.response || result,
          result.metadata || {},
        );
      }

      // Return structured response format to match ContextAgentBaseService
      const hasContent =
        result &&
        (result.response || result.message || typeof result === 'string');
      const successResponse = {
        success: true,
        response: hasContent
          ? result.response || result
          : 'Let’s continue the conversation — how would you like to proceed?',
        metadata: {
          agentType: this.getAgentType(),
          functionStatus: 'executed',
          processedAt: new Date().toISOString(),
          ...functionParams.metadata,
          ...(result.metadata || {}),
          ...(hasContent ? {} : { fallback: true }),
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

      // NEW ARCHITECTURE: Enrich response with PII metadata
      return this.enrichResponseWithPIIMetadata(successResponse, params);
    } catch (error) {
      this.functionLogger.error(
        `Function execution error for ${agentName}:`,
        error,
      );

      // Broadcast error status
      if (this.services.taskProgressGateway && this.currentTaskId) {
        this.services.taskProgressGateway.broadcastTaskCompletion(
          this.currentTaskId,
          'failed',
          error instanceof Error ? error.message : String(error),
        );
      }

      // Return structured error response
      const errorResponse = {
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

      // NEW ARCHITECTURE: Enrich error response with PII metadata
      return this.enrichResponseWithPIIMetadata(errorResponse, params);
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
      return;
    }

    // Track completed workflow steps
    if (
      status === 'completed' &&
      !this.completedWorkflowSteps.includes(stepName)
    ) {
      this.completedWorkflowSteps.push(stepName);
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
    } else {
      this.functionLogger.error(
        'TaskProgressGateway is not available for broadcasting progress events',
      );
    }
  }

  /**
   * Set the total number of steps for progress tracking
   */
  protected setTotalSteps(totalSteps: number): void {
    this.totalSteps = totalSteps;
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
