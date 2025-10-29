import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { getTableName } from '../../supabase/supabase.config';

/**
 * Database record type for tasks table
 */
interface TaskDbRecord {
  id: string;
  user_id: string;
  conversation_id: string;
  status: string;
  params: Record<string, unknown>;
  response: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  [key: string]: unknown;
}

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

        // Set started_at timestamp when task execution begins
        if (updates.status === 'running' || updates.status === 'processing') {
          updateData.started_at = new Date().toISOString();
        }

        // Set completed_at timestamp when task finishes
        if (updates.status === 'completed' || updates.status === 'failed') {
          updateData.completed_at = new Date().toISOString();
        }
      }

      // Handle deliverable-related fields
      if (updates.deliverableType) {
        updateData.deliverable_type = updates.deliverableType;
      }

      // Handle response field (for storing task results)
      if (updates.response !== undefined) {
        updateData.response = updates.response;
      }

      // Handle response_metadata field (for LLM response metadata)
      if (updates.responseMetadata) {
        updateData.response_metadata = updates.responseMetadata;
      }

      // Store custom fields in params.status_data for A2A protocol
      if (
        updates.progress !== undefined ||
        updates.progressMessage ||
        updates.metadata
      ) {
        // Fetch current params to merge status data
        const { data } = await this.supabaseService
          .getServiceClient()
          .from(getTableName('tasks'))
          .select('params')
          .eq('id', taskId)
          .eq('user_id', userId)
          .single();

        const currentTask = data as Pick<TaskDbRecord, 'params'> | null;
        const currentParams =
          (currentTask?.params as Record<string, unknown> & {
            status_data?: Record<string, unknown>;
          }) || {};
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
      // Extract metadata from response - could be TaskResponseDto or plain object
      const responseObj = response as {
        metadata?: Record<string, unknown>;
        payload?: {
          type?: string;
          metadata?: Record<string, unknown>;
          content?: {
            deliverable?: { type?: string };
          };
        };
      };

      // Try multiple paths to extract metadata
      // 1. Top-level metadata (from TaskResponseDto)
      // 2. payload.metadata (nested in payload)
      const responseMetadata =
        responseObj?.metadata || responseObj?.payload?.metadata;

      // Try to extract deliverable type from multiple locations
      const deliverableType =
        responseObj?.payload?.type ||
        responseObj?.payload?.content?.deliverable?.type;

      this.logger.debug(
        `🔍 [completeTask] Response structure - hasTopMetadata: ${!!responseObj?.metadata}, hasPayloadMetadata: ${!!responseObj?.payload?.metadata}, hasPayload: ${!!responseObj?.payload}`,
      );
      this.logger.debug(
        `🔍 [completeTask] Extracted metadata - hasMetadata: ${!!responseMetadata}, metadataKeys: ${responseMetadata ? Object.keys(responseMetadata).join(',') : 'none'}, deliverableType: ${deliverableType}`,
      );

      const updateData: Record<string, unknown> = {
        status: 'completed',
        response: response,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Store response metadata (LLM provider, model, usage, etc.)
      if (responseMetadata && Object.keys(responseMetadata).length > 0) {
        updateData.response_metadata = responseMetadata;
        this.logger.debug(
          `✅ [completeTask] Setting response_metadata with keys: ${Object.keys(responseMetadata).join(',')}`,
        );
      }

      // Store deliverable type if available
      if (deliverableType) {
        updateData.deliverable_type = deliverableType;
        this.logger.debug(
          `✅ [completeTask] Setting deliverable_type: ${deliverableType}`,
        );
      }

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
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('tasks'))
        .select('status, response, error, params')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      const task = data as
        | (Pick<TaskDbRecord, 'status' | 'response' | 'params'> & {
            error?: string;
          })
        | null;

      if (error || !task) {
        return null;
      }

      const taskParams = task.params as Record<string, unknown> & {
        status_data?: Record<string, unknown>;
      };
      const statusData =
        (taskParams?.status_data as Record<string, unknown>) || {};

      return {
        status: task.status,
        progress: statusData.progress as number | undefined,
        progressMessage: statusData.progressMessage as string | undefined,
        response: task.response,
        error: task.error,
        metadata: statusData.metadata as Record<string, unknown> | undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get A2A task ${taskId} status:`, error);
      return null;
    }
  }
}
