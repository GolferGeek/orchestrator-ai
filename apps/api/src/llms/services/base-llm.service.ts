import { Injectable, Logger } from '@nestjs/common';
import { PIIService } from '../../services/pii.service';
import { DictionaryPseudonymizerService } from '../../services/dictionary-pseudonymizer.service';
import { RunMetadataService } from '../run-metadata.service';
import { ProviderConfigService } from '../provider-config.service';
import { PIIProcessingMetadata } from '../../common/types/pii-metadata.types';
import {
  LLMError,
  LLMErrorMapper,
  LLMErrorMonitor,
  LLMErrorType,
} from './llm-error-handling';
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
    protected readonly dictionaryPseudonymizerService: DictionaryPseudonymizerService,
    protected readonly runMetadataService: RunMetadataService,
    protected readonly providerConfigService: ProviderConfigService,
  ) {
    this.logger = new Logger(this.constructor.name);
    this.logger.log(
      `${this.constructor.name} initialized for provider: ${config.provider}`,
    );
  }

  /**
   * Abstract method that all provider services must implement
   * This is the core method for generating responses from the LLM
   */
  abstract generateResponse(
    params: GenerateResponseParams,
  ): Promise<LLMResponse>;

  /**
   * Create standardized metadata for responses
   */
  protected createMetadata(
    rawResponse: any,
    params: GenerateResponseParams,
    startTime: number,
    endTime: number,
    requestId: string,
  ): ResponseMetadata {
    const inputTokens = this.estimateTokens(
      params.systemPrompt + params.userMessage,
    );
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
        cost: this.calculateCost(
          params.config.provider,
          params.config.model,
          inputTokens,
          outputTokens,
        ),
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
    options: PiiOptions = {},
  ): Promise<{ processedText: string; piiMetadata?: PIIProcessingMetadata }> {
    try {
      if (!options.enablePseudonymization) {
        return { processedText: text };
      }

      // Use dictionary pseudonymizer if requested
      if (options.useDictionaryPseudonymizer) {
        const result =
          await this.dictionaryPseudonymizerService.pseudonymizeText(text);

        // Convert dictionary result to minimal PIIProcessingMetadata
        const piiMetadata: PIIProcessingMetadata = {
          piiDetected: result.mappings.length > 0,
          showstopperDetected: false,
          detectionResults: {
            totalMatches: result.mappings.length,
            flaggedMatches: result.mappings.map((mapping: any) => ({
              value: mapping.originalValue,
              dataType: mapping.dataType,
              severity: 'info' as any,
              confidence: 1.0,
              startIndex: 0, // Dictionary doesn't track positions
              endIndex: 0,
              pattern: mapping.originalValue,
              pseudonym: mapping.pseudonym,
            })),
            showstopperMatches: [],
            dataTypesSummary: {},
            severityBreakdown: {
              showstopper: 0,
              warning: 0,
              info: result.mappings.length,
            },
          },
          policyDecision: {
            allowed: result.mappings.length === 0,
            blocked: false,
            violations: [],
            reasoningPath: [
              result.mappings.length > 0
                ? 'Dictionary matches found'
                : 'No dictionary matches',
            ],
            appliedFor: 'external',
          },
          userMessage: {
            summary:
              result.mappings.length > 0
                ? `Applied ${result.mappings.length} dictionary pseudonym(s)`
                : 'No dictionary matches found',
            details: [
              `Dictionary pseudonymization: ${result.mappings.length} matches`,
            ],
            actionsTaken:
              result.mappings.length > 0 ? ['pseudonymization'] : [],
            isBlocked: false,
          },
          processingFlow: 'pseudonymized',
          processingSteps: [
            `Dictionary pseudonymization: ${result.mappings.length} matches`,
          ],
          timestamps: {
            detectionStart: Date.now() - result.processingTimeMs,
            pseudonymApplied: Date.now(),
          },
        };

        return {
          processedText: result.pseudonymizedText,
          piiMetadata,
        };
      }

      // Use standard pseudonymizer
      const requestId = this.generateRequestId('pii');
      // Note: Pseudonymization is now handled at the LLM service level via DictionaryPseudonymizerService
      const result = { pseudonymizedText: text, mappings: [] }; // No-op since pattern-based pseudonymization is removed

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
    mappings?: any[],
  ): Promise<string> {
    try {
      if (!requestId && !mappings) {
        return text;
      }

      // For dictionary pseudonymizer, use the mappings directly
      if (mappings && Array.isArray(mappings)) {
        const result =
          await this.dictionaryPseudonymizerService.reversePseudonyms(
            text,
            mappings,
          );
        return result.originalText;
      }

      // For standard pseudonymizer, use the request ID
      if (requestId) {
        // Note: Pseudonym reversal is now handled at the LLM service level via DictionaryPseudonymizerService
        const result = { originalText: text }; // No-op since pattern-based pseudonymization is removed
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
  protected async trackUsage(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cost?: number,
    requestMetadata?: {
      requestId?: string;
      userId?: string;
      conversationId?: string;
      callerType?: string;
      callerName?: string;
      piiMetadata?: any;
      startTime?: number;
      endTime?: number;
    },
  ): Promise<void> {
    try {
      this.logger.debug(
        `Usage tracked - Provider: ${provider}, Model: ${model}, Input: ${inputTokens}, Output: ${outputTokens}, Cost: ${cost || 'N/A'}`,
      );

      // Start metadata tracking if we have the necessary info
      if (requestMetadata?.startTime && requestMetadata?.userId) {
        const routingDecision = {
          provider,
          model,
          isLocal: provider === 'ollama',
          modelTier: 'general',
          fallbackUsed: false,
        };

        const options = {
          userId: requestMetadata.userId,
          callerType: requestMetadata.callerType || 'llm_service',
          callerName: requestMetadata.callerName || 'direct_call',
          conversationId: requestMetadata.conversationId,
        };

        // Insert a single completed usage record (simpler, no two-phase update)
        this.logger.debug(
          `🔍 [PII-METADATA-DEBUG] trackUsage - requestMetadata.piiMetadata exists:`,
          !!requestMetadata.piiMetadata,
        );
        if (requestMetadata.piiMetadata) {
          this.logger.debug(
            `🔍 [PII-METADATA-DEBUG] trackUsage - piiMetadata structure:`,
            {
              piiDetected: requestMetadata.piiMetadata.piiDetected,
              processingFlow: requestMetadata.piiMetadata.processingFlow,
              totalMatches: requestMetadata.piiMetadata.totalMatches,
              hasDetectionResults:
                !!requestMetadata.piiMetadata.detectionResults,
              hasPseudonymInstructions:
                !!requestMetadata.piiMetadata.pseudonymInstructions,
            },
          );
        }

        // Derive full pseudonym mappings from PII metadata when available
        const derivePseudonymMappings = (
          piiMeta: any,
        ): Array<{ original: string; pseudonym: string; dataType: string }> => {
          try {
            // Prefer explicit pseudonymsApplied if present
            if (
              Array.isArray(piiMeta?.pseudonymsApplied) &&
              piiMeta.pseudonymsApplied.length > 0
            ) {
              return piiMeta.pseudonymsApplied
                .map((m: any) => ({
                  original: m.original ?? m.value ?? m.source ?? '',
                  pseudonym: m.pseudonym ?? '',
                  dataType: m.type ?? m.dataType ?? 'custom',
                }))
                .filter(
                  (m: {
                    original: string;
                    pseudonym: string;
                    dataType: string;
                  }) => m.original && m.pseudonym,
                );
            }
            // Fallback to processedMatches
            const matches =
              piiMeta?.pseudonymResults?.processedMatches ||
              piiMeta?.pseudonymInstructions?.targetMatches ||
              [];
            return (matches as any[])
              .filter((m: any) => !!m?.pseudonym)
              .map((m: any) => ({
                original: m.value ?? '',
                pseudonym: m.pseudonym ?? '',
                dataType: m.dataType ?? 'custom',
              }))
              .filter(
                (m: {
                  original: string;
                  pseudonym: string;
                  dataType: string;
                }) => m.original && m.pseudonym,
              );
          } catch {
            return [];
          }
        };

        const enhancedMetrics = requestMetadata.piiMetadata
          ? {
              dataSanitizationApplied:
                requestMetadata.piiMetadata.piiDetected || false,
              sanitizationLevel:
                requestMetadata.piiMetadata.processingFlow || 'none',
              piiDetected: requestMetadata.piiMetadata.piiDetected || false,
              piiTypes:
                requestMetadata.piiMetadata.detectionResults
                  ?.dataTypesSummary || {},
              // Extract pseudonym information from pseudonymInstructions
              pseudonymsUsed:
                requestMetadata.piiMetadata.pseudonymInstructions?.targetMatches
                  ?.length || 0,
              pseudonymTypes:
                requestMetadata.piiMetadata.pseudonymInstructions?.targetMatches?.map(
                  (m: any) => m.dataType,
                ) || [],
              pseudonymMappings: derivePseudonymMappings(
                requestMetadata.piiMetadata,
              ),
              // Also include flagged items count
              redactionsApplied:
                requestMetadata.piiMetadata.detectionResults?.flaggedMatches
                  ?.length || 0,
              redactionTypes:
                requestMetadata.piiMetadata.detectionResults?.flaggedMatches?.map(
                  (m: any) => m.dataType,
                ) || [],
            }
          : undefined;

        this.logger.debug(
          `🔍 [PII-METADATA-DEBUG] trackUsage - enhancedMetrics:`,
          enhancedMetrics,
        );

        await this.runMetadataService.insertCompletedUsage({
          provider,
          model,
          isLocal: provider === 'ollama',
          userId: requestMetadata.userId,
          callerType: requestMetadata.callerType,
          callerName: requestMetadata.callerName,
          conversationId: requestMetadata.conversationId,
          inputTokens,
          outputTokens,
          totalCost: cost,
          startTime: requestMetadata.startTime,
          endTime: requestMetadata.endTime,
          status: 'completed',
          enhancedMetrics,
          runId: requestMetadata.requestId,
        });

        this.logger.debug(
          `✅ Usage data saved to database for ${provider}/${model}`,
        );
      } else {
        this.logger.debug(
          `⚠️ Insufficient metadata for database tracking - missing startTime or userId`,
        );
      }
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
    outputTokens: number,
  ): number | undefined {
    try {
      const p = provider.toLowerCase();
      const m = model.toLowerCase();

      // Basic per-token rate maps (USD) using reasonable defaults.
      // Rates are expressed per token (i.e., $ per 1 token).
      // Example rates are used where exact pricing is unavailable in code.
      const openaiRates: Record<string, { input: number; output: number }> = {
        // gpt-4o family
        'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 }, // $5 / $15 per 1M
        'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 }, // $0.15 / $0.60 per 1M
        // legacy models
        'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 }, // $30 / $60 per 1M
        'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 }, // $10 / $30 per 1M
        'gpt-3.5-turbo': { input: 0.0015 / 1000, output: 0.002 / 1000 }, // $1.5 / $2 per 1M
        // reasoning family (example rates)
        o1: { input: 0.003 / 1000, output: 0.012 / 1000 }, // $3 / $12 per 1M
        'o1-mini': { input: 0.003 / 1000, output: 0.012 / 1000 },
        'o4-mini': { input: 0.001 / 1000, output: 0.005 / 1000 }, // example placeholder
      };

      const anthropicRates: Record<string, { input: number; output: number }> =
        {
          'claude-3-5-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 }, // $3 / $15 per 1M
          'claude-3-5-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 }, // $0.25 / $1.25 per 1M
          'claude-3-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
          'claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
        };

      const defaultRates = { input: 0.001 / 1000, output: 0.002 / 1000 }; // $1 / $2 per 1M

      const matchRate = (
        rates: Record<string, { input: number; output: number }>,
      ) => {
        for (const key of Object.keys(rates)) {
          if (m.includes(key)) return rates[key];
        }
        return undefined;
      };

      let rate: { input: number; output: number } | undefined;
      if (p === 'openai') {
        rate = matchRate(openaiRates);
      } else if (p === 'anthropic') {
        rate = matchRate(anthropicRates);
      }

      const r = rate || defaultRates;
      const cost = inputTokens * r.input + outputTokens * r.output;
      return cost;
    } catch (error) {
      this.logger.error('Cost calculation failed:', error);
      return undefined;
    }
  }

  /**
   * Handle errors consistently across all providers
   */
  protected handleError(error: any, context: string): never {
    try {
      const provider = this.config?.provider || 'unknown';
      const model = this.config?.model;
      const mappedError = LLMErrorMapper.fromGenericError(
        error,
        provider,
        model,
      );
      LLMErrorMonitor.recordError(mappedError);
      throw mappedError;
    } catch (_mappingFailure) {
      const fallback = new LLMError(
        `${context}: ${error?.message || 'Unknown error occurred'}`,
        LLMErrorType.UNKNOWN,
        this.config?.provider || 'unknown',
        { model: this.config?.model, originalError: error },
      );
      LLMErrorMonitor.recordError(fallback);
      throw fallback;
    }
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
    response: LLMResponse,
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
    duration: number,
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
