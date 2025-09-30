import { Injectable, Logger } from '@nestjs/common';

/**
 * Task Management Interfaces
 */
export interface Task {
  id: string;
  method: string;
  params: any;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  result?: any;
  error?: TaskError;
  timeout?: number;
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface TaskCreationRequest {
  method: string;
  params?: any;
  timeout?: number;
}

export interface TaskError {
  code: number;
  message: string;
  data?: any;
}

export interface TaskMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  activeTasks: number;
  completedTasks: number;
  uptime: number;
  memoryUsage?: NodeJS.MemoryUsage;
  timestamp: Date;
}

export interface TaskLifecycleConfig {
  defaultTimeout?: number;
  maxConcurrentTasks?: number;
  enableMetrics?: boolean;
  cleanupInterval?: number;
}

export interface TaskExecutor {
  executeTask(method: string, params: any): Promise<any>;
}

/**
 * Service responsible for managing the complete lifecycle of tasks including
 * creation, execution, status tracking, timeout handling, and cleanup.
 */
@Injectable()
export class TaskLifecycleService {
  private readonly logger = new Logger(TaskLifecycleService.name);
  private readonly startTime = Date.now();
  private readonly activeTasks = new Map<string, Task>();
  private readonly taskTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly taskHistory: Task[] = [];

  private config: TaskLifecycleConfig = {
    defaultTimeout: 300000, // 5 minutes
    maxConcurrentTasks: 100,
    enableMetrics: true,
    cleanupInterval: 60000, // 1 minute
  };

  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<TaskLifecycleConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): TaskLifecycleConfig {
    return { ...this.config };
  }

  /**
   * Create a new task with the specified configuration
   */
  async createTask(request: TaskCreationRequest): Promise<Task> {
    // Check concurrent task limit
    if (
      this.config.maxConcurrentTasks &&
      this.activeTasks.size >= this.config.maxConcurrentTasks
    ) {
      throw new Error(
        `Maximum concurrent tasks limit reached (${this.config.maxConcurrentTasks})`,
      );
    }

    const taskId = this.generateTaskId();
    const now = new Date();

    const task: Task = {
      id: taskId,
      method: request.method,
      params: request.params,
      status: TaskStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      timeout: request.timeout || this.config.defaultTimeout,
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

    return task;
  }

  /**
   * Execute a task with full lifecycle management using the provided executor
   */
  async executeTaskWithLifecycle(
    taskId: string,
    executor: TaskExecutor,
  ): Promise<Task> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== TaskStatus.PENDING) {
      throw new Error(
        `Task ${taskId} is not in pending status (current: ${task.status})`,
      );
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
          executor.executeTask(task.method, task.params),
          timeoutPromise,
        ]);
      } else {
        result = await executor.executeTask(task.method, task.params);
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
   * Update the status of a task
   */
  updateTaskStatus(taskId: string, status: TaskStatus): Task | null {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return null;
    }

    const oldStatus = task.status;
    task.status = status;
    task.updatedAt = new Date();

    return task;
  }

  /**
   * Get task by ID
   */
  getTaskById(taskId: string): Task | null {
    return this.activeTasks.get(taskId) || null;
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
    return this.getAllTasks().filter((task) => task.status === status);
  }

  /**
   * Get task history for completed/failed/cancelled tasks
   */
  getTaskHistory(agentId?: string): Task[] {
    if (agentId) {
      // Filter by agent ID if provided (could be stored in task metadata)
      return this.taskHistory.filter(
        (task) =>
          task.params?.agentId === agentId ||
          task.params?.currentUser?.agentId === agentId,
      );
    }
    return [...this.taskHistory];
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return false;
    }

    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.FAILED
    ) {
      return false; // Cannot cancel completed or failed tasks
    }

    this.updateTaskStatus(taskId, TaskStatus.CANCELLED);
    this.cleanupTask(taskId);

    return true;
  }

  /**
   * Remove completed, failed, or cancelled tasks from active management
   * Optionally specify a date threshold to only cleanup older tasks
   */
  async cleanupTasks(olderThan?: Date): Promise<number> {
    const now = olderThan || new Date();
    const tasksToCleanup = this.getAllTasks().filter((task) => {
      const isFinished =
        task.status === TaskStatus.COMPLETED ||
        task.status === TaskStatus.FAILED ||
        task.status === TaskStatus.CANCELLED;

      const isOldEnough = olderThan ? task.updatedAt < now : true;

      return isFinished && isOldEnough;
    });

    for (const task of tasksToCleanup) {
      this.cleanupTask(task.id);
    }

    // Only log cleanup if tasks were actually cleaned up
    if (tasksToCleanup.length > 0) {
    }
    return tasksToCleanup.length;
  }

  /**
   * Get task execution metrics
   */
  getTaskMetrics(): TaskMetrics {
    const allTasks = this.getAllTasks();
    const completedTasks = this.getTasksByStatus(TaskStatus.COMPLETED);
    const failedTasks = this.getTasksByStatus(TaskStatus.FAILED);
    const activeTasks = this.getTasksByStatus(TaskStatus.RUNNING);

    // Calculate average response time for completed tasks
    const completedTasksWithTiming = completedTasks.filter(
      (task) => task.result && task.createdAt && task.updatedAt,
    );
    const averageResponseTime =
      completedTasksWithTiming.length > 0
        ? completedTasksWithTiming.reduce(
            (sum, task) =>
              sum + (task.updatedAt.getTime() - task.createdAt.getTime()),
            0,
          ) / completedTasksWithTiming.length
        : 0;

    return {
      requestCount: allTasks.length + this.taskHistory.length,
      errorCount:
        failedTasks.length +
        this.taskHistory.filter((t) => t.status === TaskStatus.FAILED).length,
      averageResponseTime,
      activeTasks: activeTasks.length,
      completedTasks:
        completedTasks.length +
        this.taskHistory.filter((t) => t.status === TaskStatus.COMPLETED)
          .length,
      uptime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date(),
    };
  }

  /**
   * Check for stuck tasks (running for too long)
   */
  getStuckTasks(): Task[] {
    const runningTasks = this.getTasksByStatus(TaskStatus.RUNNING);
    return runningTasks.filter(
      (task) =>
        Date.now() - task.updatedAt.getTime() >
        (task.timeout || this.config.defaultTimeout!),
    );
  }

  /**
   * Force cleanup of stuck tasks
   */
  async cleanupStuckTasks(): Promise<number> {
    const stuckTasks = this.getStuckTasks();

    for (const task of stuckTasks) {
      this.failTask(task.id, new Error('Task stuck - forced cleanup'));
    }

    return stuckTasks.length;
  }

  /**
   * Complete a task with the given result
   */
  private completeTask(taskId: string, result: any): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return;
    }

    task.status = TaskStatus.COMPLETED;
    task.result = result;
    task.updatedAt = new Date();

    this.cleanupTaskTimeout(taskId);
  }

  /**
   * Mark a task as failed with the given error
   */
  private failTask(taskId: string, error: any): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return;
    }

    task.status = TaskStatus.FAILED;
    task.error = {
      code: -32603, // Internal error
      message: error instanceof Error ? error.message : 'Unknown error',
      data: error instanceof Error ? { stack: error.stack } : error,
    };
    task.updatedAt = new Date();

    this.cleanupTaskTimeout(taskId);
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return;
    }

    task.status = TaskStatus.FAILED;
    task.error = {
      code: -32603,
      message: `Task execution timeout after ${task.timeout}ms`,
      data: { timeout: task.timeout },
    };
    task.updatedAt = new Date();

    this.cleanupTaskTimeout(taskId);
  }

  /**
   * Clean up timeout handler for a task
   */
  private cleanupTaskTimeout(taskId: string): void {
    const timeoutHandle = this.taskTimeouts.get(taskId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.taskTimeouts.delete(taskId);
    }
  }

  /**
   * Remove a task from active management and move to history
   */
  private cleanupTask(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      // Move to history if metrics are enabled
      if (this.config.enableMetrics) {
        this.taskHistory.push({ ...task });

        // Limit history size to prevent memory leaks
        if (this.taskHistory.length > 1000) {
          this.taskHistory.splice(0, this.taskHistory.length - 1000);
        }
      }

      this.activeTasks.delete(taskId);
    }

    this.cleanupTaskTimeout(taskId);
  }

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
      this.cleanupInterval = setInterval(async () => {
        try {
          // Cleanup tasks older than 1 hour
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          await this.cleanupTasks(oneHourAgo);

          // Cleanup stuck tasks
          await this.cleanupStuckTasks();
        } catch (_error) {}
      }, this.config.cleanupInterval);
    }
  }

  /**
   * Stop automatic cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Cleanup all resources when service is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    // Stop cleanup interval
    this.stopCleanupInterval();

    // Cancel all running tasks
    const runningTasks = this.getTasksByStatus(TaskStatus.RUNNING);
    for (const task of runningTasks) {
      await this.cancelTask(task.id);
    }

    // Clear all timeouts
    for (const [taskId] of this.taskTimeouts) {
      this.cleanupTaskTimeout(taskId);
    }

    // Clear all tasks
    this.activeTasks.clear();
  }
}
