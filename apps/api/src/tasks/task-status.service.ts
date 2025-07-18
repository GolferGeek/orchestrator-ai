import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TasksService } from './tasks.service';

export interface TaskStatus {
  taskId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progressMessage?: string;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  // Agent-specific JSON data (flexible)
  [key: string]: any;
}

export interface TaskStatusUpdate {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  progressMessage?: string;
  result?: any;
  error?: string;
  // Any additional JSON fields from agent
  [key: string]: any;
}

/**
 * Single source of truth for task status management
 * Handles both ephemeral and persistent tasks based on agent card taskType
 */
@Injectable()
export class TaskStatusService {
  private readonly logger = new Logger(TaskStatusService.name);
  
  // Hot cache for all active tasks (both ephemeral and persistent)
  private activeTaskStatuses = new Map<string, TaskStatus>();
  
  // Cleanup timers for completed tasks
  private cleanupTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly tasksService: TasksService,
  ) {
    this.logger.debug('TaskStatusService initialized');
  }

  /**
   * Create a new task with initial status
   */
  async createTask(
    taskId: string,
    userId: string,
    taskType: 'ephemeral' | 'long_running' | 'swarm' = 'ephemeral',
    initialData: Partial<TaskStatus> = {}
  ): Promise<void> {
    const taskStatus: TaskStatus = {
      taskId,
      userId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      taskType, // Store taskType for persistence decisions
      ...initialData,
    };

    // Store in hot cache
    this.activeTaskStatuses.set(taskId, taskStatus);

    // Persist to database for long-running and swarm tasks
    if (taskType === 'long_running' || taskType === 'swarm') {
      try {
        await this.tasksService.updateTask(taskId, userId, {
          status: taskStatus.status,
          progress: taskStatus.progress,
          progressMessage: taskStatus.progressMessage,
        });
        this.logger.debug(`Task ${taskId} persisted to database (${taskType})`);
      } catch (error) {
        this.logger.warn(`Failed to persist task ${taskId}:`, error);
      }
    }

    this.logger.debug(`Task ${taskId} created with type: ${taskType}`);
    this.emitStatusChange(taskId, taskStatus);
  }

  /**
   * Update task status with flexible JSON data
   * This is the ONLY method that should update task status
   */
  async updateTaskStatus(
    taskId: string,
    userId: string,
    update: TaskStatusUpdate
  ): Promise<void> {
    const currentStatus = this.activeTaskStatuses.get(taskId);
    if (!currentStatus) {
      this.logger.warn(`Task ${taskId} not found in active tasks`);
      return;
    }

    // Verify user ownership
    if (currentStatus.userId !== userId) {
      this.logger.warn(`User ${userId} attempted to update task ${taskId} owned by ${currentStatus.userId}`);
      return;
    }

    // Merge the update with current status
    const newStatus: TaskStatus = {
      ...currentStatus,
      ...update,
      updatedAt: new Date(),
    };

    // Update hot cache
    this.activeTaskStatuses.set(taskId, newStatus);

    // Persist to database for non-ephemeral tasks
    if (currentStatus.taskType === 'long_running' || currentStatus.taskType === 'swarm') {
      try {
        await this.tasksService.updateTask(taskId, userId, {
          status: newStatus.status,
          progress: newStatus.progress,
          progressMessage: newStatus.progressMessage,
          response: newStatus.result ? JSON.stringify(newStatus.result) : undefined,
          errorMessage: newStatus.error,
        });
      } catch (error) {
        this.logger.warn(`Failed to persist task ${taskId} update:`, error);
      }
    }

    this.logger.debug(`Task ${taskId} status updated:`, {
      status: newStatus.status,
      progress: newStatus.progress,
      message: newStatus.progressMessage,
    });

    // Emit status change event
    this.emitStatusChange(taskId, newStatus);

    // Handle task completion
    if (newStatus.status === 'completed' || newStatus.status === 'failed' || newStatus.status === 'cancelled') {
      this.handleTaskCompletion(taskId, newStatus);
    }
  }

  /**
   * Get current task status (for polling)
   * Only returns status if user owns the task
   */
  getTaskStatus(taskId: string, userId: string): TaskStatus | null {
    const status = this.activeTaskStatuses.get(taskId);
    if (!status || status.userId !== userId) {
      return null;
    }
    return { ...status }; // Return copy to prevent mutations
  }

  /**
   * Get all active tasks for a user (for dashboard)
   */
  getUserActiveTasks(userId: string): TaskStatus[] {
    const userTasks: TaskStatus[] = [];
    for (const status of this.activeTaskStatuses.values()) {
      if (status.userId === userId && status.status !== 'completed' && status.status !== 'failed' && status.status !== 'cancelled') {
        userTasks.push({ ...status });
      }
    }
    return userTasks;
  }

  /**
   * Mark task as completed (single authority)
   */
  async completeTask(taskId: string, userId: string, result: any): Promise<void> {
    await this.updateTaskStatus(taskId, userId, {
      status: 'completed',
      progress: 100,
      result,
    });
  }

  /**
   * Mark task as failed (single authority)
   */
  async failTask(taskId: string, userId: string, error: string): Promise<void> {
    await this.updateTaskStatus(taskId, userId, {
      status: 'failed',
      error,
    });
  }

  /**
   * Update task progress (convenience method)
   */
  async updateProgress(taskId: string, userId: string, progress: number, message?: string): Promise<void> {
    await this.updateTaskStatus(taskId, userId, {
      status: 'running',
      progress,
      progressMessage: message,
    });
  }

  /**
   * Handle task completion and cleanup
   */
  private handleTaskCompletion(taskId: string, taskStatus: TaskStatus): void {
    // Clear any existing cleanup timer
    const existingTimer = this.cleanupTimers.get(taskId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set cleanup based on task type
    let cleanupDelayMs: number;
    
    switch (taskStatus.taskType) {
      case 'ephemeral':
        cleanupDelayMs = 60 * 1000; // 1 minute
        break;
      case 'long_running':
        cleanupDelayMs = 15 * 60 * 1000; // 15 minutes
        break;
      case 'swarm':
        cleanupDelayMs = 60 * 60 * 1000; // 1 hour
        break;
      default:
        cleanupDelayMs = 60 * 1000; // Default 1 minute
    }

    // Schedule cleanup
    const cleanupTimer = setTimeout(() => {
      this.cleanupTask(taskId);
    }, cleanupDelayMs);

    this.cleanupTimers.set(taskId, cleanupTimer);
    
    this.logger.debug(`Task ${taskId} scheduled for cleanup in ${cleanupDelayMs / 1000} seconds`);
  }

  /**
   * Remove task from active cache
   */
  private cleanupTask(taskId: string): void {
    this.activeTaskStatuses.delete(taskId);
    this.cleanupTimers.delete(taskId);
    this.logger.debug(`Task ${taskId} cleaned up from active cache`);
  }

  /**
   * Emit status change events for WebSocket broadcasting
   */
  private emitStatusChange(taskId: string, taskStatus: TaskStatus): void {
    // Emit generic task status change
    this.eventEmitter.emit('task.status_changed', {
      taskId,
      userId: taskStatus.userId,
      status: taskStatus.status,
      progress: taskStatus.progress,
      message: taskStatus.progressMessage,
      data: taskStatus,
    });

    // Emit specific lifecycle events
    switch (taskStatus.status) {
      case 'running':
        this.eventEmitter.emit('task.started', { taskId, userId: taskStatus.userId });
        break;
      case 'completed':
        this.eventEmitter.emit('task.completed', { taskId, userId: taskStatus.userId, result: taskStatus.result });
        break;
      case 'failed':
        this.eventEmitter.emit('task.failed', { taskId, userId: taskStatus.userId, error: taskStatus.error });
        break;
      case 'cancelled':
        this.eventEmitter.emit('task.cancelled', { taskId, userId: taskStatus.userId });
        break;
    }
  }

  /**
   * Get service statistics
   */
  getStats(): { activeTaskCount: number; userTaskCounts: Record<string, number> } {
    const userTaskCounts: Record<string, number> = {};
    
    for (const status of this.activeTaskStatuses.values()) {
      userTaskCounts[status.userId] = (userTaskCounts[status.userId] || 0) + 1;
    }

    return {
      activeTaskCount: this.activeTaskStatuses.size,
      userTaskCounts,
    };
  }
}