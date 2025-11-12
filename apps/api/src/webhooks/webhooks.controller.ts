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
import { StreamingService } from '../agent2agent/services/streaming.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ObservabilityWebhookService } from '../observability/observability-webhook.service';

/**
 * Workflow Status Update
 * This can come from n8n, coded function agents, or any external workflow system
 * Extended to support internal agent observability
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

  // NEW: Observability enrichment fields
  agentSlug?: string; // Agent being executed
  username?: string; // display_name or email (human-readable)
  organizationSlug?: string; // Organization namespace
  mode?: string; // 'converse', 'plan', 'build', 'orchestrate'
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
    private readonly streamingService: StreamingService,
    private readonly supabaseService: SupabaseService,
    private readonly observabilityService: ObservabilityWebhookService,
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

      // Emit SSE chunk event via StreamingService for real-time streaming to frontend (USER STREAM)
      this.logger.log(
        `📤 [WebhookController] Broadcasting to USER stream via streamingService.emitProgress for taskId=${update.taskId}`,
      );
      this.streamingService.emitProgress(
        update.taskId,
        update.message || stepName,
        {
          step: stepName,
          sequence,
          totalSteps: totalStepsFromUpdate,
          status: update.status,
          progress,
        },
      );
      this.logger.debug(
        `✅ [WebhookController] Broadcasted to USER stream successfully`,
      );

      // Webhooks only emit progress - never completion
      // The stream will be cleaned up when the API call completes and returns to frontend

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

      // NEW: Emit observability event for admin monitoring and store in database (ADMIN STREAM)
      this.logger.log(
        `📊 [WebhookController] Broadcasting to ADMIN stream via observability event for taskId=${update.taskId}`,
      );
      await this.storeAndBroadcastObservabilityEvent(update, {
        stepName,
        progress,
        sequence,
        totalStepsFromUpdate,
      });
      this.logger.debug(
        `✅ [WebhookController] Broadcasted to ADMIN stream successfully`,
      );
    } catch (error) {
      this.logger.error('Error processing workflow status update', error);
    }
  }

  /**
   * Store observability event in database and broadcast to admin clients
   */
  private async storeAndBroadcastObservabilityEvent(
    update: WorkflowStatusUpdate,
    computed: {
      stepName: string;
      progress: number;
      sequence: number;
      totalStepsFromUpdate?: number;
    },
  ): Promise<void> {
    try {
      const now = Date.now();
      
      // Resolve username if not provided
      let username = update.username;
      if (update.userId && !username) {
        // Resolve username from userId using AuthService
        try {
          const userProfile = await this.observabilityService['authService'].getUserProfile(update.userId);
          username = userProfile?.displayName || userProfile?.email || update.userId;
        } catch {
          username = update.userId; // Fallback to userId if resolution fails
        }
      }

      const eventData = {
        source_app: 'orchestrator-ai',
        session_id: update.conversationId || update.taskId,
        hook_event_type: update.status, // 'agent.started', 'agent.progress', etc.
        user_id: update.userId || null,
        username: username || null,
        conversation_id: update.conversationId || null,
        task_id: update.taskId,
        agent_slug: update.agentSlug || null,
        organization_slug: update.organizationSlug || null,
        mode: update.mode || null,
        status: update.status,
        message: update.message || null,
        progress: computed.progress,
        step: computed.stepName,
        payload: update,
        timestamp: now,
      };

      // Store in database
      const { error: dbError } = await this.supabaseService
        .getServiceClient()
        .from('observability_events')
        .insert(eventData);

      if (dbError) {
        this.logger.error(
          `Failed to store observability event: ${dbError.message}`,
          dbError,
        );
      } else {
        this.logger.debug(
          `📊 Stored observability event for task ${update.taskId}`,
        );
      }

      // Emit to admin clients via EventEmitter (ADMIN STREAM)
      // This event is picked up by /observability/stream endpoint
      this.eventEmitter.emit('observability.event', {
        ...eventData,
        eventType: update.status,
      });
      this.logger.debug(
        `📡 Emitted observability.event for admin stream: ${update.status} - ${update.message?.substring(0, 50)}...`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to process observability event',
        error instanceof Error ? error.message : error,
      );
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
