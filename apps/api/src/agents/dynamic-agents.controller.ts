import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
  NotFoundException,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AgentDiscoveryService } from '../agent-discovery.service';
import { AppService } from '../app.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import { SessionsService } from '../sessions/sessions.service';
import { AgentConversationsService } from '../agent-conversations/agent-conversations.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatusService } from '../tasks/task-status.service';
import {
  CreateTaskDto,
  AgentType,
} from '../common/types/agent-conversations.types';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';

@Controller('agents')
export class DynamicAgentsController {
  private readonly logger = new Logger(DynamicAgentsController.name);

  constructor(
    private readonly agentDiscovery: AgentDiscoveryService,
    private readonly appService: AppService,
    private readonly sessionsService: SessionsService,
    private readonly tasksService: TasksService,
    private readonly agentConversationsService: AgentConversationsService,
    private readonly taskStatusService: TaskStatusService,
    private readonly contextOptimizationService: ContextOptimizationService,
  ) {}

  /**
   * Get agent hierarchy
   * Route: GET /agents/.well-known/hierarchy
   */
  @Get('.well-known/hierarchy')
  @Public()
  async getAgentHierarchy() {
    this.logger.debug('Getting agent hierarchy');

    try {
      // Ensure agents are discovered and hierarchy is built
      await this.agentDiscovery.discoverAgents();

      const hierarchy = this.agentDiscovery.getAgentHierarchy();

      return {
        success: true,
        data: hierarchy,
        metadata: {
          totalAgents: this.agentDiscovery.getDiscoveredAgents().length,
          rootNodes: hierarchy.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get agent hierarchy:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        metadata: {
          totalAgents: 0,
          rootNodes: 0,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Handle tasks for any discovered agent
   * Route: POST /agents/:agentType/:agentName/tasks
   */
  @Post(':agentType/:agentName/tasks')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async handleTasks(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string,
    @Body() taskRequest: any, // Change from CreateTaskDto to any to handle both formats
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any,
  ) {
    this.logger.debug(
      `Processing task for ${agentType}/${agentName} for user ${currentUser.id}`,
    );

    // Check if this is a JSON-RPC request and convert it to CreateTaskDto format
    let normalizedTaskRequest: CreateTaskDto;

    if (taskRequest && taskRequest.jsonrpc === '2.0' && taskRequest.method) {
      // This is a JSON-RPC request - convert to CreateTaskDto format
      this.logger.debug('Converting JSON-RPC request to CreateTaskDto format');

      const params = taskRequest.params || {};
      normalizedTaskRequest = {
        method: taskRequest.method,
        prompt:
          params.message ||
          params.userMessage ||
          params.prompt ||
          'No message provided',
        params: {
          ...params,
          // Preserve the original JSON-RPC structure for the agent
          jsonrpc: taskRequest.jsonrpc,
          jsonrpcId: taskRequest.id,
          jsonrpcMethod: taskRequest.method,
        },
        conversationId: params.conversationId || params.session_id,
        taskId: params.taskId,
        timeoutSeconds: params.timeoutSeconds,
        llmSelection: params.llmSelection,
        executionMode: params.executionMode,
        conversationHistory:
          params.conversation_history || params.conversationHistory || [],
      };
    } else {
      // This is already in CreateTaskDto format
      normalizedTaskRequest = taskRequest as CreateTaskDto;
    }

    // Validate required fields
    if (!normalizedTaskRequest.method || !normalizedTaskRequest.prompt) {
      throw new Error('Method and prompt are required');
    }

    // Extract auth token from request
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Get agent configuration for timeout and other settings
    const agentCard = await agentInstance.getAgentCard();
    const agentTimeout = agentCard.timeout || 300; // Default to 5 minutes if not specified
    
    // Get agent's preferred task type (if available)
    const agentTaskType = (agentInstance as any).getTaskType ? 
      (agentInstance as any).getTaskType() : 
      'ephemeral'; // Default for dynamic agent requests

    // Create task with agent-specific timeout
    // Optimize context (backend-intelligent) with feature flag
    const wp = normalizedTaskRequest.params?.workProduct;
    const optimizationEnabled =
      (process.env.CONTEXT_OPTIMIZATION_ENABLED ?? 'true') !== 'false';
    const optimizedHistory = optimizationEnabled
      ? await this.contextOptimizationService.optimizeContext({
          fullHistory: normalizedTaskRequest.conversationHistory || [],
          conversationId: normalizedTaskRequest.conversationId,
          workProductType: wp?.type,
          workProductId: wp?.id,
          tokenBudget: this.getTokenBudget(normalizedTaskRequest.llmSelection),
        })
      : normalizedTaskRequest.conversationHistory || [];

    const taskRequestWithTimeout = {
      ...normalizedTaskRequest,
      conversationHistory: optimizedHistory,
      llmMetadata: {
        ...(normalizedTaskRequest as any).llmMetadata,
        contextOptimization: optimizationEnabled
          ? {
              strategy: 'backend_intelligent',
              originalMessageCount:
                (normalizedTaskRequest.conversationHistory || []).length,
              optimizedMessageCount: optimizedHistory.length,
              workProductType: wp?.type,
            }
          : undefined,
      },
      timeoutSeconds: agentTimeout,
    };

    const task = await this.tasksService.createTask(
      currentUser.id,
      agentName,
      agentType as AgentType,
      taskRequestWithTimeout,
      agentTaskType, // Pass agent's preferred task type
    );

    try {
      // Task status already initialized in TasksService.createTask()
      // No need to duplicate TaskStatusService.createTask() call here
      
      // If client provided workProduct, bind it immutably to the conversation once
      if (wp && task.agentConversationId) {
        try {
          await this.agentConversationsService.setPrimaryWorkProduct(
            task.agentConversationId,
            currentUser.id,
            { type: wp.type, id: wp.id },
          );
        } catch (e) {
          this.logger.warn(
            `Work product binding skipped for conversation ${task.agentConversationId}: ${e instanceof Error ? e.message : e}`,
          );
        }
      }

      // Prepare request for agent with task context
      const authenticatedTaskRequest = {
        ...normalizedTaskRequest.params,
        method: normalizedTaskRequest.method,
        prompt: normalizedTaskRequest.prompt,
        taskId: task.id,
        currentUser,
        authToken: token,
        llmSelection: normalizedTaskRequest.llmSelection,
        conversationHistory: normalizedTaskRequest.conversationHistory || [],
      };

      this.logger.debug(
        `Processing task ${task.id} with agent ${agentType}/${agentName}`,
      );

      // Determine processing mode based on execution mode and pre-generated task ID
      const executionMode = normalizedTaskRequest.executionMode;
      const hasPreGeneratedTaskId = normalizedTaskRequest.taskId;
      const shouldProcessAsync =
        executionMode === 'websocket' || executionMode === 'polling';

      if (shouldProcessAsync) {
        this.logger.debug(
          `${executionMode} mode detected for task ${task.id}${hasPreGeneratedTaskId ? ' (pre-generated for early WebSocket subscription)' : ''}. Processing asynchronously for real-time updates.`,
        );

        // Process asynchronously (don't await) - agent will handle completion via TaskStatusService
        this.processTaskAsync(task, authenticatedTaskRequest, agentInstance);

        // Return immediately so frontend can listen for WebSocket updates or poll
        return {
          taskId: task.id,
          conversationId: task.agentConversationId,
          status: 'pending',
          result: null,
        };
      }

      this.logger.debug(`🔍 DEBUG - Using immediate/synchronous mode for task ${task.id}`);
      this.logger.debug(`🔍 DEBUG - About to call agentInstance.processTask`);

      // For synchronous processing, await the result
      const result = await agentInstance.processTask(authenticatedTaskRequest);

      this.logger.debug(`🔍 DEBUG - Task ${task.id} completed with result: ${JSON.stringify(result, null, 2)}`);

      // Store the result in the task record so frontend can access it
      await this.taskStatusService.completeTask(
        task.id,
        currentUser.id,
        result, // This is the orchestrator response with message field
      );

      this.logger.debug(`🔍 DEBUG - Task ${task.id} marked as completed in database`);

      // Return the result for immediate response
      return {
        taskId: task.id,
        conversationId: task.agentConversationId,
        status: 'completed',
        result,
      };
    } catch (error) {
      // Mark task as failed via TaskStatusService (single source of truth)
      await this.taskStatusService.failTask(
        task.id,
        currentUser.id,
        error instanceof Error ? error.message : 'Unknown error',
      );

      this.logger.error(`Task ${task.id} failed:`, error);
      throw error;
    }
  }

  private getTokenBudget(llmSelection?: any): number {
    const budgets: Record<string, number> = {
      'claude-3-5-sonnet': 100000,
      'claude-3-haiku': 150000,
      'gpt-4-turbo': 100000,
      default: 80000,
    };
    const modelId = llmSelection?.modelId || 'default';
    return budgets[modelId] ?? budgets.default;
  }

  /**
   * Get agent card for any discovered agent
   * Route: GET /agents/:agentType/:agentName/.well-known/agent.json
   */
  @Get(':agentType/:agentName/.well-known/agent.json')
  async getAgentCard(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string,
  ) {
    this.logger.debug(`Getting agent card for ${agentType}/${agentName}`);

    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Get the agent card
    return agentInstance.getAgentCard();
  }

  /**
   * Health check for any discovered agent
   * Route: GET /agents/:agentType/:agentName/health
   */
  @Get(':agentType/:agentName/health')
  async getAgentHealth(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string,
  ) {
    this.logger.debug(`Getting health status for ${agentType}/${agentName}`);

    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Get the health status if available
    if (agentInstance.getHealthStatus) {
      return agentInstance.getHealthStatus();
    }

    return { status: 'healthy', message: 'Agent is running' };
  }

  /**
   * Find an agent instance by type and name
   */
  private findAgentInstance(agentType: string, agentName: string): any {
    const discoveredAgents = this.appService.getDiscoveredAgents();
    const agentInstances = this.appService.getAgentInstances();

    // Match the agent by path logic (e.g., "specialists/blog_post" or "orchestrator/orchestrator")
    const expectedPath = `${agentType}/${agentName}`;
    let agentIndex = discoveredAgents.findIndex((a) => {
      if (!a.path) {
        // Fallback for agents with null path - match by type and name
        return a.type === agentType && a.name === agentName;
      }
      const normalizedAgentPath = this.normalizeAgentName(a.path);
      const normalizedExpectedPath = this.normalizeAgentName(expectedPath);
      return normalizedAgentPath === normalizedExpectedPath;
    });

    if (agentIndex === -1) {
      this.logger.debug(`Agent not found. Looking for: ${expectedPath}`);
      this.logger.debug(
        `Available agents:`,
        discoveredAgents.map((a) => a.path || `${a.type}/${a.name}`),
      );
      this.logger.debug(
        `Available agent types and names:`,
        discoveredAgents.map((a) => `${a.type}/${a.name}`),
      );
      return null;
    }

    // Return the corresponding agent instance
    return agentInstances[agentIndex] || null;
  }

  /**
   * Process task asynchronously - simplified version using TaskStatusService
   */
  private async processTaskAsync(
    task: any,
    authenticatedTaskRequest: any,
    agentInstance: any,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Processing task ${task.id} asynchronously - agent will handle completion via TaskStatusService`,
      );

      // Let the agent handle the task and all status updates
      // Agent will use TaskStatusService methods to update progress and completion
      await agentInstance.processTask(authenticatedTaskRequest);

      this.logger.debug(
        `Async task ${task.id} processing completed - agent handled status updates`,
      );
    } catch (error) {
      // Agent should have handled error via TaskStatusService failTask() method
      // But as a fallback, ensure task is marked as failed
      try {
        await this.taskStatusService.failTask(
          task.id,
          authenticatedTaskRequest.currentUser.id,
          error instanceof Error ? error.message : 'Unknown error',
        );
      } catch (statusError) {
        this.logger.error(
          `Failed to update task status for error:`,
          statusError,
        );
      }

      this.logger.error(`Async task ${task.id} failed:`, error);
    }
  }

  /**
   * Normalize agent name for comparison (handle underscores, spaces, etc.)
   */
  private normalizeAgentName(name: string): string {
    return name.toLowerCase().replace(/[\\s_-]+/g, '_');
  }
}
