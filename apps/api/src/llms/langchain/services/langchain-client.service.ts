import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMService } from '@/llms/llm.service';
import { isLLMResponse } from '@/llms/services/llm-interfaces';

/**
 * LangChain Client Service
 *
 * Adapter service that provides LangChain-compatible interface while using
 * our centralized LLMService for intelligent routing and monitoring.
 * All LLM calls are routed through the centralized service for consistency.
 */
@Injectable()
export class LangChainClientService {
  private readonly logger = new Logger(LangChainClientService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * Execute a simple LLM call with system and user messages
   * Now uses centralized LLMService for consistent routing and monitoring
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
    // Use centralized LLMService instead of direct LangChain client
    const result = await this.llmService.generateResponse(
      systemPrompt,
      userMessage,
      {
        temperature: options?.temperature || 0.7,
        provider: options?.provider as
          | 'openai'
          | 'anthropic'
          | 'google'
          | 'ollama', // Only specify if explicitly requested
        modelName: options?.model, // Only specify if explicitly requested
        complexity: 'simple', // LangChain tool operations are typically simple
        callerType: 'service',
        callerName: 'langchain-client-service',
        dataClassification: 'internal',
      },
    );

    if (typeof result === 'string') {
      return result;
    }

    if (isLLMResponse(result)) {
      return result.content;
    }

    return String(result ?? '');
  }

  /**
   * Check if LangChain client is properly configured
   * Now delegates to centralized LLMService availability
   */
  isConfigured(): boolean {
    // Since we now use centralized LLMService, we're always "configured"
    // The LLMService handles provider availability and fallbacks
    return true;
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
