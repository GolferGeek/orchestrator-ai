import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LLMService } from './llm.service';

@Controller('llm')
export class LLMController {
  private readonly logger = new Logger(LLMController.name);

  constructor(private readonly llmService: LLMService) {}

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
      };
    },
  ): Promise<{ response: string }> {

    try {
      const response = await this.llmService.generateResponse(
        request.systemPrompt,
        request.userPrompt,
        {
          temperature: request.options?.temperature,
          maxTokens: request.options?.maxTokens,
          provider: request.options?.provider,
        },
      );

      return { response };
    } catch (error) {

      throw error;
    }
  }
}
