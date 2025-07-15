import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TaskLifecycleService, TaskStatus } from '../agents/base/sub-services/task-lifecycle/task-lifecycle.service';
import { AgentConversationsService } from '../agent-conversations/agent-conversations.service';
import {
  Task,
  CreateTaskDto,
  UpdateTaskDto,
  TaskQueryParams,
  TaskProgressEvent,
} from '../common/types/agent-conversations.types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { snakeToCamel } from '../utils/case-converter';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly taskLifecycleService: TaskLifecycleService,
    private readonly agentConversationsService: AgentConversationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new task with database persistence
   * Supports lazy conversation creation - if no conversationId provided, creates one
   */
  async createTask(
    userId: string,
    agentName: string,
    agentType: 'specialist' | 'orchestrator' | 'external' | 'api',
    dto: CreateTaskDto,
  ): Promise<Task> {
    try {
      // Handle conversation - create only if needed
      let conversationId: string | null = dto.conversationId || null;
      
      // Only create conversation if this is the first task (no conversationId provided)
      if (!conversationId) {
        const conversation = await this.agentConversationsService.getOrCreateConversation(
          userId,
          agentName,
          agentType,
        );
        conversationId = conversation.id;
        this.logger.debug(`Created new conversation ${conversationId} for first task`);
      }

      // Create task in database
      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('tasks')
        .insert({
          agent_conversation_id: conversationId,
          user_id: userId,
          method: dto.method,
          prompt: dto.prompt,
          params: dto.params || {},
          timeout_seconds: dto.timeoutSeconds || 300,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating task in database:', error);
        throw new Error(`Failed to create task: ${error.message}`);
      }

      // Create task in lifecycle service for execution tracking
      await this.taskLifecycleService.createTask({
        method: dto.method,
        params: { ...dto.params, taskId: data.id },
        timeout: (dto.timeoutSeconds || 300) * 1000, // Convert to milliseconds
      });

      // Emit task created event
      this.eventEmitter.emit('task.created', {
        taskId: data.id,
        conversationId,
        userId,
        agentName,
      });

      return this.mapToTask(data);
    } catch (error) {
      this.logger.error('Error in createTask:', error);
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
        this.logger.error('Error fetching task:', error);
        throw new Error(`Failed to fetch task: ${error.message}`);
      }

      return data ? this.mapToTask(data) : null;
    } catch (error) {
      this.logger.error('Error in getTaskById:', error);
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
        this.logger.error('Error listing tasks:', error);
        throw new Error(`Failed to list tasks: ${error.message}`);
      }

      return {
        tasks: data.map(item => this.mapToTask(item)),
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Error in listTasks:', error);
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
        this.logger.error('Error updating task:', error);
        throw new Error(`Failed to update task: ${error.message}`);
      }

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

      // Emit completion event
      if (
        updates.status === 'completed' ||
        updates.status === 'failed' ||
        updates.status === 'cancelled'
      ) {
        this.eventEmitter.emit(`task.${updates.status}`, {
          taskId,
          userId,
        });
      }

      return this.mapToTask(data);
    } catch (error) {
      this.logger.error('Error in updateTask:', error);
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
        this.logger.error('Error updating task progress:', error);
        throw new Error(`Failed to update task progress: ${error.message}`);
      }

      // Emit progress event
      const progressEvent: TaskProgressEvent = {
        taskId,
        progress,
        message,
      };
      this.eventEmitter.emit('task.progress', progressEvent);
    } catch (error) {
      this.logger.error('Error in updateTaskProgress:', error);
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
      this.logger.error('Error in cancelTask:', error);
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
        this.logger.error('Error fetching active tasks:', error);
        throw new Error(`Failed to fetch active tasks: ${error.message}`);
      }

      return data.map(item => this.mapToTask(item));
    } catch (error) {
      this.logger.error('Error in getActiveTasks:', error);
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
          
          if (updatedTask.status !== 'pending' && updatedTask.status !== 'running') {
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
      startedAt: converted.startedAt ? new Date(converted.startedAt) : undefined,
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