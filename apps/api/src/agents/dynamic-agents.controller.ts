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
import { TasksService } from '../tasks/tasks.service';
import { TaskStatusService } from '../tasks/task-status.service';
import { SupabaseToolsService } from '../langchain/services/supabase-tools.service';
import {
  CreateTaskDto,
  AgentType,
} from '../common/types/agent-conversations.types';

@Controller('agents')
export class DynamicAgentsController {
  private readonly logger = new Logger(DynamicAgentsController.name);

  constructor(
    private readonly agentDiscovery: AgentDiscoveryService,
    private readonly appService: AppService,
    private readonly sessionsService: SessionsService,
    private readonly tasksService: TasksService,
    private readonly taskStatusService: TaskStatusService,
    private readonly supabaseTools: SupabaseToolsService,
  ) {}

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
        prompt: params.message || params.userMessage || params.prompt || 'No message provided',
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
        conversationHistory: params.conversation_history || params.conversationHistory || [],
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

    // Create task with agent-specific timeout
    const taskRequestWithTimeout = {
      ...normalizedTaskRequest,
      timeoutSeconds: agentTimeout,
    };

    const task = await this.tasksService.createTask(
      currentUser.id,
      agentName,
      agentType as AgentType,
      taskRequestWithTimeout,
    );

    try {
      // Initialize task status in TaskStatusService (single source of truth)
      await this.taskStatusService.createTask(
        task.id,
        currentUser.id,
        'ephemeral', // Agent can override via getTaskType() in agent card
      );

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

      // For synchronous processing, await the result
      const result = await agentInstance.processTask(authenticatedTaskRequest);

      // Agent should have completed the task via TaskStatusService
      // Just return the result
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
    const agentIndex = discoveredAgents.findIndex((a) => {
      const normalizedAgentPath = this.normalizeAgentName(a.path);
      const normalizedExpectedPath = this.normalizeAgentName(expectedPath);
      return normalizedAgentPath === normalizedExpectedPath;
    });

    if (agentIndex === -1) {
      this.logger.debug(`Agent not found. Looking for: ${expectedPath}`);
      this.logger.debug(
        `Available agents:`,
        discoveredAgents.map((a) => a.path),
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
