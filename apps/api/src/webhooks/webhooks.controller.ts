import { Controller, Post, Body, Logger, HttpCode, Inject, forwardRef } from '@nestjs/common';
import { TaskProgressGateway } from '../websocket/task-progress.gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TasksService } from '../tasks/tasks.service';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { DeliverableFormat, DeliverableVersionCreationType } from '../deliverables/dto';

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
  results?: any;

  // Optional sequence tracking (from n8n)
  sequence?: number;
  totalSteps?: number;

  // Optional result fields from n8n marketing workflow
  webPost?: string;
  seoContent?: string;
  socialMedia?: string;

  // Any additional data from the workflow system
  [key: string]: any;
}

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  
  // Store status history per task
  private taskStatusHistory: Map<string, any[]> = new Map();

  constructor(
    private readonly taskProgressGateway: TaskProgressGateway,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
    @Inject(forwardRef(() => DeliverablesService))
    private readonly deliverablesService: DeliverablesService,
  ) {}

  /**
   * Receive status updates from any workflow system (n8n, coded agents, etc.)
   * POST /webhooks/status
   */
  @Post('status')
  @HttpCode(204)
  async handleStatusUpdate(@Body() update: WorkflowStatusUpdate): Promise<void> {
    this.logger.debug('=== WEBHOOK ENDPOINT HIT ===');
    this.logger.debug(`Request body: ${JSON.stringify(update)}`);
    this.logger.log(`Received workflow status update for task ${update.taskId}: ${update.status}`);
    this.logger.debug(`Sequence info - top level: ${update.sequence}, in data: ${update.data?.sequence}`);

    // Validate required fields
    if (!update.taskId) {
      this.logger.warn('Missing required taskId in workflow status update', update);
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
      const sequence = update.sequence || update.data?.sequence || history.length + 1;
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
      const stepName = update.step || update.stage || update.node || update.status;
      const stepIndex = this.calculateStepIndex(update.status, update.step);
      const totalStepsEstimated = this.estimateTotalSteps(update.status);
      const progress = update.percent ?? this.calculateProgress(update.status);

      // Emit workflow step progress via WebSocket
      this.taskProgressGateway.broadcastWorkflowStepProgress(
        update.taskId,
        stepName,
        stepIndex,
        totalStepsEstimated,
        update.status,
        update.message,
      );

      // Send the COMPLETE status history each time
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
      
      this.logger.debug(`📤 Sending to WebSocket - History length: ${history.length}`);
      this.taskProgressGateway.sendToTask(update.taskId, 'workflow_status_update', eventData);

      // Emit event for other services that might care
      this.eventEmitter.emit('workflow.status_update', {
        taskId: update.taskId,
        conversationId: update.conversationId,
        executionId: update.executionId,
        status: update.status,
        progress,
        data: update,
      });

      // If workflow is completed, handle final results
      if (update.status === 'completed') {
        this.logger.log(`Workflow completed for task ${update.taskId}`);

        // Update task in database with final results
        if (this.tasksService && update.userId) {
          try {
            // Extract the actual content fields (webPost, seoContent, socialMedia, etc.)
            const finalResults = update.results || update.webPost || update.seoContent || update.socialMedia ? {
              webPost: update.webPost,
              seoContent: update.seoContent,
              socialMedia: update.socialMedia,
              ...update.results
            } : null;

            this.logger.log(`Updating task ${update.taskId} with final results:`, finalResults ? Object.keys(finalResults) : 'none');

            await this.tasksService.updateTask(update.taskId, update.userId, {
              status: 'completed',
              progress: 100,
              progressMessage: update.message || 'Workflow completed successfully',
              response: finalResults,
            });

            this.logger.log(`✅ Task ${update.taskId} updated in database with final results`);

            // Create deliverable with the n8n workflow results
            if (update.conversationId && finalResults) {
              try {
                this.logger.log(`Creating deliverable for task ${update.taskId}`);

                // Format the content from the n8n response
                const formattedContent = this.formatMarketingContent(finalResults);

                await this.deliverablesService.create(
                  {
                    title: 'Marketing Content Package',
                    conversationId: update.conversationId,
                    agentName: 'marketing-swarm',
                    initialContent: formattedContent,
                    initialFormat: DeliverableFormat.MARKDOWN,
                    initialCreationType: DeliverableVersionCreationType.CONVERSATION_TASK,
                    initialTaskId: update.taskId,
                    initialMetadata: {
                      status: update.status,
                      executionId: update.executionId,
                      timestamp: update.timestamp,
                      userId: update.userId,
                    },
                  },
                  update.userId,
                );

                this.logger.log(`✅ Deliverable created for task ${update.taskId}`);
              } catch (error) {
                this.logger.error(`Failed to create deliverable for task ${update.taskId}:`, error);
              }
            }
          } catch (error) {
            this.logger.error(`Failed to update task ${update.taskId} in database:`, error);
          }
        } else {
          this.logger.warn(`Cannot update task ${update.taskId}: missing tasksService or userId`);
        }

        // Broadcast completion via WebSocket
        const resultsToSend = update.results || {
          webPost: update.webPost,
          seoContent: update.seoContent,
          socialMedia: update.socialMedia
        };

        // Clean up status history after completion
        this.taskStatusHistory.delete(update.taskId);
        
        this.taskProgressGateway.broadcastTaskCompletionWithResponse(
          update.taskId,
          'completed',
          update.message || 'Workflow completed successfully',
          typeof resultsToSend === 'string' ? resultsToSend : JSON.stringify(resultsToSend),
          {
            executionId: update.executionId,
            conversationId: update.conversationId,
            workflowId: update.workflowId,
            workflowName: update.workflowName,
          },
        );
      }

      // If workflow failed, broadcast failure
      if (update.status === 'failed' || update.status === 'error') {
        this.logger.error(`Workflow failed for task ${update.taskId}`, update);

        this.taskProgressGateway.broadcastTaskCompletion(
          update.taskId,
          'failed',
          update.message || 'Workflow execution failed',
        );
      }
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
  private estimateTotalSteps(status: string): number {
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

  /**
   * Format marketing content from n8n workflow results into a structured markdown deliverable
   */
  private formatMarketingContent(results: any): string {
    const sections: string[] = ['# Marketing Content Package\n'];

    if (results.webPost) {
      sections.push('## Web Post\n');
      sections.push(results.webPost);
      sections.push('\n');
    }

    if (results.seoContent) {
      sections.push('## SEO Content\n');
      sections.push(results.seoContent);
      sections.push('\n');
    }

    if (results.socialMedia) {
      sections.push('## Social Media\n');
      sections.push(results.socialMedia);
      sections.push('\n');
    }

    return sections.join('\n');
  }
}
