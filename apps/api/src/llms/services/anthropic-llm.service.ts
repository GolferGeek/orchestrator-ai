import { Injectable, Logger } from '@nestjs/common';
import { BaseLLMService } from './base-llm.service';
import { 
  GenerateResponseParams, 
  LLMResponse, 
  LLMServiceConfig,
  ResponseMetadata 
} from './llm-interfaces';
import { PIIService } from '../../services/pii.service';
import { PseudonymizerService } from '../../services/pseudonymizer.service';
import { DictionaryPseudonymizerService } from '../../services/dictionary-pseudonymizer.service';
import { RunMetadataService } from '../run-metadata.service';
import { ProviderConfigService } from '../provider-config.service';
import Anthropic from '@anthropic-ai/sdk';
import { LLMErrorMapper } from './llm-error-handling';

/**
 * Anthropic-specific response metadata extension
 */
interface AnthropicResponseMetadata extends ResponseMetadata {
  providerSpecific: {
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
    stop_sequence?: string;
    model_version?: string;
    // Anthropic usage details
    input_tokens?: number;
    output_tokens?: number;
    // Anthropic-specific fields
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

/**
 * Anthropic LLM Service Implementation
 * 
 * This example shows how to extend BaseLLMService for Anthropic Claude models
 * with provider-specific functionality and metadata handling.
 */
@Injectable()
export class AnthropicLLMService extends BaseLLMService {
  private anthropic: Anthropic;

  constructor(
    config: LLMServiceConfig,
    piiService: PIIService,
    pseudonymizerService: PseudonymizerService,
    dictionaryPseudonymizerService: DictionaryPseudonymizerService,
    runMetadataService: RunMetadataService,
    providerConfigService: ProviderConfigService,
  ) {
    super(
      config,
      piiService,
      pseudonymizerService,
      dictionaryPseudonymizerService,
      runMetadataService,
      providerConfigService,
    );

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config.baseUrl,
    });
  }

  /**
   * Implementation of the abstract generateResponse method for Anthropic
   */
  async generateResponse(params: GenerateResponseParams): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId('anthropic');
    
    try {
      // Validate configuration
      this.validateConfig(params.config);
      
      // Handle PII in input
      const piiResult = await this.handlePiiInput(params.userMessage, {
        enablePseudonymization: true,
        useDictionaryPseudonymizer: true, // Anthropic example uses dictionary pseudonymizer
      });
      
      // Prepare Anthropic request
      const messages: Anthropic.Messages.MessageParam[] = [
        { role: 'user', content: piiResult.processedText },
      ];

      // Make Anthropic API call
      const completion = await this.anthropic.messages.create({
        model: params.config.model,
        messages,
        system: params.systemPrompt,
        temperature: params.options?.temperature ?? params.config.temperature ?? 0.7,
        max_tokens: params.options?.maxTokens ?? params.config.maxTokens ?? 1000,
      });

      if (!completion.content || completion.content.length === 0) {
        throw new Error('No content in Anthropic response');
      }

      // Extract text content (Anthropic returns array of content blocks)
      const textContent = completion.content
        .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      if (!textContent) {
        throw new Error('No text content in Anthropic response');
      }

      // Handle PII in output (pseudonym reversal)
      const finalContent = await this.handlePiiOutput(textContent, requestId, piiResult.piiMetadata as any);
      
      const endTime = Date.now();
      
      // Create Anthropic-specific metadata
      const metadata = this.createAnthropicMetadata(
        completion,
        params,
        startTime,
        endTime,
        requestId
      );
      
      // Track usage
      this.trackUsage(
        params.config.provider,
        params.config.model,
        metadata.usage.inputTokens,
        metadata.usage.outputTokens,
        metadata.usage.cost,
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
      this.handleError(error, 'AnthropicLLMService.generateResponse');
    }
  }

  /**
   * Create Anthropic-specific metadata with provider-specific fields
   */
  private createAnthropicMetadata(
    completion: Anthropic.Messages.Message,
    params: GenerateResponseParams,
    startTime: number,
    endTime: number,
    requestId: string
  ): AnthropicResponseMetadata {
    const usage = completion.usage;
    
    return {
      provider: 'anthropic',
      model: completion.model,
      requestId,
      timestamp: new Date().toISOString(),
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
        cost: this.calculateCost('anthropic', completion.model, usage.input_tokens, usage.output_tokens),
      },
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
      tier: params.options?.preferLocal ? 'local' : 'external',
      status: 'completed',
      // Anthropic-specific fields
      providerSpecific: {
        stop_reason: completion.stop_reason as any,
        stop_sequence: completion.stop_sequence || undefined,
        model_version: completion.model,
        // Include actual token counts from Anthropic
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        usage: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
        },
      },
    };
  }

  /**
   * Override LangSmith integration for Anthropic-specific tracing
   */
  protected async integrateLangSmith(
    params: GenerateResponseParams,
    response: LLMResponse
  ): Promise<string | undefined> {
    // Example Anthropic-specific LangSmith integration
    if (process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_TRACING === 'true') {
      try {
        // This would integrate with LangSmith for Anthropic-specific tracing
        const runId = `anthropic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.logger.debug(`LangSmith integration for Anthropic: ${runId}`);
        return runId;
      } catch (error) {
        this.logger.warn('LangSmith integration failed:', error);
      }
    }
    return undefined;
  }

  /**
   * Anthropic-specific configuration validation
   */
  protected validateConfig(config: LLMServiceConfig): void {
    super.validateConfig(config);
    
    if (config.provider !== 'anthropic') {
      throw new Error('AnthropicLLMService requires provider to be "anthropic"');
    }
    
    if (!config.apiKey && !process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key is required');
    }
    
    // Validate Anthropic-specific model names
    const validModels = [
      'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'
    ];
    
    if (!validModels.some(model => config.model.includes(model.split('-').slice(0, 3).join('-')))) {
      this.logger.warn(`Unknown Anthropic model: ${config.model}. Proceeding anyway.`);
    }
  }

  /**
   * Anthropic-specific error handling
   */
  protected handleError(error: any, context: string): never {
    // Map to standardized error and delegate to base handler
    try {
      const mapped = LLMErrorMapper.fromAnthropicError(error, 'anthropic', this.config?.model);
      super.handleError(mapped, context);
    } catch {
      super.handleError(error, context);
    }
  }
}

/**
 * Factory function to create Anthropic service instances
 */
export function createAnthropicService(
  config: LLMServiceConfig,
  dependencies: {
    piiService: PIIService;
    pseudonymizerService: PseudonymizerService;
    dictionaryPseudonymizerService: DictionaryPseudonymizerService;
    runMetadataService: RunMetadataService;
    providerConfigService: ProviderConfigService;
  }
): AnthropicLLMService {
  return new AnthropicLLMService(
    { ...config, provider: 'anthropic' },
    dependencies.piiService,
    dependencies.pseudonymizerService,
    dependencies.dictionaryPseudonymizerService,
    dependencies.runMetadataService,
    dependencies.providerConfigService,
  );
}

/**
 * Example usage and testing
 */
export async function testAnthropicService() {
  // This would be used in your tests to verify the Anthropic implementation
  const config: LLMServiceConfig = {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 1000,
  };

  // Mock dependencies for testing
  const mockDependencies = {
    piiService: {} as PIIService,
    pseudonymizerService: {} as PseudonymizerService,
    dictionaryPseudonymizerService: {} as DictionaryPseudonymizerService,
    runMetadataService: {} as RunMetadataService,
    providerConfigService: {} as ProviderConfigService,
  };

  const service = createAnthropicService(config, mockDependencies);
  
  const params: GenerateResponseParams = {
    systemPrompt: 'You are Claude, an AI assistant created by Anthropic.',
    userMessage: 'Hello, how are you today?',
    config,
    conversationId: 'test-conversation',
  };

  try {
    const response = await service.generateResponse(params);
    console.log('Anthropic Response:', response.content);
    console.log('Metadata:', response.metadata);
    return response;
  } catch (error) {
    console.error('Anthropic Service Error:', error);
    throw error;
  }
}
