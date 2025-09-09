import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { SupabaseService } from '../supabase/supabase.service';
import { CIDAFMService } from '../cidafm/cidafm.service';
import { CentralizedRoutingService } from './centralized-routing.service';
import { RunMetadataService, RunMetadata } from './run-metadata.service';
import { ProviderConfigService } from './provider-config.service';
import { DataSanitizationService, DetailedSanitizationMetrics } from './data-sanitization.service';
import { PIIService } from '../services/pii.service';
import { PseudonymizerService } from '../services/pseudonymizer.service';
import { DictionaryPseudonymizerService } from '../services/dictionary-pseudonymizer.service';
import { PIIProcessingMetadata } from '../common/types/pii-metadata.types';
import { LocalModelStatusService } from './local-model-status.service';
import { LocalLLMService } from './local-llm.service';
import { BlindedLLMService } from './blinded-llm.service';
import {
  Provider,
  Model,
  CostCalculation,
  LLMUsageMetrics,
  CIDAFMOptions,
  SystemLLMConfigs,
  SystemOperationType,
  UserLLMPreferences,
} from '../types/llm-evaluation';
import { mapProviderFromDb, mapModelFromDb } from '../utils/case-converter';
import { getTableName } from '../supabase/supabase.config';

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

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly cidafmService: CIDAFMService,
    private readonly centralizedRoutingService: CentralizedRoutingService,
    private readonly runMetadataService: RunMetadataService,
    private readonly providerConfigService: ProviderConfigService,
    private readonly dataSanitizationService: DataSanitizationService,
    private readonly piiService: PIIService,
    private readonly pseudonymizerService: PseudonymizerService,
    private readonly dictionaryPseudonymizerService: DictionaryPseudonymizerService,
    private readonly localModelStatusService: LocalModelStatusService,
    private readonly localLLMService: LocalLLMService,
    private readonly blindedLLMService: BlindedLLMService,
  ) {

    // Initialize OpenAI client only if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

    } else {

    }

    // Initialize system LLM configurations for different orchestrator operations
    // Each operation type can have its own optimized configuration
    this.systemLLMConfigs = {
      delegation: {
        provider: (process.env.SYSTEM_DELEGATION_LLM_PROVIDER as any) || 'disabled',
        model: process.env.SYSTEM_DELEGATION_LLM_MODEL || 'disabled',
        temperature: parseFloat(
          process.env.SYSTEM_DELEGATION_LLM_TEMPERATURE || '0.0',
        ),
        maxTokens: parseInt(
          process.env.SYSTEM_DELEGATION_LLM_MAX_TOKENS || '300',
        ),
        enabled: process.env.SYSTEM_DELEGATION_LLM_ENABLED !== 'false' && 
                 !!process.env.SYSTEM_DELEGATION_LLM_PROVIDER && 
                 !!process.env.SYSTEM_DELEGATION_LLM_MODEL,
        description: 'Fast delegation decisions - which agent to use',
      },
      agent_selection: {
        provider: (process.env.SYSTEM_AGENT_SELECTION_LLM_PROVIDER as any) || 'disabled',
        model: process.env.SYSTEM_AGENT_SELECTION_LLM_MODEL || 'disabled',
        temperature: parseFloat(
          process.env.SYSTEM_AGENT_SELECTION_LLM_TEMPERATURE || '0.1',
        ),
        maxTokens: parseInt(
          process.env.SYSTEM_AGENT_SELECTION_LLM_MAX_TOKENS || '400',
        ),
        enabled: process.env.SYSTEM_AGENT_SELECTION_LLM_ENABLED !== 'false' && 
                 !!process.env.SYSTEM_AGENT_SELECTION_LLM_PROVIDER && 
                 !!process.env.SYSTEM_AGENT_SELECTION_LLM_MODEL,
        description: 'Agent selection and matching logic',
      },
      response_coordination: {
        provider: (process.env.SYSTEM_RESPONSE_COORD_LLM_PROVIDER as any) || 'disabled',
        model: process.env.SYSTEM_RESPONSE_COORD_LLM_MODEL || 'disabled',
        temperature: parseFloat(
          process.env.SYSTEM_RESPONSE_COORD_LLM_TEMPERATURE || '0.2',
        ),
        maxTokens: parseInt(
          process.env.SYSTEM_RESPONSE_COORD_LLM_MAX_TOKENS || '800',
        ),
        enabled: process.env.SYSTEM_RESPONSE_COORD_LLM_ENABLED !== 'false' && 
                 !!process.env.SYSTEM_RESPONSE_COORD_LLM_PROVIDER && 
                 !!process.env.SYSTEM_RESPONSE_COORD_LLM_MODEL,
        description: 'Response coordination and organization',
      },
      conversation_analysis: {
        provider: (process.env.SYSTEM_CONVERSATION_LLM_PROVIDER as any) || 'disabled',
        model: process.env.SYSTEM_CONVERSATION_LLM_MODEL || 'disabled',
        temperature: parseFloat(
          process.env.SYSTEM_CONVERSATION_LLM_TEMPERATURE || '0.1',
        ),
        maxTokens: parseInt(
          process.env.SYSTEM_CONVERSATION_LLM_MAX_TOKENS || '600',
        ),
        enabled: process.env.SYSTEM_CONVERSATION_LLM_ENABLED !== 'false' && 
                 !!process.env.SYSTEM_CONVERSATION_LLM_PROVIDER && 
                 !!process.env.SYSTEM_CONVERSATION_LLM_MODEL,
        description: 'Conversation context analysis',
      },
      error_handling: {
        provider: (process.env.SYSTEM_ERROR_LLM_PROVIDER as any) || 'disabled',
        model: process.env.SYSTEM_ERROR_LLM_MODEL || 'disabled',
        temperature: parseFloat(
          process.env.SYSTEM_ERROR_LLM_TEMPERATURE || '0.0',
        ),
        maxTokens: parseInt(process.env.SYSTEM_ERROR_LLM_MAX_TOKENS || '200'),
        enabled: process.env.SYSTEM_ERROR_LLM_ENABLED !== 'false' && 
                 !!process.env.SYSTEM_ERROR_LLM_PROVIDER && 
                 !!process.env.SYSTEM_ERROR_LLM_MODEL,
        description: 'Error handling and fallback operations',
      },
      default: {
        provider: (process.env.SYSTEM_DEFAULT_LLM_PROVIDER as any) || 'disabled',
        model: process.env.SYSTEM_DEFAULT_LLM_MODEL || 'disabled',
        temperature: parseFloat(
          process.env.SYSTEM_DEFAULT_LLM_TEMPERATURE || '0.1',
        ),
        maxTokens: parseInt(process.env.SYSTEM_DEFAULT_LLM_MAX_TOKENS || '500'),
        enabled: process.env.SYSTEM_DEFAULT_LLM_ENABLED !== 'false' && 
                 !!process.env.SYSTEM_DEFAULT_LLM_PROVIDER && 
                 !!process.env.SYSTEM_DEFAULT_LLM_MODEL,
        description: 'Default system operations',
      },
    };

    Object.entries(this.systemLLMConfigs).forEach(([operation, config]) => {

    });

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
      // Support full LLM preferences from UI
      providerName?: string;
      modelName?: string;
      cidafmOptions?: CIDAFMOptions;
      authToken?: string;
      sessionId?: string;
      currentUser?: any; // User object with id, email, etc.
      userId?: string; // Direct user ID for usage tracking
      // Intelligent routing hints
      complexity?: 'simple' | 'medium' | 'complex' | 'reasoning'; // Task complexity for routing decisions
      // Caller tracking for usage analytics
      callerType?: string; // 'agent', 'api', 'user', 'system', 'service'
      callerName?: string; // 'metrics-agent', 'user-chat', 'api-endpoint', etc.
      conversationId?: string; // Optional conversation/session context
      dataClassification?: string; // 'public', 'internal', 'confidential', 'restricted'
      // Return format control
      includeMetadata?: boolean; // If true, return object with metadata instead of just string
    },
  ): Promise<string | any> {
    this.logger.debug(`🔍 [LLM-USAGE-DEBUG] generateResponse called with callerType: ${options?.callerType}, callerName: ${options?.callerName}, providerName: ${options?.providerName}, modelName: ${options?.modelName}`);
    try {
      // Debug LLM options being received

      // If providerName/modelName are provided, delegate to enhanced response for proper DB lookup
      if (options?.providerName || options?.modelName || options?.cidafmOptions) {
        this.logger.debug(`🔍 [LLM-USAGE-DEBUG] Delegating to generateEnhancedResponse`);

        // Extract user ID from userId field or currentUser object
        const userId = options.userId || options.currentUser?.id;

        const enhancedResult = await this.generateEnhancedResponse(
          userId,
          systemPrompt,
          userMessage,
          {
            provider: options.providerName,
            model: options.modelName,
            cidafmOptions: options.cidafmOptions,
            sessionId: options.sessionId,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            // Pass caller tracking options
            callerType: options.callerType,
            callerName: options.callerName,
            conversationId: options.conversationId,
            dataClassification: options.dataClassification,
          },
        );

        // Return just the content for backward compatibility with simple method
        return enhancedResult.content;
      }

      // Use centralized routing for intelligent provider/model selection
      // Only use centralized routing if no explicit provider/model is specified
      const hasExplicitSelection = (options?.provider || options?.providerName) && options?.modelName;
      
      // Use centralized routing if there's no explicit selection (regardless of routing hints)
      if (!hasExplicitSelection) {
        const centralizedResult = await this.generateCentralizedResponse(
          systemPrompt,
          userMessage,
          {
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
            // Map frontend field names to routing service field names
            provider: options?.provider || options?.providerName,
            model: options?.modelName,
            preferLocal: true, // Default to preferring local models
            maxComplexity: options?.complexity, // Pass complexity hint to routing
            authToken: options?.authToken,
            sessionId: options?.sessionId,
            currentUser: options?.currentUser,
            callerType: options?.callerType,
            callerName: options?.callerName,
            conversationId: options?.conversationId,
            dataClassification: options?.dataClassification,
          },
        );

        // Return just the content for backward compatibility
        return centralizedResult.content;
      }

      // Original simple implementation for backward compatibility
      const provider = options?.provider || options?.providerName;
      
      // No fallback - require explicit provider configuration
      if (!provider) {
        throw new Error(
          'No LLM provider specified. Please provide either "provider" or "providerName" in options. ' +
          'Available providers: ollama, anthropic, openai, google'
        );
      }
      
      const isLocalProvider = provider === 'ollama';
      
      this.logger.log(`🔍 [SIMPLE-LLM-DEBUG] Simple response path - provider: ${provider}, isLocal: ${isLocalProvider}`);
      this.logger.log(`🔍 [SIMPLE-LLM-DEBUG] User message preview: "${userMessage.substring(0, 100)}..."`);

      // Apply conditional sanitization using unified PII service
      // Generate request ID for pseudonymization context
      const requestId = options?.conversationId || options?.sessionId || `simple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Step 1: Pseudonymize user message before LLM call
      const pseudonymResult = await this.pseudonymizerService.pseudonymizeText(
        userMessage,
        requestId,
        { context: 'llm-call' }
      );

      const sanitizedSystemPrompt = systemPrompt; // System prompts typically don't contain user PII
      const sanitizedUserMessage = pseudonymResult.pseudonymizedText;

      this.logger.log(`🎭 [PSEUDONYMIZER-DEBUG] Pseudonymization completed: ${pseudonymResult.mappings.length} replacements in ${pseudonymResult.processingTimeMs}ms`);
      if (pseudonymResult.mappings.length > 0) {
        pseudonymResult.mappings.forEach(mapping => {
          this.logger.log(`🎭 [PSEUDONYMIZER-DEBUG] "${mapping.originalValue}" → "${mapping.pseudonym}"`);
        });
      }

      // Start usage tracking for simple path
      const routingDecision = {
        provider: provider,
        model: options?.modelName || 'default',
        tier: provider === 'ollama' ? 'local' : 'external',
        isLocal: provider === 'ollama',
        routingReason: 'simple-path-default'
      };

      const metadataContext = await this.runMetadataService.startRequest(routingDecision, {
        userId: options?.userId || options?.currentUser?.id, // Accept userId directly or from currentUser object
        callerType: options?.callerType || 'system',
        callerName: options?.callerName || 'simple-llm',
        conversationId: options?.conversationId, // Use proper conversation ID from current system
        dataClassification: options?.dataClassification || 'internal',
      });

      try {
        // Use LangChain LLM instead of raw OpenAI - this gets automatic LangSmith tracing
        const llm =
          options?.temperature || options?.maxTokens || options?.provider
            ? this.createCustomLangGraphLLM({
                provider: provider as any,
                model: options?.modelName,
                temperature: options?.temperature,
                maxTokens: options?.maxTokens,
              })
            : this.getLangGraphLLM(provider as any);

        // Format messages for the specific provider - LLM service controls the format
        const messages = this.formatMessagesForProvider(
          sanitizedSystemPrompt,
          sanitizedUserMessage,
          provider,
          options?.modelName
        );
        
        // Add debug logging to see what's being sent
        this.logger.debug('🔍 [LLM-DEBUG] Messages being sent to LLM:', JSON.stringify(messages, null, 2));
        this.logger.debug('🔍 [LLM-DEBUG] Provider:', provider);
        this.logger.debug('🔍 [LLM-DEBUG] Model:', options?.modelName);

        const response = await llm.invoke(messages);
      let content = (response.content as string) || 'I apologize, but I was unable to generate a response.';

      // Step 2: Reverse pseudonyms in the response
      if (pseudonymResult.mappings.length > 0) {
        const reversalResult = await this.pseudonymizerService.reversePseudonyms(
          content,
          requestId
        );
        content = reversalResult.originalText;
        
        this.logger.log(`🔄 [PSEUDONYMIZER-DEBUG] Reversal completed: ${reversalResult.reversalCount} reversals in ${reversalResult.processingTimeMs}ms`);
        
        if (reversalResult.reversalCount === 0 && pseudonymResult.mappings.length > 0) {
          this.logger.warn(`🔄 [PSEUDONYMIZER-DEBUG] Expected reversals but none found - LLM may not have used the pseudonyms`);
        }
      }

      // Complete usage tracking for simple path
      await this.runMetadataService.completeRequest(metadataContext, {
        content: content,
        inputTokens: 0, // LangChain doesn't provide token counts easily
        outputTokens: 0,
      });

      // Return metadata if requested (for HTTP API calls)
      if (options?.includeMetadata) {
        // Create metadata from pseudonymization results
        const pseudonymizationMetadata = {
          pseudonymizationApplied: pseudonymResult.mappings.length > 0,
          pseudonymCount: pseudonymResult.mappings.length,
          processingTimeMs: pseudonymResult.processingTimeMs,
          mappings: pseudonymResult.mappings.map(m => ({
            type: m.dataType,
            originalLength: m.originalValue.length,
            pseudonymLength: m.pseudonym.length
          }))
        };
        
        return {
          content: content,
          response: content, // For backward compatibility
          sanitizationMetadata: pseudonymizationMetadata
        };
      }

      return content;
    } catch (error) {
      // Complete usage tracking with error for simple path
      if (metadataContext) {
        try {
          await this.runMetadataService.completeRequestWithError(
            metadataContext,
            error instanceof Error ? error : new Error(String(error))
          );
        } catch (trackingError) {
          this.logger.error('Failed to complete usage tracking on error:', trackingError);
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`LLM service error: ${errorMessage}`);
    }
  } catch (outerError) {
    // Handle any errors in the try block setup
    const errorMessage =
      outerError instanceof Error ? outerError.message : String(outerError);
    throw new Error(`LLM service error: ${errorMessage}`);
  }
  }

  /**
   * Enhanced LLM call with dynamic provider/model selection, CIDAFM processing, and cost tracking
   */
  async generateEnhancedResponse(
    userId: string | undefined,
    systemPrompt: string,
    userMessage: string,
    options?: {
      provider?: string;
      model?: string;
      cidafmOptions?: CIDAFMOptions;
      sessionId?: string;
      temperature?: number;
      maxTokens?: number;
      // Add caller tracking for usage analytics
      callerType?: string;
      callerName?: string;
      conversationId?: string;
      dataClassification?: string;
    },
  ): Promise<{
    content: string;
    usage: LLMUsageMetrics;
    costCalculation: CostCalculation;
    langsmithRunId?: string;
    processedPrompt: string;
    cidafmState?: any;
    llmMetadata?: {
      providerName: string;
      modelName: string;
      temperature?: number;
      maxTokens?: number;
      responseTimeMs?: number;
    };
    sanitizationMetadata?: any;
  }> {
    this.logger.debug(`🔍 [LLM-USAGE-DEBUG] generateEnhancedResponse called with userId: ${userId}, callerType: ${options?.callerType}, callerName: ${options?.callerName}`);
    const startTime = Date.now();
    let metadataContext: any = null;

    try {

      // Get provider and model information from database
      const { provider, model } = await this.getProviderAndModel(
        options?.provider,
        options?.model,
      );


      // Start usage tracking
      const routingDecision = {
        provider: provider?.name?.toLowerCase() || 'unknown',
        model: model?.name || 'unknown',
        isLocal: provider?.name?.toLowerCase() === 'ollama',
        modelTier: 'general', // Default tier for enhanced response
        fallbackUsed: false,
        complexityLevel: undefined,
        complexityScore: undefined,
        routingReason: 'enhanced-response-user-selection'
      };

      this.logger.debug(`🔍 [LLM-USAGE-DEBUG] Starting usage tracking with routing decision:`, routingDecision);
      metadataContext = await this.runMetadataService.startRequest(
        routingDecision,
        {
          userId: userId,
          callerType: options?.callerType || 'enhanced',
          callerName: options?.callerName || 'enhanced-llm',
          conversationId: options?.conversationId || options?.sessionId,
          dataClassification: options?.dataClassification || 'internal'
        }
      );
      this.logger.debug(`🔍 [LLM-USAGE-DEBUG] Usage tracking started, runId: ${metadataContext?.runId}`);

      // Process CIDAFM commands if provided
      let processedPrompt = userMessage;
      let cidafmState: any = {};

      if (options?.cidafmOptions || options?.sessionId) {
        const cidafmResult = await this.cidafmService.processMessage(
          userId || 'anonymous',
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

      // Determine if provider is local (Ollama) or external
      const isLocalProvider = provider.name.toLowerCase() === 'ollama';

      // Apply state modifiers to system prompt if any
      let enhancedSystemPrompt = this.applyStateModifiersToPrompt(
        systemPrompt,
        cidafmState.activeStateModifiers || [],
      );
      let finalProcessedPrompt = processedPrompt;
      let sanitizationContext: any = null;

      // Generate request ID for pseudonymization context
      const requestId = options?.conversationId || options?.sessionId || `enhanced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Step 1: Dictionary-based pseudonymization before LLM call
      const pseudonymResult = await this.dictionaryPseudonymizerService.pseudonymizeText(finalProcessedPrompt);

      // System prompts typically don't contain user PII, but process them if needed
      enhancedSystemPrompt = enhancedSystemPrompt; // Keep as-is for now
      finalProcessedPrompt = pseudonymResult.pseudonymizedText;
      sanitizationContext = pseudonymResult; // Store for reversal

      this.logger.log(`🎯 [DICTIONARY-PSEUDONYMIZER] Pseudonymization completed: ${pseudonymResult.mappings.length} replacements in ${pseudonymResult.processingTimeMs}ms`);
      if (pseudonymResult.mappings.length > 0) {
        pseudonymResult.mappings.forEach(mapping => {
          this.logger.log(`🎯 [DICTIONARY-PSEUDONYMIZER] "${mapping.originalValue}" → "${mapping.pseudonym}"`);
        });
      }

      // Create sanitization metrics for compatibility
      const sanitizationMetrics = {
        sanitizationLevel: pseudonymResult.mappings.length > 0 ? 'pseudonymized' : 'none',
        pseudonymCount: pseudonymResult.mappings.length,
        processingTimeMs: pseudonymResult.processingTimeMs
      };

      // Create LLM instance with dynamic configuration
      const llm = await this.createLLMFromModel(model, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      // Format messages for the specific provider - LLM service controls the format
      const messages = this.formatMessagesForProvider(
        enhancedSystemPrompt,
        finalProcessedPrompt,
        model.provider?.name || 'openai',
        model.name
      );

      // Generate response with token counting
      const response = await llm.invoke(messages);
      let content = (response.content as string) || 'I apologize, but I was unable to generate a response.';

      // Step 2: Reverse pseudonyms in the response
      if (sanitizationContext && sanitizationContext.mappings && sanitizationContext.mappings.length > 0) {
        const reversalResult = await this.dictionaryPseudonymizerService.reversePseudonyms(
          content,
          sanitizationContext.mappings
        );
        content = reversalResult.originalText;
        
        this.logger.log(`🔄 [DICTIONARY-PSEUDONYMIZER] Reversal completed: ${reversalResult.reversalCount} reversals in ${reversalResult.processingTimeMs}ms`);
        
        if (reversalResult.reversalCount === 0 && sanitizationContext.mappings.length > 0) {
          this.logger.warn(`🔄 [DICTIONARY-PSEUDONYMIZER] Expected reversals but none found - LLM may not have used the pseudonyms`);
        }
      }

      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;

      // Calculate token usage (simplified estimation) using the content that was actually sent
      const inputTokens = this.estimateTokens(
        enhancedSystemPrompt + finalProcessedPrompt,
      );
      const outputTokens = this.estimateTokens(content);

      // Calculate costs
      const costCalculation = this.calculateCost(
        inputTokens,
        outputTokens,
        model.pricingInputPer1k || 0,
        model.pricingOutputPer1k || 0,
      );

      // Dictionary-based pseudonymization metadata for database tracking
      const hasPiiProcessing = sanitizationContext && sanitizationContext.mappings && sanitizationContext.mappings.length > 0;
      const pseudonymCount = sanitizationContext?.mappings?.length || 0;

      const usage: LLMUsageMetrics = {
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        totalCost: costCalculation.totalCost,
        responseTimeMs: responseTimeMs,
        // langsmithRunId would be extracted from LangSmith tracing
        
        // Dictionary-based pseudonymization metrics
        dataSanitizationApplied: hasPiiProcessing,
        sanitizationLevel: hasPiiProcessing ? 'standard' : 'none' as 'none' | 'basic' | 'standard' | 'strict',
        piiDetected: hasPiiProcessing,
        piiTypes: sanitizationContext?.mappings?.map((m: any) => m.dataType) || [],
        pseudonymsUsed: pseudonymCount,
        pseudonymTypes: [...new Set(sanitizationContext?.mappings?.map((m: any) => m.dataType as string) || [])] as string[],
        redactionsApplied: 0, // New architecture uses pseudonymization, not redaction
        redactionTypes: [],
        
        // Source blinding metrics
        sourceBlindingApplied: !isLocalProvider, // External providers use source blinding
        headersStripped: !isLocalProvider ? 15 : 0, // Estimated number of headers stripped
        customUserAgentUsed: !isLocalProvider,
        
        // Provider-specific privacy headers (assume all external providers support no-train)
        noTrainHeaderSent: !isLocalProvider,
        noRetainHeaderSent: false, // Most providers don't support no-retain yet
        
        // Data classification (could be enhanced based on content analysis)
        dataClassification: 'public', // Default, could be inferred from content
        policyProfile: 'standard',
        sovereignMode: false,
        
        // Performance metrics
        sanitizationTimeMs: sanitizationContext?.processingTimeMs || 0,
        reversalContextSize: sanitizationContext?.mappings?.length || 0,
        
        // Dictionary-based compliance flags
        complianceFlags: {
          gdprCompliant: hasPiiProcessing && pseudonymCount > 0,
          hipaaCompliant: false, // Dictionary-based approach doesn't have severity levels
          pciCompliant: false, // Our dictionary doesn't contain credit card or SSN patterns
        },
      };

      // Complete usage tracking
      this.logger.debug(`🔍 [LLM-USAGE-DEBUG] Completing usage tracking for runId: ${metadataContext?.runId}, inputTokens: ${inputTokens}, outputTokens: ${outputTokens}`);
      const runMetadata = await this.runMetadataService.completeRequest(
        metadataContext,
        {
          content,
          inputTokens: inputTokens,
          outputTokens: outputTokens,
          enhancedMetrics: usage
        }
      );
      this.logger.debug(`🔍 [LLM-USAGE-DEBUG] Usage tracking completed successfully for runId: ${runMetadata?.runId}`);

      return {
        content,
        usage,
        costCalculation,
        processedPrompt,
        cidafmState,
        // Include LLM metadata for transparency
        llmMetadata: {
          providerName: provider.name,
          modelName: model.name,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          responseTimeMs: responseTimeMs,
        },
        // Include sanitization metadata for frontend privacy indicators
        sanitizationMetadata: await this.extractSanitizationMetadataForFrontend(sanitizationMetrics),
      };

      this.logger.log(`🔍 [LLM-DEBUG] Final sanitization metadata for frontend:`, JSON.stringify(await this.extractSanitizationMetadataForFrontend(sanitizationMetrics), null, 2));
    } catch (error) {
      // Note: Usage tracking for failed requests would need to be implemented
      // if we want to track failed enhanced LLM calls
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Enhanced LLM service error: ${errorMessage}`);
    }
  }

  /**
   * Centralized LLM call with routing, metadata tracking, and secret redaction
   */
  async generateCentralizedResponse(
    systemPrompt: string,
    userMessage: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      provider?: string;
      model?: string;
      preferLocal?: boolean;
      maxComplexity?: 'simple' | 'medium' | 'complex' | 'reasoning'; // Complexity hint for routing
      authToken?: string;
      sessionId?: string;
      currentUser?: any;
      userId?: string; // Direct user ID for usage tracking
      // Caller tracking for usage analytics
      callerType?: string; // 'agent', 'api', 'user', 'system', 'service'
      callerName?: string; // 'metrics-agent', 'user-chat', 'api-endpoint', etc.
      conversationId?: string; // Optional conversation/session context
      dataClassification?: string; // 'public', 'internal', 'confidential', 'restricted'
    },
  ): Promise<{
    content: string;
    runMetadata: RunMetadata;
    routingDecision: any;
    piiMetadata?: PIIProcessingMetadata; // NEW: Include PII metadata in response
  }> {
    const startTime = Date.now();

    try {
      // Step 1: Get routing decision from centralized routing service
      await this.dataSanitizationService.debug(
        'Starting centralized LLM request',
        undefined,
        'CentralizedLLM',
        { systemPromptLength: systemPrompt.length, userMessageLength: userMessage.length }
      );

      const routingDecision = await this.centralizedRoutingService.determineRoute(
        userMessage,
        options
      );

      // Check if request was blocked by PII policy
      if (routingDecision.provider === 'policy-blocked') {
        this.logger.warn(`Request blocked by PII policy: ${routingDecision.model}`);
        throw new Error(`Request blocked due to PII policy violation: ${routingDecision.model}`);
      }

      await this.dataSanitizationService.info(
        `Routing decision: ${routingDecision.provider}/${routingDecision.model} (${routingDecision.isLocal ? 'local' : 'external'})`,
        undefined,
        'CentralizedLLM',
        { routingDecision: routingDecision }
      );

      // Step 2: Start tracking metadata
      const metadataContext = await this.runMetadataService.startRequest(routingDecision, {
        userId: options?.userId || options?.currentUser?.id, // Accept userId directly or from currentUser object
        callerType: options?.callerType || 'system',
        callerName: options?.callerName || 'unknown',
        conversationId: options?.sessionId || options?.conversationId,
        dataClassification: options?.dataClassification,
      });

      try {
        // Step 3: Get provider configuration
        const providerConfig = this.providerConfigService.getEnhancedProviderConfig(routingDecision.provider);
        if (!providerConfig) {
          throw new Error(`Provider configuration not found: ${routingDecision.provider}`);
        }

        // Step 4: Add required headers
        const headers = this.providerConfigService.getDefaultHeaders(routingDecision.provider, {
          policyProfile: options?.sessionId ? 'session' : 'standard',
          dataClass: 'public', // TODO: Make this configurable
          sovereignMode: 'false', // TODO: Make this configurable
          noTrain: true,
          noRetain: false,
        });

        await this.dataSanitizationService.debug(
          'Generated request headers',
          metadataContext.runId,
          'CentralizedLLM',
          { headers }
        );

        // Step 5: NEW ARCHITECTURE - Apply boundary processing
        let effectiveUserMessage = userMessage;
        let effectiveSystemPrompt = systemPrompt;
        let piiMetadata: PIIProcessingMetadata | undefined;

        // Extract PII metadata from routing decision
        if (routingDecision.piiMetadata) {
          piiMetadata = routingDecision.piiMetadata;
          
          // If this is an external provider and we have pseudonym instructions, apply them
          if (!routingDecision.isLocal && piiMetadata.pseudonymInstructions?.shouldPseudonymize) {
            this.logger.debug(`🎭 [LLM-BOUNDARY] Applying pseudonymization for external provider`);
            
            const requestId = options?.conversationId || options?.sessionId || `llm-${Date.now()}`;
            
            try {
              // Apply dictionary-based pseudonymization to user message
              const pseudonymResult = await this.dictionaryPseudonymizerService.pseudonymizeText(userMessage);
              
              effectiveUserMessage = pseudonymResult.pseudonymizedText;
              
              // Store pseudonym mappings in routing decision for reversal
              (routingDecision as any).pseudonymMappings = pseudonymResult.mappings;
              
              this.logger.debug(`🎯 [DICTIONARY-PSEUDONYMIZER] Centralized pseudonymization applied: ${pseudonymResult.mappings.length} mappings created`);
              
            } catch (error) {
              this.logger.error(`🎯 [DICTIONARY-PSEUDONYMIZER] Centralized pseudonymization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
              // Continue with original text if pseudonymization fails
            }
          } else {
            this.logger.debug(`🎭 [LLM-BOUNDARY] No pseudonymization needed (local: ${routingDecision.isLocal}, shouldPseudonymize: ${piiMetadata.pseudonymInstructions?.shouldPseudonymize})`);
          }
        }

        // Step 6: Call provider with processed messages
        const response = await this.callProviderWithRouting(
          routingDecision as any, // Type conversion - routingDecision has piiMetadata from new architecture
          effectiveSystemPrompt,
          effectiveUserMessage,
          headers,
          options || {}
        );

        // Step 7: NEW ARCHITECTURE - Apply boundary reversal processing
        let finalResponseContent = response.content;
        
        // If we applied pseudonymization, reverse it now
        if (!routingDecision.isLocal && piiMetadata?.pseudonymInstructions?.shouldPseudonymize) {
          this.logger.debug(`🔄 [LLM-BOUNDARY] Reversing pseudonyms in response`);
          
          const requestId = options?.conversationId || options?.sessionId || `llm-${Date.now()}`;
          
          try {
            // Use the stored mappings from pseudonymization step
            const pseudonymMappings = (routingDecision as any).pseudonymMappings || [];
            const reversalResult = await this.dictionaryPseudonymizerService.reversePseudonyms(
              response.content,
              pseudonymMappings
            );
            
            finalResponseContent = reversalResult.originalText;
            
            this.logger.debug(`🔄 [DICTIONARY-PSEUDONYMIZER] Centralized reversal completed: ${reversalResult.reversalCount} items restored`);
            
            // Update PII metadata with reversal results
            if (piiMetadata) {
              piiMetadata = {
                ...piiMetadata,
                pseudonymResults: piiMetadata.pseudonymResults ? {
                  ...piiMetadata.pseudonymResults,
                  reversalSuccess: true,
                  reversalMatches: piiMetadata.pseudonymInstructions?.targetMatches || []
                } : undefined
              };
            }
            
          } catch (error) {
            this.logger.error(`🔄 [LLM-BOUNDARY] Pseudonym reversal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Continue with pseudonymized response if reversal fails
          }
        }

        // Step 8: Complete metadata tracking with enhanced metrics (async, non-blocking)
        const runMetadataPromise = this.runMetadataService.completeRequest(metadataContext, {
          content: finalResponseContent,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          enhancedMetrics: response.enhancedMetrics,
        }).catch(error => {
          this.logger.error(`Failed to complete usage tracking for ${metadataContext.runId}:`, error);
        });

        // Get essential metadata synchronously from context for immediate return
        const runMetadata = {
          runId: metadataContext.runId,
          provider: metadataContext.provider,
          model: metadataContext.model,
          tier: metadataContext.tier,
          cost: 0, // Will be calculated in background
          duration: Date.now() - metadataContext.startTime,
          timestamp: new Date().toISOString(),
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          status: 'completed' as const,
          enhancedMetrics: response.enhancedMetrics,
        };

        await this.dataSanitizationService.info(
          `Centralized LLM request completed successfully`,
          runMetadata.runId,
          'CentralizedLLM',
          { 
            duration: runMetadata.duration,
            cost: runMetadata.cost,
            provider: routingDecision.provider,
            model: routingDecision.model
          }
        );

        return {
          content: finalResponseContent, // Use processed content with pseudonym reversal
          runMetadata,
          routingDecision,
          piiMetadata, // Include PII metadata in response
        };

      } catch (error) {
        // Handle errors and still return metadata (async, non-blocking)
        this.runMetadataService.completeRequestWithError(metadataContext, error instanceof Error ? error : new Error('Unknown error')).catch(dbError => {
          this.logger.error(`Failed to record error in usage tracking for ${metadataContext.runId}:`, dbError);
        });

        // Create immediate error metadata from context
        const runMetadata = {
          runId: metadataContext.runId,
          provider: metadataContext.provider,
          model: metadataContext.model,
          tier: metadataContext.tier,
          cost: 0,
          duration: Date.now() - metadataContext.startTime,
          timestamp: new Date().toISOString(),
          status: 'error' as const,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        };
        
        await this.dataSanitizationService.error(
          `Centralized LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          runMetadata.runId,
          'CentralizedLLM',
          { error: error instanceof Error ? error.message : 'Unknown error', provider: routingDecision.provider }
        );

        throw new Error(`Centralized LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      await this.dataSanitizationService.error(
        `Centralized routing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'CentralizedLLM'
      );
      
      throw new Error(`Centralized LLM service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call provider using routing decision with conditional sanitization
   */
  private async callProviderWithRouting(
    routingDecision: import('../common/types/pii-metadata.types').RoutingDecisionWithPII,
    systemPrompt: string,
    userMessage: string,
    headers: any,
    options: any
  ): Promise<{
    content: string;
    inputTokens?: number;
    outputTokens?: number;
    enhancedMetrics?: LLMUsageMetrics;
    sanitizationMetadata?: any;
  }> {
    // Use LocalLLMService for local Ollama models - NO SANITIZATION needed
    if (routingDecision.isLocal && routingDecision.provider === 'ollama') {
      await this.dataSanitizationService.debug(
        'Using local Ollama - skipping sanitization',
        undefined,
        'CallProvider',
        { provider: routingDecision.provider, model: routingDecision.model }
      );

      const response = await this.localLLMService.generateResponse({
        model: routingDecision.model,
        prompt: userMessage,
        system: systemPrompt,
        options: {
          temperature: options.temperature,
          max_tokens: options.maxTokens,
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
        sanitizationMetadata: null,
      };
    }

    // For EXTERNAL providers - apply sanitization before sending
    await this.dataSanitizationService.debug(
      'Using external provider - applying sanitization',
      undefined,
      'CallProvider',
      { provider: routingDecision.provider, model: routingDecision.model }
    );

    // NEW ARCHITECTURE: All PII processing is handled in generateCentralizedResponse
    // This method receives already-processed content and just calls the LLM
    const requestId = options.conversationId || options.sessionId || `callprovider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Use LangChain for external providers
    const llm = this.createCustomLangGraphLLM({
      provider: routingDecision.provider as any,
      model: routingDecision.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    // Format messages for the specific provider - LLM service controls the format
    const messages = this.formatMessagesForProvider(
      systemPrompt,
      userMessage,
      routingDecision.provider,
      routingDecision.model
    );
    
    // Add debug logging to see what's being sent
    this.logger.debug('🔍 [CENTRALIZED-LLM-DEBUG] Messages being sent to LLM:', JSON.stringify(messages, null, 2));
    this.logger.debug('🔍 [CENTRALIZED-LLM-DEBUG] Provider:', routingDecision.provider);
    this.logger.debug('🔍 [CENTRALIZED-LLM-DEBUG] Model:', routingDecision.model);

    const response = await llm.invoke(messages);
    let responseContent = (response.content as string) || 'I apologize, but I was unable to generate a response.';

    // Note: Pseudonym reversal is now handled in generateCentralizedResponse method
    // This old reversal logic has been removed as part of the new architecture

    // Estimate tokens (TODO: Get actual token counts from provider)
    const inputTokens = this.estimateTokens(systemPrompt + userMessage);
    const outputTokens = this.estimateTokens(responseContent);

    // NEW ARCHITECTURE: Use PII metadata from routing decision instead of legacy sanitization metrics
    const piiMetadata = routingDecision.piiMetadata;
    const hasPiiProcessing = piiMetadata && piiMetadata.piiDetected;
    const pseudonymCount = piiMetadata?.pseudonymInstructions?.targetMatches?.length || 0;

    const enhancedMetrics: LLMUsageMetrics = {
      inputTokens,
      outputTokens,
      totalCost: 0, // Would be calculated by caller
      responseTimeMs: 0, // Would be calculated by caller
      
      // NEW ARCHITECTURE: Data sanitization metrics from PII metadata
      dataSanitizationApplied: hasPiiProcessing,
      sanitizationLevel: hasPiiProcessing ? 'standard' : 'none',
      piiDetected: hasPiiProcessing,
      piiTypes: Object.keys(piiMetadata?.detectionResults?.dataTypesSummary || {}),
      pseudonymsUsed: pseudonymCount,
      pseudonymTypes: piiMetadata?.pseudonymInstructions?.targetMatches?.map((m: any) => m.dataType) || [],
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
      dataClassification: options.dataClassification || 'public',
      policyProfile: options.policyProfile || 'standard',
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
        processingTimeMs: 0 // Processing time tracked elsewhere in new architecture
      }),
    };
  }

  /**
   * Get default headers for requests
   */
  private getDefaultHeaders(options: any, providerConfig: any): Record<string, string> {
    return {
      'X-Policy-Profile': options.policyProfile || 'standard',
      'X-Data-Class': options.dataClass || 'public',
      'X-Sovereign-Mode': options.sovereignMode || 'false',
      ...providerConfig.headers,
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
        const firstUserMessage = conversationHistory.find(msg => msg.role === 'user')?.content || currentMessage;
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
        if (conversationHistory.length === 0 || conversationHistory[0]?.role !== 'user') {
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
      const config = this.systemLLMConfigs[operationType];

      if (!config.enabled) {

        const defaultConfig = this.systemLLMConfigs.default;
        if (!defaultConfig.enabled) {
          throw new Error('All system LLM configurations are disabled');
        }
      }

      const activeConfig = config.enabled
        ? config
        : this.systemLLMConfigs.default;

      // Create LLM instance with system configuration
      const llm = this.createCustomLangGraphLLM({
        provider: activeConfig.provider as any,
        model: activeConfig.model,
        temperature: activeConfig.temperature,
        maxTokens: activeConfig.maxTokens,
      });

      // Format messages for the specific provider - LLM service controls the format
      const messages = this.formatMessagesForProvider(
        systemPrompt,
        userMessage,
        activeConfig.provider,
        activeConfig.model
      );
      
      // Add debug logging to see what's being sent
      this.logger.debug('🔍 [SYSTEM-LLM-DEBUG] Messages being sent to LLM:', JSON.stringify(messages, null, 2));
      this.logger.debug('🔍 [SYSTEM-LLM-DEBUG] Provider:', activeConfig.provider);
      this.logger.debug('🔍 [SYSTEM-LLM-DEBUG] Model:', activeConfig.model);

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
    cidafmState?: any;
    llmMetadata?: {
      providerName: string;
      modelName: string;
      temperature?: number;
      maxTokens?: number;
      responseTimeMs?: number;
    };
  }> {
    try {

      // Delegate to the existing enhanced response method
      return await this.generateEnhancedResponse(
        authToken || 'user',
        systemPrompt,
        userMessage,
        {
          provider: userPreferences.providerName,
          model: userPreferences.modelName,
          cidafmOptions: userPreferences.cidafmOptions,
          sessionId: sessionId,
          temperature: userPreferences.temperature,
          maxTokens: userPreferences.maxTokens,
        },
      );
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
    modelName?: string
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
      case 'openai':
        // OpenAI with ChatOpenAI: use HumanMessage only to avoid system role issues
        const combinedOpenAI = systemPrompt 
          ? `${systemPrompt}\n\nUser: ${userMessage}`
          : userMessage;
        return [new HumanMessage(combinedOpenAI)];
        
      case 'anthropic':
        // Anthropic: can handle SystemMessage + HumanMessage properly
        const messages = [];
        if (systemPrompt) {
          messages.push(new SystemMessage(systemPrompt));
        }
        messages.push(new HumanMessage(userMessage));
        return messages;
        
      case 'ollama':
        // Ollama: use HumanMessage only for consistency
        const combinedOllama = systemPrompt 
          ? `${systemPrompt}\n\nUser: ${userMessage}`
          : userMessage;
        return [new HumanMessage(combinedOllama)];
        
      case 'google':
        // Google: use HumanMessage only for consistency
        const combinedGoogle = systemPrompt 
          ? `${systemPrompt}\n\nUser: ${userMessage}`
          : userMessage;
        return [new HumanMessage(combinedGoogle)];
        
      default:
        // Default: use HumanMessage approach
        const combinedDefault = systemPrompt 
          ? `${systemPrompt}\n\nUser: ${userMessage}`
          : userMessage;
        return [new HumanMessage(combinedDefault)];
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
        case 'openai':
          // Check if this is an o1 model (doesn't support custom temperature)
          const isO1Model = config.model?.includes('o1') || false;
          const temperature = isO1Model ? undefined : (config.temperature ?? parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'));
          
          // Use source-blinded LLM for external providers
          llm = this.blindedLLMService.createBlindedLLM({
            provider: 'openai',
            model: config.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            temperature: temperature,
            maxTokens: config.maxTokens ?? parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
            apiKey: config.apiKey || process.env.OPENAI_API_KEY,
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
            model: config.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
            temperature: config.temperature ?? parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
            maxTokens: config.maxTokens ?? parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000'),
            apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
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
          // Use source-blinded LLM for external providers
          llm = this.blindedLLMService.createBlindedLLM({
            provider: 'google',
            model: config.model || process.env.GOOGLE_MODEL || 'gemini-pro',
            temperature: config.temperature ?? parseFloat(process.env.GOOGLE_TEMPERATURE || '0.7'),
            maxTokens: config.maxTokens ?? parseInt(process.env.GOOGLE_MAX_TOKENS || '2000'),
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

        default:
          throw new Error(`Unsupported provider: ${config.provider}`);
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
        client.from(getTableName('llm_providers')).select('*').eq('name', providerName).single(),
        client.from(getTableName('llm_models')).select('*')
          .eq('model_name', modelName)
          .eq('provider_name', providerName)
          .single(),
      ]);

      if (providerResult.data && modelResult.data) {
        return {
          provider: mapProviderFromDb(providerResult.data),
          model: mapModelFromDb(modelResult.data),
        };
      }

      // If specific provider/model requested but not found, throw error instead of falling back
      throw new Error(
        `Requested provider '${providerName}' with model '${modelName}' not found in database. Please ensure the provider and model are properly configured.`
      );
    }

    // If no provider/model specified, this is a configuration error
    throw new Error(
      'No provider or model specified. Please provide both providerName and modelName.'
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
    const { data: provider } = await client
      .from(getTableName('llm_providers'))
      .select('*')
      .eq('name', model.providerName)
      .single();

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

    return this.createCustomLangGraphLLM({
      provider: providerType as any,
      model: model.name,
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

  /**
   * Extract sanitization metadata in the format expected by the frontend
   */
  private async extractSanitizationMetadataForFrontend(sanitizationMetrics: any): Promise<any> {
    if (!sanitizationMetrics || sanitizationMetrics.sanitizationLevel === 'none') {
      return {
        status: 'none',
        piiDetectionCount: 0,
        piiTypes: [],
        piiSeverityLevels: []
      };
    }

    // Get PII severity levels from database based on detected types
    const piiSeverityLevels = await this.getPiiSeverityLevels(sanitizationMetrics.piiTypes);

    return {
      status: sanitizationMetrics.piiDetected ? 'completed' : 'none',
      piiDetectionCount: sanitizationMetrics.pseudonymsUsed + sanitizationMetrics.redactionsApplied,
      piiTypes: sanitizationMetrics.piiTypes || [],
      piiSeverityLevels: piiSeverityLevels,
      sanitizationLevel: sanitizationMetrics.sanitizationLevel,
      pseudonymsUsed: sanitizationMetrics.pseudonymsUsed,
      redactionsApplied: sanitizationMetrics.redactionsApplied
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
      const { data: patterns, error } = await this.supabaseService
        .getServiceClient()
        .from('redaction_patterns')
        .select('severity, data_type')
        .in('data_type', piiTypes);

      if (error) {
        this.logger.warn(`Failed to fetch PII severity levels: ${error.message}`);
        // Fallback to default mapping
        return this.getDefaultSeverityMapping(piiTypes);
      }

      // Extract unique severity levels
      const severityLevels = [...new Set(patterns?.map(p => p.severity) || [])];
      return severityLevels.filter(Boolean);
    } catch (error) {
      this.logger.warn(`Error fetching PII severity levels: ${error instanceof Error ? error.message : String(error)}`);
      // Fallback to default mapping
      return this.getDefaultSeverityMapping(piiTypes);
    }
  }

  /**
   * Fallback mapping for PII types to severity levels when database query fails
   */
  private getDefaultSeverityMapping(piiTypes: string[]): string[] {
    const severityMap: Record<string, string> = {
      'ssn': 'showstopper',
      'credit_card': 'showstopper',
      'creditCard': 'showstopper',
      'email': 'pseudonymizer',
      'phone': 'pseudonymizer',
      'ipAddress': 'flagger',
      'ip_address': 'flagger',
      'name': 'pseudonymizer',
      'api_key': 'showstopper',
      'other': 'flagger'
    };

    const severities = piiTypes.map(type => severityMap[type] || 'flagger');
    return [...new Set(severities)]; // Remove duplicates
  }
}
