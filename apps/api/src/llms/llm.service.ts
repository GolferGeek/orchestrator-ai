import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatOllama } from '@langchain/ollama';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { SupabaseService } from '@/supabase/supabase.service';
import { CIDAFMService } from './cidafm/cidafm.service';
import { CentralizedRoutingService } from './centralized-routing.service';
import { RunMetadataService } from './run-metadata.service';
import { ProviderConfigService } from './provider-config.service';
import { PIIService } from './pii/pii.service';
import { DictionaryPseudonymizerService } from './pii/dictionary-pseudonymizer.service';
import type { DictionaryPseudonymMapping } from './pii/dictionary-pseudonymizer.service';
import { LocalModelStatusService } from './local-model-status.service';
import { LocalLLMService } from './local-llm.service';
import { BlindedLLMService } from './blinded-llm.service';
import { LLMServiceFactory } from './services/llm-service-factory';
import {
  GenerateResponseParams,
  UnifiedGenerateResponseParams,
  LLMResponse,
  LLMServiceConfig,
  ResponseMetadata,
  LLMRequestOptions,
  RoutingDecision,
} from './services/llm-interfaces';
import {
  Provider,
  Model,
  CostCalculation,
  LLMUsageMetrics,
  CIDAFMOptions,
  SystemLLMConfigs,
  SystemOperationType,
  UserLLMPreferences,
} from '@/llms/types/llm-evaluation';
import type {
  PIIProcessingMetadata,
  PIIMatch,
} from './types/pii-metadata.types';
import { mapProviderFromDb, mapModelFromDb } from '@/utils/case-converter';
import { ModelConfigurationService } from './config/model-configuration.service';
import type { EnvironmentName } from './config/model-configuration.service';
import { getTableName } from '@/supabase/supabase.config';
import {
  LLMError,
  LLMErrorMapper,
  LLMErrorMonitor,
  LLMErrorType,
} from './services/llm-error-handling';

type GenerateResponseOptions = LLMRequestOptions & {
  provider?: 'openai' | 'anthropic' | 'ollama' | 'google';
  cidafmOptions?: CIDAFMOptions;
  complexity?: 'simple' | 'medium' | 'complex' | 'reasoning';
};

/**
 * Database record type for redaction_patterns table
 */
interface RedactionPatternDbRecord {
  severity: string;
  data_type: string;
}

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
}

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private openai: OpenAI | null = null;
  public readonly systemLLMConfigs: SystemLLMConfigs;
  private llmServiceFactory: LLMServiceFactory;
  private readonly debugEnabled: boolean;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly cidafmService: CIDAFMService,
    private readonly centralizedRoutingService: CentralizedRoutingService,
    private readonly runMetadataService: RunMetadataService,
    private readonly providerConfigService: ProviderConfigService,
    private readonly piiService: PIIService,
    private readonly dictionaryPseudonymizerService: DictionaryPseudonymizerService,
    private readonly localModelStatusService: LocalModelStatusService,
    private readonly localLLMService: LocalLLMService,
    private readonly blindedLLMService: BlindedLLMService,
    private readonly llmServiceFactoryInstance: LLMServiceFactory,
    private readonly modelConfigurationService: ModelConfigurationService,
  ) {
    // Initialize OpenAI client only if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Deprecated: SYSTEM_* .env model defaults replaced by ModelConfigurationService
    this.systemLLMConfigs = {} as SystemLLMConfigs; // No action needed

    // Initialize the LLM service factory
    this.llmServiceFactory = this.llmServiceFactoryInstance;

    // Disable verbose debug logs by default for cleaner output during metrics-agent work
    this.debugEnabled = false;
  }

  /**
   * Simple LLM call with system and user messages - using LangChain for automatic LangSmith tracing
   */
  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    options?: GenerateResponseOptions,
  ): Promise<string | LLMResponse> {
    const startTime = Date.now();
    if (this.debugEnabled) {
      this.logger.debug(
        `🔍 [LLM-USAGE-DEBUG] generateResponse called with callerType: ${options?.callerType}, callerName: ${options?.callerName}, providerName: ${options?.providerName}, modelName: ${options?.modelName}`,
      );
    }
    try {
      // Debug LLM options being received

      // If providerName/modelName are provided, use the unified method
      if (options?.providerName && options?.modelName) {
        if (this.debugEnabled) {
          this.logger.debug(
            `🔍 [LLM-USAGE-DEBUG] Using generateUnifiedResponse with explicit provider/model`,
          );
          this.logger.debug(
            `🔍 [LLM-PII-DEBUG] Received options.piiMetadata: ${options?.piiMetadata ? 'yes' : 'no'}`,
          );
          this.logger.debug(
            `🔍 [LLM-PII-DEBUG] Received options.routingDecision: ${options?.routingDecision ? 'yes' : 'no'}`,
          );
        }

        // === PII PROCESSING BEFORE FACTORY CALL ===
        let processedUserMessage = userMessage;
        let dictionaryMappings: DictionaryPseudonymMapping[] = [];
        let enhancedPiiMetadata: PIIProcessingMetadata | undefined =
          options?.piiMetadata ?? undefined;

        // Always apply dictionary pseudonymization for external providers (non-Ollama), unless quick bypass
        const skipPII = options?.quick === true;
        if (!skipPII && options.providerName.toLowerCase() !== 'ollama') {
          if (this.debugEnabled)
            console.log(
              '🔍 [LLM-SERVICE] Applying dictionary pseudonymization for provider:',
              options.providerName,
            );

          const pseudonymResult =
            await this.dictionaryPseudonymizerService.pseudonymizeText(
              userMessage,
              {
                organizationSlug: options?.organizationSlug ?? null,
                agentSlug: options?.agentSlug ?? null,
              },
            );
          processedUserMessage = pseudonymResult.pseudonymizedText;
          dictionaryMappings = pseudonymResult.mappings;

          const requestId =
            options.conversationId ||
            options.sessionId ||
            `pii-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const dictionaryMatches = pseudonymResult.mappings.map((m) => ({
            value: m.originalValue,
            dataType: m.dataType,
            severity: 'warning',
            confidence: 1.0,
            startIndex: -1,
            endIndex: -1,
            pattern: 'dictionary_match',
            pseudonym: m.pseudonym,
          }));

          if (enhancedPiiMetadata) {
            // Merge pseudonym info into existing metadata
            enhancedPiiMetadata = {
              ...enhancedPiiMetadata,
              // Ensure flaggings available for UI debug panels
              flaggings:
                enhancedPiiMetadata.detectionResults?.flaggedMatches ||
                enhancedPiiMetadata.flaggings ||
                [],
              pseudonymsApplied: [
                ...(enhancedPiiMetadata.pseudonymsApplied || []),
                ...pseudonymResult.mappings.map((m) => ({
                  original: m.originalValue,
                  pseudonym: m.pseudonym,
                  type: m.dataType,
                })),
              ],
              pseudonymInstructions: {
                shouldPseudonymize: true,
                targetMatches: [
                  ...((enhancedPiiMetadata.pseudonymInstructions
                    ?.targetMatches as PIIMatch[]) || []),
                  ...(dictionaryMatches as PIIMatch[]),
                ] as PIIMatch[],
                requestId:
                  enhancedPiiMetadata.pseudonymInstructions?.requestId ||
                  requestId,
                context:
                  enhancedPiiMetadata.pseudonymInstructions?.context ||
                  'llm-boundary',
              },
              pseudonymResults: {
                applied: true,
                processedMatches: [
                  ...((enhancedPiiMetadata.pseudonymResults
                    ?.processedMatches as PIIMatch[]) || []),
                  ...(dictionaryMatches as PIIMatch[]),
                ],
                mappingsCount:
                  (enhancedPiiMetadata.pseudonymResults?.mappingsCount || 0) +
                  pseudonymResult.mappings.length,
                processingTimeMs:
                  (enhancedPiiMetadata.pseudonymResults?.processingTimeMs ||
                    0) + pseudonymResult.processingTimeMs,
                reversalSuccess:
                  enhancedPiiMetadata.pseudonymResults?.reversalSuccess,
                reversalMatches:
                  enhancedPiiMetadata.pseudonymResults?.reversalMatches,
              },
              piiDetected: true,
              sanitizationLevel:
                pseudonymResult.mappings.length > 0
                  ? 'standard'
                  : enhancedPiiMetadata.sanitizationLevel || 'none',
            };
          } else {
            // No metadata provided – compute detection once, then attach pseudonym fields
            const piiPolicyResult = await this.piiService.checkPolicy(
              userMessage,
              {
                provider: options.providerName,
                providerName: options.providerName,
              },
            );

            enhancedPiiMetadata = {
              ...piiPolicyResult.metadata,
              // For UI consumption
              pseudonymsApplied: pseudonymResult.mappings.map((m) => ({
                original: m.originalValue,
                pseudonym: m.pseudonym,
                type: m.dataType,
              })),
              // Provide flat flaggings array for UI convenience
              flaggings:
                piiPolicyResult.metadata.detectionResults?.flaggedMatches || [],
              // Standardized fields used across the app
              pseudonymInstructions: {
                shouldPseudonymize: pseudonymResult.mappings.length > 0,
                targetMatches: dictionaryMatches as unknown,
                requestId,
                context: 'llm-boundary',
              },
              pseudonymResults: {
                applied: pseudonymResult.mappings.length > 0,
                processedMatches: dictionaryMatches as unknown,
                mappingsCount: pseudonymResult.mappings.length,
                processingTimeMs: pseudonymResult.processingTimeMs,
              },
              piiDetected:
                piiPolicyResult.metadata.piiDetected ||
                pseudonymResult.mappings.length > 0,
              processingTimeMs:
                (piiPolicyResult.metadata.timestamps?.policyCheck ||
                  Date.now()) -
                (piiPolicyResult.metadata.timestamps?.detectionStart ||
                  Date.now()) +
                pseudonymResult.processingTimeMs,
              sanitizationLevel:
                pseudonymResult.mappings.length > 0 ? 'standard' : 'none',
            } as unknown as PIIProcessingMetadata;
          }

          if (this.debugEnabled)
            console.log(
              `🎯 [LLM-SERVICE] PII applied - pseudonyms: ${dictionaryMappings.length}`,
            );
        } else {
          // Quick/local path – no pseudonymization
          processedUserMessage = userMessage;
        }

        // Use the new unified LLM service factory approach
        const config: LLMServiceConfig = {
          provider: options.providerName,
          model: options.modelName,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        };

        const factoryParams: GenerateResponseParams = {
          systemPrompt,
          userMessage: processedUserMessage, // Use processed message
          config,
          options: {
            callerType: options.callerType,
            callerName: options.callerName,
            conversationId: options.conversationId,
            sessionId: options.sessionId,
            userId: options.userId || options.currentUser?.id,
            authToken: options.authToken,
            currentUser: options.currentUser,
            dataClassification: options.dataClassification,
            // Pass enhanced PII metadata and mappings
            piiMetadata: enhancedPiiMetadata,
            dictionaryMappings: dictionaryMappings,
            routingDecision: (options as Record<string, unknown>)
              ?.routingDecision as RoutingDecision | undefined,
          },
        };

        const unifiedResult = await this.llmServiceFactory.generateResponse(
          config,
          factoryParams,
        );

        // Apply reverse pseudonymization if we have mappings
        if (
          dictionaryMappings &&
          dictionaryMappings.length > 0 &&
          unifiedResult.content
        ) {
          const reverseResult =
            await this.dictionaryPseudonymizerService.reversePseudonyms(
              unifiedResult.content,
              dictionaryMappings,
            );
          unifiedResult.content = reverseResult.originalText;
          if (this.debugEnabled)
            this.logger.debug(
              `🔄 [LLM-SERVICE] Reversed ${reverseResult.reversalCount} pseudonyms in response`,
            );
        }

        // Ensure PII metadata is included in response
        if (enhancedPiiMetadata) {
          unifiedResult.piiMetadata = enhancedPiiMetadata;
          if (this.debugEnabled)
            console.log('✅ [LLM-SERVICE] Added PII metadata to response');
        }

        if (this.debugEnabled)
          console.log(
            '📦 [LLM-SERVICE] Returning result with keys:',
            Object.keys(unifiedResult),
          );
        // Return the result (string or object based on includeMetadata)
        return unifiedResult;
      }

      // If only partial provider/model info or CIDAFM options are provided, require explicit specification
      if (
        options?.providerName ||
        options?.modelName ||
        options?.cidafmOptions
      ) {
        throw new Error(
          'Both provider and model must be explicitly specified. ' +
            'The enhanced response method has been removed. ' +
            'Please provide both providerName and modelName in options.',
        );
      }

      // No fallback routing - require explicit provider/model specification
      throw new Error(
        'No LLM provider and model specified. The centralized routing fallback has been removed. ' +
          'Please provide both "providerName" and "modelName" in options. ' +
          'Available providers: openai, anthropic, google, grok, ollama',
      );

      // Original simple implementation for backward compatibility
      const provider = options?.provider || options?.providerName;

      // No fallback - require explicit provider configuration
      if (!provider) {
        throw new Error(
          'No LLM provider specified. Please provide either "provider" or "providerName" in options. ' +
            'Available providers: ollama, anthropic, openai, google',
        );
      }

      // TypeScript assertion: provider is guaranteed to be defined after the check above
      const validProvider = provider!; // Non-null assertion since we checked above

      const isLocalProvider = validProvider === 'ollama';

      this.logger.log(
        `🔍 [SIMPLE-LLM-DEBUG] Simple response path - provider: ${validProvider}, isLocal: ${isLocalProvider}`,
      );
      this.logger.log(
        `🔍 [SIMPLE-LLM-DEBUG] User message preview: "${userMessage.substring(0, 100)}..."`,
      );

      // Apply conditional sanitization using unified PII service
      // Generate request ID for pseudonymization context
      const _requestId =
        options?.conversationId ||
        options?.sessionId ||
        `simple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Step 1: Dictionary-based pseudonymization for external providers only
      let sanitizedUserMessage = userMessage;
      let sanitizationContext: {
        mappings: DictionaryPseudonymMapping[];
        processingTimeMs: number;
      } | null = null;

      if (!isLocalProvider) {
        const pseudonymResult =
          await this.dictionaryPseudonymizerService.pseudonymizeText(
            userMessage,
          );
        sanitizedUserMessage = pseudonymResult.pseudonymizedText;
        sanitizationContext = {
          mappings: pseudonymResult.mappings,
          processingTimeMs: pseudonymResult.processingTimeMs,
        };

        this.logger.log(
          `🎯 [DICTIONARY-PSEUDONYMIZER] Simple path pseudonymization completed: ${pseudonymResult.mappings.length} replacements in ${pseudonymResult.processingTimeMs}ms`,
        );
        if (pseudonymResult.mappings.length > 0) {
          pseudonymResult.mappings.forEach((mapping) => {
            this.logger.log(
              `🎯 [DICTIONARY-PSEUDONYMIZER] "${mapping.originalValue}" → "${mapping.pseudonym}"`,
            );
          });
        }
      } else {
        this.logger.log(
          `🎯 [DICTIONARY-PSEUDONYMIZER] Skipping pseudonymization for local provider: ${validProvider}`,
        );
      }

      const sanitizedSystemPrompt = systemPrompt; // System prompts typically don't contain user PII

      // No DB usage tracking in simple path to avoid partial rows

      try {
        // Use LangChain LLM instead of raw OpenAI - this gets automatic LangSmith tracing
        const llm =
          options?.temperature || options?.maxTokens || options?.provider
            ? this.createCustomLangGraphLLM({
                provider: validProvider as
                  | 'openai'
                  | 'anthropic'
                  | 'ollama'
                  | 'google',
                model: options?.modelName,
                temperature: options?.temperature,
                maxTokens: options?.maxTokens,
              })
            : this.getLangGraphLLM(
                validProvider as 'openai' | 'anthropic' | 'ollama' | 'google',
              );

        // Format messages for the specific provider - LLM service controls the format
        const messages = this.formatMessagesForProvider(
          sanitizedSystemPrompt,
          sanitizedUserMessage,
          validProvider,
          options?.modelName,
        );

        // Add debug logging to see what's being sent
        if (this.debugEnabled) {
          this.logger.debug(
            `🔍 [LLM-DEBUG] Sending ${messages.length} messages to ${validProvider}/${options?.modelName}`,
          );
        }

        const response = await llm.invoke(messages);
        let content =
          (response.content as string) ||
          'I apologize, but I was unable to generate a response.';

        // Step 2: Reverse pseudonyms in the response
        if (
          sanitizationContext !== null &&
          sanitizationContext!.mappings &&
          sanitizationContext!.mappings.length > 0
        ) {
          const mappings = sanitizationContext!.mappings;
          const reversalResult =
            await this.dictionaryPseudonymizerService.reversePseudonyms(
              content,
              mappings,
            );
          content = reversalResult.originalText;

          this.logger.log(
            `🔄 [DICTIONARY-PSEUDONYMIZER] Simple path reversal completed: ${reversalResult.reversalCount} reversals in ${reversalResult.processingTimeMs}ms`,
          );

          if (reversalResult.reversalCount === 0) {
            this.logger.warn(
              `🔄 [DICTIONARY-PSEUDONYMIZER] Expected reversals but none found - LLM may not have used the pseudonyms`,
            );
          }
        }

        // No DB usage write here — providers handle their own one-pass insert

        // Return metadata if requested (for HTTP API calls)
        if (options?.includeMetadata) {
          const endTime = Date.now();

          let pseudonymizationMetadata;
          if (
            sanitizationContext !== null &&
            sanitizationContext!.mappings &&
            sanitizationContext!.mappings.length > 0
          ) {
            pseudonymizationMetadata = {
              pseudonymizationApplied: true,
              pseudonymCount: sanitizationContext!.mappings.length,
              processingTimeMs: sanitizationContext!.processingTimeMs,
              mappings: sanitizationContext!.mappings.map((m) => ({
                type: m.dataType,
                originalLength: m.originalValue.length,
                pseudonymLength: m.pseudonym.length,
              })),
            };
          } else {
            pseudonymizationMetadata = {
              pseudonymizationApplied: false,
              pseudonymCount: 0,
              processingTimeMs: 0,
              mappings: [],
            };
          }

          const metadata: ResponseMetadata = {
            provider: options?.providerName ?? 'unknown',
            model: options?.modelName ?? 'unknown',
            requestId: `legacy-${startTime}`,
            timestamp: new Date(endTime).toISOString(),
            usage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            },
            timing: {
              startTime,
              endTime,
              duration: endTime - startTime,
            },
            tier:
              options?.providerName?.toLowerCase() === 'ollama'
                ? 'local'
                : 'external',
            status: 'completed',
            providerSpecific: {
              sanitizationMetadata: pseudonymizationMetadata,
            },
          };

          return {
            content,
            metadata,
            piiMetadata: options?.piiMetadata ?? null,
            sanitizationMetadata: pseudonymizationMetadata as Record<
              string,
              unknown
            >,
          };
        }

        return content;
      } catch (error: unknown) {
        let errorMessage: string;
        if (error instanceof Error) {
          errorMessage = (error as Error).message;
        } else {
          errorMessage = String(error);
        }
        throw new Error(`LLM service error: ${errorMessage}`);
      }
    } catch (_outerError) {
      // Handle any errors in the try block setup
      const errorMessage =
        _outerError instanceof Error
          ? _outerError.message
          : String(_outerError);
      throw new Error(`LLM service error: ${errorMessage}`);
    }
  }

  /**
   * Unified generateResponse method - the new entry point for all LLM requests
   *
   * This method consolidates the three existing response methods into a single unified interface
   * that requires explicit provider and model specification and uses the new LLMServiceFactory
   * architecture.
   *
   * @param params - Unified parameters including provider, model, and messages
   * @returns Promise<string | LLMResponse> - String content or full response object based on includeMetadata flag
   */
  async generateUnifiedResponse(
    params: UnifiedGenerateResponseParams,
  ): Promise<string | LLMResponse> {
    if (this.debugEnabled) {
      this.logger.debug(`🔍 [UNIFIED-LLM] generateUnifiedResponse called`, {
        provider: params.provider,
        model: params.model,
        callerType: params.options?.callerType,
        callerName: params.options?.callerName,
        includeMetadata: params.options?.includeMetadata,
      });
    }

    try {
      // Validate required parameters
      if (!params.provider) {
        throw new Error('Missing required parameter: provider is required');
      }
      if (!params.model) {
        throw new Error('Missing required parameter: model is required');
      }
      if (!params.systemPrompt) {
        throw new Error('Missing required parameter: systemPrompt is required');
      }
      if (!params.userMessage) {
        throw new Error('Missing required parameter: userMessage is required');
      }

      // Validate provider is supported
      const supportedProviders = [
        'openai',
        'anthropic',
        'google',
        'grok',
        'ollama',
      ];
      if (!supportedProviders.includes(params.provider.toLowerCase())) {
        throw new Error(
          `Unsupported provider: ${params.provider}. Supported providers: ${supportedProviders.join(', ')}`,
        );
      }

      // === PII PROCESSING AT LLM SERVICE LEVEL ===
      // Skip PII processing for Ollama (local models don't need sanitization)
      let enhancedPiiMetadata = params.options?.piiMetadata;
      let processedUserMessage = params.userMessage;
      let dictionaryMappings: DictionaryPseudonymMapping[] = [];

      // Only process PII for non-Ollama providers
      if (params.provider.toLowerCase() === 'ollama') {
        if (this.debugEnabled)
          this.logger.debug(
            '🏠 [LLM-SERVICE] Skipping PII processing for Ollama (local model)',
          );
      } else {
        // Always apply dictionary pseudonymization for non-Ollama here; merge with existing metadata if provided
        if (params.provider.toLowerCase() !== 'ollama') {
          const pseudonymResult =
            await this.dictionaryPseudonymizerService.pseudonymizeText(
              params.userMessage,
            );
          processedUserMessage = pseudonymResult.pseudonymizedText;
          dictionaryMappings = pseudonymResult.mappings;

          const requestId =
            params.options?.conversationId ||
            params.options?.sessionId ||
            `pii-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const dictionaryMatches = pseudonymResult.mappings.map((m) => ({
            value: m.originalValue,
            dataType: m.dataType,
            severity: 'warning',
            confidence: 1.0,
            startIndex: -1,
            endIndex: -1,
            pattern: 'dictionary_match',
            pseudonym: m.pseudonym,
          }));

          if (!enhancedPiiMetadata) {
            // Compute detection only if we don't already have metadata
            const piiPolicyResult = await this.piiService.checkPolicy(
              params.userMessage,
              {
                provider: params.provider,
                providerName: params.provider,
              },
            );
            enhancedPiiMetadata = piiPolicyResult.metadata;
          }

          if (!enhancedPiiMetadata) {
            throw new Error('PII metadata unavailable after policy check');
          }

          // Merge pseudonym data into metadata
          enhancedPiiMetadata = {
            ...enhancedPiiMetadata,
            flaggings:
              enhancedPiiMetadata.detectionResults?.flaggedMatches ||
              enhancedPiiMetadata.flaggings ||
              [],
            pseudonymsApplied: [
              ...(enhancedPiiMetadata?.pseudonymsApplied || []),
              ...pseudonymResult.mappings.map((m) => ({
                original: m.originalValue,
                pseudonym: m.pseudonym,
                type: m.dataType,
              })),
            ],
            pseudonymInstructions: {
              shouldPseudonymize: true,
              targetMatches: [
                ...((enhancedPiiMetadata?.pseudonymInstructions
                  ?.targetMatches as PIIMatch[]) || []),
                ...(dictionaryMatches as PIIMatch[]),
              ] as PIIMatch[],
              requestId:
                enhancedPiiMetadata?.pseudonymInstructions?.requestId ||
                requestId,
              context:
                enhancedPiiMetadata?.pseudonymInstructions?.context ||
                'llm-boundary',
            },
            pseudonymResults: {
              applied: true,
              processedMatches: [
                ...((enhancedPiiMetadata?.pseudonymResults
                  ?.processedMatches as PIIMatch[]) || []),
                ...(dictionaryMatches as PIIMatch[]),
              ],
              mappingsCount:
                (enhancedPiiMetadata?.pseudonymResults?.mappingsCount || 0) +
                pseudonymResult.mappings.length,
              processingTimeMs:
                (enhancedPiiMetadata?.pseudonymResults?.processingTimeMs || 0) +
                pseudonymResult.processingTimeMs,
              reversalSuccess:
                enhancedPiiMetadata?.pseudonymResults?.reversalSuccess,
              reversalMatches:
                enhancedPiiMetadata?.pseudonymResults?.reversalMatches,
            },
            piiDetected: true,
            sanitizationLevel:
              pseudonymResult.mappings.length > 0
                ? 'standard'
                : enhancedPiiMetadata?.sanitizationLevel || 'none',
          };

          this.logger.debug(`🎯 [LLM-SERVICE] PII applied:`, {
            pseudonymsApplied: pseudonymResult.mappings.length,
            textModified: processedUserMessage !== params.userMessage,
          });
        }
      }

      // Create LLM service configuration
      const config: LLMServiceConfig = {
        provider: params.provider,
        model: params.model,
        temperature: params.options?.temperature,
        maxTokens: params.options?.maxTokens,
      };

      // Create GenerateResponseParams for the factory with enhanced PII metadata
      const factoryParams: GenerateResponseParams = {
        systemPrompt: params.systemPrompt,
        userMessage: processedUserMessage, // Use processed message with pseudonyms
        config,
        conversationId: params.options?.conversationId,
        sessionId: params.options?.sessionId,
        userId: params.options?.userId,
        options: {
          temperature: params.options?.temperature,
          maxTokens: params.options?.maxTokens,
          callerType: params.options?.callerType,
          callerName: params.options?.callerName,
          dataClassification: params.options?.dataClassification,
          authToken: params.options?.authToken,
          currentUser: params.options?.currentUser,
          // Pass enhanced PII metadata and dictionary mappings
          piiMetadata: enhancedPiiMetadata,
          dictionaryMappings: dictionaryMappings,
          routingDecision: params.options?.routingDecision,
        },
      };

      // Use the LLMServiceFactory to generate the response
      const response = await this.llmServiceFactory.generateResponse(
        config,
        factoryParams,
      );

      // Apply reverse pseudonymization if we have mappings
      if (
        dictionaryMappings &&
        dictionaryMappings.length > 0 &&
        response.content
      ) {
        const reverseResult =
          await this.dictionaryPseudonymizerService.reversePseudonyms(
            response.content,
            dictionaryMappings,
          );
        response.content = reverseResult.originalText;
        this.logger.debug(
          `🔄 [LLM-SERVICE] Reversed ${reverseResult.reversalCount} pseudonyms in response`,
        );
      }

      // Ensure PII metadata is included in response
      if (enhancedPiiMetadata) {
        response.piiMetadata = enhancedPiiMetadata;
      }

      // Return either string or full response based on includeMetadata flag
      if (params.options?.includeMetadata) {
        return response;
      } else {
        return response.content;
      }
    } catch (error) {
      // Standardized error handling
      try {
        const mapped = LLMErrorMapper.fromGenericError(
          error,
          params.provider,
          params.model,
        );
        LLMErrorMonitor.recordError(mapped);
        this.logger.error(
          `🚨 [UNIFIED-LLM] Standardized error`,
          mapped.getTechnicalDetails(),
        );
        throw mapped;
      } catch {
        const fallback = new LLMError(
          `Unified LLM service error: ${error instanceof Error ? error.message : String(error)}`,
          LLMErrorType.UNKNOWN,
          params.provider,
          { model: params.model, originalError: error },
        );
        LLMErrorMonitor.recordError(fallback);
        this.logger.error(
          `🚨 [UNIFIED-LLM] Fallback error`,
          fallback.getTechnicalDetails(),
        );
        throw fallback;
      }
    }
  }

  /**
   * Centralized LLM call with routing, metadata tracking, and secret redaction
   *
   * @deprecated This method is deprecated. Please use generateUnifiedResponse instead for new implementations.
   * This method will be maintained for backward compatibility but may be removed in future versions.
   */
  // REMOVED: generateCentralizedResponse method - replaced by generateUnifiedResponse

  /**
   * Call provider using routing decision with conditional sanitization
   */
  private async callProviderWithRouting(
    routingDecision: import('./types/pii-metadata.types').RoutingDecisionWithPII,
    systemPrompt: string,
    userMessage: string,
    headers: Record<string, unknown>,
    options: Record<string, unknown>,
  ): Promise<{
    content: string;
    inputTokens?: number;
    outputTokens?: number;
    enhancedMetrics?: LLMUsageMetrics;
    sanitizationMetadata?: Record<string, unknown>;
  }> {
    const _startTime = Date.now();

    // ALWAYS apply dictionary-based pseudonymization first
    const pseudonymResult =
      await this.dictionaryPseudonymizerService.pseudonymizeText(userMessage);
    const processedUserMessage = pseudonymResult.pseudonymizedText;

    this.logger.debug(
      `[LLMService] Dictionary pseudonymization applied. ${pseudonymResult.mappings.length} replacements made.`,
    );

    // Merge dictionary pseudonymization results into the main PII metadata
    if (pseudonymResult.mappings.length > 0 && routingDecision.piiMetadata) {
      const piiMetadata = routingDecision.piiMetadata;
      piiMetadata.piiDetected = true;

      if (!piiMetadata.pseudonymInstructions) {
        piiMetadata.pseudonymInstructions = {
          shouldPseudonymize: false,
          targetMatches: [],
          requestId: `dict-${Date.now()}`,
          context: 'dictionary-only',
        };
      }
      piiMetadata.pseudonymInstructions.shouldPseudonymize = true;

      const dictionaryMatches = pseudonymResult.mappings.map((m) => ({
        value: m.originalValue,
        dataType: m.dataType,
        severity: 'warning', // Use 'warning' to represent pseudonymization
        confidence: 1.0,
        startIndex: -1,
        endIndex: -1,
        pattern: 'dictionary_match',
        pseudonym: m.pseudonym,
      }));

      piiMetadata.pseudonymInstructions.targetMatches.push(
        ...(dictionaryMatches as PIIMatch[]),
      );
    }

    // Use LocalLLMService for local Ollama models - NO SANITIZATION needed
    if (routingDecision.isLocal && routingDecision.provider === 'ollama') {
      this.logger.debug('Using local Ollama - skipping sanitization');

      const response = await this.localLLMService.generateResponse({
        model: routingDecision.model,
        prompt: userMessage,
        system: systemPrompt,
        options: {
          temperature: options.temperature as number | undefined,
          max_tokens: options.maxTokens as number | undefined,
        },
      });

      // Create enhanced metrics for local provider
      const enhancedMetrics: LLMUsageMetrics = {
        inputTokens: response.prompt_eval_count,
        outputTokens: response.eval_count,
        totalCost: 0, // Local models have no cost
        responseTimeMs: 0, // Would be calculated by caller

        // No sanitization for local models
        dataSanitizationApplied: false,
        sanitizationLevel: 'none',
        piiDetected: false,
        piiTypes: [],
        pseudonymsUsed: 0,
        pseudonymTypes: [],
        redactionsApplied: 0,
        redactionTypes: [],

        // No source blinding for local models
        sourceBlindingApplied: false,
        headersStripped: 0,
        customUserAgentUsed: false,
        proxyUsed: false,
        noTrainHeaderSent: false,
        noRetainHeaderSent: false,

        // Performance metrics
        sanitizationTimeMs: 0,
        reversalContextSize: 0,

        // Data classification
        dataClassification: 'public',
        policyProfile: 'local',
        sovereignMode: true, // Local = sovereign

        // Compliance flags for local processing
        complianceFlags: {
          gdprCompliant: true, // Local processing is GDPR compliant
          hipaaCompliant: true, // Local processing is HIPAA compliant
          pciCompliant: true, // Local processing is PCI compliant
        },
      };

      return {
        content: response.response,
        inputTokens: response.prompt_eval_count,
        outputTokens: response.eval_count,
        enhancedMetrics,
        // No sanitization metadata for local providers
        sanitizationMetadata: undefined,
      };
    }

    // For EXTERNAL providers - apply sanitization before sending
    if (this.debugEnabled)
      this.logger.debug('Using external provider - applying sanitization');

    // NEW ARCHITECTURE: All PII processing is handled in the unified response method
    // This method receives already-processed content and just calls the LLM

    // Use LangChain for external providers
    const llm = this.createCustomLangGraphLLM({
      provider: routingDecision.provider as
        | 'openai'
        | 'anthropic'
        | 'ollama'
        | 'google',
      model: routingDecision.model,
      temperature: options.temperature as number | undefined,
      maxTokens: options.maxTokens as number | undefined,
    });

    // Format messages for the specific provider - LLM service controls the format
    const messages = this.formatMessagesForProvider(
      systemPrompt,
      processedUserMessage,
      routingDecision.provider,
      routingDecision.model,
    );

    // Add debug logging to see what's being sent
    if (this.debugEnabled) {
      this.logger.debug(
        `🔍 [CENTRALIZED-LLM-DEBUG] Sending ${messages.length} messages to ${routingDecision.provider}/${routingDecision.model}`,
      );
    }

    const response = await llm.invoke(messages);
    let responseContent =
      (response.content as string) ||
      'I apologize, but I was unable to generate a response.';

    // Revert pseudonyms in the response
    if (pseudonymResult.mappings.length > 0) {
      const reversalResult =
        await this.dictionaryPseudonymizerService.reversePseudonyms(
          responseContent,
          pseudonymResult.mappings,
        );
      responseContent = reversalResult.originalText;
      this.logger.debug(
        `[LLMService] Dictionary pseudonymization reversed. ${reversalResult.reversalCount} items restored.`,
      );
    }

    // Estimate tokens (TODO: Get actual token counts from provider)
    const inputTokens = this.estimateTokens(
      systemPrompt + processedUserMessage,
    );
    const outputTokens = this.estimateTokens(responseContent);

    // NEW ARCHITECTURE: Use PII metadata from routing decision instead of legacy sanitization metrics
    const piiMetadata = routingDecision.piiMetadata;
    const hasPiiProcessing = piiMetadata && piiMetadata.piiDetected;
    const pseudonymCount =
      piiMetadata?.pseudonymInstructions?.targetMatches?.length || 0;

    const enhancedMetrics: LLMUsageMetrics = {
      inputTokens,
      outputTokens,
      totalCost: 0, // Would be calculated by caller
      responseTimeMs: 0, // Would be calculated by caller

      // NEW ARCHITECTURE: Data sanitization metrics from PII metadata
      dataSanitizationApplied: hasPiiProcessing,
      sanitizationLevel: hasPiiProcessing ? 'standard' : 'none',
      piiDetected: hasPiiProcessing,
      piiTypes: Object.keys(
        piiMetadata?.detectionResults?.dataTypesSummary || {},
      ),
      pseudonymsUsed: pseudonymCount,
      pseudonymTypes:
        piiMetadata?.pseudonymInstructions?.targetMatches?.map(
          (m: unknown) => (m as Record<string, unknown>).dataType as string,
        ) || [],
      redactionsApplied: 0, // Redaction is separate from pseudonymization in new architecture
      redactionTypes: [],

      // Source blinding metrics for external providers
      sourceBlindingApplied: !routingDecision.isLocal,
      headersStripped: !routingDecision.isLocal ? 15 : 0,
      customUserAgentUsed: !routingDecision.isLocal,
      proxyUsed: false,
      noTrainHeaderSent: !routingDecision.isLocal,
      noRetainHeaderSent: false,

      // Performance metrics from new architecture
      sanitizationTimeMs: 0, // Processing time is tracked elsewhere in new architecture
      reversalContextSize: piiMetadata ? JSON.stringify(piiMetadata).length : 0,

      // Data classification
      dataClassification:
        (options.dataClassification as
          | 'public'
          | 'internal'
          | 'confidential'
          | 'restricted'
          | undefined) || 'public',
      policyProfile:
        (options.policyProfile as string | undefined) || 'standard',
      sovereignMode: routingDecision.isLocal || false,

      // NEW ARCHITECTURE: Compliance flags based on actual PII processing
      complianceFlags: {
        gdprCompliant: hasPiiProcessing && pseudonymCount > 0,
        hipaaCompliant: hasPiiProcessing && pseudonymCount > 0,
        pciCompliant: piiMetadata?.showstopperDetected === false, // No showstoppers = safer
      },
    };

    return {
      content: responseContent,
      inputTokens,
      outputTokens,
      enhancedMetrics,
      // NEW ARCHITECTURE: Include PII metadata for frontend privacy indicators
      sanitizationMetadata: await this.extractSanitizationMetadataForFrontend({
        sanitizationLevel: hasPiiProcessing ? 'standard' : 'none',
        pseudonymCount: pseudonymCount,
        processingTimeMs: 0, // Processing time tracked elsewhere in new architecture
      }),
    };
  }

  /**
   * Get default headers for requests
   */
  private getDefaultHeaders(
    options: Record<string, unknown>,
    providerConfig: Record<string, unknown>,
  ): Record<string, string> {
    return {
      'X-Policy-Profile':
        (options.policyProfile as string | undefined) || 'standard',
      'X-Data-Class': (options.dataClass as string | undefined) || 'public',
      'X-Sovereign-Mode':
        (options.sovereignMode as string | undefined) || 'false',
      ...((providerConfig.headers as Record<string, string> | undefined) || {}),
    };
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
      // Use LangChain LLM instead of raw OpenAI - this gets automatic LangSmith tracing
      const llm = this.getLangGraphLLM('openai');

      // Build messages array with system prompt, conversation history, and current message
      // Note: This method assumes OpenAI models, but we should check for o1 models
      const messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }> = [];

      // Check if this might be an o1 model (this method doesn't have model info, so we'll use a heuristic)
      const isLikelyO1Model = false; // TODO: Add model detection if needed

      if (isLikelyO1Model) {
        // For o1 models, combine system prompt with first user message
        const firstUserMessage =
          conversationHistory.find((msg) => msg.role === 'user')?.content ||
          currentMessage;
        const combinedMessage = systemPrompt
          ? `${systemPrompt}\n\nUser: ${firstUserMessage}`
          : firstUserMessage;

        messages.push({
          role: 'user',
          content: combinedMessage,
        });

        // Add remaining conversation history (skip the first user message if we used it)
        conversationHistory.forEach((msg, index) => {
          if (!(msg.role === 'user' && index === 0)) {
            messages.push({
              role: msg.role,
              content: msg.content,
            });
          }
        });

        // Add current message if it wasn't the first user message
        if (
          conversationHistory.length === 0 ||
          conversationHistory[0]?.role !== 'user'
        ) {
          messages.push({
            role: 'user',
            content: currentMessage,
          });
        }
      } else {
        // Standard model handling
        messages.push({
          role: 'system',
          content: systemPrompt,
        });

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
      }

      const response = await llm.invoke(messages);
      const content =
        (response.content as string) ||
        'I apologize, but I was unable to generate a response.';

      return content;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`LLM service error: ${errorMessage}`);
    }
  }

  /**
   * Generate response for system operations using optimized configurations
   * This method is for orchestrator internal operations, not user content
   */
  async generateSystemResponse(
    operationType: SystemOperationType,
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    try {
      // Resolve configuration (global single default or environment-specific)
      const selectedDefault = this.modelConfigurationService.isGlobal()
        ? this.modelConfigurationService.getGlobalDefault()
        : this.modelConfigurationService.getEnvironmentDefault(
            this.resolveEnvironment(),
          );

      // Create LLM instance with environment default configuration
      const llm = this.createCustomLangGraphLLM({
        provider: selectedDefault.provider as
          | 'openai'
          | 'anthropic'
          | 'ollama'
          | 'google',
        model: selectedDefault.model,
        temperature: selectedDefault.parameters?.temperature as
          | number
          | undefined,
        maxTokens: selectedDefault.parameters?.maxTokens as number | undefined,
      });

      // Format messages using selected provider/model
      const messages = this.formatMessagesForProvider(
        systemPrompt,
        userMessage,
        selectedDefault.provider,
        selectedDefault.model,
      );

      // Debug
      if (this.debugEnabled) {
        this.logger.debug(
          `🔍 [SYSTEM-LLM-DEBUG] Sending ${messages.length} messages to ${selectedDefault.provider}/${selectedDefault.model}`,
        );
      }

      const response = await llm.invoke(messages);
      const content =
        (response.content as string) ||
        'I apologize, but I was unable to generate a system response.';

      return content;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`System LLM operation error: ${errorMessage}`);
    }
  }

  /**
   * Resolve environment name explicitly for configuration defaults
   */
  private resolveEnvironment(): EnvironmentName {
    const env = (process.env.NODE_ENV || '').toLowerCase();
    if (env === 'production' || env === 'staging' || env === 'development') {
      return env as EnvironmentName;
    }
    // Default to development only if explicitly configured via MODEL_CONFIG_*; otherwise require explicit
    // For safety, enforce explicit environment selection to avoid hidden fallbacks
    throw new Error(
      `Invalid NODE_ENV '${process.env.NODE_ENV}'. Expected one of 'development', 'staging', 'production'. ` +
        `Set NODE_ENV accordingly, or provide MODEL_CONFIG_JSON/PATH with the intended environment defaults.`,
    );
  }

  /**
   * Generate response for user content using their preferences
   * This is the method that should be used for actual user content generation
   */
  async generateUserContentResponse(
    systemPrompt: string,
    userMessage: string,
    userPreferences: UserLLMPreferences,
    authToken?: string,
    sessionId?: string,
  ): Promise<{
    content: string;
    usage: LLMUsageMetrics;
    costCalculation: CostCalculation;
    langsmithRunId?: string;
    processedPrompt: string;
    cidafmState?: Record<string, unknown>;
    llmMetadata?: {
      providerName: string;
      modelName: string;
      temperature?: number;
      maxTokens?: number;
      responseTimeMs?: number;
    };
  }> {
    try {
      // Validate user preferences
      if (!userPreferences.providerName) {
        throw new Error('User preferences must include a valid providerName');
      }
      if (!userPreferences.modelName) {
        throw new Error('User preferences must include a valid modelName');
      }

      // Use the unified response method
      const result = await this.generateUnifiedResponse({
        provider: userPreferences.providerName,
        model: userPreferences.modelName,
        systemPrompt,
        userMessage,
        options: {
          temperature: userPreferences.temperature,
          maxTokens: userPreferences.maxTokens,
          sessionId: sessionId,
          userId: authToken || 'user',
          includeMetadata: true, // This method expects rich metadata
        },
      });

      // Convert the LLMResponse to the expected format for backward compatibility
      if (typeof result === 'string') {
        throw new Error('Expected rich metadata from unified response');
      }

      return {
        content: result.content,
        usage: {
          provider: result.metadata.provider,
          model: result.metadata.model,
          inputTokens: result.metadata.usage.inputTokens,
          outputTokens: result.metadata.usage.outputTokens,
          totalTokens: result.metadata.usage.totalTokens,
          cost: result.metadata.usage.cost || 0,
          currency: 'USD',
          responseTimeMs: result.metadata.timing.duration,
          timestamp: result.metadata.timestamp,
          userId: authToken || 'user',
          sessionId: sessionId,
          callerType: 'user',
          callerName: 'user-content-response',
        } as LLMUsageMetrics,
        costCalculation: {
          inputTokens: result.metadata.usage.inputTokens,
          outputTokens: result.metadata.usage.outputTokens,
          inputCost: 0,
          outputCost: 0,
          totalCost: result.metadata.usage.cost || 0,
          currency: 'USD',
        } as CostCalculation,
        langsmithRunId: result.metadata.langsmithRunId,
        processedPrompt: userMessage, // Simplified for now
        cidafmState: undefined, // CIDAFM not supported in unified method yet
        llmMetadata: {
          providerName: result.metadata.provider,
          modelName: result.metadata.model,
          temperature: userPreferences.temperature,
          maxTokens: userPreferences.maxTokens,
          responseTimeMs: result.metadata.timing.duration,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`User content LLM error: ${errorMessage}`);
    }
  }

  /**
   * Format messages for specific provider using proper LangChain message types
   */
  private formatMessagesForProvider(
    systemPrompt: string,
    userMessage: string,
    provider: string,
    modelName?: string,
  ): Array<HumanMessage | SystemMessage | AIMessage> {
    // Check if this is an o1 model (only supports user/assistant)
    const isO1Model = modelName?.includes('o1') || false;

    if (isO1Model) {
      // O1 models: combine system + user into single HumanMessage
      const combinedMessage = systemPrompt
        ? `${systemPrompt}\n\nUser: ${userMessage}`
        : userMessage;
      return [new HumanMessage(combinedMessage)];
    }

    // For all other providers, let LangChain handle the conversion properly
    switch (provider.toLowerCase()) {
      case 'openai': {
        // OpenAI with ChatOpenAI: use HumanMessage only to avoid system role issues
        const combinedOpenAI = systemPrompt
          ? `${systemPrompt}\n\nUser: ${userMessage}`
          : userMessage;
        return [new HumanMessage(combinedOpenAI)];
      }

      case 'anthropic': {
        // Anthropic: can handle SystemMessage + HumanMessage properly
        const messages = [];
        if (systemPrompt) {
          messages.push(new SystemMessage(systemPrompt));
        }
        messages.push(new HumanMessage(userMessage));
        return messages;
      }

      case 'ollama': {
        // Ollama: use HumanMessage only for consistency
        const combinedOllama = systemPrompt
          ? `${systemPrompt}\n\nUser: ${userMessage}`
          : userMessage;
        return [new HumanMessage(combinedOllama)];
      }

      case 'google': {
        // Google: use HumanMessage only for consistency
        const combinedGoogle = systemPrompt
          ? `${systemPrompt}\n\nUser: ${userMessage}`
          : userMessage;
        return [new HumanMessage(combinedGoogle)];
      }

      default: {
        // Default: use HumanMessage approach
        const combinedDefault = systemPrompt
          ? `${systemPrompt}\n\nUser: ${userMessage}`
          : userMessage;
        return [new HumanMessage(combinedDefault)];
      }
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
          // Use source-blinded LLM for external providers
          llm = this.blindedLLMService.createBlindedLLM({
            provider: 'openai',
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
            apiKey: process.env.OPENAI_API_KEY,
            sourceBlindingOptions: {
              policyProfile: 'standard',
              dataClass: 'public',
              sovereignMode: 'false',
              noTrain: true,
              noRetain: false,
            },
          });
          break;

        case 'anthropic':
          // Use source-blinded LLM for external providers
          llm = this.blindedLLMService.createBlindedLLM({
            provider: 'anthropic',
            model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
            temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
            maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000'),
            apiKey: process.env.ANTHROPIC_API_KEY,
            sourceBlindingOptions: {
              policyProfile: 'standard',
              dataClass: 'public',
              sovereignMode: 'false',
              noTrain: true,
              noRetain: false,
            },
          });
          break;

        case 'ollama':
          // Ollama is local - no source blinding needed
          llm = new ChatOllama({
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'llama2',
            temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
          });
          break;

        case 'google':
          // Use source-blinded LLM for external providers
          llm = this.blindedLLMService.createBlindedLLM({
            provider: 'google',
            model: process.env.GOOGLE_MODEL || 'gemini-pro',
            temperature: parseFloat(process.env.GOOGLE_TEMPERATURE || '0.7'),
            maxTokens: parseInt(process.env.GOOGLE_MAX_TOKENS || '2000'),
            apiKey: process.env.GOOGLE_API_KEY,
            sourceBlindingOptions: {
              policyProfile: 'standard',
              dataClass: 'public',
              sovereignMode: 'false',
              noTrain: true,
              noRetain: false,
            },
          });
          break;

        default:
          llm = this.getLangGraphLLM('openai');
      }

      // LangSmith will automatically trace this LangChain LLM if environment variables are set
      return llm;
    } catch (error) {
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
        case 'openai': {
          // Check if this is an o1 model (doesn't support custom temperature)
          const isO1Model = config.model?.includes('o1') || false;
          const temperature = isO1Model
            ? undefined
            : (config.temperature ??
              parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'));

          // Require explicit model - no fallbacks allowed
          if (!config.model) {
            throw new Error(
              'OpenAI model must be explicitly specified - no fallback model configured',
            );
          }

          // Use source-blinded LLM for external providers
          llm = this.blindedLLMService.createBlindedLLM({
            provider: 'openai',
            model: config.model,
            temperature: temperature,
            maxTokens:
              config.maxTokens ??
              parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
            apiKey: config.apiKey || process.env.OPENAI_API_KEY,
            baseUrl: config.baseUrl, // Pass the database baseUrl for correct provider routing
            sourceBlindingOptions: {
              policyProfile: 'standard',
              dataClass: 'public',
              sovereignMode: 'false',
              noTrain: true,
              noRetain: false,
            },
          });
          break;
        }

        case 'anthropic': {
          // Use source-blinded LLM for external providers
          llm = this.blindedLLMService.createBlindedLLM({
            provider: 'anthropic',
            model:
              config.model ||
              process.env.ANTHROPIC_MODEL ||
              'claude-3-5-sonnet-20241022',
            temperature:
              config.temperature ??
              parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
            maxTokens:
              config.maxTokens ??
              parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000'),
            apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
            baseUrl: config.baseUrl, // Pass the database baseUrl for correct provider routing
            sourceBlindingOptions: {
              policyProfile: 'standard',
              dataClass: 'public',
              sovereignMode: 'false',
              noTrain: true,
              noRetain: false,
            },
          });
          break;
        }

        case 'ollama': {
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
        }

        case 'google': {
          // Use source-blinded LLM for external providers
          llm = this.blindedLLMService.createBlindedLLM({
            provider: 'google',
            model: config.model || process.env.GOOGLE_MODEL || 'gemini-pro',
            temperature:
              config.temperature ??
              parseFloat(process.env.GOOGLE_TEMPERATURE || '0.7'),
            maxTokens:
              config.maxTokens ??
              parseInt(process.env.GOOGLE_MAX_TOKENS || '2000'),
            apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
            sourceBlindingOptions: {
              policyProfile: 'standard',
              dataClass: 'public',
              sovereignMode: 'false',
              noTrain: true,
              noRetain: false,
            },
          });
          break;
        }

        default:
          throw new Error(`Unsupported provider: ${String(config.provider)}`);
      }

      // LangSmith will automatically trace this LangChain LLM if environment variables are set
      return llm;
    } catch (error) {
      throw new Error(
        `Failed to create custom LangGraph LLM: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get provider and model from database by names, with fallback to defaults
   */
  private async getProviderAndModel(
    providerName?: string,
    modelName?: string,
  ): Promise<{ provider: Provider; model: Model }> {
    const client = this.supabaseService.getServiceClient();

    // If both are provided, fetch them
    if (providerName && modelName) {
      const [providerResult, modelResult] = await Promise.all([
        client
          .from(getTableName('llm_providers'))
          .select('*')
          .eq('name', providerName)
          .single(),
        client
          .from(getTableName('llm_models'))
          .select('*')
          .eq('model_name', modelName)
          .eq('provider_name', providerName)
          .single(),
      ]);

      if (providerResult.data && modelResult.data) {
        return {
          provider: mapProviderFromDb(
            providerResult.data as Record<string, unknown>,
          ),
          model: mapModelFromDb(modelResult.data as Record<string, unknown>),
        };
      }

      // If specific provider/model requested but not found, throw error instead of falling back
      throw new Error(
        `Requested provider '${providerName}' with model '${modelName}' not found in database. Please ensure the provider and model are properly configured.`,
      );
    }

    // If no provider/model specified, this is a configuration error
    throw new Error(
      'No provider or model specified. Please provide both providerName and modelName.',
    );
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
    const { data: provider } = (await client
      .from(getTableName('llm_providers'))
      .select('*')
      .eq('name', model.providerName)
      .single()) as { data: Record<string, unknown> | null };

    if (!provider) {
      throw new Error(`Provider not found for model ${model.name}`);
    }

    const mappedProvider = mapProviderFromDb(provider);

    // Map provider names to our LLM creation logic
    // Note: Database provider names are lowercase, display_names are title case
    const providerMap: Record<string, string> = {
      // Database name mappings (lowercase)
      openai: 'openai',
      anthropic: 'anthropic',
      google: 'google',
      ollama: 'ollama',
      grok: 'openai', // Grok uses OpenAI-compatible API
      // Display name mappings (title case) - for backward compatibility
      OpenAI: 'openai',
      Anthropic: 'anthropic',
      Google: 'google',
      'Google Gemini': 'google',
      Ollama: 'ollama',
      'Grok (xAI)': 'openai', // Grok uses OpenAI-compatible API
      'X.AI (Grok)': 'openai', // Alternative Grok name
      Groq: 'openai', // Groq uses OpenAI-compatible API
      'Together AI': 'openai', // Together AI uses OpenAI-compatible API
      Cohere: 'openai', // Cohere can use OpenAI-compatible API
      Mistral: 'openai', // Mistral uses OpenAI-compatible API
    };

    const providerType = providerMap[mappedProvider.name] || 'openai';

    // Get the correct API key for this provider
    const providerApiKey = this.getApiKeyForProvider(mappedProvider.name);

    return this.createCustomLangGraphLLM({
      provider: providerType as 'openai' | 'anthropic' | 'ollama' | 'google',
      model: model.name,
      temperature: overrides?.temperature,
      maxTokens: overrides?.maxTokens || model.maxTokens,
      apiKey: providerApiKey,
      baseUrl: mappedProvider.apiBaseUrl,
    });
  }

  /**
   * Get the correct API key for a provider
   */
  private getApiKeyForProvider(providerName: string): string | undefined {
    const envPrefix = providerName.toUpperCase();

    // Map provider names to their environment variable names
    const apiKeyMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GOOGLE_API_KEY',
      grok: 'GROK_API_KEY',
      ollama: 'OLLAMA_API_KEY',
      // Add other providers as needed
    };

    const envVarName =
      apiKeyMap[providerName.toLowerCase()] || `${envPrefix}_API_KEY`;
    return process.env[envVarName];
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

  /**
   * Extract sanitization metadata in the format expected by the frontend
   */
  private async extractSanitizationMetadataForFrontend(
    sanitizationMetrics: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (
      !sanitizationMetrics ||
      sanitizationMetrics.sanitizationLevel === 'none'
    ) {
      return {
        status: 'none',
        piiDetectionCount: 0,
        piiTypes: [],
        piiSeverityLevels: [],
      };
    }

    // Get PII severity levels from database based on detected types
    const piiSeverityLevels = await this.getPiiSeverityLevels(
      (sanitizationMetrics.piiTypes as string[] | undefined) || [],
    );

    return {
      status: sanitizationMetrics.piiDetected ? 'completed' : 'none',
      piiDetectionCount:
        ((sanitizationMetrics.pseudonymsUsed as number | undefined) || 0) +
        ((sanitizationMetrics.redactionsApplied as number | undefined) || 0),
      piiTypes: sanitizationMetrics.piiTypes || [],
      piiSeverityLevels: piiSeverityLevels,
      sanitizationLevel: sanitizationMetrics.sanitizationLevel,
      pseudonymsUsed: sanitizationMetrics.pseudonymsUsed,
      redactionsApplied: sanitizationMetrics.redactionsApplied,
    };
  }

  /**
   * Get PII severity levels from database based on detected PII types
   */
  private async getPiiSeverityLevels(piiTypes: string[]): Promise<string[]> {
    if (!piiTypes || piiTypes.length === 0) {
      return [];
    }

    try {
      // Query the redaction_patterns table to get severity levels for detected PII types
      const { data: result, error } = await this.supabaseService
        .getServiceClient()
        .from('redaction_patterns')
        .select('severity, data_type')
        .in('data_type', piiTypes);

      if (error) {
        this.logger.warn(
          `Failed to fetch PII severity levels: ${error.message}`,
        );
        // Fallback to default mapping
        return this.getDefaultSeverityMapping(piiTypes);
      }

      const patterns = result as RedactionPatternDbRecord[] | null;
      // Extract unique severity levels
      const severityLevels = [
        ...new Set(patterns?.map((p) => p.severity) || []),
      ];
      return severityLevels.filter(Boolean);
    } catch (error) {
      this.logger.warn(
        `Error fetching PII severity levels: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback to default mapping
      return this.getDefaultSeverityMapping(piiTypes);
    }
  }

  /**
   * Fallback mapping for PII types to severity levels when database query fails
   */
  private getDefaultSeverityMapping(piiTypes: string[]): string[] {
    const severityMap: Record<string, string> = {
      ssn: 'showstopper',
      credit_card: 'showstopper',
      creditCard: 'showstopper',
      email: 'pseudonymizer',
      phone: 'pseudonymizer',
      ipAddress: 'flagger',
      ip_address: 'flagger',
      name: 'pseudonymizer',
      api_key: 'showstopper',
      other: 'flagger',
    };

    const severities = piiTypes.map((type) => severityMap[type] || 'flagger');
    return [...new Set(severities)]; // Remove duplicates
  }
}
