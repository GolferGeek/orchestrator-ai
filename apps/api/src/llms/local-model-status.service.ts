import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ModelStatus {
  name: string;
  status: 'loaded' | 'loading' | 'error' | 'unavailable';
  size?: string;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
  modifiedAt?: string;
  responseTime?: number;
  memoryUsage?: number;
  errorMessage?: string;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
  modified_at: string;
}

export interface ModelHealth {
  available: boolean;
  responseTime: number;
  lastCheck: string;
  errorMessage?: string;
}

export interface OllamaStatus {
  connected: boolean;
  version?: string;
  models: ModelStatus[];
  lastCheck: string;
  errorMessage?: string;
}

@Injectable()
export class LocalModelStatusService {
  private readonly logger = new Logger(LocalModelStatusService.name);
  private readonly ollamaBaseUrl: string;
  private readonly healthCache = new Map<string, ModelHealth>();
  private readonly cacheTimeout = 5000; // 5 seconds
  private ollamaStatus: OllamaStatus = {
    connected: false,
    models: [],
    lastCheck: new Date().toISOString(),
  };

  constructor(private readonly httpService: HttpService) {
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.logger.log(`LocalModelStatusService initialized (Ollama: ${this.ollamaBaseUrl})`);
    
    // Initial health check
    this.checkOllamaConnection().catch(error => {
      this.logger.warn('Initial Ollama connection check failed', error);
    });
  }

  /**
   * Check if Ollama service is available
   */
  async checkOllamaConnection(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.ollamaBaseUrl}/api/version`, {
          timeout: 5000,
        })
      );

      this.ollamaStatus.connected = true;
      this.ollamaStatus.version = response.data?.version || 'unknown';
      this.ollamaStatus.lastCheck = new Date().toISOString();
      this.ollamaStatus.errorMessage = undefined;

      return true;
    } catch (error) {
      this.ollamaStatus.connected = false;
      this.ollamaStatus.lastCheck = new Date().toISOString();
      this.ollamaStatus.errorMessage = error.message;
      
      this.logger.warn(`Ollama connection failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get list of available models from Ollama
   */
  async getAvailableModels(): Promise<ModelStatus[]> {
    if (!await this.checkOllamaConnection()) {
      return [];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.ollamaBaseUrl}/api/tags`, {
          timeout: 10000,
        })
      );

      const models: OllamaModel[] = response.data?.models || [];
      const modelStatuses: ModelStatus[] = [];

      for (const model of models) {
        const status: ModelStatus = {
          name: model.name,
          status: 'loaded', // If it's in the list, it's loaded
          size: this.formatBytes(model.size),
          digest: model.digest,
          details: model.details,
          modifiedAt: model.modified_at,
        };

        // Check individual model health
        const health = await this.checkModelHealth(model.name);
        status.responseTime = health.responseTime;
        
        if (!health.available) {
          status.status = 'error';
          status.errorMessage = health.errorMessage;
        }

        modelStatuses.push(status);
      }

      this.ollamaStatus.models = modelStatuses;
      return modelStatuses;
    } catch (error) {
      this.logger.error(`Failed to get available models: ${error.message}`);
      return [];
    }
  }

  /**
   * Check health of a specific model
   */
  async checkModelHealth(modelName: string): Promise<ModelHealth> {
    const cacheKey = modelName;
    const cached = this.healthCache.get(cacheKey);
    
    // Return cached result if still valid
    if (cached && Date.now() - new Date(cached.lastCheck).getTime() < this.cacheTimeout) {
      return cached;
    }

    const startTime = Date.now();
    
    try {
      // Simple health check by making a minimal generate request
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.ollamaBaseUrl}/api/generate`,
          {
            model: modelName,
            prompt: 'test',
            stream: false,
            options: {
              num_predict: 1, // Minimal response
            },
          },
          {
            timeout: 30000,
          }
        )
      );

      const responseTime = Date.now() - startTime;
      const health: ModelHealth = {
        available: !!response.data,
        responseTime,
        lastCheck: new Date().toISOString(),
      };

      this.healthCache.set(cacheKey, health);
      return health;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const health: ModelHealth = {
        available: false,
        responseTime,
        lastCheck: new Date().toISOString(),
        errorMessage: error.message,
      };

      this.healthCache.set(cacheKey, health);
      return health;
    }
  }

  /**
   * Pull/download a model if not available
   */
  async pullModel(modelName: string): Promise<boolean> {
    if (!await this.checkOllamaConnection()) {
      throw new Error('Ollama service is not available');
    }

    try {
      this.logger.log(`Pulling model: ${modelName}`);
      
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.ollamaBaseUrl}/api/pull`,
          {
            name: modelName,
          },
          {
            timeout: 300000, // 5 minutes for model download
          }
        )
      );

      this.logger.log(`Successfully pulled model: ${modelName}`);
      
      // Clear cache to force refresh
      this.healthCache.delete(modelName);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to pull model ${modelName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Ensure a model is loaded and available
   */
  async ensureModelLoaded(modelName: string): Promise<boolean> {
    // First check if model is already available
    const health = await this.checkModelHealth(modelName);
    if (health.available) {
      return true;
    }

    // Try to pull the model
    return await this.pullModel(modelName);
  }

  /**
   * Get models by tier
   */
  async getModelsByTier(tier: string): Promise<ModelStatus[]> {
    // This would integrate with the database to get tier information
    // For now, return models that match common tier patterns
    const allModels = await this.getAvailableModels();
    
    const tierPatterns = {
      'ultra-fast': ['1b', '3b'],
      'general': ['7b', '8b'],
      'fast-thinking': ['20b', '70b'],
    };

    const patterns = tierPatterns[tier] || [];
    return allModels.filter(model => 
      patterns.some(pattern => model.name.includes(pattern))
    );
  }

  /**
   * Get overall Ollama status
   */
  async getOllamaStatus(): Promise<OllamaStatus> {
    await this.checkOllamaConnection();
    
    if (this.ollamaStatus.connected) {
      this.ollamaStatus.models = await this.getAvailableModels();
    }

    return { ...this.ollamaStatus };
  }

  /**
   * Get model information for a specific model
   */
  async getModelInfo(modelName: string): Promise<ModelStatus | null> {
    const models = await this.getAvailableModels();
    return models.find(model => model.name === modelName) || null;
  }

  /**
   * Delete/remove a model
   */
  async deleteModel(modelName: string): Promise<boolean> {
    if (!await this.checkOllamaConnection()) {
      throw new Error('Ollama service is not available');
    }

    try {
      await firstValueFrom(
        this.httpService.delete(`${this.ollamaBaseUrl}/api/delete`, {
          data: { name: modelName },
          timeout: 30000,
        })
      );

      this.logger.log(`Successfully deleted model: ${modelName}`);
      
      // Clear cache
      this.healthCache.delete(modelName);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete model ${modelName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Clear health cache
   */
  clearCache(): void {
    this.healthCache.clear();
    this.logger.debug('Cleared model health cache');
  }

  /**
   * Get service statistics
   */
  getStats(): {
    connected: boolean;
    totalModels: number;
    loadedModels: number;
    errorModels: number;
    cacheSize: number;
    avgResponseTime: number;
  } {
    const models = this.ollamaStatus.models;
    const loadedModels = models.filter(m => m.status === 'loaded').length;
    const errorModels = models.filter(m => m.status === 'error').length;
    
    const responseTimes = models
      .filter(m => m.responseTime)
      .map(m => m.responseTime!);
    
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return {
      connected: this.ollamaStatus.connected,
      totalModels: models.length,
      loadedModels,
      errorModels,
      cacheSize: this.healthCache.size,
      avgResponseTime: Math.round(avgResponseTime),
    };
  }

  /**
   * Periodic health check for all models
   */
  async performHealthCheck(): Promise<void> {
    this.logger.debug('Performing periodic health check');
    
    const models = await this.getAvailableModels();
    for (const model of models) {
      // This will update the cache
      await this.checkModelHealth(model.name);
    }
  }
}
