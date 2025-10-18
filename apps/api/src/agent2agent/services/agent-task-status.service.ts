import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { getTableName } from '../../supabase/supabase.config';

/**
 * Agent2Agent-specific Task Status Service
 * Handles task status updates for A2A Google protocol agents
 * Isolated from legacy file-based agent system
 */
@Injectable()
export class Agent2AgentTaskStatusService {
  private readonly logger = new Logger(Agent2AgentTaskStatusService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Update task status
   * A2A protocol: status updates during task execution
   */
  async updateTaskStatus(
    taskId: string,
    userId: string,
    updates: {
      status?: string;
      progress?: number;
      progressMessage?: string;
      metadata?: Record<string, unknown>;
      [key: string]: unknown;
    },
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status) {
        updateData.status = updates.status;
      }

      // Store custom fields in params.status_data for A2A protocol
      if (
        updates.progress !== undefined ||
        updates.progressMessage ||
        updates.metadata
      ) {
        // Fetch current params to merge status data
        const { data: currentTask } = await this.supabaseService
          .getServiceClient()
          .from(getTableName('tasks'))
          .select('params')
          .eq('id', taskId)
          .eq('user_id', userId)
          .single();

        const currentParams = currentTask?.params || {};
        const currentStatusData = currentParams.status_data || {};

        updateData.params = {
          ...currentParams,
          status_data: {
            ...currentStatusData,
            ...(updates.progress !== undefined && {
              progress: updates.progress,
            }),
            ...(updates.progressMessage && {
              progressMessage: updates.progressMessage,
            }),
            ...(updates.metadata && { metadata: updates.metadata }),
            protocol: 'a2a-google',
            lastUpdate: new Date().toISOString(),
          },
        };
      }

      const { error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('tasks'))
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to update task status: ${error.message}`);
      }

      this.logger.debug(
        `✅ Updated A2A task ${taskId} status: ${updates.status || 'progress update'}`,
      );
    } catch (error) {
      this.logger.error(`Failed to update A2A task ${taskId} status:`, error);
      throw error;
    }
  }

  /**
   * Complete a task
   * A2A protocol: task completion with response payload
   */
  async completeTask(
    taskId: string,
    userId: string,
    response: unknown,
  ): Promise<void> {
    try {
      const updateData = {
        status: 'completed',
        response: response,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('tasks'))
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to complete task: ${error.message}`);
      }

      this.logger.log(`✅ A2A task ${taskId} completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to complete A2A task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Fail a task
   * A2A protocol: task failure with error details
   */
  async failTask(
    taskId: string,
    userId: string,
    errorMessage: string,
    errorDetails?: unknown,
  ): Promise<void> {
    try {
      const updateData = {
        status: 'failed',
        error: errorMessage,
        response: errorDetails
          ? { error: errorMessage, details: errorDetails }
          : { error: errorMessage },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('tasks'))
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to mark task as failed: ${error.message}`);
      }

      this.logger.warn(`❌ A2A task ${taskId} failed: ${errorMessage}`);
    } catch (error) {
      this.logger.error(`Failed to fail A2A task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get task status
   * A2A protocol: status queries
   */
  async getTaskStatus(
    taskId: string,
    userId: string,
  ): Promise<{
    status: string;
    progress?: number;
    progressMessage?: string;
    response?: unknown;
    error?: string;
    metadata?: Record<string, unknown>;
  } | null> {
    try {
      const { data: task, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('tasks'))
        .select('status, response, error, params')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (error || !task) {
        return null;
      }

      const statusData = task.params?.status_data || {};

      return {
        status: task.status,
        progress: statusData.progress,
        progressMessage: statusData.progressMessage,
        response: task.response,
        error: task.error,
        metadata: statusData.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to get A2A task ${taskId} status:`, error);
      return null;
    }
  }
}
