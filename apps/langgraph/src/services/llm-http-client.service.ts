import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface LLMCallRequest {
  provider: string;
  model: string;
  systemMessage?: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  callerName?: string;
  userId: string; // Required for usage tracking
}

export interface LLMCallResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class LLMHttpClientService {
  private readonly logger = new Logger(LLMHttpClientService.name);
  private readonly llmServiceUrl: string;
  private readonly llmEndpoint: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.llmServiceUrl = this.configService.get<string>('LLM_SERVICE_URL') || 'http://localhost:7100';
    this.llmEndpoint = this.configService.get<string>('LLM_ENDPOINT') || '/llm/generate';
  }

  /**
   * Make a non-streaming LLM call
   */
  async callLLM(request: LLMCallRequest): Promise<LLMCallResponse> {
    const url = `${this.llmServiceUrl}${this.llmEndpoint}`;

    this.logger.debug(`Calling LLM service: ${url}`, {
      provider: request.provider,
      model: request.model,
      caller: request.callerName,
    });

    try {
      if (!request.userId) {
        throw new Error('userId is required for LLM calls');
      }

      const response = await firstValueFrom(
        this.httpService.post(url, {
          systemPrompt: request.systemMessage || '',
          userPrompt: request.userMessage,
          options: {
            provider: request.provider,
            modelName: request.model,
            temperature: request.temperature ?? 0.7,
            maxTokens: request.maxTokens ?? 3500,
            callerType: 'langgraph',
            callerName: request.callerName || 'workflow',
            userId: request.userId, // Pass userId for usage tracking
          },
        }),
      );

      const text = response.data.response || response.data.content || '';

      return {
        text,
        usage: response.data.metadata?.usage,
      };
    } catch (error) {
      this.logger.error('LLM call failed', error);
      throw new Error(`LLM call failed: ${error.message}`);
    }
  }
}
