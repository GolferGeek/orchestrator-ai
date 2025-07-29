import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';

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

  // Live message cache for active tasks (for polling clients)
  private activeTaskMessages = new Map<
    string,
    Array<{
      id: string;
      taskId: string;
      content: string;
      messageType: 'progress' | 'status' | 'info' | 'warning' | 'error';
      progressPercentage?: number;
      metadata?: Record<string, any>;
      createdAt: string;
    }>
  >();

  // Cleanup timers for completed tasks
  private cleanupTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly supabaseService: SupabaseService,
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
    initialData: Partial<TaskStatus> = {},
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

    // Persist to database for all task types (including ephemeral for evaluations)
    if (taskType === 'long_running' || taskType === 'swarm' || taskType === 'ephemeral') {
      try {
        const { error } = await this.supabaseService
          .getAnonClient()
          .from('tasks')
          .update({
            status: taskStatus.status,
            progress: taskStatus.progress,
            progress_message: taskStatus.progressMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          this.logger.warn(
            `Failed to persist task ${taskId} to database:`,
            error,
          );
        } else {
          this.logger.debug(
            `Task ${taskId} persisted to database (${taskType})`,
          );
        }
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
    update: TaskStatusUpdate,
  ): Promise<void> {
    const currentStatus = this.activeTaskStatuses.get(taskId);
    if (!currentStatus) {
      this.logger.warn(`Task ${taskId} not found in active tasks`);
      return;
    }

    // Verify user ownership
    if (currentStatus.userId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to update task ${taskId} owned by ${currentStatus.userId}`,
      );
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

    // Persist to database for all task types (including ephemeral for evaluations)
    if (
      currentStatus.taskType === 'long_running' ||
      currentStatus.taskType === 'swarm' ||
      currentStatus.taskType === 'ephemeral'
    ) {
      try {
        const updateData: any = {
          status: newStatus.status,
          progress: newStatus.progress,
          progress_message: newStatus.progressMessage,
          updated_at: new Date().toISOString(),
        };

        if (newStatus.result) {
          updateData.response =
            typeof newStatus.result === 'string'
              ? newStatus.result
              : JSON.stringify(newStatus.result);
        }

        if (newStatus.error) {
          updateData.error_message = newStatus.error;
        }

        const { error } = await this.supabaseService
          .getAnonClient()
          .from('tasks')
          .update(updateData)
          .eq('id', taskId)
          .eq('user_id', userId);

        if (error) {
          this.logger.warn(`Failed to persist task ${taskId} update:`, error);
        }
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
    if (
      newStatus.status === 'completed' ||
      newStatus.status === 'failed' ||
      newStatus.status === 'cancelled'
    ) {
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
   * Add a progress message to the live cache (for polling clients)
   */
  addTaskMessage(
    taskId: string,
    messageContent: string,
    messageType:
      | 'progress'
      | 'status'
      | 'info'
      | 'warning'
      | 'error' = 'progress',
    metadata?: Record<string, any>,
  ): void {
    if (!this.activeTaskMessages.has(taskId)) {
      this.activeTaskMessages.set(taskId, []);
    }

    const messages = this.activeTaskMessages.get(taskId)!;
    const newMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      content: messageContent,
      messageType,
      progressPercentage: metadata?.progress,
      metadata,
      createdAt: new Date().toISOString(),
    };

    messages.push(newMessage);
    this.logger.debug(
      `Added message to task ${taskId}: ${messageContent} (total: ${messages.length})`,
    );
  }

  /**
   * Get accumulated messages for a task (live cache first, for polling)
   */
  getTaskMessages(
    taskId: string,
    userId: string,
  ): Array<{
    id: string;
    taskId: string;
    content: string;
    messageType: 'progress' | 'status' | 'info' | 'warning' | 'error';
    progressPercentage?: number;
    metadata?: Record<string, any>;
    createdAt: string;
  }> {
    // Check if user owns this task
    const taskStatus = this.getTaskStatus(taskId, userId);
    if (!taskStatus) {
      this.logger.debug(
        `Task ${taskId} not found or user ${userId} doesn't own it`,
      );
      return [];
    }

    // Return live messages from cache
    const messages = this.activeTaskMessages.get(taskId) || [];
    this.logger.debug(
      `Retrieved ${messages.length} live messages for task ${taskId}`,
    );
    return [...messages]; // Return copy to prevent mutations
  }

  /**
   * Get all active tasks for a user (for dashboard)
   */
  getUserActiveTasks(userId: string): TaskStatus[] {
    const userTasks: TaskStatus[] = [];
    for (const status of this.activeTaskStatuses.values()) {
      if (
        status.userId === userId &&
        status.status !== 'completed' &&
        status.status !== 'failed' &&
        status.status !== 'cancelled'
      ) {
        userTasks.push({ ...status });
      }
    }
    return userTasks;
  }

  /**
   * Mark task as completed (single authority)
   */
  async completeTask(
    taskId: string,
    userId: string,
    result: any,
  ): Promise<void> {
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
  async updateProgress(
    taskId: string,
    userId: string,
    progress: number,
    message?: string,
  ): Promise<void> {
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

    this.logger.debug(
      `Task ${taskId} scheduled for cleanup in ${cleanupDelayMs / 1000} seconds`,
    );
  }

  /**
   * Remove task from active cache
   */
  private cleanupTask(taskId: string): void {
    this.activeTaskStatuses.delete(taskId);
    this.activeTaskMessages.delete(taskId); // Clean up live messages too
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
        this.eventEmitter.emit('task.started', {
          taskId,
          userId: taskStatus.userId,
        });
        break;
      case 'completed':
        this.eventEmitter.emit('task.completed', {
          taskId,
          userId: taskStatus.userId,
          result: taskStatus.result,
        });
        break;
      case 'failed':
        this.eventEmitter.emit('task.failed', {
          taskId,
          userId: taskStatus.userId,
          error: taskStatus.error,
        });
        break;
      case 'cancelled':
        this.eventEmitter.emit('task.cancelled', {
          taskId,
          userId: taskStatus.userId,
        });
        break;
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeTaskCount: number;
    userTaskCounts: Record<string, number>;
  } {
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
