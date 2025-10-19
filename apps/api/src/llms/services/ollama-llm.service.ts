import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseLLMService } from './base-llm.service';
import {
  GenerateResponseParams,
  LLMResponse,
  LLMServiceConfig,
  ResponseMetadata,
  LocalLLMRequest,
} from './llm-interfaces';
import { PIIService } from '../pii/pii.service';
import { DictionaryPseudonymizerService } from '../pii/dictionary-pseudonymizer.service';
import { RunMetadataService } from '../run-metadata.service';
import { ProviderConfigService } from '../provider-config.service';
import { LLMErrorMapper } from './llm-error-handling';
import { ollamaResponseSchema } from '../types/provider-schemas';
import type { OllamaResponseParsed } from '../types/provider-schemas';

/**
 * Ollama-specific response metadata extension
 */
interface OllamaResponseMetadata extends ResponseMetadata {
  providerSpecific: {
    // Ollama-specific timing and performance metrics
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
    // Model loading information
    model_loaded: boolean;
    load_time_ms?: number;
    // Local model status
    model_status: 'loaded' | 'loading' | 'unloaded' | 'error';
  };
}

/**
 * Ollama LLM Service Implementation
 *
 * This example shows how to extend BaseLLMService for local Ollama models
 * with local-specific functionality, model management, and performance metrics.
 */
@Injectable()
export class OllamaLLMService extends BaseLLMService {
  private readonly ollamaBaseUrl: string;
  private readonly loadedModels = new Set<string>();

  constructor(
    config: LLMServiceConfig,
    piiService: PIIService,
    dictionaryPseudonymizerService: DictionaryPseudonymizerService,
    runMetadataService: RunMetadataService,
    providerConfigService: ProviderConfigService,
    private readonly httpService: HttpService,
  ) {
    super(
      config,
      piiService,
      dictionaryPseudonymizerService,
      runMetadataService,
      providerConfigService,
    );

    this.ollamaBaseUrl =
      config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.logger.log(
      `OllamaLLMService initialized (URL: ${this.ollamaBaseUrl})`,
    );
  }

  /**
   * Implementation of the abstract generateResponse method for Ollama
   */
  async generateResponse(params: GenerateResponseParams): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId('ollama');

    try {
      // Validate configuration
      this.validateConfig(params.config);

      // Skip PII processing for local models (data never leaves the machine)
      const piiResult = await this.handlePiiInput(params.userMessage, {
        enablePseudonymization: false,
        useDictionaryPseudonymizer: false,
      });

      // Ensure model is loaded
      const modelLoadResult = await this.ensureModelLoaded(params.config.model);
      if (!modelLoadResult.success) {
        throw new Error(
          `Failed to load model ${params.config.model}: ${modelLoadResult.message}`,
        );
      }

      // Prepare Ollama request
      const ollamaRequest: LocalLLMRequest = {
        model: params.config.model,
        prompt: piiResult.processedText,
        system: params.systemPrompt,
        options: {
          temperature:
            params.options?.temperature ?? params.config.temperature ?? 0.7,
          max_tokens:
            params.options?.maxTokens ?? params.config.maxTokens ?? 2000,
          top_p: 0.9,
          top_k: 40,
        },
      };

      // Make Ollama API call
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.ollamaBaseUrl}/api/generate`,
          {
            ...ollamaRequest,
            stream: false,
            options: {
              temperature: ollamaRequest.options?.temperature,
              num_predict: ollamaRequest.options?.max_tokens,
              top_p: ollamaRequest.options?.top_p,
              top_k: ollamaRequest.options?.top_k,
            },
          },
          {
            timeout: 120000, // 2 minute timeout for local models
          },
        ),
      );

      const parsedResponse: OllamaResponseParsed = ollamaResponseSchema.parse(
        response.data,
      );

      if (!parsedResponse.response) {
        throw new Error('No response from Ollama model');
      }

      // Handle PII in output (usually not needed for local models)
      const finalContent = await this.handlePiiOutput(
        parsedResponse.response,
        requestId,
      );

      const endTime = Date.now();

      // Create Ollama-specific metadata
      const metadata = this.createOllamaMetadata(
        parsedResponse,
        params,
        startTime,
        endTime,
        requestId,
        modelLoadResult,
      );

      // Track usage with full metadata for database persistence (local models have different cost structure)
      await this.trackUsage(
        params.config.provider,
        params.config.model,
        metadata.usage.inputTokens,
        metadata.usage.outputTokens,
        0, // Local models typically have no cost
        {
          requestId,
          userId: params.userId || params.options?.userId,
          conversationId:
            params.conversationId || params.options?.conversationId,
          callerType: params.options?.callerType,
          callerName: params.options?.callerName,
          piiMetadata: (piiResult.piiMetadata ?? undefined) as
            | Record<string, unknown>
            | undefined,
          startTime,
          endTime,
        },
      );

      const llmResponse: LLMResponse = {
        content: finalContent,
        metadata,
        piiMetadata: piiResult.piiMetadata ?? undefined,
      };

      // Log request/response
      this.logRequestResponse(params, llmResponse, metadata.timing.duration);

      return llmResponse;
    } catch (error) {
      this.handleError(error, 'OllamaLLMService.generateResponse');
    }
  }

  /**
   * Ensure the model is loaded and ready for use
   */
  private async ensureModelLoaded(
    model: string,
  ): Promise<{ success: boolean; message?: string; loadTime?: number }> {
    const loadStartTime = Date.now();

    try {
      // Check if model is already loaded
      if (this.loadedModels.has(model)) {
        return { success: true };
      }

      // Check if model exists
      const modelsResponse = await firstValueFrom(
        this.httpService.get(`${this.ollamaBaseUrl}/api/tags`),
      );

      const availableModels =
        (modelsResponse.data as Record<string, unknown>).models || [];
      const modelExists = (
        availableModels as Array<Record<string, unknown>>
      ).some((m: Record<string, unknown>) => m.name === model);

      if (!modelExists) {
        const modelNames = (
          availableModels as Array<Record<string, unknown>>
        ).map((m: Record<string, unknown>) => (m as { name: string }).name);
        return {
          success: false,
          message: `Model ${model} not found. Available models: ${modelNames.join(', ')}`,
        };
      }

      // Load the model by making a small request
      await firstValueFrom(
        this.httpService.post(
          `${this.ollamaBaseUrl}/api/generate`,
          {
            model,
            prompt: 'test',
            stream: false,
            options: { num_predict: 1 },
          },
          { timeout: 60000 },
        ),
      );

      const loadTime = Date.now() - loadStartTime;
      this.loadedModels.add(model);
      this.logger.log(`Model ${model} loaded successfully in ${loadTime}ms`);

      return { success: true, loadTime };
    } catch (error) {
      const loadTime = Date.now() - loadStartTime;
      this.logger.error(
        `Failed to load model ${model} after ${loadTime}ms:`,
        error,
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        loadTime,
      };
    }
  }

  /**
   * Create Ollama-specific metadata with local model performance metrics
   */
  private createOllamaMetadata(
    ollamaResponse: OllamaResponseParsed,
    params: GenerateResponseParams,
    startTime: number,
    endTime: number,
    requestId: string,
    modelLoadResult: { success: boolean; loadTime?: number },
  ): OllamaResponseMetadata {
    // Estimate tokens for local models (Ollama doesn't always provide exact counts)
    const inputTokens =
      ollamaResponse.prompt_eval_count ||
      this.estimateTokens(params.systemPrompt + params.userMessage);
    const outputTokens =
      ollamaResponse.eval_count || this.estimateTokens(ollamaResponse.response);

    return {
      provider: 'ollama',
      model: ollamaResponse.model,
      requestId,
      timestamp: new Date().toISOString(),
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost: 0, // Local models typically have no API cost
      },
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
      tier: 'local', // Ollama is always local
      status: 'completed',
      // Ollama-specific performance metrics
      providerSpecific: {
        total_duration: ollamaResponse.total_duration,
        load_duration: ollamaResponse.load_duration,
        prompt_eval_count: ollamaResponse.prompt_eval_count,
        prompt_eval_duration: ollamaResponse.prompt_eval_duration,
        eval_count: ollamaResponse.eval_count,
        eval_duration: ollamaResponse.eval_duration,
        model_loaded: modelLoadResult.success,
        load_time_ms: modelLoadResult.loadTime,
        model_status: modelLoadResult.success ? 'loaded' : 'error',
      },
    };
  }

  /**
   * Ollama-specific configuration validation
   */
  protected validateConfig(config: LLMServiceConfig): void {
    super.validateConfig(config);

    if (config.provider !== 'ollama') {
      throw new Error('OllamaLLMService requires provider to be "ollama"');
    }

    // Validate Ollama connection
    if (!this.ollamaBaseUrl) {
      throw new Error('Ollama base URL is required');
    }
  }

  /**
   * Ollama-specific error handling
   */
  protected handleError(error: unknown, context: string): never {
    try {
      const mapped = LLMErrorMapper.fromOllamaError(
        error,
        'ollama',
        this.config?.model,
      );
      super.handleError(mapped, context);
    } catch {
      super.handleError(error, context);
    }
  }

  /**
   * Get available models from Ollama
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.ollamaBaseUrl}/api/tags`),
      );
      const models = (response.data as Record<string, unknown>).models as
        | Array<{ name: string }>
        | undefined;
      return models?.map((model) => model.name) || [];
    } catch (error) {
      this.logger.error('Failed to get available models:', error);
      return [];
    }
  }

  /**
   * Check Ollama server health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    version?: string;
    models?: string[];
  }> {
    try {
      const [versionResponse, modelsResponse] = await Promise.all([
        firstValueFrom(
          this.httpService.get(`${this.ollamaBaseUrl}/api/version`),
        ),
        firstValueFrom(this.httpService.get(`${this.ollamaBaseUrl}/api/tags`)),
      ]);

      const models = (modelsResponse.data as Record<string, unknown>).models as
        | Array<{ name: string }>
        | undefined;
      return {
        healthy: true,
        version: (versionResponse.data as Record<string, unknown>).version as
          | string
          | undefined,
        models: models?.map((m) => m.name) || [],
      };
    } catch {
      return { healthy: false };
    }
  }
}

/**
 * Factory function to create Ollama service instances
 */
export function createOllamaService(
  config: LLMServiceConfig,
  dependencies: {
    piiService: PIIService;
    dictionaryPseudonymizerService: DictionaryPseudonymizerService;
    runMetadataService: RunMetadataService;
    providerConfigService: ProviderConfigService;
    httpService: HttpService;
  },
): OllamaLLMService {
  return new OllamaLLMService(
    { ...config, provider: 'ollama' },
    dependencies.piiService,
    dependencies.dictionaryPseudonymizerService,
    dependencies.runMetadataService,
    dependencies.providerConfigService,
    dependencies.httpService,
  );
}

/**
 * Example usage and testing
 */
export async function testOllamaService() {
  // This would be used in your tests to verify the Ollama implementation
  const config: LLMServiceConfig = {
    provider: 'ollama',
    model: 'llama3.2:3b', // Popular small model for testing
    temperature: 0.7,
    maxTokens: 1000,
    baseUrl: 'http://localhost:11434',
  };

  // Mock dependencies for testing
  const mockDependencies = {
    piiService: {} as PIIService,
    dictionaryPseudonymizerService: {} as DictionaryPseudonymizerService,
    runMetadataService: {} as RunMetadataService,
    providerConfigService: {} as ProviderConfigService,
    httpService: {} as HttpService,
  };

  const service = createOllamaService(config, mockDependencies);

  // Check health first
  const health = await service.checkHealth();
  console.log('Ollama Health:', health);

  if (!health.healthy) {
    throw new Error('Ollama server is not healthy');
  }

  const params: GenerateResponseParams = {
    systemPrompt: 'You are a helpful AI assistant running locally.',
    userMessage: 'Hello, tell me about yourself.',
    config,
    conversationId: 'test-conversation',
    options: {
      preferLocal: true, // This will set tier to 'local'
    },
  };

  try {
    const response = await service.generateResponse(params);
    console.log('Ollama Response:', response.content);
    console.log('Performance Metrics:', response.metadata.providerSpecific);
    return response;
  } catch (error) {
    console.error('Ollama Service Error:', error);
    throw error;
  }
}
