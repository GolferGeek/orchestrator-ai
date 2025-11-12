import { Injectable } from '@nestjs/common';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { WebhookStatusService } from '../../services/webhook-status.service';

@Injectable()
export class LLMNodeExecutor {
  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly webhookService: WebhookStatusService,
  ) {}

  async execute(
    state: Record<string, unknown>,
    config: {
      systemMessage: string;
      userMessageField: string;
      outputField: string;
      stepName: string;
      sequence: number;
      totalSteps: number;
    },
  ): Promise<Partial<Record<string, unknown>>> {
    const {
      provider,
      model,
      taskId,
      conversationId,
      userId,
      statusWebhook,
    } = state as {
      provider: string;
      model: string;
      taskId: string;
      conversationId: string;
      userId: string;
      statusWebhook?: string;
    };

    // Send progress update
    if (statusWebhook) {
      await this.webhookService.sendProgress(
        statusWebhook,
        taskId,
        conversationId,
        userId,
        config.stepName,
        config.sequence,
        config.totalSteps,
      );
    }

    // Make LLM call
    const userMessage = state[config.userMessageField] as string;
    
    if (!userId) {
      throw new Error(`userId is required in workflow state for LLM node execution (step: ${config.stepName})`);
    }

    const result = await this.llmClient.callLLM({
      provider,
      model,
      systemMessage: config.systemMessage,
      userMessage,
      callerName: config.stepName,
      userId, // Required for usage tracking
    });

    // Return updated state
    return {
      [config.outputField]: result.text,
    };
  }
}
