import { Injectable, Logger } from '@nestjs/common';
import { PIIService } from '../services/pii.service';
import { PseudonymizerService } from '../services/pseudonymizer.service';
import { DictionaryPseudonymizerService } from '../services/dictionary-pseudonymizer.service';
import { RunMetadataService } from './run-metadata.service';
import { ProviderConfigService } from './provider-config.service';
import { PIIProcessingMetadata } from '../common/types/pii-metadata.types';
import {
  LLMServiceConfig,
  GenerateResponseParams,
  LLMResponse,
  ResponseMetadata,
  PiiOptions,
} from './llm-interfaces';

/**
 * Abstract base class for all LLM service implementations
 * 
 * This class provides a consistent interface and shared functionality
 * across all provider-specific LLM services, including:
 * - Standardized response format
 * - PII processing integration
 * - Logging and error handling
 * - Cost tracking hooks
 * - Metadata management
 */
@Injectable()
export abstract class BaseLLMService {
  protected readonly logger: Logger;
  
  constructor(
    protected readonly config: LLMServiceConfig,
    protected readonly piiService: PIIService,
    protected readonly pseudonymizerService: PseudonymizerService,
    protected readonly dictionaryPseudonymizerService: DictionaryPseudonymizerService,
    protected readonly runMetadataService: RunMetadataService,
    protected readonly providerConfigService: ProviderConfigService,
  ) {
    this.logger = new Logger(this.constructor.name);
    this.logger.log(`${this.constructor.name} initialized for provider: ${config.provider}`);
  }

  /**
   * Abstract method that all provider services must implement
   * This is the core method for generating responses from the LLM
   */
  abstract generateResponse(params: GenerateResponseParams): Promise<LLMResponse>;

  /**
   * Create standardized metadata for responses
   */
  protected createMetadata(
    rawResponse: any,
    params: GenerateResponseParams,
    startTime: number,
    endTime: number,
    requestId: string
  ): ResponseMetadata {
    const inputTokens = this.estimateTokens(params.systemPrompt + params.userMessage);
    const outputTokens = this.estimateTokens(rawResponse.content || '');
    const totalTokens = inputTokens + outputTokens;
    
    return {
      provider: params.config.provider,
      model: params.config.model,
      requestId,
      timestamp: new Date().toISOString(),
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        cost: this.calculateCost(params.config.provider, params.config.model, inputTokens, outputTokens),
      },
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
      // Enhanced fields
      tier: params.options?.preferLocal ? 'local' : 'external',
      status: 'completed',
      // Provider-specific data can be added by subclasses
      providerSpecific: rawResponse.providerSpecific || {},
    };
  }

  /**
   * Handle PII processing for input text
   */
  protected async handlePiiInput(
    text: string,
    options: PiiOptions = {}
  ): Promise<{ processedText: string; piiMetadata?: PIIProcessingMetadata }> {
    try {
      if (!options.enablePseudonymization) {
        return { processedText: text };
      }

      // Use dictionary pseudonymizer if requested
      if (options.useDictionaryPseudonymizer) {
        const result = await this.dictionaryPseudonymizerService.pseudonymizeText(text);
        return {
          processedText: result.pseudonymizedText,
          // Note: Dictionary pseudonymizer doesn't provide PIIProcessingMetadata
          // This would need to be adapted based on actual requirements
        };
      }

      // Use standard pseudonymizer
      const requestId = this.generateRequestId('pii');
      const result = await this.pseudonymizerService.pseudonymizeText(text, requestId, {
        context: 'llm-boundary',
      });
      return {
        processedText: result.pseudonymizedText,
        // Note: Standard pseudonymizer doesn't directly provide PIIProcessingMetadata
        // This would need to be adapted based on actual requirements
      };
    } catch (error) {
      this.logger.error('PII processing failed:', error);
      // Return original text if PII processing fails
      return { processedText: text };
    }
  }

  /**
   * Handle PII processing for output text (pseudonym reversal)
   */
  protected async handlePiiOutput(
    text: string,
    requestId?: string,
    mappings?: any[]
  ): Promise<string> {
    try {
      if (!requestId && !mappings) {
        return text;
      }

      // For dictionary pseudonymizer, use the mappings directly
      if (mappings && Array.isArray(mappings)) {
        const result = await this.dictionaryPseudonymizerService.reversePseudonyms(text, mappings);
        return result.originalText;
      }

      // For standard pseudonymizer, use the request ID
      if (requestId) {
        const result = await this.pseudonymizerService.reversePseudonyms(text, requestId);
        return result.originalText;
      }

      return text;
    } catch (error) {
      this.logger.error('PII output processing failed:', error);
      return text;
    }
  }

  /**
   * Track usage metrics and costs
   */
  protected trackUsage(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cost?: number
  ): void {
    try {
      this.logger.debug(`Usage tracked - Provider: ${provider}, Model: ${model}, Input: ${inputTokens}, Output: ${outputTokens}, Cost: ${cost || 'N/A'}`);
      
      // TODO: Integrate with usage tracking service
      // This could send metrics to a centralized usage tracking system
    } catch (error) {
      this.logger.error('Usage tracking failed:', error);
    }
  }

  /**
   * Generate a unique request ID
   */
  protected generateRequestId(prefix: string = 'req'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate token count for text (simple approximation)
   * TODO: Replace with actual tokenizer for each provider
   */
  protected estimateTokens(text: string): number {
    if (!text) return 0;
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost based on provider pricing
   */
  protected calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number | undefined {
    try {
      // Get provider configuration for pricing
      const providerConfig = this.providerConfigService.getEnhancedProviderConfig(provider);
      if (!providerConfig) {
        return undefined;
      }

      // TODO: Implement actual cost calculation based on provider pricing
      // This would use the provider's pricing model to calculate costs
      return undefined;
    } catch (error) {
      this.logger.error('Cost calculation failed:', error);
      return undefined;
    }
  }

  /**
   * Handle errors consistently across all providers
   */
  protected handleError(error: any, context: string): never {
    const errorMessage = error.message || 'Unknown error occurred';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    this.logger.error(`${context}: ${errorMessage}`, error.stack);
    
    throw new Error(`${context}: ${errorMessage}`);
  }

  /**
   * Validate configuration before processing
   */
  protected validateConfig(config: LLMServiceConfig): void {
    if (!config.provider) {
      throw new Error('Provider must be specified in configuration');
    }
    
    if (!config.model) {
      throw new Error('Model must be specified in configuration');
    }
    
    // Additional provider-specific validation can be implemented in subclasses
  }

  /**
   * Optional LangSmith integration hook
   * Subclasses can override this to provide LangSmith integration
   */
  protected async integrateLangSmith(
    params: GenerateResponseParams,
    response: LLMResponse
  ): Promise<string | undefined> {
    // Default implementation returns undefined (no LangSmith integration)
    // Subclasses can override this method to provide actual integration
    return undefined;
  }

  /**
   * Log request/response for debugging and monitoring
   */
  protected logRequestResponse(
    params: GenerateResponseParams,
    response: LLMResponse,
    duration: number
  ): void {
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug('Request/Response Log:', {
        provider: params.config.provider,
        model: params.config.model,
        requestId: response.metadata.requestId,
        inputLength: params.userMessage.length,
        outputLength: response.content.length,
        duration,
        cost: response.metadata.usage.cost,
      });
    }
  }
}
