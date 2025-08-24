import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LLMService } from '@/llms/llm.service';

/**
 * LangChain Client Service
 *
 * Core orchestration service for LangChain.js operations.
 * Provides centralized LLM access and configuration management.
 */
@Injectable()
export class LangChainClientService {
  private readonly logger = new Logger(LangChainClientService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * Get a configured LangChain LLM instance
   */
  getLLM(options?: {
    provider?: string;
    model?: string;
    temperature?: number;
    timeout?: number;
  }): ChatOpenAI {
    const provider = options?.provider || 'openai';
    const model = options?.model || 'gpt-4';
    const temperature = options?.temperature ?? 0;
    const timeout = options?.timeout ?? 60000; // Default to 60 seconds

    if (provider === 'openai') {
      return new ChatOpenAI({
        modelName: model,
        temperature,
        timeout,
        maxRetries: 3, // Enable retries for rate limits
        openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
        configuration: {
          timeout: timeout, // Axios timeout configuration
          maxRetries: 3, // Enable retries for rate limits
        },
      });
    }

    // Fallback to OpenAI

    return new ChatOpenAI({
      modelName: 'gpt-4',
      temperature,
      timeout,
      maxRetries: 3, // Enable retries for rate limits
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
      configuration: {
        timeout: timeout, // Axios timeout configuration
        maxRetries: 3, // Enable retries for rate limits
      },
    });
  }

  /**
   * Execute a simple LLM call with system and user messages
   */
  async executeSimpleCall(
    systemPrompt: string,
    userMessage: string,
    options?: {
      provider?: string;
      model?: string;
      temperature?: number;
    },
  ): Promise<string> {
    try {
      const llm = this.getLLM(options);

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userMessage),
      ];

      const response = await llm.invoke(messages);
      return response.content as string;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Check if LangChain is properly configured
   */
  isConfigured(): boolean {
    const hasOpenAIKey = !!this.configService.get<string>('OPENAI_API_KEY');

    if (!hasOpenAIKey) {

    }

    return hasOpenAIKey;
  }

  /**
   * Get available LLM providers
   */
  getAvailableProviders(): string[] {
    const providers = ['openai'];

    // Could add more providers based on available API keys
    // if (this.configService.get<string>('ANTHROPIC_API_KEY')) {
    //   providers.push('anthropic');
    // }

    return providers;
  }
}
