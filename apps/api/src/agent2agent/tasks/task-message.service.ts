import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { snakeToCamel } from '@/utils/case-converter';
import { Cron } from '@nestjs/schedule';

export interface TaskMessage {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  messageType: 'progress' | 'status' | 'info' | 'warning' | 'error';
  progressPercentage?: number;
  metadata: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
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

/**
 * Database record type for task_messages table
 */
interface TaskMessageDbRecord {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  message_type: string;
  progress_percentage?: number;
  metadata: Record<string, any>;
  created_at: string;
  expires_at: string;
}

@Injectable()
export class TaskMessageService {
  private readonly logger = new Logger(TaskMessageService.name);
  private readonly ttlMinutes = Number(
    process.env.TASK_MESSAGE_TTL_MINUTES ?? 60,
  );

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new task message
   */
  async createTaskMessage(dto: CreateTaskMessageDto): Promise<TaskMessage> {
    const expiresAt = this.computeExpiry();

    const taskMessageData = {
      task_id: dto.taskId,
      user_id: dto.userId,
      content: dto.content,
      message_type: dto.messageType,
      progress_percentage: dto.progressPercentage,
      metadata: dto.metadata || {},
      expires_at: expiresAt.toISOString(),
    };

    const { data: result, error } = await this.supabaseService
      .getAnonClient()
      .from('task_messages')
      .insert(taskMessageData)
      .select()
      .single();

    const data = result as TaskMessageDbRecord | null;

    if (error || !data) {
      throw new Error(`Failed to create task message: ${error?.message || 'No data returned'}`);
    }

    const taskMessage = this.mapToTaskMessage(data);

    // Emit task message event for real-time updates
    this.eventEmitter.emit('task.message', {
      taskId: dto.taskId,
      userId: dto.userId,
      message: taskMessage,
    });

    // Also emit progress event if this is a progress message
    if (
      dto.messageType === 'progress' &&
      dto.progressPercentage !== undefined
    ) {
      this.eventEmitter.emit('task.progress', {
        taskId: dto.taskId,
        progress: dto.progressPercentage,
        message: dto.content,
      });
    }

    return taskMessage;
  }

  @Cron('0 */15 * * * *')
  async cleanupExpiredMessages(): Promise<void> {
    try {
      const cutoff = new Date().toISOString();
      const { error, count } = await this.supabaseService
        .getServiceClient()
        .from('task_messages')
        .delete({ count: 'exact' })
        .lte('expires_at', cutoff);

      if (error) {
        throw error;
      }

      if ((count ?? 0) > 0) {
        this.logger.log(`Pruned ${count} expired task_messages records`);
      }
    } catch (error) {
      this.logger.error('Failed to prune expired task messages', error);
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

      const { data: result, error, count } = await query;

      const data = result as TaskMessageDbRecord[] | null;

      if (error) {
        throw new Error(`Failed to fetch task messages: ${error.message}`);
      }

      return {
        messages: (data || []).map((item) => this.mapToTaskMessage(item)),
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get task messages', error);
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

      const { data: result, error, count } = await query;

      const data = result as TaskMessageDbRecord[] | null;

      if (error) {
        throw new Error(`Failed to fetch recent messages: ${error.message}`);
      }

      return {
        messages: (data || []).map((item) => this.mapToTaskMessage(item)),
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get recent messages', error);
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
        throw new Error(`Failed to delete task messages: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to delete task messages', error);
      throw error;
    }
  }

  /**
   * Get message statistics for a task
   */
  async getTaskMessageStats(
    taskId: string,
    userId: string,
  ): Promise<{
    total: number;
    byType: Record<string, number>;
    progressMessages: number;
    errorMessages: number;
    lastMessage?: TaskMessage;
  }> {
    try {
      const { data: result, error } = await this.supabaseService
        .getAnonClient()
        .from('task_messages')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const data = result as TaskMessageDbRecord[] | null;

      if (error) {
        throw new Error(`Failed to fetch task message stats: ${error.message}`);
      }

      const messages = (data || []).map((item) => this.mapToTaskMessage(item));
      const byType: Record<string, number> = {};
      let progressMessages = 0;
      let errorMessages = 0;

      messages.forEach((message) => {
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
      this.logger.error('Failed to get task message stats', error);
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
    const messageListener = (event: { taskId: string; userId: string; message: string }) => {
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
        const { messages: newMessages } = await this.getTaskMessages(
          taskId,
          userId,
          {
            limit: 10, // Just check for recent messages
          },
        );

        const unseenMessages = lastMessageTime
          ? newMessages.filter((msg) => msg.createdAt > lastMessageTime!)
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
    const converted = snakeToCamel(data) as Record<string, unknown>;

    return {
      id: converted.id as string,
      taskId: converted.taskId as string,
      userId: converted.userId as string,
      content: converted.content as string,
      messageType: converted.messageType as TaskMessage['messageType'],
      progressPercentage: converted.progressPercentage as number | undefined,
      metadata: (converted.metadata as Record<string, unknown>) || {},
      createdAt: new Date(converted.createdAt as string),
      expiresAt: converted.expiresAt
        ? new Date(converted.expiresAt as string)
        : this.computeExpiry(),
    };
  }

  private computeExpiry(): Date {
    const now = Date.now();
    const ttlMs = Math.max(this.ttlMinutes, 1) * 60 * 1000;
    return new Date(now + ttlMs);
  }
}
