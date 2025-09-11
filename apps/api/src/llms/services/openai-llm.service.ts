import { Injectable, Logger } from '@nestjs/common';
import { BaseLLMService } from './base-llm.service';
import { 
  GenerateResponseParams, 
  LLMResponse, 
  LLMServiceConfig,
  ResponseMetadata 
} from './llm-interfaces';
import { PIIService } from '../../services/pii.service';
import { DictionaryPseudonymizerService, DictionaryPseudonymMapping } from '../../services/dictionary-pseudonymizer.service';
import { RunMetadataService } from '../run-metadata.service';
import { ProviderConfigService } from '../provider-config.service';
import OpenAI from 'openai';

/**
 * OpenAI-specific response metadata extension
 */
interface OpenAIResponseMetadata extends ResponseMetadata {
  providerSpecific: {
    finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter' | 'null';
    system_fingerprint?: string;
    model_version?: string;
    logprobs?: any;
    // OpenAI usage details
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * OpenAI LLM Service Implementation
 * 
 * This example shows how to extend BaseLLMService for OpenAI-specific functionality
 * while maintaining compatibility with the standardized interface.
 */
@Injectable()
export class OpenAILLMService extends BaseLLMService {
  private openai: OpenAI;

  constructor(
    config: LLMServiceConfig,
    piiService: PIIService,
    dictionaryPseudonymizerService: DictionaryPseudonymizerService,
    runMetadataService: RunMetadataService,
    providerConfigService: ProviderConfigService,
  ) {
    super(
      config,
      piiService,
      dictionaryPseudonymizerService,
      runMetadataService,
      providerConfigService,
    );

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
  }

  /**
   * Implementation of the abstract generateResponse method for OpenAI
   */
  async generateResponse(params: GenerateResponseParams): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId('openai');
    
    try {
      // Validate configuration
      this.validateConfig(params.config);
      
      // Handle PII in input - ALWAYS apply dictionary pseudonymization
      let piiResult;
      if (params.options?.piiMetadata) {
        // Use existing PII metadata from centralized routing, but still apply dictionary pseudonymization
        this.logger.debug(`🔍 [PII-METADATA-DEBUG] OpenAILLMService - Using existing PII metadata from routing decision`);
        
        // Apply dictionary pseudonymization to the original text
        const dictionaryResult = await this.dictionaryPseudonymizerService.pseudonymizeText(params.userMessage);
        
        piiResult = {
          processedText: dictionaryResult.pseudonymizedText,
          piiMetadata: params.options.piiMetadata,
          dictionaryMappings: dictionaryResult.mappings, // Store for reversal
        };
        
        this.logger.debug(`🎯 [DICTIONARY-DEBUG] Applied dictionary pseudonymization: ${dictionaryResult.mappings.length} replacements`);
      } else {
        // Fallback to local PII processing with dictionary pseudonymization enabled
        this.logger.debug(`🔍 [PII-METADATA-DEBUG] OpenAILLMService - No existing PII metadata, performing local processing`);
        piiResult = await this.handlePiiInput(params.userMessage, {
          enablePseudonymization: true,
          useDictionaryPseudonymizer: true, // Enable dictionary pseudonymization
        });
      }
      
      // Normalize config for model-specific restrictions
      const normalizedConfig = this.normalizeConfigForModel(params.config);

      // Prepare OpenAI request with model-specific handling
      const messages = this.prepareMessagesForModel(
        normalizedConfig.model,
        params.systemPrompt,
        piiResult.processedText
      );

      // Build API request parameters, respecting model restrictions
      const apiParams: any = {
        model: normalizedConfig.model,
        messages,
        stream: false,
      };

      // Only add temperature if the normalized config includes it
      if (normalizedConfig.temperature !== undefined) {
        apiParams.temperature = normalizedConfig.temperature;
      }

      // Add max_tokens if specified
      if (params.options?.maxTokens ?? normalizedConfig.maxTokens) {
        apiParams.max_tokens = params.options?.maxTokens ?? normalizedConfig.maxTokens;
      }

      // Make OpenAI API call
      const completion = await this.openai.chat.completions.create(apiParams);

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No content in OpenAI response');
      }

      // Handle PII in output (pseudonym reversal)
      // Handle PII output and dictionary reversal
      let finalContent = await this.handlePiiOutput(choice.message.content, requestId);
      
      // Apply dictionary reversal if we have mappings
      if ('dictionaryMappings' in piiResult && piiResult.dictionaryMappings && piiResult.dictionaryMappings.length > 0) {
        this.logger.debug(`🎯 [DICTIONARY-DEBUG] Reversing dictionary pseudonyms: ${piiResult.dictionaryMappings.length} mappings`);
        const reversalResult = await this.dictionaryPseudonymizerService.reversePseudonyms(finalContent, piiResult.dictionaryMappings);
        finalContent = reversalResult.originalText;
        this.logger.debug(`🎯 [DICTIONARY-DEBUG] Dictionary reversal completed: ${reversalResult.reversalCount} reversals`);
      }
      
      const endTime = Date.now();
      
      // Create OpenAI-specific metadata
      const metadata = this.createOpenAIMetadata(
        completion,
        params,
        startTime,
        endTime,
        requestId
      );
      
      // Debug PII metadata before passing to trackUsage
      this.logger.debug(`🔍 [PII-METADATA-DEBUG] OpenAILLMService - piiResult structure:`, {
        hasPiiResult: !!piiResult,
        hasPiiMetadata: !!piiResult?.piiMetadata,
        piiDetected: piiResult?.piiMetadata?.piiDetected,
        processingFlow: piiResult?.piiMetadata?.processingFlow
      });
      
      if (piiResult?.piiMetadata) {
        this.logger.debug(`🔍 [PII-METADATA-DEBUG] OpenAILLMService - Full piiMetadata:`, piiResult.piiMetadata);
      }
      
      // Track usage with full metadata for database persistence
      await this.trackUsage(
        params.config.provider,
        params.config.model,
        metadata.usage.inputTokens,
        metadata.usage.outputTokens,
        metadata.usage.cost,
        {
          requestId,
          userId: params.userId || params.options?.userId,
          conversationId: params.conversationId || params.options?.conversationId,
          callerType: params.options?.callerType,
          callerName: params.options?.callerName,
          piiMetadata: piiResult.piiMetadata,
          startTime,
          endTime,
        }
      );
      
      const response: LLMResponse = {
        content: finalContent,
        metadata,
        piiMetadata: piiResult.piiMetadata,
      };
      
      // Optional LangSmith integration
      const langsmithRunId = await this.integrateLangSmith(params, response);
      if (langsmithRunId) {
        response.metadata.langsmithRunId = langsmithRunId;
      }
      
      // Log request/response
      this.logRequestResponse(params, response, metadata.timing.duration);
      
      return response;
    } catch (error) {
      this.handleError(error, 'OpenAILLMService.generateResponse');
    }
  }

  /**
   * Check if a model is part of the o1 series (with special restrictions)
   */
  private isO1SeriesModel(model: string): boolean {
    return model.startsWith('o1-') || model === 'o4-mini';
  }

  /**
   * Normalize configuration for OpenAI model-specific restrictions
   */
  private normalizeConfigForModel(config: LLMServiceConfig): LLMServiceConfig {
    const normalizedConfig = { ...config };

    if (this.isO1SeriesModel(config.model)) {
      // o1 models don't support temperature
      if (normalizedConfig.temperature !== undefined) {
        this.logger.debug(
          `OpenAI o1 model ${config.model} doesn't support temperature, removing: ${normalizedConfig.temperature}`
        );
        delete normalizedConfig.temperature;
      }
    }

    return normalizedConfig;
  }

  /**
   * Prepare messages for OpenAI API based on model capabilities
   * o1 models don't support system messages, so we combine them into user messages
   */
  private prepareMessagesForModel(
    model: string,
    systemPrompt: string,
    userMessage: string
  ): Array<{ role: 'system' | 'user'; content: string }> {
    if (this.isO1SeriesModel(model)) {
      // o1 models don't support system messages - combine into user message
      this.logger.debug(
        `OpenAI o1 model ${model} doesn't support system messages, combining with user message`
      );
      
      return [
        { 
          role: 'user' as const, 
          content: `${systemPrompt}\n\n${userMessage}` 
        }
      ];
    }

    // Standard models support system messages
    return [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage }
    ];
  }

  /**
   * Create OpenAI-specific metadata with provider-specific fields
   */
  private createOpenAIMetadata(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    params: GenerateResponseParams,
    startTime: number,
    endTime: number,
    requestId: string
  ): OpenAIResponseMetadata {
    const choice = completion.choices[0];
    const usage = completion.usage;
    
    return {
      provider: 'openai',
      model: completion.model,
      requestId,
      timestamp: new Date().toISOString(),
      usage: {
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        cost: this.calculateCost('openai', completion.model, usage?.prompt_tokens || 0, usage?.completion_tokens || 0),
      },
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
      tier: params.options?.preferLocal ? 'local' : 'external',
      status: 'completed',
      // OpenAI-specific fields
      providerSpecific: {
        finish_reason: choice?.finish_reason as any,
        system_fingerprint: completion.system_fingerprint,
        model_version: completion.model,
        logprobs: choice?.logprobs,
        // Include actual token counts from OpenAI
        prompt_tokens: usage?.prompt_tokens,
        completion_tokens: usage?.completion_tokens,
        total_tokens: usage?.total_tokens,
      },
    };
  }

  /**
   * Override LangSmith integration for OpenAI-specific tracing
   */
  protected async integrateLangSmith(
    params: GenerateResponseParams,
    response: LLMResponse
  ): Promise<string | undefined> {
    // Example OpenAI-specific LangSmith integration
    if (process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_TRACING === 'true') {
      try {
        // This would integrate with LangSmith for OpenAI-specific tracing
        const runId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.logger.debug(`LangSmith integration for OpenAI: ${runId}`);
        return runId;
      } catch (error) {
        this.logger.warn('LangSmith integration failed:', error);
      }
    }
    return undefined;
  }

  /**
   * OpenAI-specific configuration validation
   */
  protected validateConfig(config: LLMServiceConfig): void {
    super.validateConfig(config);
    
    if (config.provider !== 'openai') {
      throw new Error('OpenAILLMService requires provider to be "openai"');
    }
    
    if (!config.apiKey && !process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required');
    }
    
    // Validate OpenAI-specific model names
    const validModels = [
      'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini',
      'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'
    ];
    
    if (!validModels.some(model => config.model.startsWith(model))) {
      this.logger.warn(`Unknown OpenAI model: ${config.model}. Proceeding anyway.`);
    }
  }
}

/**
 * Factory function to create OpenAI service instances
 */
export function createOpenAIService(
  config: LLMServiceConfig,
  dependencies: {
    piiService: PIIService;
    dictionaryPseudonymizerService: DictionaryPseudonymizerService;
    runMetadataService: RunMetadataService;
    providerConfigService: ProviderConfigService;
  }
): OpenAILLMService {
  return new OpenAILLMService(
    { ...config, provider: 'openai' },
    dependencies.piiService,
    dependencies.dictionaryPseudonymizerService,
    dependencies.runMetadataService,
    dependencies.providerConfigService,
  );
}

/**
 * Example usage and testing
 */
export async function testOpenAIService() {
  // This would be used in your tests to verify the OpenAI implementation
  const config: LLMServiceConfig = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1000,
  };

  // Mock dependencies for testing
  const mockDependencies = {
    piiService: {} as PIIService,
    dictionaryPseudonymizerService: {} as DictionaryPseudonymizerService,
    runMetadataService: {} as RunMetadataService,
    providerConfigService: {} as ProviderConfigService,
  };

  const service = createOpenAIService(config, mockDependencies);
  
  const params: GenerateResponseParams = {
    systemPrompt: 'You are a helpful assistant.',
    userMessage: 'Hello, how are you?',
    config,
    conversationId: 'test-conversation',
  };

  try {
    const response = await service.generateResponse(params);
    console.log('OpenAI Response:', response.content);
    console.log('Metadata:', response.metadata);
    return response;
  } catch (error) {
    console.error('OpenAI Service Error:', error);
    throw error;
  }
}
