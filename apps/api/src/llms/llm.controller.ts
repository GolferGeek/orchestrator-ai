import {
  Controller,
  Post,
  Get,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LLMService } from './llm.service';
import { LocalModelStatusService } from './local-model-status.service';

@Controller('llm')
export class LLMController {
  private readonly logger = new Logger(LLMController.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly localModelStatusService: LocalModelStatusService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(
    @Body()
    request: {
      systemPrompt: string;
      userPrompt: string;
      options?: {
        temperature?: number;
        maxTokens?: number;
        provider?: 'openai' | 'anthropic' | 'ollama' | 'google';
        // Support full LLM preferences from UI
        providerName?: string;
        modelName?: string;
        // Caller tracking for usage analytics
        callerType?: string;
        callerName?: string;
        conversationId?: string;
        dataClassification?: string;
      };
    },
  ): Promise<{ response: string; sanitizationMetadata?: any }> {

    try {
      const result = await this.llmService.generateResponse(
        request.systemPrompt,
        request.userPrompt,
        {
          temperature: request.options?.temperature,
          maxTokens: request.options?.maxTokens,
          provider: request.options?.provider,
          // Support full LLM preferences from UI
          providerName: request.options?.providerName,
          modelName: request.options?.modelName,
          // Caller tracking - use provided values or defaults
          callerType: request.options?.callerType || 'api',
          callerName: request.options?.callerName || 'llm-controller',
          conversationId: request.options?.conversationId,
          dataClassification: request.options?.dataClassification || 'public',
          // Request metadata for Python agents
          includeMetadata: true,
        },
      );

      // Handle both string and object responses
      if (typeof result === 'string') {
        return { response: result };
      } else {
        return { 
          response: result.content || result.response || result,
          sanitizationMetadata: result.sanitizationMetadata
        };
      }
    } catch (error) {

      throw error;
    }
  }

  @Get('local-models/status')
  @HttpCode(HttpStatus.OK)
  async getLocalModelStatus(): Promise<any> {
    try {
      const status = await this.localModelStatusService.getOllamaStatus();
      return status;
    } catch (error) {
      this.logger.error('Failed to get local model status', error);
      throw error;
    }
  }
}
