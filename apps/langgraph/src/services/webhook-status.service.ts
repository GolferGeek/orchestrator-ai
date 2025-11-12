import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface StatusUpdate {
  taskId: string;
  conversationId: string;
  userId: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  timestamp: string;
  step?: string;
  message?: string;
  sequence?: number;
  totalSteps?: number;
  data?: Record<string, unknown>;
  error?: string;
}

@Injectable()
export class WebhookStatusService {
  private readonly logger = new Logger(WebhookStatusService.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Send status update to webhook URL
   */
  async sendStatus(webhookUrl: string, update: StatusUpdate): Promise<void> {
    if (!webhookUrl) {
      this.logger.warn('No webhook URL provided, skipping status update');
      return;
    }

    this.logger.debug(`Sending status update to ${webhookUrl}`, {
      taskId: update.taskId,
      status: update.status,
      step: update.step,
    });

    try {
      await firstValueFrom(
        this.httpService.post(webhookUrl, update, {
          timeout: 5000, // 5 second timeout
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`Status update sent successfully: ${update.status}`);
    } catch (error) {
      this.logger.error(`Failed to send status update to ${webhookUrl}`, error);
      // Don't throw - webhook failures shouldn't break the workflow
    }
  }

  /**
   * Send started status
   */
  async sendStarted(
    webhookUrl: string,
    taskId: string,
    conversationId: string,
    userId: string,
    totalSteps?: number,
  ): Promise<void> {
    await this.sendStatus(webhookUrl, {
      taskId,
      conversationId,
      userId,
      status: 'started',
      timestamp: new Date().toISOString(),
      message: 'Workflow execution started',
      totalSteps,
    });
  }

  /**
   * Send progress status
   */
  async sendProgress(
    webhookUrl: string,
    taskId: string,
    conversationId: string,
    userId: string,
    step: string,
    sequence: number,
    totalSteps: number,
    message?: string,
  ): Promise<void> {
    await this.sendStatus(webhookUrl, {
      taskId,
      conversationId,
      userId,
      status: 'progress',
      timestamp: new Date().toISOString(),
      step,
      sequence,
      totalSteps,
      message: message || `Executing step ${sequence}/${totalSteps}: ${step}`,
    });
  }

  /**
   * Send completed status
   */
  async sendCompleted(
    webhookUrl: string,
    taskId: string,
    conversationId: string,
    userId: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.sendStatus(webhookUrl, {
      taskId,
      conversationId,
      userId,
      status: 'completed',
      timestamp: new Date().toISOString(),
      message: 'Workflow execution completed',
      data,
    });
  }

  /**
   * Send failed status
   */
  async sendFailed(
    webhookUrl: string,
    taskId: string,
    conversationId: string,
    userId: string,
    error: string,
  ): Promise<void> {
    await this.sendStatus(webhookUrl, {
      taskId,
      conversationId,
      userId,
      status: 'failed',
      timestamp: new Date().toISOString(),
      message: 'Workflow execution failed',
      error,
    });
  }
}
