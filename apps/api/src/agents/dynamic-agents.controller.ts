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
  BadRequestException,
} from '@nestjs/common';
import { AgentDiscoveryService } from '../agent-discovery.service';
import { AppService } from '../app.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import { AgentConversationsService } from '../agent-conversations/agent-conversations.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatusService } from '../tasks/task-status.service';
import {
  CreateTaskDto,
  AgentType,
} from '../common/types/agent-conversations.types';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { CentralizedRoutingService } from '../llms/centralized-routing.service';

@Controller('agents')
export class DynamicAgentsController {
  private readonly logger = new Logger(DynamicAgentsController.name);

  constructor(
    private readonly agentDiscovery: AgentDiscoveryService,
    private readonly appService: AppService,
    private readonly tasksService: TasksService,
    private readonly agentConversationsService: AgentConversationsService,
    private readonly taskStatusService: TaskStatusService,
    private readonly contextOptimizationService: ContextOptimizationService,
    private readonly centralizedRoutingService: CentralizedRoutingService,
  ) {}

  /**
   * Debug endpoint to see raw discovered agents
   * Route: GET /agents/.well-known/debug-agents
   */
  @Get('.well-known/debug-agents')
  @Public()
  async getDebugAgents() {
    const agents = this.agentDiscovery.getDiscoveredAgents();
    return {
      success: true,
      data: agents.map(a => ({
        name: a.name,
        path: a.path,
        reportsTo: a.reportsTo,
        hasConfig: !!a.configPath
      })),
      total: agents.length
    };
  }

  /**
   * Get agent hierarchy
   * Route: GET /agents/.well-known/hierarchy
   */
  @Get('.well-known/hierarchy')
  @Public()
  async getAgentHierarchy() {

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
    // 🔍 DEBUG: Log incoming request at the very top
    this.logger.debug(`🚀 [DynamicAgentsController] Incoming request to ${agentType}/${agentName}`);
    this.logger.debug(`🚀 [DynamicAgentsController] Request body type: ${typeof taskRequest}`);
    this.logger.debug(`🚀 [DynamicAgentsController] Request method: ${taskRequest?.method || 'undefined'}`);
    this.logger.debug(`🚀 [DynamicAgentsController] User ID: ${currentUser?.id || 'undefined'}`);
    this.logger.debug(`🚀 [DynamicAgentsController] Full request body: ${JSON.stringify(taskRequest, null, 2)}`);


    // Check if this is a JSON-RPC request and convert it to CreateTaskDto format
    let normalizedTaskRequest: CreateTaskDto;

    if (taskRequest && taskRequest.jsonrpc === '2.0' && taskRequest.method) {
      // This is a JSON-RPC request - convert to CreateTaskDto format

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

    // 🔒 PII POLICY CHECK - Block sensitive data before it reaches any agent
    this.logger.debug(`🔒 [DynamicAgentsController] Performing PII policy check for ${agentType}/${agentName}`);
    const routingDecision = await this.centralizedRoutingService.determineRoute(
      normalizedTaskRequest.prompt,
      {
        conversationId: normalizedTaskRequest.conversationId,
        userId: currentUser?.id,
        requestId: `agent-${agentType}-${agentName}-${Date.now()}`,
        // Pass provider information for PII policy decisions
        providerName: normalizedTaskRequest.llmSelection?.providerName,
      }
    );

    // Check if request was blocked by PII policy
    if (routingDecision.provider === 'policy-blocked') {
      this.logger.warn(`🚫 [DynamicAgentsController] Request blocked by PII policy: ${routingDecision.piiMetadata?.policyDecision?.violations?.join(', ')}`);

      // Create a blocked task response immediately
      const task = await this.tasksService.createTask(
        currentUser.id,
        agentName,
        agentType as AgentType,
        {
          ...normalizedTaskRequest,
          conversationHistory: normalizedTaskRequest.conversationHistory || [],
        },
      );

      const userMessage = routingDecision.piiMetadata?.userMessage;
      const defaultMessage = 'Request blocked due to PII policy violation. Please rephrase your request without including sensitive personal information.';
      const messageSummary = userMessage?.summary || defaultMessage;

      // Mark task as failed with PII violation
      await this.taskStatusService.failTask(
        task.id,
        currentUser.id,
        messageSummary,
      );

      // Return a successful response with PII policy block information
      return {
        success: false,
        blocked: true,
        reason: 'PII_POLICY_VIOLATION',
        message: messageSummary,
        taskId: task.id,
        conversationId: task.agentConversationId,
        details: {
          reason: userMessage?.details?.join(' ') || 'Sensitive personal information detected.',
          suggestion: userMessage?.blockingDetails?.recommendation || 'Please remove any SSNs, credit card numbers, API keys, or other sensitive data and try again.',
          detectedTypes: userMessage?.blockingDetails?.showstopperTypes || [],
        },
        piiMetadata: routingDecision.piiMetadata,
      };
    }

    this.logger.debug(`✅ [DynamicAgentsController] PII policy check passed for ${agentType}/${agentName}`);

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

    // Task type is no longer used - all tasks are handled as ephemeral

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

    const normalizedOptimizedHistory = (optimizedHistory || []).map(
      (m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || new Date().toISOString(),
        ...(m.metadata ? { metadata: m.metadata } : {}),
      }),
    );

    const taskRequestWithTimeout = {
      ...normalizedTaskRequest,
      conversationHistory: normalizedOptimizedHistory,
      llmMetadata: {
        ...(normalizedTaskRequest as any).llmMetadata,
        contextOptimization: optimizationEnabled
          ? {
              strategy: 'backend_intelligent',
              originalMessageCount: (
                normalizedTaskRequest.conversationHistory || []
              ).length,
              optimizedMessageCount: normalizedOptimizedHistory.length,
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

        }
      }

      // Prepare request for agent with task context
      const authenticatedTaskRequest = {
        ...normalizedTaskRequest.params,
        method: normalizedTaskRequest.method,
        prompt: normalizedTaskRequest.prompt,
        taskId: task.id,
        conversationId: normalizedTaskRequest.conversationId, // Pass conversation ID to agent services
        currentUser,
        authToken: token,
        llmSelection: normalizedTaskRequest.llmSelection,
        conversationHistory: normalizedTaskRequest.conversationHistory || [],
        metadata: normalizedTaskRequest.metadata, // Pass metadata for deliverable operations
        // NEW ARCHITECTURE: Pass PII metadata and routing decision to agents
        piiMetadata: routingDecision.piiMetadata,
        routingDecision: routingDecision,
        originalPrompt: routingDecision.originalPrompt,
      };

      // In A2A architecture, all execution modes should await completion
      // The difference is only in progress reporting:
      // - immediate: no progress updates
      // - websocket/polling: progress updates via WebSocket during processing
      
      const executionMode = normalizedTaskRequest.executionMode;
      this.logger.log(`🚀 Processing task ${task.id} in ${executionMode} mode - will await completion`);

      // 🔍 DEBUG: Log before calling processTask
      this.logger.debug(`🎯 [DynamicAgentsController] About to call processTask on agent: ${agentName}`);
      this.logger.debug(`🎯 [DynamicAgentsController] Agent instance type: ${agentInstance.constructor.name}`);
      this.logger.debug(`🎯 [DynamicAgentsController] Task request method: ${authenticatedTaskRequest.method}`);
      this.logger.debug(`🎯 [DynamicAgentsController] Task request prompt: ${authenticatedTaskRequest.prompt?.substring(0, 100)}...`);

      // All modes now await the result for proper A2A behavior
      const result = await agentInstance.processTask(authenticatedTaskRequest);

      // 🔍 DEBUG: Log the result from processTask
      this.logger.debug(`🎯 [DynamicAgentsController] processTask completed for ${agentName}`);
      this.logger.debug(`🎯 [DynamicAgentsController] Result type: ${typeof result}`);
      this.logger.debug(`🎯 [DynamicAgentsController] Result keys: ${result ? Object.keys(result).join(', ') : 'null'}`);
      this.logger.debug(`🎯 [DynamicAgentsController] Result success: ${result?.success}`);
      this.logger.debug(`🎯 [DynamicAgentsController] Result message length: ${result?.message?.length || 0}`);
      if (result?.response) {
        this.logger.debug(`🎯 [DynamicAgentsController] Result response length: ${result.response?.length || 0}`);
      }

      // Store the result in the task record with deliverable auto-creation
      // Use the agent's completeTask method to enable deliverable creation
      if (agentInstance.completeTask) {
        await agentInstance.completeTask(task.id, currentUser.id, result);
      } else {
        // Fallback to direct task completion if agent doesn't have completeTask method
        await this.taskStatusService.completeTask(task.id, currentUser.id, result);
      }

      // Return the result for immediate response
      return {
        taskId: task.id,
        conversationId: task.agentConversationId,
        status: 'completed',
        result,
        // NEW ARCHITECTURE: Include PII metadata in response
        piiMetadata: routingDecision.piiMetadata,
        // Include any PII metadata from the agent result if available
        ...(result?.metadata?.piiMetadata && {
          agentPiiMetadata: result.metadata.piiMetadata
        })
      };
    } catch (error) {
      // Mark task as failed via TaskStatusService (single source of truth)
      await this.taskStatusService.failTask(
        task.id,
        currentUser.id,
        error instanceof Error ? error.message : 'Unknown error',
      );

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
    const modelName: string = (llmSelection && llmSelection.modelName) || 'default';
    const hasKey = Object.prototype.hasOwnProperty.call(budgets, modelName);
    const value: number = hasKey
      ? (budgets[modelName] as number)
      : (budgets['default'] as number);
    return value;
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
      if (!a.path) {
        // Fallback for agents with null path - match by type and name
        return a.type === agentType && a.name === agentName;
      }
      const normalizedAgentPath = this.normalizeAgentName(a.path);
      const normalizedExpectedPath = this.normalizeAgentName(expectedPath);
      return normalizedAgentPath === normalizedExpectedPath;
    });

    if (agentIndex === -1) {

      return null;
    }

    // Return the corresponding agent instance
    return agentInstances[agentIndex] || null;
  }

  /**
   * Process task asynchronously - simplified version using TaskStatusService
   */
  // processTaskAsync method removed - all execution modes now use synchronous await pattern

  /**
   * Normalize agent name for comparison (handle underscores, spaces, etc.)
   */
  private normalizeAgentName(name: string): string {
    return name.toLowerCase().replace(/[\\s_-]+/g, '_');
  }
}
