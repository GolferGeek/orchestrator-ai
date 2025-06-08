import { Injectable, Logger } from '@nestjs/common';
import { BaseService } from '../../../base.service';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcNotification,
  AgentCard,
  AgentEndpoints,
  JSON_RPC_ERRORS,
  JsonRpcErrorCode,
  AgentCapabilities,
  SecurityScheme,
  AgentProvider,
  AgentCardConfig,
  AgentSkill,
  TaskCreationRequest,
  Task,
  TaskStatus,
  AgentMetrics,
  HealthStatus,
  HealthCheck
} from './interfaces';

@Injectable()
export class A2AAgentBaseService extends BaseService {
  private readonly logger = new Logger(A2AAgentBaseService.name);
  private readonly startTime = Date.now();
  private readonly activeTasks = new Map<string, Task>();
  private readonly taskTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly defaultTaskTimeout = 300000; // 5 minutes

  /**
   * Process a single JSON-RPC request or notification
   */
  async processTask(taskRequest: any): Promise<JsonRpcResponse | null> {
    this.logger.debug('Processing JSON-RPC request', { method: taskRequest?.method });

    // Handle batch requests
    if (Array.isArray(taskRequest)) {
      const batchResults = await this.processBatch(taskRequest);
      return batchResults.length > 0 ? batchResults as any : null;
    }

    // Validate request structure
    const validationError = this.validateJsonRpcRequest(taskRequest);
    if (validationError) {
      return this.createJsonRpcError(
        validationError.code, 
        validationError.message, 
        taskRequest?.id ?? null
      );
    }

    const request = taskRequest as JsonRpcRequest;

    // Handle notifications (no response expected)
    if (request.id === undefined) {
      await this.handleNotification(request as JsonRpcNotification);
      return null;
    }

    // Process regular request
    try {
      const result = await this.executeTask(request.method, request.params);
      return this.createJsonRpcResponse(request.id, result);
    } catch (error) {
      return this.handleExecutionError(error, request.id);
    }
  }

  /**
   * Process a JSON-RPC request with full task lifecycle management
   * This provides more detailed tracking compared to the basic processTask method
   */
  async processTaskWithLifecycle(taskRequest: any): Promise<{ response: JsonRpcResponse | null; task?: Task }> {
    this.logger.debug('Processing JSON-RPC request with lifecycle management', { method: taskRequest?.method });

    // Handle batch requests
    if (Array.isArray(taskRequest)) {
      const batchResults = await this.processBatch(taskRequest);
      return { 
        response: batchResults.length > 0 ? batchResults as any : null 
      };
    }

    // Validate request structure
    const validationError = this.validateJsonRpcRequest(taskRequest);
    if (validationError) {
      return {
        response: this.createJsonRpcError(
          validationError.code, 
          validationError.message, 
          taskRequest?.id ?? null
        )
      };
    }

    const request = taskRequest as JsonRpcRequest;

    // Handle notifications (no response expected)
    if (request.id === undefined) {
      await this.handleNotification(request as JsonRpcNotification);
      return { response: null };
    }

    // Create a managed task for the request
    const taskCreationRequest: TaskCreationRequest = {
      method: request.method,
      params: request.params,
      timeout: 30000 // 30 second default timeout for JSON-RPC requests
    };

    try {
      const task = await this.createTask(taskCreationRequest);
      const executedTask = await this.executeTaskWithLifecycle(task.id);

      if (executedTask.status === TaskStatus.COMPLETED) {
        return {
          response: this.createJsonRpcResponse(request.id, executedTask.result),
          task: executedTask
        };
      } else {
        return {
          response: this.createJsonRpcError(
            (executedTask.error?.code as JsonRpcErrorCode) || JSON_RPC_ERRORS.INTERNAL_ERROR,
            executedTask.error?.message || 'Task execution failed',
            request.id,
            executedTask.error?.data
          ),
          task: executedTask
        };
      }
    } catch (error) {
      return {
        response: this.handleExecutionError(error, request.id)
      };
    }
  }

  /**
   * Process batch JSON-RPC requests
   */
  async processBatch(batchRequest: any[]): Promise<JsonRpcResponse[]> {
    this.logger.debug('Processing batch request', { count: batchRequest.length });

    if (batchRequest.length === 0) {
      return [this.createJsonRpcError(JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid Request', null)];
    }

    const responses: JsonRpcResponse[] = [];
    
    // Process all requests in parallel
    const results = await Promise.allSettled(
      batchRequest.map(request => this.processTask(request))
    );

    // Collect non-null responses (notifications return null)
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        responses.push(result.value);
      } else if (result.status === 'rejected') {
        responses.push(this.createJsonRpcError(
          JSON_RPC_ERRORS.INTERNAL_ERROR, 
          'Internal error during batch processing', 
          null
        ));
      }
    }

    return responses;
  }

  /**
   * Generate agent card with A2A protocol compliance
   */
  async getAgentCard(): Promise<AgentCard> {
    // Use the new A2A compliant agent card structure
    return this.generateAgentCard('http://localhost:3000'); // TODO: Get actual base URL from config
  }

  /**
   * Get agent endpoints
   */
  getEndpoints(): AgentEndpoints {
    return {
      tasks: "/tasks",
      health: "/health",
      agent: "/.well-known/agent.json"
    };
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): string[] {
    return this.getAgentCapabilities();
  }

  /**
   * Get agent capabilities for A2A protocol features
   */
  protected getA2ACapabilities(): AgentCapabilities {
    return {
      streaming: false, // TODO: Implement streaming in future phases
      pushNotifications: false, // TODO: Implement push notifications
      stateTransitionHistory: false, // Future feature
      extensions: [] // TODO: Add extension support
    };
  }

  /**
   * Get default input modes supported by the agent
   */
  protected getDefaultInputModes(): string[] {
    return [
      'text/plain',
      'application/json'
    ];
  }

  /**
   * Get default output modes produced by the agent
   */
  protected getDefaultOutputModes(): string[] {
    return [
      'text/plain',
      'application/json'
    ];
  }

  /**
   * Get security schemes for the agent
   */
  protected getSecuritySchemes(): Record<string, SecurityScheme> {
    return {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for agent authentication'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for agent access'
      }
    };
  }

  /**
   * Get security requirements for the agent
   */
  protected getSecurityRequirements(): Array<Record<string, string[]>> {
    return [
      { bearerAuth: [] },
      { apiKey: [] }
    ];
  }

  /**
   * Get agent provider information
   */
  protected getAgentProvider(): AgentProvider | undefined {
    return {
      organization: 'Orchestrator AI',
      url: 'https://orchestrator-ai.com'
    };
  }

  /**
   * Generate a complete A2A Agent Card
   */
  async generateAgentCard(baseUrl: string, config?: Partial<AgentCardConfig>): Promise<AgentCard> {
    const capabilities = {
      ...this.getA2ACapabilities(),
      ...config?.capabilitiesOverride
    };

    const card: AgentCard = {
      name: this.getAgentName(),
      description: `${this.getAgentName()} - A2A Protocol compliant agent`,
      url: baseUrl,
      provider: this.getAgentProvider(),
      version: this.getAgentVersion(),
      capabilities,
      securitySchemes: this.getSecuritySchemes(),
      security: this.getSecurityRequirements(),
      defaultInputModes: this.getDefaultInputModes(),
      defaultOutputModes: this.getDefaultOutputModes(),
      skills: await this.getAgentSkills(),
      supportsAuthenticatedExtendedCard: config?.enableAuthenticatedExtendedCard ?? false
    };

    // Apply any card overrides from config
    if (config?.card) {
      Object.assign(card, config.card);
    }

    this.logger.debug(`Generated agent card for ${this.getAgentName()}`, { 
      skillCount: card.skills.length,
      capabilities: card.capabilities
    });

    return card;
  }

  /**
   * Generate an authenticated extended agent card with additional skills and security schemes
   */
  async generateAuthenticatedAgentCard(
    baseUrl: string, 
    config?: Partial<AgentCardConfig>
  ): Promise<AgentCard> {
    const baseCard = await this.generateAgentCard(baseUrl, config);

    // Add authenticated-only skills
    if (config?.authenticatedSkills) {
      baseCard.skills.push(...config.authenticatedSkills);
    }

    // Add authenticated-only security schemes
    if (config?.authenticatedSecuritySchemes) {
      baseCard.securitySchemes = {
        ...baseCard.securitySchemes,
        ...config.authenticatedSecuritySchemes
      };
    }

    this.logger.debug(`Generated authenticated agent card for ${this.getAgentName()}`, {
      totalSkills: baseCard.skills.length,
      securitySchemes: Object.keys(baseCard.securitySchemes || {})
    });

    return baseCard;
  }

  /**
   * Get agent skills - should be implemented by concrete agent classes
   */
  protected async getAgentSkills(): Promise<AgentSkill[]> {
    // Default implementation - concrete agents should override this
    return [
      {
        id: 'basic-communication',
        name: 'Basic Communication',
        description: 'Handle basic agent-to-agent communication and task processing',
        tags: ['communication', 'tasks', 'a2a'],
        examples: [
          'Process incoming agent requests',
          'Handle task delegation',
          'Provide agent status information'
        ],
        inputModes: this.getDefaultInputModes(),
        outputModes: this.getDefaultOutputModes()
      }
    ];
  }

  /**
   * Validate an agent card structure
   */
  protected validateAgentCard(card: AgentCard): void {
    const errors: string[] = [];

    if (!card.name?.trim()) {
      errors.push('Agent card must have a non-empty name');
    }

    if (!card.description?.trim()) {
      errors.push('Agent card must have a non-empty description');
    }

    if (!card.url?.trim()) {
      errors.push('Agent card must have a valid URL');
    }

    if (!card.version?.trim()) {
      errors.push('Agent card must have a version');
    }

    if (!Array.isArray(card.skills) || card.skills.length === 0) {
      errors.push('Agent card must have at least one skill');
    }

    if (!Array.isArray(card.defaultInputModes) || card.defaultInputModes.length === 0) {
      errors.push('Agent card must specify default input modes');
    }

    if (!Array.isArray(card.defaultOutputModes) || card.defaultOutputModes.length === 0) {
      errors.push('Agent card must specify default output modes');
    }

    // Validate skills
    card.skills.forEach((skill, index) => {
      if (!skill.id?.trim()) {
        errors.push(`Skill at index ${index} must have a non-empty ID`);
      }
      if (!skill.name?.trim()) {
        errors.push(`Skill at index ${index} must have a non-empty name`);
      }
      if (!skill.description?.trim()) {
        errors.push(`Skill at index ${index} must have a non-empty description`);
      }
      if (!Array.isArray(skill.tags)) {
        errors.push(`Skill at index ${index} must have tags array`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Agent card validation failed: ${errors.join(', ')}`);
    }
  }

  // Abstract methods to be implemented by derived classes
  protected getAgentName(): string {
    throw new Error('getAgentName must be implemented by derived service');
  }

  protected getAgentType(): string {
    throw new Error('getAgentType must be implemented by derived service');
  }

  protected getAgentVersion(): string {
    return "1.0.0";
  }

  protected getAgentCapabilities(): string[] {
    throw new Error('getAgentCapabilities must be implemented by derived service');
  }

  protected getAgentMetadata(): Record<string, any> {
    return {
      uptime: Date.now() - this.startTime,
      pid: process.pid,
      nodeVersion: process.version
    };
  }

  protected async executeTask(method: string, params: any): Promise<any> {
    throw new Error('executeTask must be implemented by derived service');
  }

  /**
   * Handle JSON-RPC notifications (no response expected)
   */
  protected async handleNotification(notification: JsonRpcNotification): Promise<void> {
    this.logger.debug('Handling notification', { method: notification.method });
    
    try {
      await this.executeTask(notification.method, notification.params);
    } catch (error) {
      this.logger.error('Error handling notification', { 
        method: notification.method, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Validate JSON-RPC request structure
   */
  private validateJsonRpcRequest(request: any): { code: JsonRpcErrorCode; message: string } | null {
    // Check if request exists
    if (!request || typeof request !== 'object') {
      return { code: JSON_RPC_ERRORS.INVALID_REQUEST, message: 'Invalid Request' };
    }

    // Check JSON-RPC version
    if (request.jsonrpc !== '2.0') {
      return { code: JSON_RPC_ERRORS.INVALID_REQUEST, message: 'Invalid Request: jsonrpc must be "2.0"' };
    }

    // Check method exists and is string
    if (!request.method || typeof request.method !== 'string') {
      return { code: JSON_RPC_ERRORS.INVALID_REQUEST, message: 'Invalid Request: method must be a string' };
    }

    // Check id type if present (string, number, or null)
    if (request.id !== undefined && 
        request.id !== null && 
        typeof request.id !== 'string' && 
        typeof request.id !== 'number') {
      return { code: JSON_RPC_ERRORS.INVALID_REQUEST, message: 'Invalid Request: id must be string, number, or null' };
    }

    return null;
  }

  /**
   * Handle execution errors and convert to appropriate JSON-RPC errors
   */
  private handleExecutionError(error: any, id: string | number | null): JsonRpcResponse {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    this.logger.error('Task execution error', { error: errorMessage, id });

    // Check for specific error types
    if (errorMessage.includes('Method not found') || errorMessage.includes('executeTask must be implemented')) {
      return this.createJsonRpcError(JSON_RPC_ERRORS.METHOD_NOT_FOUND, 'Method not found', id);
    }

    if (errorMessage.includes('Invalid params')) {
      return this.createJsonRpcError(JSON_RPC_ERRORS.INVALID_PARAMS, 'Invalid params', id);
    }

    // Default to internal error
    return this.createJsonRpcError(JSON_RPC_ERRORS.INTERNAL_ERROR, 'Internal error', id);
  }

  /**
   * Create JSON-RPC 2.0 compliant response
   */
  private createJsonRpcResponse(id: string | number | null, result: any): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: id,
      result: result
    };
  }

  /**
   * Create JSON-RPC 2.0 compliant error response
   */
  private createJsonRpcError(
    code: JsonRpcErrorCode, 
    message: string, 
    id: string | number | null,
    data?: any
  ): JsonRpcResponse {
    const error: JsonRpcError = {
      code: code,
      message: message
    };

    if (data !== undefined) {
      error.data = data;
    }

    return {
      jsonrpc: '2.0',
      id: id,
      error: error
    };
  }

  /**
   * Create a new task and register it for lifecycle management
   */
  async createTask(request: TaskCreationRequest): Promise<Task> {
    const taskId = this.generateTaskId();
    const now = new Date();

    const task: Task = {
      id: taskId,
      method: request.method,
      params: request.params,
      status: TaskStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      timeout: request.timeout || this.defaultTaskTimeout
    };

    // Register task in active tasks
    this.activeTasks.set(taskId, task);

    // Set up timeout handler
    if (task.timeout && task.timeout > 0) {
      const timeoutHandle = setTimeout(() => {
        this.handleTaskTimeout(taskId);
      }, task.timeout);
      this.taskTimeouts.set(taskId, timeoutHandle);
    }

    this.logger.debug(`Created task ${taskId}`, { 
      method: task.method, 
      timeout: task.timeout 
    });

    return task;
  }

  /**
   * Execute a task with full lifecycle management
   */
  async executeTaskWithLifecycle(taskId: string): Promise<Task> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== TaskStatus.PENDING) {
      throw new Error(`Task ${taskId} is not in pending status (current: ${task.status})`);
    }

    try {
      // Transition to running state
      this.updateTaskStatus(taskId, TaskStatus.RUNNING);

      // Create a timeout promise that rejects after the timeout period
      const timeoutPromise = new Promise<never>((_, reject) => {
        if (task.timeout && task.timeout > 0) {
          setTimeout(() => {
            reject(new Error(`Task execution timeout after ${task.timeout}ms`));
          }, task.timeout);
        }
      });

      // Race between task execution and timeout
      let result: any;
      if (task.timeout && task.timeout > 0) {
        result = await Promise.race([
          this.executeTask(task.method, task.params),
          timeoutPromise
        ]);
      } else {
        result = await this.executeTask(task.method, task.params);
      }

      // Task completed successfully
      this.completeTask(taskId, result);

      return this.activeTasks.get(taskId)!;
    } catch (error) {
      // Check if this is a timeout error
      if (error instanceof Error && error.message.includes('timeout')) {
        this.handleTaskTimeout(taskId);
      } else {
        // Task failed for other reasons
        this.failTask(taskId, error);
      }
      return this.activeTasks.get(taskId)!;
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Get all active tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return this.getAllTasks().filter(task => task.status === status);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      return false; // Cannot cancel completed or failed tasks
    }

    this.updateTaskStatus(taskId, TaskStatus.CANCELLED);
    this.cleanupTask(taskId);

    this.logger.debug(`Cancelled task ${taskId}`);
    return true;
  }

  /**
   * Remove completed, failed, or cancelled tasks from active management
   */
  async cleanupCompletedTasks(): Promise<number> {
    const tasksToCleanup = this.getAllTasks().filter(task => 
      task.status === TaskStatus.COMPLETED || 
      task.status === TaskStatus.FAILED || 
      task.status === TaskStatus.CANCELLED
    );

    for (const task of tasksToCleanup) {
      this.cleanupTask(task.id);
    }

    this.logger.debug(`Cleaned up ${tasksToCleanup.length} completed tasks`);
    return tasksToCleanup.length;
  }

  /**
   * Get task execution metrics
   */
  getTaskMetrics(): AgentMetrics {
    const allTasks = this.getAllTasks();
    const completedTasks = this.getTasksByStatus(TaskStatus.COMPLETED);
    const failedTasks = this.getTasksByStatus(TaskStatus.FAILED);
    const activeTasks = this.getTasksByStatus(TaskStatus.RUNNING);

    // Calculate average response time for completed tasks
    const completedTasksWithTiming = completedTasks.filter(task => task.result && task.createdAt && task.updatedAt);
    const averageResponseTime = completedTasksWithTiming.length > 0
      ? completedTasksWithTiming.reduce((sum, task) => 
          sum + (task.updatedAt.getTime() - task.createdAt.getTime()), 0) / completedTasksWithTiming.length
      : 0;

    return {
      requestCount: allTasks.length,
      errorCount: failedTasks.length,
      averageResponseTime,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      uptime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date()
    };
  }

  /**
   * Generate health status including task-related health checks
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];
    const metrics = this.getTaskMetrics();

    // Check for stuck tasks (running for too long)
    const runningTasks = this.getTasksByStatus(TaskStatus.RUNNING);
    const stuckTasks = runningTasks.filter(task => 
      Date.now() - task.updatedAt.getTime() > (task.timeout || this.defaultTaskTimeout)
    );

    checks.push({
      name: 'task-execution',
      status: stuckTasks.length === 0 ? 'pass' : 'warn',
      message: stuckTasks.length > 0 ? `${stuckTasks.length} tasks may be stuck` : 'All tasks executing normally'
    });

    // Check task queue size
    checks.push({
      name: 'task-queue',
      status: metrics.activeTasks < 100 ? 'pass' : 'warn',
      message: `${metrics.activeTasks} active tasks`
    });

    // Check error rate
    const errorRate = metrics.requestCount > 0 ? metrics.errorCount / metrics.requestCount : 0;
    checks.push({
      name: 'error-rate',
      status: errorRate < 0.1 ? 'pass' : errorRate < 0.3 ? 'warn' : 'fail',
      message: `Error rate: ${(errorRate * 100).toFixed(1)}%`
    });

    const overallStatus = checks.some(check => check.status === 'fail') ? 'unhealthy' :
                         checks.some(check => check.status === 'warn') ? 'degraded' : 'healthy';

    return {
      status: overallStatus,
      timestamp: new Date(),
      checks,
      uptime: metrics.uptime
    };
  }

  // ============================================================================
  // PRIVATE TASK LIFECYCLE METHODS
  // ============================================================================

  /**
   * Update task status and timestamp
   */
  private updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      this.activeTasks.set(taskId, task);

      this.logger.debug(`Task ${taskId} status updated to ${status}`);
    }
  }

  /**
   * Complete a task successfully
   */
  private completeTask(taskId: string, result: any): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = TaskStatus.COMPLETED;
      task.result = result;
      task.updatedAt = new Date();
      this.activeTasks.set(taskId, task);

      this.cleanupTaskTimeout(taskId);
      this.logger.debug(`Task ${taskId} completed successfully`);
    }
  }

  /**
   * Mark a task as failed
   */
  private failTask(taskId: string, error: any): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = TaskStatus.FAILED;
      task.error = {
        code: JSON_RPC_ERRORS.INTERNAL_ERROR,
        message: error.message || 'Task execution failed',
        data: { error: error.toString() }
      };
      task.updatedAt = new Date();
      this.activeTasks.set(taskId, task);

      this.cleanupTaskTimeout(taskId);
      this.logger.error(`Task ${taskId} failed`, { error: error.toString() });
    }
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    if (task && task.status === TaskStatus.RUNNING) {
      task.status = TaskStatus.FAILED;
      task.error = {
        code: JSON_RPC_ERRORS.INTERNAL_ERROR,
        message: 'Task execution timeout',
        data: { timeout: task.timeout }
      };
      task.updatedAt = new Date();
      this.activeTasks.set(taskId, task);

      this.logger.warn(`Task ${taskId} timed out after ${task.timeout}ms`);
    }
    this.cleanupTaskTimeout(taskId);
  }

  /**
   * Clean up task timeout
   */
  private cleanupTaskTimeout(taskId: string): void {
    const timeoutHandle = this.taskTimeouts.get(taskId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.taskTimeouts.delete(taskId);
    }
  }

  /**
   * Clean up task resources
   */
  private cleanupTask(taskId: string): void {
    this.cleanupTaskTimeout(taskId);
    this.activeTasks.delete(taskId);
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 