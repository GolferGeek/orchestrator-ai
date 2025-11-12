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
    // Build LLM service URL from API_PORT (same as main API)
    // Fail fast if required configuration is missing - no defaults allowed
    const apiPort = this.configService.get<string>('API_PORT');
    if (!apiPort) {
      throw new Error(
        'API_PORT environment variable is required. ' +
        'Please set API_PORT in your .env file (e.g., API_PORT=7100). ' +
        'This must be explicitly configured for your environment.'
      );
    }
    
    // API_HOST and LLM_ENDPOINT have stable defaults but can be overridden
    const apiHost = this.configService.get<string>('API_HOST') || 'localhost';
    const llmEndpoint = this.configService.get<string>('LLM_ENDPOINT') || '/llm/generate';
    
    this.llmServiceUrl = `http://${apiHost}:${apiPort}`;
    this.llmEndpoint = llmEndpoint;
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
            // Support both provider and providerName for compatibility
            provider: request.provider,
            providerName: request.provider,
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
      // Extract detailed error information
      let errorMessage = error.message;
      let errorDetails = '';
      
      if (error.response) {
        // Axios error with response
        errorDetails = JSON.stringify(error.response.data || error.response.statusText);
        errorMessage = `Request failed with status code ${error.response.status}: ${errorDetails}`;
      } else if (error.request) {
        // Axios error without response
        errorMessage = `No response received: ${error.message}`;
      }
      
      this.logger.error('LLM call failed', {
        message: errorMessage,
        details: errorDetails,
        url,
        request: {
          provider: request.provider,
          model: request.model,
          callerName: request.callerName,
        },
      });
      
      throw new Error(`LLM call failed: ${errorMessage}`);
    }
  }
}
