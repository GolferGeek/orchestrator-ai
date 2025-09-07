import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SupabaseService } from '../supabase/supabase.service';
import { CIDAFMService } from '../cidafm/cidafm.service';
import { CentralizedRoutingService } from './centralized-routing.service';
import { RunMetadataService, RunMetadata } from './run-metadata.service';
import { ProviderConfigService } from './provider-config.service';
import { DataSanitizationService, DetailedSanitizationMetrics } from './data-sanitization.service';
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
        provider:
          (process.env.SYSTEM_DELEGATION_LLM_PROVIDER as any) || 'openai',
        model: process.env.SYSTEM_DELEGATION_LLM_MODEL || 'gpt-3.5-turbo',
        temperature: parseFloat(
          process.env.SYSTEM_DELEGATION_LLM_TEMPERATURE || '0.0',
        ),
        maxTokens: parseInt(
          process.env.SYSTEM_DELEGATION_LLM_MAX_TOKENS || '300',
        ),
        enabled: process.env.SYSTEM_DELEGATION_LLM_ENABLED !== 'false',
        description: 'Fast delegation decisions - which agent to use',
      },
      agent_selection: {
        provider:
          (process.env.SYSTEM_AGENT_SELECTION_LLM_PROVIDER as any) || 'openai',
        model: process.env.SYSTEM_AGENT_SELECTION_LLM_MODEL || 'gpt-3.5-turbo',
        temperature: parseFloat(
          process.env.SYSTEM_AGENT_SELECTION_LLM_TEMPERATURE || '0.1',
        ),
        maxTokens: parseInt(
          process.env.SYSTEM_AGENT_SELECTION_LLM_MAX_TOKENS || '400',
        ),
        enabled: process.env.SYSTEM_AGENT_SELECTION_LLM_ENABLED !== 'false',
        description: 'Agent selection and matching logic',
      },
      response_coordination: {
        provider:
          (process.env.SYSTEM_RESPONSE_COORD_LLM_PROVIDER as any) || 'openai',
        model: process.env.SYSTEM_RESPONSE_COORD_LLM_MODEL || 'gpt-3.5-turbo',
        temperature: parseFloat(
          process.env.SYSTEM_RESPONSE_COORD_LLM_TEMPERATURE || '0.2',
        ),
        maxTokens: parseInt(
          process.env.SYSTEM_RESPONSE_COORD_LLM_MAX_TOKENS || '800',
        ),
        enabled: process.env.SYSTEM_RESPONSE_COORD_LLM_ENABLED !== 'false',
        description: 'Response coordination and organization',
      },
      conversation_analysis: {
        provider:
          (process.env.SYSTEM_CONVERSATION_LLM_PROVIDER as any) || 'openai',
        model: process.env.SYSTEM_CONVERSATION_LLM_MODEL || 'gpt-3.5-turbo',
        temperature: parseFloat(
          process.env.SYSTEM_CONVERSATION_LLM_TEMPERATURE || '0.1',
        ),
        maxTokens: parseInt(
          process.env.SYSTEM_CONVERSATION_LLM_MAX_TOKENS || '600',
        ),
        enabled: process.env.SYSTEM_CONVERSATION_LLM_ENABLED !== 'false',
        description: 'Conversation context analysis',
      },
      error_handling: {
        provider: (process.env.SYSTEM_ERROR_LLM_PROVIDER as any) || 'openai',
        model: process.env.SYSTEM_ERROR_LLM_MODEL || 'gpt-3.5-turbo',
        temperature: parseFloat(
          process.env.SYSTEM_ERROR_LLM_TEMPERATURE || '0.0',
        ),
        maxTokens: parseInt(process.env.SYSTEM_ERROR_LLM_MAX_TOKENS || '200'),
        enabled: process.env.SYSTEM_ERROR_LLM_ENABLED !== 'false',
        description: 'Error handling and fallback operations',
      },
      default: {
        provider: (process.env.SYSTEM_DEFAULT_LLM_PROVIDER as any) || 'openai',
        model: process.env.SYSTEM_DEFAULT_LLM_MODEL || 'gpt-3.5-turbo',
        temperature: parseFloat(
          process.env.SYSTEM_DEFAULT_LLM_TEMPERATURE || '0.1',
        ),
        maxTokens: parseInt(process.env.SYSTEM_DEFAULT_LLM_MAX_TOKENS || '500'),
        enabled: process.env.SYSTEM_DEFAULT_LLM_ENABLED !== 'false',
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
      // Intelligent routing hints
      complexity?: 'simple' | 'medium' | 'complex' | 'reasoning'; // Task complexity for routing decisions
      // Caller tracking for usage analytics
      callerType?: string; // 'agent', 'api', 'user', 'system', 'service'
      callerName?: string; // 'metrics-agent', 'user-chat', 'api-endpoint', etc.
      conversationId?: string; // Optional conversation/session context
      dataClassification?: string; // 'public', 'internal', 'confidential', 'restricted'
    },
  ): Promise<string | any> {
    try {
      // Debug LLM options being received

      // If providerName/modelName are provided, delegate to enhanced response for proper DB lookup
      if (options?.providerName || options?.modelName || options?.cidafmOptions) {

        // Extract user ID from currentUser object or use undefined as fallback
        const userId = options.currentUser?.id;

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
      
      // Only use centralized routing if there's no explicit selection AND we have routing hints
      if (!hasExplicitSelection && (options?.complexity || (!options?.provider && !options?.providerName && !options?.modelName))) {
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
      const provider = options?.provider || options?.providerName || 'openai';
      const isLocalProvider = provider === 'ollama';
      

      // Apply conditional sanitization for external providers only
      let sanitizedSystemPrompt = systemPrompt;
      let sanitizedUserMessage = userMessage;
      let sanitizationContext: any = null;

      if (!isLocalProvider) {
        await this.dataSanitizationService.debug(
          'Simple response: Using external provider - applying sanitization',
          undefined,
          'SimpleLLM',
          { provider }
        );

        try {
          // Use the sanitizeForLLM method which handles both system and user messages
          const sanitizationResult = await this.dataSanitizationService.sanitizeForLLM(
            systemPrompt,
            userMessage,
            options?.sessionId || 'simple-request',
            {
              enableRedaction: process.env.ENABLE_REDACTION === 'true',
              enablePseudonymization: true,
              preserveFormatting: true
            }
          );

          sanitizedSystemPrompt = sanitizationResult.sanitizedSystemPrompt;
          sanitizedUserMessage = sanitizationResult.sanitizedUserMessage;
          sanitizationContext = sanitizationResult.reversalContext;

          await this.dataSanitizationService.debug(
            'Simple response content sanitized for external provider',
            undefined,
            'SimpleLLM',
            {
              sanitized: true,
              hasReversalContext: !!sanitizationContext
            }
          );

        } catch (sanitizationError) {
          await this.dataSanitizationService.error(
            `Simple response sanitization failed: ${sanitizationError instanceof Error ? sanitizationError.message : 'Unknown error'}`,
            undefined,
            'SimpleLLM'
          );
          
          // NO FALLBACKS! Fail loudly as per CLAUDE.md principles
          throw new Error(`Data sanitization failed for simple LLM call (${provider}): ${sanitizationError instanceof Error ? sanitizationError.message : 'Unknown error'}.`);
        }
      } else {
        await this.dataSanitizationService.debug(
          'Simple response: Using local provider - skipping sanitization',
          undefined,
          'SimpleLLM',
          { provider }
        );
      }

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

      // Handle o1 models which don't support system messages
      const isO1Model = options?.modelName?.includes('o1');
      let messages;
      
      if (isO1Model) {
        // o1 models don't support system messages - combine system prompt with user message
        const combinedMessage = sanitizedSystemPrompt 
          ? `${sanitizedSystemPrompt}\n\nUser: ${sanitizedUserMessage}`
          : sanitizedUserMessage;
        messages = [
          { role: 'user' as const, content: combinedMessage },
        ];
      } else {
        messages = [
          { role: 'system' as const, content: sanitizedSystemPrompt },
          { role: 'user' as const, content: sanitizedUserMessage },
        ];
      }

      const response = await llm.invoke(messages);
      let content = (response.content as string) || 'I apologize, but I was unable to generate a response.';

      // Restore pseudonyms in the response if sanitization was applied
      if (!isLocalProvider && sanitizationContext) {
        try {
          const restoredContent = await this.dataSanitizationService.reverseLLMResponse(
            content,
            sanitizationContext
          );

          if (restoredContent !== content) {
            content = restoredContent;
            await this.dataSanitizationService.debug(
              'Simple response content restored from pseudonyms',
              undefined,
              'SimpleLLM',
              { restored: true }
            );
          }

        } catch (restorationError) {
          await this.dataSanitizationService.warn(
            `Simple response restoration failed: ${restorationError instanceof Error ? restorationError.message : 'Unknown error'}`,
            undefined,
            'SimpleLLM'
          );
          // Continue with sanitized response if restoration fails
        }
      }

      return content;
    } catch (error) {

      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
  }> {
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

      // Apply conditional sanitization for external providers only
      if (!isLocalProvider) {
        await this.dataSanitizationService.debug(
          'Enhanced response: Using external provider - applying sanitization',
          undefined,
          'EnhancedLLM',
          { provider: provider.name, model: model.name }
        );

        try {
          // Use the sanitizeForLLM method which handles both system and user messages
          const sanitizationResult = await this.dataSanitizationService.sanitizeForLLM(
            enhancedSystemPrompt,
            finalProcessedPrompt,
            options?.sessionId || 'enhanced-request',
            {
              enableRedaction: process.env.ENABLE_REDACTION === 'true',
              enablePseudonymization: true,
              preserveFormatting: true
            }
          );

          enhancedSystemPrompt = sanitizationResult.sanitizedSystemPrompt;
          finalProcessedPrompt = sanitizationResult.sanitizedUserMessage;
          sanitizationContext = sanitizationResult.reversalContext;

          await this.dataSanitizationService.debug(
            'Enhanced response content sanitized for external provider',
            undefined,
            'EnhancedLLM',
            {
              sanitized: true,
              hasReversalContext: !!sanitizationContext
            }
          );

        } catch (sanitizationError) {
          await this.dataSanitizationService.error(
            `Enhanced response sanitization failed: ${sanitizationError instanceof Error ? sanitizationError.message : 'Unknown error'}`,
            undefined,
            'EnhancedLLM'
          );
          
          // NO FALLBACKS! Fail loudly as per CLAUDE.md principles
          throw new Error(`Data sanitization failed for enhanced LLM call (${provider.name}/${model.name}): ${sanitizationError instanceof Error ? sanitizationError.message : 'Unknown error'}.`);
        }
      } else {
        await this.dataSanitizationService.debug(
          'Enhanced response: Using local provider - skipping sanitization',
          undefined,
          'EnhancedLLM',
          { provider: provider.name, model: model.name }
        );
      }

      // Create LLM instance with dynamic configuration
      const llm = await this.createLLMFromModel(model, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      const messages = [
        { role: 'system' as const, content: enhancedSystemPrompt },
        { role: 'user' as const, content: finalProcessedPrompt },
      ];

      // Generate response with token counting
      const response = await llm.invoke(messages);
      let content = (response.content as string) || 'I apologize, but I was unable to generate a response.';

      // Restore pseudonyms in the response if sanitization was applied
      if (!isLocalProvider && sanitizationContext) {
        try {
          const restoredContent = await this.dataSanitizationService.reverseLLMResponse(
            content,
            sanitizationContext
          );

          if (restoredContent !== content) {
            content = restoredContent;
            await this.dataSanitizationService.debug(
              'Enhanced response content restored from pseudonyms',
              undefined,
              'EnhancedLLM',
              { restored: true }
            );
          }

        } catch (restorationError) {
          await this.dataSanitizationService.warn(
            `Enhanced response restoration failed: ${restorationError instanceof Error ? restorationError.message : 'Unknown error'}`,
            undefined,
            'EnhancedLLM'
          );
          // Continue with sanitized response if restoration fails
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

      // Extract detailed sanitization metrics
      const sanitizationMetrics = this.dataSanitizationService.extractSanitizationMetrics(
        sanitizationContext ? { 
          sanitizedText: '', 
          originalLength: 0, 
          sanitizedLength: 0,
          processingTimeMs: 0,
          reversalContext: sanitizationContext 
        } as any : undefined,
        isLocalProvider
      );

      const usage: LLMUsageMetrics = {
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        totalCost: costCalculation.totalCost,
        responseTimeMs: responseTimeMs,
        // langsmithRunId would be extracted from LangSmith tracing
        
        // Data sanitization metrics
        dataSanitizationApplied: sanitizationMetrics.sanitizationLevel !== 'none',
        sanitizationLevel: sanitizationMetrics.sanitizationLevel,
        piiDetected: sanitizationMetrics.piiDetected,
        piiTypes: sanitizationMetrics.piiTypes,
        pseudonymsUsed: sanitizationMetrics.pseudonymsUsed,
        pseudonymTypes: sanitizationMetrics.pseudonymTypes,
        redactionsApplied: sanitizationMetrics.redactionsApplied,
        redactionTypes: sanitizationMetrics.redactionTypes,
        
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
        sanitizationTimeMs: sanitizationMetrics.sanitizationTimeMs,
        reversalContextSize: sanitizationMetrics.reversalContextSize,
        
        // Compliance flags (basic implementation)
        complianceFlags: {
          gdprCompliant: sanitizationMetrics.piiDetected && sanitizationMetrics.pseudonymsUsed > 0,
          hipaaCompliant: sanitizationMetrics.sanitizationLevel === 'strict',
          pciCompliant: sanitizationMetrics.redactionsApplied > 0,
        },
      };

      // Complete usage tracking
      const runMetadata = await this.runMetadataService.completeRequest(
        metadataContext,
        {
          content,
          inputTokens: inputTokens,
          outputTokens: outputTokens,
          enhancedMetrics: usage
        }
      );

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
      };
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

      await this.dataSanitizationService.info(
        `Routing decision: ${routingDecision.provider}/${routingDecision.model} (${routingDecision.isLocal ? 'local' : 'external'})`,
        undefined,
        'CentralizedLLM',
        { routingDecision: routingDecision }
      );

      // Step 2: Start tracking metadata
      const metadataContext = await this.runMetadataService.startRequest(routingDecision, {
        userId: options?.currentUser?.id,
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

        // Step 5: Call provider with appropriate configuration
        const response = await this.callProviderWithRouting(
          routingDecision,
          systemPrompt,
          userMessage,
          headers,
          options || {}
        );

        // Step 6: Complete metadata tracking with enhanced metrics (async, non-blocking)
        const runMetadataPromise = this.runMetadataService.completeRequest(metadataContext, {
          content: response.content,
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
          content: response.content,
          runMetadata,
          routingDecision,
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
    routingDecision: any,
    systemPrompt: string,
    userMessage: string,
    headers: any,
    options: any
  ): Promise<{
    content: string;
    inputTokens?: number;
    outputTokens?: number;
    enhancedMetrics?: LLMUsageMetrics;
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
      };
    }

    // For EXTERNAL providers - apply sanitization before sending
    await this.dataSanitizationService.debug(
      'Using external provider - applying sanitization',
      undefined,
      'CallProvider',
      { provider: routingDecision.provider, model: routingDecision.model }
    );

    // Sanitize system prompt and user message before sending to external provider
    let sanitizedSystemPrompt: string;
    let sanitizedUserMessage: string;
    let systemPromptContext: any = null;
    let userMessageContext: any = null;
    let actualSanitizationResult: any = null;

    try {
      // Use the sanitizeForLLM method which handles both system and user messages
      this.logger.log(`🔍 LLMService: Calling sanitizeForLLM for external provider`);
      const sanitizationResult = await this.dataSanitizationService.sanitizeForLLM(
        systemPrompt,
        userMessage,
        options.sessionId || 'external-request',
        {
          enableRedaction: process.env.ENABLE_REDACTION === 'true',
          enablePseudonymization: true,
          preserveFormatting: true
        }
      );
      this.logger.log(`🔍 LLMService: sanitizeForLLM completed`);

      sanitizedSystemPrompt = sanitizationResult.sanitizedSystemPrompt;
      sanitizedUserMessage = sanitizationResult.sanitizedUserMessage;
      // Store both contexts for compatibility with existing code
      systemPromptContext = sanitizationResult.reversalContext;
      userMessageContext = sanitizationResult.reversalContext;
      
      // Store the actual sanitization results for metrics extraction
      actualSanitizationResult = sanitizationResult.userSanitizationResult; // Use user message result as primary

      await this.dataSanitizationService.debug(
        'Content sanitized for external provider',
        undefined,
        'CallProvider',
        {
          sanitized: true,
          hasReversalContext: !!sanitizationResult.reversalContext
        }
      );

    } catch (sanitizationError) {
      await this.dataSanitizationService.error(
        `Sanitization failed for external provider: ${sanitizationError instanceof Error ? sanitizationError.message : 'Unknown error'}`,
        undefined,
        'CallProvider'
      );
      
      // NO FALLBACKS! Fail loudly as per CLAUDE.md principles
      throw new Error(`Data sanitization failed for external provider (${routingDecision.provider}): ${sanitizationError instanceof Error ? sanitizationError.message : 'Unknown error'}. Cannot proceed with unsanitized data to external provider.`);
    }

    // Use LangChain for external providers with sanitized content
    const llm = this.createCustomLangGraphLLM({
      provider: routingDecision.provider as any,
      model: routingDecision.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    // Handle o1 models which don't support system messages
    const isO1Model = routingDecision.model?.includes('o1');
    let messages;
    
    if (isO1Model) {
      // o1 models don't support system messages - combine system prompt with user message
      const combinedMessage = sanitizedSystemPrompt 
        ? `${sanitizedSystemPrompt}\n\nUser: ${sanitizedUserMessage}`
        : sanitizedUserMessage;
      messages = [
        { role: 'user' as const, content: combinedMessage },
      ];
    } else {
      messages = [
        { role: 'system' as const, content: sanitizedSystemPrompt },
        { role: 'user' as const, content: sanitizedUserMessage },
      ];
    }

    const response = await llm.invoke(messages);
    let responseContent = (response.content as string) || 'I apologize, but I was unable to generate a response.';

    // Restore pseudonyms in the response if any were applied
    if (systemPromptContext) {
      try {
        const restoredContent = await this.dataSanitizationService.reverseLLMResponse(
          responseContent,
          systemPromptContext
        );

        if (restoredContent !== responseContent) {
          responseContent = restoredContent;
          await this.dataSanitizationService.debug(
            'Response content restored from pseudonyms',
            undefined,
            'CallProvider',
            { restored: true }
          );
        }

      } catch (restorationError) {
        await this.dataSanitizationService.warn(
          `Response restoration failed: ${restorationError instanceof Error ? restorationError.message : 'Unknown error'}`,
          undefined,
          'CallProvider'
        );
        // Continue with sanitized response if restoration fails
      }
    }

    // Estimate tokens (TODO: Get actual token counts from provider)
    const inputTokens = this.estimateTokens(sanitizedSystemPrompt + sanitizedUserMessage);
    const outputTokens = this.estimateTokens(responseContent);

    // Extract enhanced metrics from sanitization process
    const sanitizationMetrics = this.dataSanitizationService.extractSanitizationMetrics(
      actualSanitizationResult,
      false // isLocalProvider = false for external providers
    );

    const enhancedMetrics: LLMUsageMetrics = {
      inputTokens,
      outputTokens,
      totalCost: 0, // Would be calculated by caller
      responseTimeMs: 0, // Would be calculated by caller
      
      // Data sanitization metrics from actual sanitization process
      dataSanitizationApplied: sanitizationMetrics.sanitizationLevel !== 'none',
      sanitizationLevel: sanitizationMetrics.sanitizationLevel,
      piiDetected: sanitizationMetrics.piiDetected,
      piiTypes: sanitizationMetrics.piiTypes,
      pseudonymsUsed: sanitizationMetrics.pseudonymsUsed,
      pseudonymTypes: sanitizationMetrics.pseudonymTypes,
      redactionsApplied: sanitizationMetrics.redactionsApplied,
      redactionTypes: sanitizationMetrics.redactionTypes,
      
      // Source blinding metrics for external providers
      sourceBlindingApplied: true, // All external providers use source blinding
      headersStripped: 15, // Estimated number of headers stripped
      customUserAgentUsed: true,
      proxyUsed: false, // Could be enhanced based on actual proxy usage
      noTrainHeaderSent: true, // External providers get no-train header
      noRetainHeaderSent: false,
      
      // Performance metrics
      sanitizationTimeMs: sanitizationMetrics.sanitizationTimeMs,
      reversalContextSize: sanitizationMetrics.reversalContextSize,
      
      // Data classification
      dataClassification: options.dataClassification || 'public',
      policyProfile: options.policyProfile || 'standard',
      sovereignMode: false, // External providers = not sovereign
      
      // Compliance flags based on sanitization
      complianceFlags: {
        gdprCompliant: sanitizationMetrics.piiDetected && sanitizationMetrics.pseudonymsUsed > 0,
        hipaaCompliant: sanitizationMetrics.sanitizationLevel === 'strict',
        pciCompliant: sanitizationMetrics.redactionsApplied > 0,
      },
    };

    return {
      content: responseContent,
      inputTokens,
      outputTokens,
      enhancedMetrics,
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

      // Handle o1 models which don't support system messages
      const isO1Model = activeConfig.model?.includes('o1');
      let messages;
      
      if (isO1Model) {
        // o1 models don't support system messages - combine system prompt with user message
        const combinedMessage = systemPrompt 
          ? `${systemPrompt}\n\nUser: ${userMessage}`
          : userMessage;
        messages = [
          { role: 'user' as const, content: combinedMessage },
        ];
      } else {
        messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: userMessage },
        ];
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
          // Use source-blinded LLM for external providers
          llm = this.blindedLLMService.createBlindedLLM({
            provider: 'openai',
            model: config.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            temperature: config.temperature ?? parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
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
    }

    // Fallback to default OpenAI o1-mini (from our 2025 models)
    const { data: defaultProvider } = await client
      .from(getTableName('llm_providers'))
      .select('*')
      .eq('name', 'openai')
      .single();

    const { data: defaultModel } = await client
      .from(getTableName('llm_models'))
      .select('*')
      .eq('model_name', 'o1-mini')
      .eq('provider_name', 'openai')
      .single();

    if (!defaultProvider || !defaultModel) {
      // If no default provider/model found, this is a configuration error
      throw new Error(
        'No default provider/model found in database. Please ensure the database is properly populated with LLM providers and models.'
      );
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
}
