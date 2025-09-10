import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  TaskLifecycleService,
  TaskStatus,
} from '../agents/base/sub-services/task-lifecycle/task-lifecycle.service';
import { AgentConversationsService } from '../agent-conversations/agent-conversations.service';
import {
  Task,
  CreateTaskDto,
  UpdateTaskDto,
  TaskQueryParams,
  TaskProgressEvent,
  AgentType,
} from '../common/types/agent-conversations.types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { snakeToCamel } from '../utils/case-converter';
import { TaskMessageService } from './task-message.service';
import { TaskStatusService } from './task-status.service';
import {
  MessageEmitter,
  TaskMessageEmitter,
} from './message-emitter.interface';
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly taskLifecycleService: TaskLifecycleService,
    private readonly agentConversationsService: AgentConversationsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly taskMessageService: TaskMessageService,
    @Inject(forwardRef(() => TaskStatusService))
    private readonly taskStatusService: TaskStatusService,
  ) {}

  /**
   * Generate a unique task ID using UUID v4
   */
  private generateTaskId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Create a new task with database persistence
   * Supports lazy conversation creation - if no conversationId provided, creates one
   */
  async createTask(
    userId: string,
    agentName: string,
    agentType: AgentType,
    dto: CreateTaskDto,
  ): Promise<Task> {
    try {
      // Handle conversation - always ensure it exists
      let conversationId: string | null = dto.conversationId || null;

      // Always validate/create conversation to avoid foreign key violations
      const conversation =
        await this.agentConversationsService.getOrCreateConversation(
          userId,
          agentName,
          agentType,
          conversationId, // Pass existing ID for validation/reuse
        );
      conversationId = conversation.id;

      // Prepare task data with proper ID handling
      const taskData: any = {
        agent_conversation_id: conversationId,
        user_id: userId,
        method: dto.method,
        prompt: dto.prompt,
        params: dto.params || {},
        status: 'pending',
        progress: 0,
        timeout_seconds: dto.timeoutSeconds || 300,
        metadata: dto.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Use provided task ID if available, otherwise generate new one
      if (dto.taskId) {
        taskData.id = dto.taskId;
      } else {
        taskData.id = this.generateTaskId();
      }

      // Store LLM selection metadata if provided
      if (dto.llmSelection) {
        taskData.llm_metadata = {
          originalLLMSelection: dto.llmSelection,
          createdAt: new Date().toISOString(),
        };
      }

      let finalTaskData = taskData;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const { data, error } = await this.supabaseService
            .getAnonClient()
            .from('tasks')
            .insert(finalTaskData)
            .select()
            .single();

          if (error) {
            // If it's a duplicate key error and we have attempts left, generate new ID
            if (error.code === '23505' && attempts < maxAttempts - 1) {

              finalTaskData = {
                ...taskData,
                id: this.generateTaskId(), // Generate new unique ID
              };
              attempts++;
              continue;
            }

            throw new Error(`Failed to create task: ${error.message}`);
          }

          // Success - continue with task setup
          const createdTask = data;

          // Create task in lifecycle service for execution tracking
          await this.taskLifecycleService.createTask({
            method: dto.method,
            params: { ...dto.params, taskId: createdTask.id },
            timeout: (dto.timeoutSeconds || 300) * 1000, // Convert to milliseconds
          });

          // Register task with TaskStatusService for live tracking
          await this.taskStatusService.createTask(
            createdTask.id,
            userId,
            `${agentType}/${agentName}`, // Use the constructed task type for status service
            {
              status: 'pending',
              progress: 0,
              progressMessage: 'Task created, waiting for execution...',
            },
          );

          // Emit task created event
          this.eventEmitter.emit('task.created', {
            taskId: createdTask.id,
            conversationId,
            userId,
            agentName,
          });

          return this.mapToTask(createdTask);
        } catch (error) {
          if (attempts >= maxAttempts - 1) {
            throw error;
          }
          attempts++;
        }
      }

      throw new Error(`Failed to create task after ${maxAttempts} attempts`);
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get task by ID
   */
  async getTaskById(taskId: string, userId: string): Promise<Task | null> {
    try {
      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('tasks')
        .select()
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {

        throw new Error(`Failed to fetch task: ${error.message}`);
      }

      const result = data ? this.mapToTask(data) : null;

      if (result) {

        if (result.response) {

        }
      }

      return result;
    } catch (error) {

      throw error;
    }
  }

  /**
   * List tasks with filters
   */
  async listTasks(
    params: TaskQueryParams,
  ): Promise<{ tasks: Task[]; total: number }> {
    try {
      let query = this.supabaseService
        .getAnonClient()
        .from('tasks')
        .select('*', { count: 'exact' });

      // Apply filters
      if (params.conversationId) {
        query = query.eq('agent_conversation_id', params.conversationId);
      }
      if (params.userId) {
        query = query.eq('user_id', params.userId);
      }
      if (params.status) {
        query = query.eq('status', params.status);
      }

      // Apply pagination
      const limit = params.limit || 50;
      const offset = params.offset || 0;
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {

        throw new Error(`Failed to list tasks: ${error.message}`);
      }

      return {
        tasks: data.map((item) => this.mapToTask(item)),
        total: count || 0,
      };
    } catch (error) {

      throw error;
    }
  }

  /**
   * Update task status and progress
   */
  async updateTask(
    taskId: string,
    userId: string,
    updates: UpdateTaskDto,
  ): Promise<Task> {
    try {
      const updateData: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Handle status transitions
      if (updates.status === 'running' && !updateData.started_at) {
        updateData.started_at = new Date().toISOString();
      }
      if (
        updates.status === 'completed' ||
        updates.status === 'failed' ||
        updates.status === 'cancelled'
      ) {
        updateData.completed_at = new Date().toISOString();
      }

      // Convert camelCase to snake_case for database columns
      if (updateData.responseMetadata !== undefined) {
        updateData.response_metadata = updateData.responseMetadata;
        delete updateData.responseMetadata;
      }
      if (updateData.errorData !== undefined) {
        updateData.error_data = updateData.errorData;
        delete updateData.errorData;
      }
      if (updateData.progressMessage !== undefined) {
        updateData.progress_message = updateData.progressMessage;
        delete updateData.progressMessage;
      }
      if (updateData.errorCode !== undefined) {
        updateData.error_code = updateData.errorCode;
        delete updateData.errorCode;
      }
      if (updateData.errorMessage !== undefined) {
        updateData.error_message = updateData.errorMessage;
        delete updateData.errorMessage;
      }
      if (updateData.llmMetadata !== undefined) {
        updateData.llm_metadata = updateData.llmMetadata;
        delete updateData.llmMetadata;
      }

      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {

        throw new Error(`Failed to update task: ${error.message}`);
      }

      // Sync with TaskStatusService for live tracking
      await this.taskStatusService.updateTaskStatus(taskId, userId, {
        status: updates.status as any,
        progress: updates.progress,
        progressMessage: updates.progressMessage,
        result: updates.response
          ? typeof updates.response === 'string'
            ? updates.response
            : JSON.stringify(updates.response)
          : undefined,
        error: updates.errorMessage,
      });

      // Emit progress event
      if (updates.progress !== undefined || updates.progressMessage) {
        const progressEvent: TaskProgressEvent = {
          taskId,
          progress: updates.progress ?? data.progress,
          message: updates.progressMessage,
          status: updates.status,
        };
        this.eventEmitter.emit('task.progress', progressEvent);
      }

      // Deliverable creation is now handled via event listeners in DeliverablesService

      // Note: Completion events are now emitted by TaskStatusService.emitStatusChange()
      // to avoid duplicate emissions that cause multiple deliverable versions

      return this.mapToTask(data);
    } catch (error) {

      throw error;
    }
  }

  /**
   * Update task progress
   */
  async updateTaskProgress(
    taskId: string,
    progress: number,
    message?: string,
  ): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getAnonClient()
        .from('tasks')
        .update({
          progress,
          progress_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) {

        throw new Error(`Failed to update task progress: ${error.message}`);
      }

      // We don't know the userId in this method, so we can't sync with TaskStatusService here
      // Progress updates should go through the main updateTask method instead

      // Emit progress event
      const progressEvent: TaskProgressEvent = {
        taskId,
        progress,
        message,
      };
      this.eventEmitter.emit('task.progress', progressEvent);
    } catch (error) {

      throw error;
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string, userId: string): Promise<void> {
    try {
      await this.updateTask(taskId, userId, {
        status: 'cancelled',
      });

      // Also cancel in lifecycle service if active
      const lifecycleTask = this.taskLifecycleService.getTaskById(taskId);
      if (lifecycleTask && lifecycleTask.status === TaskStatus.RUNNING) {
        this.taskLifecycleService.cancelTask(taskId);
      }
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get active tasks for a profile
   */
  async getActiveTasks(userId: string): Promise<Task[]> {
    try {
      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('tasks')
        .select()
        .eq('user_id', userId)
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false });

      if (error) {

        throw new Error(`Failed to fetch active tasks: ${error.message}`);
      }

      return data.map((item) => this.mapToTask(item));
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get task metrics and analytics for the user
   */
  async getTaskMetrics(userId: string): Promise<any> {
    try {
      const { data: tasks, error } = await this.supabaseService
        .getAnonClient()
        .from('tasks')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Failed to fetch tasks for metrics:', error);
        throw new Error(`Failed to fetch task metrics: ${error.message}`);
      }

      // Calculate basic metrics
      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(task => task.status === 'completed').length || 0;
      const activeTasks = tasks?.filter(task => ['pending', 'running'].includes(task.status)).length || 0;
      const failedTasks = tasks?.filter(task => task.status === 'failed').length || 0;
      
      // Calculate success rate
      const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 100;

      // Calculate average completion time (for completed tasks)
      const completedTasksWithTimes = tasks?.filter(task => 
        task.status === 'completed' && task.created_at && task.updated_at
      ) || [];
      
      const averageCompletionTime = completedTasksWithTimes.length > 0
        ? completedTasksWithTimes.reduce((sum, task) => {
            const created = new Date(task.created_at).getTime();
            const updated = new Date(task.updated_at).getTime();
            return sum + (updated - created);
          }, 0) / completedTasksWithTimes.length
        : 0;

      return {
        totalTasks,
        completedTasks,
        activeTasks,
        failedTasks,
        successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
        averageCompletionTime: Math.round(averageCompletionTime), // in milliseconds
        timestamp: new Date().toISOString(),
        uptime: process.uptime() * 1000, // Convert to milliseconds
        memoryUsage: process.memoryUsage()
      };
    } catch (error) {
      this.logger.error('Error calculating task metrics:', error);
      throw error;
    }
  }

  /**
   * Stream task progress events (for SSE)
   */
  async *streamTaskProgress(taskId: string, userId: string) {
    // Verify task belongs to user
    const task = await this.getTaskById(taskId, userId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Create event listener
    const progressListener = (event: TaskProgressEvent) => {
      if (event.taskId === taskId) {
        return event;
      }
      return null;
    };

    // Subscribe to progress events
    this.eventEmitter.on('task.progress', progressListener);

    try {
      // Yield current task status
      yield {
        taskId,
        progress: task.progress,
        message: task.progressMessage,
        status: task.status,
      };

      // Keep connection alive and yield updates
      while (task.status === 'pending' || task.status === 'running') {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check for updates
        const updatedTask = await this.getTaskById(taskId, userId);
        if (updatedTask && updatedTask.status !== task.status) {
          yield {
            taskId,
            progress: updatedTask.progress,
            message: updatedTask.progressMessage,
            status: updatedTask.status,
          };

          if (
            updatedTask.status !== 'pending' &&
            updatedTask.status !== 'running'
          ) {
            break;
          }
        }
      }
    } finally {
      // Clean up listener
      this.eventEmitter.off('task.progress', progressListener);
    }
  }

  /**
   * Create a MessageEmitter for a task
   * This allows agents to emit messages during task execution
   */
  createMessageEmitter(taskId: string, userId: string): MessageEmitter {
    return new TaskMessageEmitter(taskId, userId, this.taskMessageService);
  }

  /**
   * Emit a message for a task
   * Convenience method for direct message emission
   */
  async emitTaskMessage(
    taskId: string,
    userId: string,
    content: string,
    type: 'progress' | 'status' | 'info' | 'warning' | 'error' = 'info',
    progressPercentage?: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.taskMessageService.createTaskMessage({
      taskId,
      userId,
      content,
      messageType: type,
      progressPercentage,
      metadata,
    });
  }

  /**
   * Get messages for a task
   */
  async getTaskMessages(taskId: string, userId: string): Promise<any[]> {
    const { messages } = await this.taskMessageService.getTaskMessages(
      taskId,
      userId,
    );
    return messages;
  }

  /**
   * Add deliverable ID to task response
   */
  private addDeliverableIdToResponse(response: any, deliverableId: string): string {
    try {
      let result = response;
      if (typeof response === 'string') {
        try {
          result = JSON.parse(response);
        } catch {
          result = { response };
        }
      }

      const enhancedResult = {
        ...result,
        deliverableId,
      };

      return JSON.stringify(enhancedResult);
    } catch (error) {

      return response;
    }
  }

  /**
   * Map database record to Task type
   */
  private mapToTask(data: any): Task {
    // Use the case converter to handle snake_case to camelCase conversion
    const converted = snakeToCamel(data);

    return {
      id: converted.id,
      agentConversationId: converted.agentConversationId,
      userId: converted.userId,
      method: converted.method,
      prompt: converted.prompt,
      params: converted.params || {},
      response: converted.response,
      responseMetadata: converted.responseMetadata || {},
      status: converted.status,
      progress: converted.progress,
      progressMessage: converted.progressMessage,
      evaluation: converted.evaluation || {},
      llmMetadata: converted.llmMetadata || {},
      errorCode: converted.errorCode,
      errorMessage: converted.errorMessage,
      errorData: converted.errorData,
      startedAt: converted.startedAt
        ? new Date(converted.startedAt)
        : undefined,
      completedAt: converted.completedAt
        ? new Date(converted.completedAt)
        : undefined,
      timeoutSeconds: converted.timeoutSeconds,
      metadata: converted.metadata || {},
      createdAt: new Date(converted.createdAt),
      updatedAt: new Date(converted.updatedAt),
    };
  }
}
