import { Injectable } from '@nestjs/common';
import { LLMNodeExecutor } from '../nodes/llm-node';
import { WebhookStatusService } from '../../services/webhook-status.service';

export interface MarketingSwarmState {
  announcement: string;
  provider: string;
  model: string;
  taskId: string;
  conversationId: string;
  userId: string;
  statusWebhook?: string;
  webPost?: string;
  seoContent?: string;
  socialMedia?: string;
  result?: Record<string, string>;
  errors?: string[];
}

@Injectable()
export class MarketingSwarmGraph {
  constructor(
    private readonly llmNode: LLMNodeExecutor,
    private readonly webhookService: WebhookStatusService,
  ) {}

  async execute(input: MarketingSwarmState): Promise<MarketingSwarmState> {
    // Send start webhook
    if (input.statusWebhook) {
      await this.webhookService.sendStarted(
        input.statusWebhook,
        input.taskId,
        input.conversationId,
        input.userId,
        3, // totalSteps
      );
    }

    try {
      // Execute steps sequentially
      const state: MarketingSwarmState = { ...input };

      // Step 1: Generate web post
      const webPostResult = await this.llmNode.execute(state as unknown as Record<string, unknown>, {
        systemMessage:
          'You are a brilliant blog post writer who specializes in being both entertaining and informative, and you\'re best known for being able to write posts for all audiences.',
        userMessageField: 'announcement',
        outputField: 'webPost',
        stepName: 'Write Blog Post',
        sequence: 1,
        totalSteps: 3,
      });
      Object.assign(state, webPostResult);

      // Step 2: Generate SEO content
      const seoResult = await this.llmNode.execute(state as unknown as Record<string, unknown>, {
        systemMessage:
          'You are an expert SEO specialist. Generate comprehensive SEO-optimized content including: meta title (60 chars max), meta description (155 chars max), 5-10 relevant keywords, H1 heading, and JSON-LD structured data for the given topic.',
        userMessageField: 'announcement',
        outputField: 'seoContent',
        stepName: 'Create SEO',
        sequence: 2,
        totalSteps: 3,
      });
      Object.assign(state, seoResult);

      // Step 3: Generate social media posts
      const socialResult = await this.llmNode.execute(state as unknown as Record<string, unknown>, {
        systemMessage:
          'You are a social media content strategist. Create engaging social media posts (NOT blog posts) for multiple platforms: Twitter/X (280 chars with hashtags), LinkedIn (professional tone, 1300 chars max), and Facebook (conversational, 500 chars).',
        userMessageField: 'announcement',
        outputField: 'socialMedia',
        stepName: 'Create Social Media',
        sequence: 3,
        totalSteps: 3,
      });
      Object.assign(state, socialResult);

      // Merge results
      state.result = {
        webPost: state.webPost!,
        seoContent: state.seoContent!,
        socialMedia: state.socialMedia!,
      };

      // Send completion webhook
      if (input.statusWebhook) {
        await this.webhookService.sendCompleted(
          input.statusWebhook,
          input.taskId,
          input.conversationId,
          input.userId,
          state.result,
        );
      }

      return state;
    } catch (error) {
      // Send failure webhook
      if (input.statusWebhook) {
        await this.webhookService.sendFailed(
          input.statusWebhook,
          input.taskId,
          input.conversationId,
          input.userId,
          error.message,
        );
      }
      throw error;
    }
  }
}
