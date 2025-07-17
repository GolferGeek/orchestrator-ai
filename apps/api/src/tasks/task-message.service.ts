import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { snakeToCamel } from '../utils/case-converter';

export interface TaskMessage {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  messageType: 'progress' | 'status' | 'info' | 'warning' | 'error';
  progressPercentage?: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface CreateTaskMessageDto {
  taskId: string;
  userId: string;
  content: string;
  messageType: 'progress' | 'status' | 'info' | 'warning' | 'error';
  progressPercentage?: number;
  metadata?: Record<string, any>;
}

export interface TaskMessageQueryParams {
  taskId?: string;
  userId?: string;
  messageType?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class TaskMessageService {
  private readonly logger = new Logger(TaskMessageService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new task message
   */
  async createTaskMessage(dto: CreateTaskMessageDto): Promise<TaskMessage> {
    try {
      const taskMessageData = {
        task_id: dto.taskId,
        user_id: dto.userId,
        content: dto.content,
        message_type: dto.messageType,
        progress_percentage: dto.progressPercentage,
        metadata: dto.metadata || {},
      };

      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('task_messages')
        .insert(taskMessageData)
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating task message:', error);
        throw new Error(`Failed to create task message: ${error.message}`);
      }

      const taskMessage = this.mapToTaskMessage(data);

      // Emit task message event for real-time updates
      this.eventEmitter.emit('task.message', {
        taskId: dto.taskId,
        userId: dto.userId,
        message: taskMessage,
      });

      // Also emit progress event if this is a progress message
      if (dto.messageType === 'progress' && dto.progressPercentage !== undefined) {
        this.eventEmitter.emit('task.progress', {
          taskId: dto.taskId,
          progress: dto.progressPercentage,
          message: dto.content,
        });
      }

      return taskMessage;
    } catch (error) {
      this.logger.error('Error in createTaskMessage:', error);
      throw error;
    }
  }

  /**
   * Get messages for a specific task
   */
  async getTaskMessages(
    taskId: string,
    userId: string,
    params: TaskMessageQueryParams = {},
  ): Promise<{ messages: TaskMessage[]; total: number }> {
    try {
      let query = this.supabaseService
        .getAnonClient()
        .from('task_messages')
        .select('*', { count: 'exact' })
        .eq('task_id', taskId)
        .eq('user_id', userId);

      // Apply additional filters
      if (params.messageType) {
        query = query.eq('message_type', params.messageType);
      }

      // Apply pagination
      const limit = params.limit || 100;
      const offset = params.offset || 0;
      query = query
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Error fetching task messages:', error);
        throw new Error(`Failed to fetch task messages: ${error.message}`);
      }

      return {
        messages: data.map(item => this.mapToTaskMessage(item)),
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Error in getTaskMessages:', error);
      throw error;
    }
  }

  /**
   * Get recent messages across all tasks for a user
   */
  async getRecentMessages(
    userId: string,
    params: TaskMessageQueryParams = {},
  ): Promise<{ messages: TaskMessage[]; total: number }> {
    try {
      let query = this.supabaseService
        .getAnonClient()
        .from('task_messages')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply filters
      if (params.messageType) {
        query = query.eq('message_type', params.messageType);
      }

      // Apply pagination
      const limit = params.limit || 50;
      const offset = params.offset || 0;
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Error fetching recent messages:', error);
        throw new Error(`Failed to fetch recent messages: ${error.message}`);
      }

      return {
        messages: data.map(item => this.mapToTaskMessage(item)),
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Error in getRecentMessages:', error);
      throw error;
    }
  }

  /**
   * Delete messages for a specific task (cleanup)
   */
  async deleteTaskMessages(taskId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getAnonClient()
        .from('task_messages')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Error deleting task messages:', error);
        throw new Error(`Failed to delete task messages: ${error.message}`);
      }

      this.logger.debug(`Deleted messages for task ${taskId}`);
    } catch (error) {
      this.logger.error('Error in deleteTaskMessages:', error);
      throw error;
    }
  }

  /**
   * Get message statistics for a task
   */
  async getTaskMessageStats(taskId: string, userId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    progressMessages: number;
    errorMessages: number;
    lastMessage?: TaskMessage;
  }> {
    try {
      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('task_messages')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Error fetching task message stats:', error);
        throw new Error(`Failed to fetch task message stats: ${error.message}`);
      }

      const messages = data.map(item => this.mapToTaskMessage(item));
      const byType: Record<string, number> = {};
      let progressMessages = 0;
      let errorMessages = 0;

      messages.forEach(message => {
        byType[message.messageType] = (byType[message.messageType] || 0) + 1;
        if (message.messageType === 'progress') progressMessages++;
        if (message.messageType === 'error') errorMessages++;
      });

      return {
        total: messages.length,
        byType,
        progressMessages,
        errorMessages,
        lastMessage: messages[0], // Most recent message
      };
    } catch (error) {
      this.logger.error('Error in getTaskMessageStats:', error);
      throw error;
    }
  }

  /**
   * Stream task messages for real-time updates
   */
  async *streamTaskMessages(taskId: string, userId: string) {
    // Verify task access (could add task verification here)
    
    let lastMessageTime: Date | null = null;

    // Create event listener for new messages
    const messageListener = (event: any) => {
      if (event.taskId === taskId && event.userId === userId) {
        return event.message;
      }
      return null;
    };

    // Subscribe to message events
    this.eventEmitter.on('task.message', messageListener);

    try {
      // Yield existing messages first
      const { messages } = await this.getTaskMessages(taskId, userId);
      for (const message of messages) {
        yield message;
        lastMessageTime = message.createdAt;
      }

      // Keep connection alive and yield new messages
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Check for new messages since last known message
        const { messages: newMessages } = await this.getTaskMessages(taskId, userId, {
          limit: 10, // Just check for recent messages
        });

        const unseenMessages = lastMessageTime 
          ? newMessages.filter(msg => msg.createdAt > lastMessageTime!)
          : newMessages;

        for (const message of unseenMessages) {
          yield message;
          lastMessageTime = message.createdAt;
        }
      }
    } finally {
      // Clean up listener
      this.eventEmitter.off('task.message', messageListener);
    }
  }

  /**
   * Map database record to TaskMessage type
   */
  private mapToTaskMessage(data: any): TaskMessage {
    const converted = snakeToCamel(data);
    
    return {
      id: converted.id,
      taskId: converted.taskId,
      userId: converted.userId,
      content: converted.content,
      messageType: converted.messageType,
      progressPercentage: converted.progressPercentage,
      metadata: converted.metadata || {},
      createdAt: new Date(converted.createdAt),
    };
  }
}