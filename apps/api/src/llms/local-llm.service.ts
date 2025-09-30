import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  LocalModelStatusService,
  ModelStatus,
} from './local-model-status.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface LocalLLMRequest {
  model: string;
  prompt: string;
  system?: string;
  options?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    top_k?: number;
  };
}

export interface LocalLLMResponse {
  response: string;
  model: string;
  created_at: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface ModelLoadResult {
  success: boolean;
  model: string;
  message?: string;
  loadTime?: number;
}

@Injectable()
export class LocalLLMService {
  private readonly logger = new Logger(LocalLLMService.name);
  private readonly ollamaBaseUrl: string;
  private readonly maxConcurrentLoads = 2;
  private loadingQueue: string[] = [];
  private currentlyLoading = new Set<string>();

  constructor(
    private readonly httpService: HttpService,
    private readonly localModelStatusService: LocalModelStatusService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.ollamaBaseUrl =
      process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.logger.log(
      `LocalLLMService initialized (Ollama: ${this.ollamaBaseUrl})`,
    );
  }

  /**
   * Generate a response using a local Ollama model
   */
  async generateResponse(request: LocalLLMRequest): Promise<LocalLLMResponse> {
    const startTime = Date.now();

    try {
      // Ensure the model is loaded
      const loadResult = await this.ensureModelLoaded(request.model);
      if (!loadResult.success) {
        throw new Error(
          `Failed to load model ${request.model}: ${loadResult.message}`,
        );
      }

      // Prepare the request payload
      const payload = {
        model: request.model,
        prompt: request.prompt,
        system: request.system,
        stream: false,
        options: {
          temperature: request.options?.temperature ?? 0.7,
          num_predict: request.options?.max_tokens ?? 2000,
          top_p: request.options?.top_p ?? 0.9,
          top_k: request.options?.top_k ?? 40,
        },
      };

      // Make the API call to Ollama
      const apiStartTime = Date.now();
      const _response = await firstValueFrom(
        this.httpService.post(`${this.ollamaBaseUrl}/api/generate`, payload, {
          timeout: 120000, // 2 minute timeout
        }),
      );
      const apiDuration = Date.now() - apiStartTime;

      if (response.data.response?.length === 0) {
        this.logger.warn(
          `🚨 [LocalLLM] Empty response from model ${request.model} - this is unexpected for a blog post request`,
        );
      }

      const result: LocalLLMResponse = {
        response: response.data.response,
        model: response.data.model,
        created_at: new Date().toISOString(),
        done: response.data.done,
        total_duration: response.data.total_duration,
        load_duration: response.data.load_duration,
        prompt_eval_count: response.data.prompt_eval_count,
        prompt_eval_duration: response.data.prompt_eval_duration,
        eval_count: response.data.eval_count,
        eval_duration: response.data.eval_duration,
      };

      const duration = Date.now() - startTime;
      this.logger.log(
        `Local LLM response generated in ${duration}ms (model: ${request.model})`,
      );

      return result;
    } catch (_error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Local LLM generation failed after ${duration}ms`,
        _error,
      );
      throw new Error(
        `Local LLM generation failed: ${_error instanceof Error ? _error.message : 'Unknown _error'}`,
      );
    }
  }

  /**
   * Ensure a model is loaded in memory, loading it if necessary
   */
  async ensureModelLoaded(modelName: string): Promise<ModelLoadResult> {
    try {
      // Check if model is already loaded using fast loaded models check
      const loadedModels = await this.localModelStatusService.getLoadedModels();
      const loadedModel = loadedModels.find((m) => m.name === modelName);

      if (loadedModel) {
        this.logger.debug(`Model ${modelName} already loaded`);
        return { success: true, model: modelName };
      }

      // Check if model is currently being loaded
      if (this.currentlyLoading.has(modelName)) {
        this.logger.debug(
          `Model ${modelName} is currently loading, waiting...`,
        );
        return await this.waitForModelLoad(modelName);
      }

      // Load the model
      return await this.loadModel(modelName);
    } catch (_error) {
      this.logger.error(`Failed to ensure model ${modelName} is loaded`, _error);
      return {
        success: false,
        model: modelName,
        message: _error instanceof Error ? _error.message : 'Unknown _error',
      };
    }
  }

  /**
   * Load a specific model into memory
   */
  private async loadModel(modelName: string): Promise<ModelLoadResult> {
    const startTime = Date.now();

    try {
      this.currentlyLoading.add(modelName);
      this.logger.log(`Loading model: ${modelName}`);

      // Use Ollama's generate endpoint with empty prompt to load model
      const payload = {
        model: modelName,
        prompt: '',
        stream: false,
      };

      await firstValueFrom(
        this.httpService.post(`${this.ollamaBaseUrl}/api/generate`, payload, {
          timeout: 300000, // 5 minute timeout for loading
        }),
      );

      const loadTime = Date.now() - startTime;
      this.logger.log(
        `Model ${modelName} loaded successfully in ${loadTime}ms`,
      );

      return {
        success: true,
        model: modelName,
        loadTime,
      };
    } catch (_error) {
      const loadTime = Date.now() - startTime;
      this.logger.error(
        `Failed to load model ${modelName} after ${loadTime}ms`,
        _error,
      );

      return {
        success: false,
        model: modelName,
        message: _error instanceof Error ? _error.message : 'Unknown _error',
        loadTime,
      };
    } finally {
      this.currentlyLoading.delete(modelName);
    }
  }

  /**
   * Wait for a model that's currently loading
   */
  private async waitForModelLoad(
    modelName: string,
    maxWaitMs = 300000,
  ): Promise<ModelLoadResult> {
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second

    while (this.currentlyLoading.has(modelName)) {
      if (Date.now() - startTime > maxWaitMs) {
        return {
          success: false,
          model: modelName,
          message: 'Timeout waiting for model to load',
        };
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    // Check if model is now loaded
    const loadedModels = await this.localModelStatusService.getLoadedModels();
    const loadedModel = loadedModels.find((m) => m.name === modelName);

    return {
      success: !!loadedModel,
      model: modelName,
      message: loadedModel ? undefined : 'Model failed to load',
    };
  }

  /**
   * Get the best local model for a given complexity/task type
   */
  async getBestModelForTask(
    taskComplexity: 'simple' | 'medium' | 'complex' | 'reasoning',
    requiresThinking?: boolean,
    speedPreference?: 'ultra-fast' | 'fast' | 'medium' | 'slow',
  ): Promise<string | null> {
    try {
      // First, get currently loaded models
      const loadedModels = await this.getCurrentlyLoadedModels();

      const client = this.supabaseService.getServiceClient();

      // Build query for suitable models
      let query = client
        .from('llm_models')
        .select(
          'model_name, complexity_level, thinking_mode, speed_tier, resource_requirements',
        )
        .eq('is_local', true)
        .eq('is_active', true)
        .lte('complexity_level', this.getComplexityOrder(taskComplexity));

      // Filter by thinking mode if required
      if (requiresThinking) {
        query = query.eq('thinking_mode', true);
      }

      // Order by speed preference and loading priority
      const speedOrder = speedPreference
        ? `speed_tier.${speedPreference}, loading_priority desc`
        : 'loading_priority desc';

      const { data, error } = await query.order('loading_priority', {
        ascending: false,
      });

      if (error) {
        this.logger.error(
          'Failed to get best model for task from database',
          error,
        );
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Prefer already loaded models to avoid loading delays
      const loadedModelNames = loadedModels.map((m) => m.name);
      const alreadyLoaded = data.find((model) =>
        loadedModelNames.includes(model.model_name),
      );

      if (alreadyLoaded) {
        this.logger.debug(
          `Using already loaded model: ${alreadyLoaded.model_name}`,
        );
        return alreadyLoaded.model_name;
      }

      // Otherwise return the best match
      return data[0]?.model_name || null;
    } catch (_error) {
      this.logger.error('Failed to query best model for task', _error);
      return null;
    }
  }

  /**
   * Get currently loaded models from ollama ps
   */
  private async getCurrentlyLoadedModels(): Promise<
    Array<{ name: string; size: string }>
  > {
    try {
      const loadedModels = await this.localModelStatusService.getLoadedModels();
      return loadedModels.map((m) => ({ name: m.name, size: m.size || '0' }));
    } catch (_error) {
      this.logger.warn('Failed to get currently loaded models', _error);
      return [];
    }
  }

  /**
   * Convert complexity level to numeric order for comparison
   */
  private getComplexityOrder(complexity: string): number {
    const order = { simple: 1, medium: 2, complex: 3, reasoning: 4 };
    return order[complexity as keyof typeof order] || 2;
  }

  /**
   * Get the best local model for a given tier (legacy method)
   */
  async getBestModelForTier(
    tier: 'ultra-fast' | 'balanced' | 'high-quality',
  ): Promise<string | null> {
    // Map legacy tiers to new complexity system
    const complexityMap = {
      'ultra-fast': 'simple',
      balanced: 'medium',
      'high-quality': 'reasoning',
    };

    const speedMap = {
      'ultra-fast': 'ultra-fast',
      balanced: 'fast',
      'high-quality': 'medium',
    };

    return this.getBestModelForTask(
      complexityMap[tier] as any,
      tier === 'high-quality', // Only high-quality tier requires thinking
      speedMap[tier] as any,
    );
  }

  /**
   * Get available local models from database
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const client = this.supabaseService.getServiceClient();
      const { data, error } = await client
        .from('llm_models')
        .select('model_name')
        .eq('is_local', true)
        .eq('is_active', true)
        .order('loading_priority', { ascending: false });

      if (error) {
        this.logger.error(
          'Failed to get available models from database',
          error,
        );
        return [];
      }

      return data?.map((row) => row.model_name) || [];
    } catch (_error) {
      this.logger.error('Failed to query available models', _error);
      return [];
    }
  }

  /**
   * Unload a model from memory (if Ollama supports it in the future)
   */
  async unloadModel(modelName: string): Promise<boolean> {
    // Ollama doesn't currently have an explicit unload API
    // Models are automatically unloaded when memory is needed
    this.logger.debug(
      `Unload requested for model: ${modelName} (not supported by Ollama)`,
    );
    return false;
  }

  /**
   * Get current Ollama status
   */
  async getStatus() {
    return await this.localModelStatusService.getOllamaStatus();
  }
}
