import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SupabaseService } from '../supabase/supabase.service';
import { CIDAFMService } from '../cidafm/cidafm.service';
import {
  Provider,
  Model,
  CostCalculation,
  LLMUsageMetrics,
  CIDAFMOptions,
} from '../types/llm-evaluation';
import {
  mapProviderFromDb,
  mapModelFromDb,
} from '../utils/case-converter';

// Explicitly set LangSmith environment variables for automatic tracing
// Support both the official LangSmith env vars and our custom ones for backward compatibility
const langsmithEnabled =
  process.env.LANGSMITH_TRACING === 'true' ||
  process.env.LANGSMITH_ENABLED === 'true';
const langsmithApiKey = process.env.LANGSMITH_API_KEY;
const langsmithProject =
  process.env.LANGSMITH_PROJECT ||
  process.env.LANGSMITH_PROJECT_NAME ||
  'orchestrator-ai';

if (langsmithEnabled && langsmithApiKey) {
  process.env.LANGCHAIN_TRACING_V2 = 'true';
  process.env.LANGCHAIN_API_KEY = langsmithApiKey;
  process.env.LANGCHAIN_PROJECT = langsmithProject;
  if (process.env.LANGSMITH_ENDPOINT) {
    process.env.LANGCHAIN_ENDPOINT = process.env.LANGSMITH_ENDPOINT;
  }
  console.log('🔧 LangSmith environment variables set for automatic tracing:');
  console.log(`- LANGCHAIN_TRACING_V2: ${process.env.LANGCHAIN_TRACING_V2}`);
  console.log(`- LANGCHAIN_PROJECT: ${process.env.LANGCHAIN_PROJECT}`);
  console.log(
    `- LANGCHAIN_API_KEY: ${process.env.LANGCHAIN_API_KEY ? 'SET' : 'NOT SET'}`,
  );
  console.log(
    `- LANGCHAIN_ENDPOINT: ${process.env.LANGCHAIN_ENDPOINT || 'DEFAULT'}`,
  );
}

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly cidafmService: CIDAFMService,
  ) {
    this.logger.log('🔄 LLMService constructor starting...');
    this.logger.log(
      `- OpenAI API Key available: ${!!process.env.OPENAI_API_KEY}`,
    );

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.logger.log('✅ OpenAI client created');
    this.logger.log(
      '✅ LLMService initialized - LangChain LLMs will automatically trace to LangSmith',
    );
  }

  /**
   * Simple LLM call with system and user messages - using LangChain for automatic LangSmith tracing
   */
  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      provider?: 'openai' | 'anthropic' | 'ollama' | 'google';
    },
  ): Promise<string> {
    try {
      this.logger.log(
        `🔄 generateResponse called - using LangChain LLM for automatic LangSmith tracing`,
      );
      this.logger.debug(
        `Generating LLM response for message: ${userMessage.substring(0, 100)}...`,
      );

      // Use LangChain LLM instead of raw OpenAI - this gets automatic LangSmith tracing
      const llm =
        options?.temperature || options?.maxTokens || options?.provider
          ? this.createCustomLangGraphLLM({
              provider: options?.provider || 'openai',
              temperature: options?.temperature,
              maxTokens: options?.maxTokens,
            })
          : this.getLangGraphLLM(options?.provider || 'openai');

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userMessage },
      ];

      this.logger.log(
        `✅ Using LangChain ChatOpenAI for automatic LangSmith tracing`,
      );

      const response = await llm.invoke(messages);
      const content =
        (response.content as string) ||
        'I apologize, but I was unable to generate a response.';

      this.logger.debug(
        `LLM response generated successfully (${content.length} characters)`,
      );
      return content;
    } catch (error) {
      this.logger.error('Error generating LLM response:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`LLM service error: ${errorMessage}`);
    }
  }

  /**
   * Enhanced LLM call with dynamic provider/model selection, CIDAFM processing, and cost tracking
   */
  async generateEnhancedResponse(
    userId: string,
    systemPrompt: string,
    userMessage: string,
    options?: {
      providerId?: string;
      modelId?: string;
      cidafmOptions?: CIDAFMOptions;
      sessionId?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<{
    content: string;
    usage: LLMUsageMetrics;
    costCalculation: CostCalculation;
    langsmithRunId?: string;
    processedPrompt: string;
    cidafmState?: any;
  }> {
    const startTime = Date.now();

    try {
      this.logger.log(
        '🔄 generateEnhancedResponse called with dynamic LLM selection',
      );

      // Get provider and model information from database
      const { provider, model } = await this.getProviderAndModel(
        options?.providerId,
        options?.modelId,
      );

      // Process CIDAFM commands if provided
      let processedPrompt = userMessage;
      let cidafmState: any = {};

      if (options?.cidafmOptions || options?.sessionId) {
        const cidafmResult = await this.cidafmService.processMessage(
          userId,
          userMessage,
          options.cidafmOptions,
          options.sessionId,
        );

        processedPrompt = cidafmResult.modifiedPrompt;
        cidafmState = {
          activeStateModifiers: cidafmResult.activeStateModifiers,
          executedCommands: cidafmResult.executedCommands,
          processingNotes: cidafmResult.processingNotes,
        };
      }

      // Create LLM instance with dynamic configuration
      const llm = await this.createLLMFromModel(model, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      // Apply state modifiers to system prompt if any
      const enhancedSystemPrompt = this.applyStateModifiersToPrompt(
        systemPrompt,
        cidafmState.activeStateModifiers || [],
      );

      const messages = [
        { role: 'system' as const, content: enhancedSystemPrompt },
        { role: 'user' as const, content: processedPrompt },
      ];

      this.logger.log(
        `✅ Using ${model.name} (${provider.name}) for enhanced response`,
      );

      // Generate response with token counting
      const response = await llm.invoke(messages);
      const content =
        (response.content as string) ||
        'I apologize, but I was unable to generate a response.';

      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;

      // Calculate token usage (simplified estimation)
      const inputTokens = this.estimateTokens(
        enhancedSystemPrompt + processedPrompt,
      );
      const outputTokens = this.estimateTokens(content);

      // Calculate costs
      const costCalculation = this.calculateCost(
        inputTokens,
        outputTokens,
        model.pricingInputPer1k || 0,
        model.pricingOutputPer1k || 0,
      );

      const usage: LLMUsageMetrics = {
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        totalCost: costCalculation.totalCost,
        responseTimeMs: responseTimeMs,
        // langsmithRunId would be extracted from LangSmith tracing
      };

      this.logger.debug(
        `Enhanced response generated: ${content.length} chars, ${inputTokens + outputTokens} tokens, $${costCalculation.totalCost.toFixed(6)}`,
      );

      return {
        content,
        usage,
        costCalculation,
        processedPrompt,
        cidafmState,
      };
    } catch (error) {
      this.logger.error('Error generating enhanced LLM response:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Enhanced LLM service error: ${errorMessage}`);
    }
  }

  /**
   * Enhanced LLM call with conversation history support - using LangChain for automatic LangSmith tracing
   */
  async generateResponseWithHistory(
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    currentMessage: string,
  ): Promise<string> {
    try {
      this.logger.log(
        `🔄 generateResponseWithHistory called - using LangChain LLM for automatic LangSmith tracing`,
      );
      this.logger.debug(
        `Generating LLM response with history (${conversationHistory.length} messages) for: ${currentMessage.substring(0, 100)}...`,
      );

      // Use LangChain LLM instead of raw OpenAI - this gets automatic LangSmith tracing
      const llm = this.getLangGraphLLM('openai');

      // Build messages array with system prompt, conversation history, and current message
      const messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }> = [
        {
          role: 'system',
          content: systemPrompt,
        },
      ];

      // Add conversation history
      conversationHistory.forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });

      // Add current message
      messages.push({
        role: 'user',
        content: currentMessage,
      });

      this.logger.log(
        `✅ Using LangChain ChatOpenAI with history for automatic LangSmith tracing`,
      );

      const response = await llm.invoke(messages);
      const content =
        (response.content as string) ||
        'I apologize, but I was unable to generate a response.';

      this.logger.debug(
        `LLM response with history generated successfully (${content.length} characters)`,
      );
      return content;
    } catch (error) {
      this.logger.error('Error generating LLM response with history:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`LLM service error: ${errorMessage}`);
    }
  }



  /**
   * Get a LangGraph-compatible LLM instance for the specified provider with automatic LangSmith tracing
   */
  getLangGraphLLM(
    provider: 'openai' | 'anthropic' | 'ollama' | 'google' = 'openai',
  ): BaseChatModel {
    try {
      let llm: BaseChatModel;

      switch (provider) {
        case 'openai':
          llm = new ChatOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
          });
          break;

        case 'anthropic':
          llm = new ChatAnthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
            temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
            maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000'),
          });
          break;

        case 'ollama':
          llm = new ChatOllama({
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'llama2',
            temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
          });
          break;

        case 'google':
          llm = new ChatGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_API_KEY,
            model: process.env.GOOGLE_MODEL || 'gemini-pro',
            temperature: parseFloat(process.env.GOOGLE_TEMPERATURE || '0.7'),
            maxOutputTokens: parseInt(process.env.GOOGLE_MAX_TOKENS || '2000'),
          });
          break;

        default:
          this.logger.warn(
            `Unknown provider: ${provider}, falling back to OpenAI`,
          );
          llm = this.getLangGraphLLM('openai');
      }

      // LangSmith will automatically trace this LangChain LLM if environment variables are set
      return llm;
    } catch (error) {
      this.logger.error(
        `Error creating LangGraph LLM for provider ${provider}:`,
        error,
      );
      throw new Error(
        `Failed to create LangGraph LLM: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create a LangGraph LLM instance with custom configuration and automatic LangSmith tracing
   */
  createCustomLangGraphLLM(config: {
    provider: 'openai' | 'anthropic' | 'ollama' | 'google';
    model?: string;
    temperature?: number;
    maxTokens?: number;
    apiKey?: string;
    baseUrl?: string;
  }): BaseChatModel {
    try {
      let llm: BaseChatModel;

      switch (config.provider) {
        case 'openai':
          llm = new ChatOpenAI({
            apiKey: config.apiKey || process.env.OPENAI_API_KEY,
            model: config.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            temperature:
              config.temperature ??
              parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
            maxTokens:
              config.maxTokens ??
              parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
          });
          break;

        case 'anthropic':
          llm = new ChatAnthropic({
            apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
            model:
              config.model ||
              process.env.ANTHROPIC_MODEL ||
              'claude-3-sonnet-20240229',
            temperature:
              config.temperature ??
              parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
            maxTokens:
              config.maxTokens ??
              parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000'),
          });
          break;

        case 'ollama':
          llm = new ChatOllama({
            baseUrl:
              config.baseUrl ||
              process.env.OLLAMA_BASE_URL ||
              'http://localhost:11434',
            model: config.model || process.env.OLLAMA_MODEL || 'llama2',
            temperature:
              config.temperature ??
              parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
          });
          break;

        case 'google':
          llm = new ChatGoogleGenerativeAI({
            apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
            model: config.model || process.env.GOOGLE_MODEL || 'gemini-pro',
            temperature:
              config.temperature ??
              parseFloat(process.env.GOOGLE_TEMPERATURE || '0.7'),
            maxOutputTokens:
              config.maxTokens ??
              parseInt(process.env.GOOGLE_MAX_TOKENS || '2000'),
          });
          break;

        default:
          throw new Error(`Unsupported provider: ${config.provider}`);
      }

      // LangSmith will automatically trace this LangChain LLM if environment variables are set
      return llm;
    } catch (error) {
      this.logger.error(`Error creating custom LangGraph LLM:`, error);
      throw new Error(
        `Failed to create custom LangGraph LLM: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get provider and model from database by IDs, with fallback to defaults
   */
  private async getProviderAndModel(
    providerId?: string,
    modelId?: string,
  ): Promise<{ provider: Provider; model: Model }> {
    const client = this.supabaseService.getServiceClient();

    // If both are provided, fetch them
    if (providerId && modelId) {
      const [providerResult, modelResult] = await Promise.all([
        client.from('providers').select('*').eq('id', providerId).single(),
        client.from('models').select('*').eq('id', modelId).single(),
      ]);

      if (providerResult.data && modelResult.data) {
        return {
          provider: mapProviderFromDb(providerResult.data),
          model: mapModelFromDb(modelResult.data),
        };
      }
    }

    // Fallback to default OpenAI GPT-4o mini
    const { data: defaultProvider } = await client
      .from('providers')
      .select('*')
      .eq('name', 'OpenAI')
      .single();

    const { data: defaultModel } = await client
      .from('models')
      .select('*')
      .eq('model_id', 'gpt-4o-mini')
      .single();

    if (!defaultProvider || !defaultModel) {
      throw new Error('Default provider/model not found in database');
    }

    return {
      provider: mapProviderFromDb(defaultProvider),
      model: mapModelFromDb(defaultModel),
    };
  }

  /**
   * Create LLM instance from database model configuration
   */
  private async createLLMFromModel(
    model: Model,
    overrides?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<BaseChatModel> {
    const client = this.supabaseService.getServiceClient();

    // Get provider details
    const { data: provider } = await client
      .from('providers')
      .select('*')
      .eq('id', model.providerId)
      .single();

    if (!provider) {
      throw new Error(`Provider not found for model ${model.name}`);
    }

    const mappedProvider = mapProviderFromDb(provider);

    // Map provider names to our LLM creation logic
    const providerMap: Record<string, string> = {
      OpenAI: 'openai',
      Anthropic: 'anthropic',
      Google: 'google',
      Ollama: 'ollama',
      'X.AI (Grok)': 'openai', // Grok uses OpenAI-compatible API
      Groq: 'openai', // Groq uses OpenAI-compatible API
      'Together AI': 'openai', // Together AI uses OpenAI-compatible API
      Cohere: 'openai', // Cohere can use OpenAI-compatible API
      Mistral: 'openai', // Mistral uses OpenAI-compatible API
    };

    const providerType = providerMap[mappedProvider.name] || 'openai';

    return this.createCustomLangGraphLLM({
      provider: providerType as any,
      model: model.modelId,
      temperature: overrides?.temperature,
      maxTokens: overrides?.maxTokens || model.maxTokens,
      baseUrl: mappedProvider.apiBaseUrl,
    });
  }

  /**
   * Apply CIDAFM state modifiers to system prompt
   */
  private applyStateModifiersToPrompt(
    systemPrompt: string,
    activeModifiers: string[],
  ): string {
    let enhancedPrompt = systemPrompt;

    for (const modifier of activeModifiers) {
      switch (modifier) {
        case 'token-efficient':
          enhancedPrompt +=
            '\n\n[CIDAFM: Be concise and token-efficient while preserving clarity and relevance.]';
          break;
        case 'disciplined':
          enhancedPrompt +=
            '\n\n[CIDAFM: Follow explicit user instructions only. Do not make assumptions. Request clarification if unclear.]';
          break;
        case 'context-independent':
          enhancedPrompt +=
            '\n\n[CIDAFM: Provide all necessary context for complete understanding without relying on external information.]';
          break;
        case 'friendly':
          enhancedPrompt +=
            '\n\n[CIDAFM: Use a warm, personable, and conversational tone in your response.]';
          break;
        case 'professional':
          enhancedPrompt +=
            '\n\n[CIDAFM: Maintain a formal, business-appropriate tone and structure.]';
          break;
        case 'technical':
          enhancedPrompt +=
            '\n\n[CIDAFM: Focus on technical accuracy and precision. Include relevant technical details.]';
          break;
        case 'educational':
          enhancedPrompt +=
            '\n\n[CIDAFM: Structure response to be educational, explaining concepts step-by-step.]';
          break;
        default:
          // Custom user modifier
          enhancedPrompt += `\n\n[CIDAFM: Apply custom behavior modifier "${modifier}".]`;
      }
    }

    return enhancedPrompt;
  }

  /**
   * Simple token estimation (4 characters ≈ 1 token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost based on token usage and pricing
   */
  private calculateCost(
    inputTokens: number,
    outputTokens: number,
    inputPricePer1k: number,
    outputPricePer1k: number,
  ): CostCalculation {
    const inputCost = (inputTokens / 1000) * inputPricePer1k;
    const outputCost = (outputTokens / 1000) * outputPricePer1k;

    return {
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      inputCost: inputCost,
      outputCost: outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
    };
  }

}
