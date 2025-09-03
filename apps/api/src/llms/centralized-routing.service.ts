import { Injectable, Logger } from '@nestjs/common';
import { LocalModelStatusService } from './local-model-status.service';

export interface RoutingDecision {
  provider: string;
  model: string;
  isLocal: boolean;
  modelTier?: string;
  fallbackUsed: boolean;
  complexityScore: number;
  reasoningPath: string[];
}

export interface LLMRequest {
  prompt: string;
  options?: {
    provider?: string;
    model?: string;
    preferLocal?: boolean;
    maxComplexity?: 'simple' | 'medium' | 'complex';
    [key: string]: any;
  };
}

export type ComplexityLevel = 'simple' | 'medium' | 'complex';

@Injectable()
export class CentralizedRoutingService {
  private readonly logger = new Logger(CentralizedRoutingService.name);

  constructor(private readonly localModelStatusService: LocalModelStatusService) {
    this.logger.log('CentralizedRoutingService initialized');
  }

  /**
   * Main routing method that determines the best provider/model for a request
   */
  async determineRoute(prompt: string, options: any = {}): Promise<RoutingDecision> {
    const request: LLMRequest = { prompt, options };
    const reasoningPath: string[] = [];

    try {
      // Step 1: Honor explicit provider/model requests
      if (options.provider && options.model) {
        reasoningPath.push(`Explicit provider/model requested: ${options.provider}/${options.model}`);
        return {
          provider: options.provider,
          model: options.model,
          isLocal: options.provider === 'ollama',
          fallbackUsed: false,
          complexityScore: 0,
          reasoningPath,
        };
      }

      // Step 2: Analyze request complexity
      const complexity = this.analyzeComplexity(request);
      const complexityScore = this.getComplexityScore(complexity);
      reasoningPath.push(`Complexity analysis: ${complexity} (score: ${complexityScore})`);

      // Step 3: Select appropriate tier based on complexity
      const tier = this.selectTierForComplexity(complexity);
      reasoningPath.push(`Selected tier: ${tier}`);

      // Step 4: Check if we should prefer local models
      const preferLocal = options.preferLocal !== false; // Default to true
      if (preferLocal) {
        reasoningPath.push('Attempting local-first routing');
        
        // For now, simulate local model availability check
        const localModelAvailable = await this.checkLocalModelAvailability(tier);
        
        if (localModelAvailable) {
          const localModel = await this.selectBestLocalModel(tier);
          reasoningPath.push(`Selected local model: ${localModel}`);
          
          return {
            provider: 'ollama',
            model: localModel,
            isLocal: true,
            modelTier: tier,
            fallbackUsed: false,
            complexityScore,
            reasoningPath,
          };
        } else {
          reasoningPath.push('No local models available, falling back to external');
        }
      }

      // Step 5: Fall back to external provider
      const externalDecision = this.getExternalFallback(tier, request);
      reasoningPath.push(`External fallback: ${externalDecision.provider}/${externalDecision.model}`);

      return {
        ...externalDecision,
        complexityScore,
        reasoningPath,
        fallbackUsed: true,
      };

    } catch (error) {
      this.logger.error('Error in routing decision', error);
      reasoningPath.push(`Error occurred: ${error instanceof Error ? error.message : 'Unknown error'}, using default fallback`);
      
      // Emergency fallback to OpenAI GPT-3.5
      return {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        isLocal: false,
        fallbackUsed: true,
        complexityScore: 5,
        reasoningPath,
      };
    }
  }

  /**
   * Analyze the complexity of a request using various heuristics
   */
  private analyzeComplexity(request: LLMRequest): ComplexityLevel {
    const { prompt } = request;
    
    // Basic metrics
    const wordCount = prompt.split(/\s+/).length;
    const sentenceCount = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : wordCount;
    
    // Advanced heuristics
    const hasCodeBlocks = /```[\s\S]*```|`[^`]+`/.test(prompt);
    const hasComplexQuestions = /\b(how|why|what|when|where|analyze|compare|evaluate|explain|describe)\b/gi.test(prompt);
    const hasMultipleRequests = /\b(and|also|additionally|furthermore|moreover|then|next)\b/gi.test(prompt);
    const hasTechnicalTerms = /\b(algorithm|database|api|function|class|method|variable|parameter|framework|library|deployment|architecture)\b/gi.test(prompt);
    
    // Calculate complexity score
    let score = 0;
    
    // Word count scoring
    if (wordCount < 20) score += 1;
    else if (wordCount < 100) score += 3;
    else if (wordCount < 300) score += 5;
    else score += 7;
    
    // Sentence complexity
    if (avgWordsPerSentence > 15) score += 2;
    if (sentenceCount > 5) score += 2;
    
    // Content complexity
    if (hasCodeBlocks) score += 3;
    if (hasComplexQuestions) score += 2;
    if (hasMultipleRequests) score += 2;
    if (hasTechnicalTerms) score += 1;
    
    // Map score to complexity level
    if (score <= 4) return 'simple';
    if (score <= 8) return 'medium';
    return 'complex';
  }

  /**
   * Get numeric complexity score for tracking
   */
  private getComplexityScore(complexity: ComplexityLevel): number {
    switch (complexity) {
      case 'simple': return 3;
      case 'medium': return 6;
      case 'complex': return 9;
    }
  }

  /**
   * Select appropriate tier based on complexity
   */
  private selectTierForComplexity(complexity: ComplexityLevel): string {
    switch (complexity) {
      case 'simple':
        return 'ultra-fast';
      case 'medium':
        return 'general';
      case 'complex':
        return 'fast-thinking';
    }
  }

  /**
   * Check if local models are available for the given tier
   */
  private async checkLocalModelAvailability(tier: string): Promise<boolean> {
    try {
      const models = await this.localModelStatusService.getModelsByTier(tier);
      return models.length > 0 && models.some(model => model.status === 'loaded');
    } catch (error) {
      this.logger.error(`Failed to check local model availability for tier ${tier}:`, error);
      return false;
    }
  }

  /**
   * Select the best local model for the given tier
   */
  private async selectBestLocalModel(tier: string): Promise<string> {
    try {
      const models = await this.localModelStatusService.getModelsByTier(tier);
      const availableModels = models.filter(model => model.status === 'loaded');
      
      if (availableModels.length > 0) {
        // Return the first available model (they're already sorted by priority)
        return availableModels[0]?.name || 'llama3.1:8b';
      }
      
      // Fallback to any model in the tier
      if (models.length > 0) {
        return models[0]?.name || 'llama3.1:8b';
      }
      
      // Final fallback based on tier
      const fallbackMap = {
        'ultra-fast': 'llama3.2:1b',
        'general': 'llama3.1:8b', 
        'fast-thinking': 'llama3.1:70b',
      };
      
      return fallbackMap[tier as keyof typeof fallbackMap] || 'llama3.1:8b';
    } catch (error) {
      this.logger.error(`Failed to select best local model for tier ${tier}:`, error);
      
      // Emergency fallback
      const fallbackMap = {
        'ultra-fast': 'llama3.2:1b',
        'general': 'llama3.1:8b', 
        'fast-thinking': 'llama3.1:70b',
      };
      
      return fallbackMap[tier as keyof typeof fallbackMap] || 'llama3.1:8b';
    }
  }

  /**
   * Get external provider fallback for the given tier
   */
  private getExternalFallback(tier: string, request: LLMRequest): Omit<RoutingDecision, 'complexityScore' | 'reasoningPath' | 'fallbackUsed'> {
    // Map local tiers to appropriate external providers
    switch (tier) {
      case 'fast-thinking':
        return {
          provider: 'openai',
          model: 'gpt-4',
          isLocal: false,
          modelTier: 'external-advanced',
        };
      case 'general':
        return {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          isLocal: false,
          modelTier: 'external-standard',
        };
      case 'ultra-fast':
        return {
          provider: 'openai',
          model: 'gpt-3.5-turbo-instruct',
          isLocal: false,
          modelTier: 'external-fast',
        };
      default:
        return {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          isLocal: false,
          modelTier: 'external-standard',
        };
    }
  }

  /**
   * Get routing statistics for monitoring
   */
  getRoutingStats(): {
    totalRequests: number;
    localRoutes: number;
    externalRoutes: number;
    fallbackRoutes: number;
    avgComplexityScore: number;
  } {
    // TODO: Implement actual statistics tracking
    return {
      totalRequests: 0,
      localRoutes: 0,
      externalRoutes: 0,
      fallbackRoutes: 0,
      avgComplexityScore: 0,
    };
  }
}
