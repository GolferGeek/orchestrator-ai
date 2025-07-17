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
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import { SessionsService } from '../sessions/sessions.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateTaskDto, AgentType } from '../common/types/agent-conversations.types';

@Controller('agents')
export class DynamicAgentsController {
  private readonly logger = new Logger(DynamicAgentsController.name);

  constructor(
    private readonly agentDiscovery: AgentDiscoveryService,
    private readonly appService: AppService,
    private readonly sessionsService: SessionsService,
    private readonly tasksService: TasksService,
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
    @Body() taskRequest: CreateTaskDto,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any,
  ) {
    this.logger.debug(
      `Processing task for ${agentType}/${agentName} for user ${currentUser.id}`,
    );

    // Validate required fields
    if (!taskRequest.method || !taskRequest.prompt) {
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

    // Create task with conversation tracking
    const task = await this.tasksService.createTask(
      currentUser.id,
      agentName,
      agentType as AgentType,
      taskRequest,
    );

    try {
      // Update task to running status
      await this.tasksService.updateTask(task.id, currentUser.id, {
        status: 'running',
      });

      // Prepare request for agent with task context
      const authenticatedTaskRequest = {
        ...taskRequest.params,
        method: taskRequest.method,
        prompt: taskRequest.prompt,
        taskId: task.id,
        currentUser,
        authToken: token,
        llmSelection: taskRequest.llmSelection, // Pass LLM selection to agent
        conversationHistory: taskRequest.conversationHistory || [], // Pass conversation history to agent
      };

      this.logger.debug(
        `Processing task ${task.id} with agent ${agentType}/${agentName}`,
      );

      // Process the task using the agent's processTask method
      const result = await agentInstance.processTask(authenticatedTaskRequest);

      // Extract response and metadata from result
      let responseData: string;
      let responseMetadata: Record<string, any> | undefined;
      let llmMetadata: Record<string, any> | undefined;

      if (typeof result === 'object' && result !== null) {
        responseData = JSON.stringify(result);
        responseMetadata = result.metadata || {};
        llmMetadata = result.llmMetadata || {};
        
        // If result has A2A protocol structure, extract the actual response
        if (result.success && result.response) {
          responseData = typeof result.response === 'string' ? result.response : JSON.stringify(result.response);
          responseMetadata = { ...responseMetadata, ...result.metadata };
        }
      } else {
        responseData = String(result);
      }

      // Store LLM selection in metadata if provided
      if (taskRequest.llmSelection) {
        llmMetadata = {
          ...llmMetadata,
          originalLLMSelection: taskRequest.llmSelection,
        };
      }

      // Update task with result and metadata
      await this.tasksService.updateTask(task.id, currentUser.id, {
        status: 'completed',
        response: responseData,
        responseMetadata,
        llmMetadata,
        progress: 100,
      });

      // Return task info along with result
      return {
        taskId: task.id,
        conversationId: task.agentConversationId,
        status: 'completed',
        result,
      };
    } catch (error) {
      // Update task with error
      await this.tasksService.updateTask(task.id, currentUser.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorData: { stack: error instanceof Error ? error.stack : undefined },
      });

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
      return null;
    }

    // Return the corresponding agent instance
    return agentInstances[agentIndex] || null;
  }

  /**
   * Normalize agent name for comparison (handle underscores, spaces, etc.)
   */
  private normalizeAgentName(name: string): string {
    return name.toLowerCase().replace(/[\\s_-]+/g, '_');
  }
}
