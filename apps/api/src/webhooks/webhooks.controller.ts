import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TasksService } from '../agent2agent/tasks/tasks.service';

/**
 * Workflow Status Update
 * This can come from n8n, coded function agents, or any external workflow system
 */
interface WorkflowStatusUpdate {
  // Required fields
  taskId: string;
  status: string;
  timestamp: string;

  // Optional workflow identification
  executionId?: string;
  workflowId?: string;
  workflowName?: string;

  // Optional context fields
  conversationId?: string;
  userId?: string;

  // Optional progress fields
  step?: string;
  percent?: number;
  message?: string;
  node?: string;
  stage?: string;
  results?: Record<string, unknown>;

  // Optional sequence tracking (from n8n)
  sequence?: number;
  totalSteps?: number;

  // Nested data object that may contain sequence/totalSteps
  data?: {
    sequence?: number;
    totalSteps?: number;
    [key: string]: unknown;
  };
}

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  // Store status history per task
  private taskStatusHistory: Map<string, Record<string, unknown>[]> = new Map();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
  ) {}

  /**
   * Receive status updates from any workflow system (n8n, coded agents, etc.)
   * POST /webhooks/status
   */
  @Post('status')
  @HttpCode(204)
  async handleStatusUpdate(
    @Body() update: WorkflowStatusUpdate,
  ): Promise<void> {
    this.logger.debug('=== WEBHOOK ENDPOINT HIT ===');
    this.logger.debug(`Request body: ${JSON.stringify(update)}`);
    this.logger.log(
      `Received workflow status update for task ${update.taskId}: ${update.status}`,
    );
    this.logger.debug(
      `Sequence info - top level: ${update.sequence}, in data: ${update.data?.sequence}`,
    );

    // Validate required fields
    if (!update.taskId) {
      this.logger.warn(
        'Missing required taskId in workflow status update',
        update,
      );
      return;
    }

    try {
      // Build status history for this task
      if (!this.taskStatusHistory.has(update.taskId)) {
        this.taskStatusHistory.set(update.taskId, []);
      }

      const history = this.taskStatusHistory.get(update.taskId)!;

      // Add this status update to history
      // Check for sequence at top level first (from n8n), then in data
      const sequence =
        update.sequence || update.data?.sequence || history.length + 1;
      const totalStepsFromUpdate = update.totalSteps || update.data?.totalSteps;

      const statusEntry = {
        timestamp: update.timestamp || new Date().toISOString(),
        status: update.status,
        step: update.step,
        message: update.message,
        sequence: sequence,
        totalSteps: totalStepsFromUpdate,
        data: update,
      };

      history.push(statusEntry);

      // Map workflow status update to our WorkflowStepProgressEvent format
      const stepName =
        update.step || update.stage || update.node || update.status;
      const stepIndex = this.calculateStepIndex(update.status, update.step);
      const totalStepsEstimated = this.estimateTotalSteps(update.status);
      const progress = update.percent ?? this.calculateProgress(update.status);

      // Emit workflow step progress event
      this.eventEmitter.emit('workflow.step.progress', {
        taskId: update.taskId,
        step: stepName,
        stepIndex,
        totalSteps: totalStepsEstimated,
        status: update.status,
        message: update.message,
        progress,
      });

      // Create task message for progress update (shows in message bubble)
      if (update.userId && update.message) {
        try {
          await this.tasksService.emitTaskMessage(
            update.taskId,
            update.userId,
            update.message,
            'progress',
            progress,
            {
              step: stepName,
              sequence,
              totalSteps: totalStepsFromUpdate,
              status: update.status,
            },
          );
          this.logger.debug(
            `📝 Created task message for ${update.taskId}: "${update.message}"`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to create task message for ${update.taskId}:`,
            error,
          );
        }
      }

      // Emit SSE chunk event for real-time streaming to frontend
      this.eventEmitter.emit('agent.stream.chunk', {
        taskId: update.taskId,
        conversationId: update.conversationId,
        chunk: {
          type: 'progress',
          content: update.message || stepName,
          metadata: {
            step: stepName,
            sequence,
            totalSteps: totalStepsFromUpdate,
            status: update.status,
            progress,
          },
        },
      });

      // Send the COMPLETE status history via event
      const eventData = {
        executionId: update.executionId,
        workflowId: update.workflowId,
        workflowName: update.workflowName,
        status: update.status,
        step: stepName,
        progress,
        timestamp: update.timestamp,
        conversationId: update.conversationId,
        statusHistory: history, // Send complete history
        data: update,
      };

      this.logger.debug(
        `📤 Emitting workflow status update - History length: ${history.length}`,
      );
      this.eventEmitter.emit('workflow.status.update', {
        taskId: update.taskId,
        event: 'workflow_status_update',
        data: eventData,
      });

      // Emit event for other services that might care
      this.eventEmitter.emit('workflow.status_update', {
        taskId: update.taskId,
        conversationId: update.conversationId,
        executionId: update.executionId,
        status: update.status,
        progress,
        data: update,
      });

      // Webhook is ONLY for progress updates - completion should go through agent2agent controller
      this.logger.debug(
        `Webhook received status "${update.status}" - emitting as progress update only`,
      );
    } catch (error) {
      this.logger.error('Error processing workflow status update', error);
    }
  }

  /**
   * Calculate step index based on status
   */
  private calculateStepIndex(status: string, step?: string): number {
    // Map common statuses to step indices
    const statusMap: Record<string, number> = {
      started: 0,
      initialization: 0,
      in_progress: 1,
      processing: 2,
      web_post_generated: 1,
      seo_content_generated: 2,
      social_content_generated: 3,
      completed: 4,
    };

    return statusMap[status] ?? statusMap[step || ''] ?? 1;
  }

  /**
   * Estimate total steps based on workflow type
   */
  private estimateTotalSteps(_status: string): number {
    // Marketing swarm typically has 5 steps
    // This could be made configurable per workflow
    return 5;
  }

  /**
   * Calculate progress percentage from status
   */
  private calculateProgress(status: string): number {
    const progressMap: Record<string, number> = {
      started: 1,
      initialization: 1,
      in_progress: 25,
      web_post_generated: 25,
      seo_content_generated: 50,
      social_content_generated: 75,
      completed: 100,
      failed: 0,
      error: 0,
    };

    return progressMap[status] ?? 50;
  }

}
