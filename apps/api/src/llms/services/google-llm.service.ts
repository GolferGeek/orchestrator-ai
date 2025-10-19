import { Injectable } from '@nestjs/common';
import { BaseLLMService } from './base-llm.service';
import {
  GenerateResponseParams,
  LLMResponse,
  LLMServiceConfig,
  ResponseMetadata,
} from './llm-interfaces';
import { LLMErrorMapper } from './llm-error-handling';
import { PIIService } from '../pii/pii.service';
import { DictionaryPseudonymizerService } from '../pii/dictionary-pseudonymizer.service';
import { RunMetadataService } from '../run-metadata.service';
import { ProviderConfigService } from '../provider-config.service';
import {
  GoogleGenerativeAI,
  FinishReason,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import type {
  GoogleGenerateContentResult,
  GoogleGenerateContentResponse,
  GoogleGenerateContentCandidate,
  GoogleUsageMetadata,
  GoogleCitationSource,
} from '../types/provider-payload.types';

/**
 * Google-specific response metadata extension
 */
interface GoogleResponseMetadata extends ResponseMetadata {
  providerSpecific: {
    finish_reason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
    safety_ratings?: Array<{
      category: string;
      probability: string;
    }>;
    citation_metadata?: {
      citation_sources: Array<{
        start_index: number;
        end_index: number;
        uri: string;
        license: string;
      }>;
    };
    // Google-specific usage details
    prompt_token_count?: number;
    candidates_token_count?: number;
    total_token_count?: number;
    // Model version and capabilities
    model_version?: string;
    generation_config?: {
      temperature?: number;
      top_p?: number;
      top_k?: number;
      max_output_tokens?: number;
    };
  };
}

/**
 * Google Gemini LLM Service Implementation
 *
 * This example shows how to extend BaseLLMService for Google's Gemini models
 * with provider-specific functionality, safety settings, and metadata handling.
 */
@Injectable()
export class GoogleLLMService extends BaseLLMService {
  private genAI: GoogleGenerativeAI;

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

    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key is required');
    }

    // Initialize Google Generative AI
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Implementation of the abstract generateResponse method for Google Gemini
   */
  async generateResponse(params: GenerateResponseParams): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId('google');

    try {
      // Validate configuration
      this.validateConfig(params.config);

      // Use LLM Service level PII pre-processing when provided
      const processedText = params.userMessage;
      const piiMetadata = params.options?.piiMetadata || null;
      const dictionaryMappings = params.options?.dictionaryMappings || [];
      if (!piiMetadata) {
        this.logger.warn(
          `⚠️ [PII-METADATA-DEBUG] GoogleLLMService - No PII metadata from LLM Service, using raw message`,
        );
      } else {
        this.logger.debug(
          `🔍 [PII-METADATA-DEBUG] GoogleLLMService - Using preprocessed text and PII metadata`,
        );
      }
      if (dictionaryMappings.length > 0) {
        this.logger.debug(
          `📓 [DICTIONARY] Applying ${dictionaryMappings.length} dictionary mappings for Google request ${requestId}`,
        );
      }

      // Get the model
      const model = this.genAI.getGenerativeModel({
        model: params.config.model,
        generationConfig: {
          temperature:
            params.options?.temperature ?? params.config.temperature ?? 0.7,
          maxOutputTokens: params.options?.maxTokens ?? params.config.maxTokens,
          topP: 0.95,
          topK: 64,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });

      // Prepare the prompt (Google uses a different format)
      const prompt = `${params.systemPrompt}\n\nUser: ${processedText}\n\nAssistant:`;

      // Make Google API call
      const result: GoogleGenerateContentResult =
        await model.generateContent(prompt);
      const response: GoogleGenerateContentResponse = result.response;

      if (typeof response?.text !== 'function') {
        throw new Error('Unexpected Google response shape: missing text()');
      }

      const responseText = response.text();

      if (!responseText) {
        throw new Error('No content in Google response');
      }

      // Do not reverse here; LLMService handles dictionary reversal consistently
      const finalContent = responseText;

      const endTime = Date.now();

      // Create Google-specific metadata
      const metadata = this.createGoogleMetadata(
        result,
        response,
        params,
        startTime,
        endTime,
        requestId,
      );

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
          conversationId:
            params.conversationId || params.options?.conversationId,
          callerType: params.options?.callerType,
          callerName: params.options?.callerName,
          piiMetadata: (piiMetadata ?? undefined) as unknown as
            | Record<string, unknown>
            | undefined,
          startTime,
          endTime,
        },
      );

      const llmResponse: LLMResponse = {
        content: finalContent,
        metadata,
        piiMetadata: piiMetadata ?? undefined,
      };

      // Optional LangSmith integration
      const langsmithRunId = await this.integrateLangSmith(params, llmResponse);
      if (langsmithRunId) {
        llmResponse.metadata.langsmithRunId = langsmithRunId;
      }

      // Log request/response
      this.logRequestResponse(params, llmResponse, metadata.timing.duration);

      return llmResponse;
    } catch (error) {
      this.handleError(error, 'GoogleLLMService.generateResponse');
    }
  }

  /**
   * Create Google-specific metadata with provider-specific fields
   */
  private createGoogleMetadata(
    result: GoogleGenerateContentResult,
    response: GoogleGenerateContentResponse,
    params: GenerateResponseParams,
    startTime: number,
    endTime: number,
    requestId: string,
  ): GoogleResponseMetadata {
    const usageMetadata: GoogleUsageMetadata | undefined =
      response.usageMetadata ?? result.response?.usageMetadata;
    const candidate: GoogleGenerateContentCandidate | undefined =
      response.candidates?.[0];

    const normalizedFinishReason = this.mapFinishReason(candidate);
    const citationMetadata = candidate?.citationMetadata;

    return {
      provider: 'google',
      model: params.config.model,
      requestId,
      timestamp: new Date().toISOString(),
      usage: {
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens: usageMetadata?.totalTokenCount || 0,
        cost: this.calculateCost(
          'google',
          params.config.model,
          usageMetadata?.promptTokenCount || 0,
          usageMetadata?.candidatesTokenCount || 0,
        ),
      },
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
      tier: params.options?.preferLocal ? 'local' : 'external',
      status: 'completed',
      // Google-specific fields
      providerSpecific: {
        finish_reason: normalizedFinishReason,
        safety_ratings: candidate?.safetyRatings?.map((rating) => ({
          category: rating.category,
          probability: rating.probability,
        })),
        citation_metadata: citationMetadata
          ? {
              citation_sources: (citationMetadata.citationSources || []).map(
                (source: GoogleCitationSource) => ({
                  start_index: source.startIndex ?? 0,
                  end_index: source.endIndex ?? 0,
                  uri: source.uri ?? '',
                  license: source.license ?? '',
                }),
              ),
            }
          : undefined,
        // Include actual token counts from Google
        prompt_token_count: usageMetadata?.promptTokenCount,
        candidates_token_count: usageMetadata?.candidatesTokenCount,
        total_token_count: usageMetadata?.totalTokenCount,
        model_version: params.config.model,
        generation_config: {
          temperature:
            params.options?.temperature ?? params.config.temperature ?? 0.7,
          top_p: 0.95,
          top_k: 64,
          max_output_tokens:
            params.options?.maxTokens ?? params.config.maxTokens,
        },
      },
    };
  }

  /**
   * Override LangSmith integration for Google-specific tracing
   */
  protected integrateLangSmith(
    params: GenerateResponseParams,
    response: LLMResponse,
  ): Promise<string | undefined> {
    // Example Google-specific LangSmith integration
    if (
      process.env.LANGSMITH_API_KEY &&
      process.env.LANGSMITH_TRACING === 'true'
    ) {
      try {
        // This would integrate with LangSmith for Google-specific tracing
        const runId = `google-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.logger.debug(
          `LangSmith integration for Google model ${params.config.model} (run: ${runId}, tokens: ${response.metadata.usage.totalTokens})`,
        );
        return Promise.resolve(runId);
      } catch (error) {
        this.logger.warn('LangSmith integration failed:', error);
      }
    }
    return Promise.resolve(undefined);
  }

  private mapFinishReason(
    candidate?: GoogleGenerateContentCandidate,
  ): GoogleResponseMetadata['providerSpecific']['finish_reason'] {
    switch (candidate?.finishReason) {
      case FinishReason.STOP:
        return 'STOP';
      case FinishReason.MAX_TOKENS:
        return 'MAX_TOKENS';
      case FinishReason.SAFETY:
        return 'SAFETY';
      case FinishReason.RECITATION:
        return 'RECITATION';
      default:
        return 'OTHER';
    }
  }

  /**
   * Google-specific configuration validation
   */
  protected validateConfig(config: LLMServiceConfig): void {
    super.validateConfig(config);

    if (config.provider !== 'google') {
      throw new Error('GoogleLLMService requires provider to be "google"');
    }

    if (!config.apiKey && !process.env.GOOGLE_API_KEY) {
      throw new Error('Google API key is required');
    }

    // Validate Google-specific model names
    const validModels = [
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.0-pro',
      'gemini-pro',
      'gemini-pro-vision',
    ];

    if (!validModels.some((model) => config.model.includes(model))) {
      this.logger.warn(
        `Unknown Google model: ${config.model}. Proceeding anyway.`,
      );
    }
  }

  /**
   * Google-specific error handling
   */
  protected handleError(error: unknown, context: string): never {
    try {
      const mapped = LLMErrorMapper.fromGoogleError(
        error,
        'google',
        this.config?.model,
      );
      super.handleError(mapped, context);
    } catch {
      super.handleError(error, context);
    }
  }

  /**
   * Override cost calculation for Google-specific pricing
   */
  protected calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    // Google Gemini pricing (as of late 2024)
    // Note: These are example rates - check Google AI documentation for current pricing
    const googleRates = {
      'gemini-1.5-pro': {
        input: 0.00000125, // $1.25 per 1M input tokens
        output: 0.000005, // $5 per 1M output tokens
      },
      'gemini-1.5-flash': {
        input: 0.000000075, // $0.075 per 1M input tokens
        output: 0.0000003, // $0.30 per 1M output tokens
      },
      'gemini-1.0-pro': {
        input: 0.0000005, // $0.50 per 1M input tokens
        output: 0.0000015, // $1.50 per 1M output tokens
      },
    };

    // Find matching rate (handle model variations)
    let rates = googleRates['gemini-1.0-pro']; // default
    for (const [modelKey, modelRates] of Object.entries(googleRates)) {
      if (model.includes(modelKey)) {
        rates = modelRates;
        break;
      }
    }

    return inputTokens * rates.input + outputTokens * rates.output;
  }

  /**
   * Check if content was blocked by safety filters
   */
  private checkSafetyBlocking(response: unknown): {
    blocked: boolean;
    reason?: string;
  } {
    const r = response as {
      candidates?: Array<{ finishReason?: string; safetyRatings?: unknown[] }>;
    };
    const candidate = r.candidates?.[0];

    if (candidate?.finishReason === 'SAFETY') {
      const safetyRatings = candidate.safetyRatings || [];
      const blockedRatings = safetyRatings.filter((rating: unknown) => {
        const rat = rating as { probability?: string };
        return rat.probability === 'HIGH' || rat.probability === 'MEDIUM';
      });

      if (blockedRatings.length > 0) {
        return {
          blocked: true,
          reason: `Content blocked due to: ${blockedRatings.map((r: unknown) => (r as { category?: string }).category).join(', ')}`,
        };
      }
    }

    return { blocked: false };
  }
}

/**
 * Factory function to create Google service instances
 */
export function createGoogleService(
  config: LLMServiceConfig,
  dependencies: {
    piiService: PIIService;
    dictionaryPseudonymizerService: DictionaryPseudonymizerService;
    runMetadataService: RunMetadataService;
    providerConfigService: ProviderConfigService;
  },
): GoogleLLMService {
  return new GoogleLLMService(
    { ...config, provider: 'google' },
    dependencies.piiService,
    dependencies.dictionaryPseudonymizerService,
    dependencies.runMetadataService,
    dependencies.providerConfigService,
  );
}

/**
 * Example usage and testing
 */
export async function testGoogleService() {
  // This would be used in your tests to verify the Google implementation
  const config: LLMServiceConfig = {
    provider: 'google',
    model: 'gemini-1.5-flash',
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

  const service = createGoogleService(config, mockDependencies);

  const params: GenerateResponseParams = {
    systemPrompt: 'You are a helpful AI assistant powered by Google Gemini.',
    userMessage: 'Explain the benefits of multimodal AI models.',
    config,
    conversationId: 'test-conversation',
  };

  try {
    const response = await service.generateResponse(params);
    console.log('Google Response:', response.content);
    console.log(
      'Safety Ratings:',
      response.metadata.providerSpecific?.safety_ratings,
    );
    console.log('Metadata:', response.metadata);
    return response;
  } catch (error) {
    console.error('Google Service Error:', error);
    throw error;
  }
}
