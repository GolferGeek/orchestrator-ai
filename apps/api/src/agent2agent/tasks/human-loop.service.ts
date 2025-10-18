import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { snakeToCamel } from '@/utils/case-converter';

export interface HumanInput {
  id: string;
  taskId: string;
  userId: string;
  requestType: 'confirmation' | 'choice' | 'input' | 'approval';
  prompt: string;
  options?: any[];
  userResponse?: string;
  responseMetadata?: Record<string, any>;
  status: 'pending' | 'completed' | 'timeout' | 'cancelled';
  timeoutAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHumanInputDto {
  taskId: string;
  userId: string;
  requestType: 'confirmation' | 'choice' | 'input' | 'approval';
  prompt: string;
  options?: any[];
  timeoutSeconds?: number;
}

export interface HumanInputResponse {
  response: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class HumanLoopService {
  private readonly logger = new Logger(HumanLoopService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Request human input during task execution
   * This pauses the task and waits for user response
   */
  async requestHumanInput(
    taskId: string,
    userId: string,
    prompt: string,
    requestType: 'confirmation' | 'choice' | 'input' | 'approval' = 'input',
    options?: any[],
    timeoutSeconds: number = 300, // 5 minutes default
  ): Promise<HumanInput> {
    const timeoutAt = new Date(Date.now() + timeoutSeconds * 1000);

    const humanInputData = {
      task_id: taskId,
      user_id: userId,
      request_type: requestType,
      prompt,
      options: options ? JSON.stringify(options) : null,
      timeout_at: timeoutAt.toISOString(),
      status: 'pending',
    };

    const { data, error } = await this.supabaseService
      .getAnonClient()
      .from('human_inputs')
      .insert(humanInputData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create human input: ${error.message}`);
    }

    const humanInput = this.mapToHumanInput(data);

    // Emit event for real-time notification
    this.eventEmitter.emit('human_input.required', {
      taskId,
      userId,
      inputId: humanInput.id,
      prompt,
      requestType,
      options,
      timeoutAt,
    });

    return humanInput;
  }

  /**
   * Submit a response to a human input request
   */
  async submitHumanResponse(
    inputId: string,
    userId: string,
    response: HumanInputResponse,
  ): Promise<HumanInput> {
    const updateData = {
      user_response: response.response,
      response_metadata: response.metadata || {},
      status: 'completed',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabaseService
      .getAnonClient()
      .from('human_inputs')
      .update(updateData)
      .eq('id', inputId)
      .eq('user_id', userId)
      .eq('status', 'pending') // Only update if still pending
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update human input: ${error.message}`);
    }

    if (!data) {
      throw new Error('Human input not found or already completed');
    }

    const humanInput = this.mapToHumanInput(data);

    // Emit event for real-time notification
    this.eventEmitter.emit('human_input.response', {
      taskId: humanInput.taskId,
      userId,
      inputId,
      response: response.response,
      metadata: response.metadata,
    });

    // Emit task resumed event
    this.eventEmitter.emit('task.resumed', {
      taskId: humanInput.taskId,
      userId,
    });

    return humanInput;
  }

  /**
   * Wait for human response with timeout
   * This is used by agents to pause execution until user responds
   */
  async waitForHumanResponse(
    inputId: string,
    timeoutMs?: number,
  ): Promise<HumanInput> {
    return new Promise((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | undefined;

      // Set up timeout
      const clearAll = (interval: NodeJS.Timeout) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        clearInterval(interval);
      };

      if (timeoutMs) {
        timeoutHandle = setTimeout(() => {
          clearAll(checkInterval);
          this.handleHumanInputTimeout(inputId)
            .then(resolve)
            .catch((err) =>
              reject(err instanceof Error ? err : new Error(String(err))),
            );
        }, timeoutMs);
      }

      // Poll for completion
      const checkInterval = setInterval(() => {
        void (async () => {
          try {
            const humanInput = await this.getHumanInputById(inputId);
            if (humanInput && humanInput.status !== 'pending') {
              clearAll(checkInterval);
              resolve(humanInput);
            }
          } catch (error) {
            clearAll(checkInterval);
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        })();
      }, 1000); // Check every second
    });
  }

  /**
   * Get human input by ID
   */
  async getHumanInputById(inputId: string): Promise<HumanInput | null> {
    const { data, error } = await this.supabaseService
      .getAnonClient()
      .from('human_inputs')
      .select()
      .eq('id', inputId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch human input: ${error.message}`);
    }

    return data ? this.mapToHumanInput(data) : null;
  }

  /**
   * Get pending human inputs for a task
   */
  async getPendingInputsForTask(
    taskId: string,
    userId: string,
  ): Promise<HumanInput[]> {
    try {
      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('human_inputs')
        .select()
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch pending inputs: ${error.message}`);
      }

      return data.map((item) => this.mapToHumanInput(item));
    } catch (error) {
      this.logger.error('Failed to get pending inputs for task', error);
      throw error;
    }
  }

  /**
   * Cancel a pending human input
   */
  async cancelHumanInput(inputId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getAnonClient()
        .from('human_inputs')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', inputId)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) {
        throw new Error(`Failed to cancel human input: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Failed to cancel human input', error);
      throw error;
    }
  }

  /**
   * Handle timeout for human input
   */
  async handleHumanInputTimeout(inputId: string): Promise<HumanInput> {
    try {
      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('human_inputs')
        .update({
          status: 'timeout',
          updated_at: new Date().toISOString(),
        })
        .eq('id', inputId)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to handle timeout: ${error.message}`);
      }

      const humanInput = this.mapToHumanInput(data);

      // Emit timeout event
      this.eventEmitter.emit('human_input.timeout', {
        taskId: humanInput.taskId,
        userId: humanInput.userId,
        inputId,
      });

      // Emit task resumed event (task continues with default/timeout behavior)
      this.eventEmitter.emit('task.resumed', {
        taskId: humanInput.taskId,
        userId: humanInput.userId,
      });

      return humanInput;
    } catch (error) {
      this.logger.error('Failed to handle human input timeout', error);
      throw error;
    }
  }

  /**
   * Clean up expired human inputs (for scheduled cleanup)
   */
  async cleanupExpiredInputs(): Promise<number> {
    try {
      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('human_inputs')
        .update({
          status: 'timeout',
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'pending')
        .lt('timeout_at', new Date().toISOString())
        .select('id, task_id, user_id');

      if (error) {
        throw new Error(`Failed to cleanup expired inputs: ${error.message}`);
      }

      // Emit timeout events for each expired input
      for (const input of data || []) {
        this.eventEmitter.emit('human_input.timeout', {
          taskId: input.task_id,
          userId: input.user_id,
          inputId: input.id,
        });

        this.eventEmitter.emit('task.resumed', {
          taskId: input.task_id,
          userId: input.user_id,
        });
      }

      const count = data?.length || 0;
      if (count > 0) {
        // Emitted timeout events for expired inputs above
      }

      return count;
    } catch (error) {
      this.logger.error('Failed to cleanup expired inputs', error);
      throw error;
    }
  }

  /**
   * Map database record to HumanInput type
   */
  private mapToHumanInput(data: unknown): HumanInput {
    const converted = snakeToCamel(data) as Record<string, unknown>;

    return {
      id: converted.id as string,
      taskId: converted.taskId as string,
      userId: converted.userId as string,
      requestType: converted.requestType as HumanInput['requestType'],
      prompt: converted.prompt as string,
      options: converted.options
        ? JSON.parse(converted.options as string)
        : undefined,
      userResponse: converted.userResponse as string | undefined,
      responseMetadata:
        (converted.responseMetadata as Record<string, unknown>) || {},
      status: converted.status as HumanInput['status'],
      timeoutAt: converted.timeoutAt
        ? new Date(converted.timeoutAt as string)
        : undefined,
      createdAt: new Date(converted.createdAt as string),
      updatedAt: new Date(converted.updatedAt as string),
    };
  }
}
