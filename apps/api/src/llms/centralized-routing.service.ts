import { Injectable, Logger } from '@nestjs/common';

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

  constructor() {
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
          const localModel = this.selectBestLocalModel(tier);
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
      reasoningPath.push(`Error occurred: ${error.message}, using default fallback`);
      
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
   * TODO: This will be replaced with actual LocalModelStatusService integration
   */
  private async checkLocalModelAvailability(tier: string): Promise<boolean> {
    // Simulate availability check
    // In the real implementation, this will check with LocalModelStatusService
    const availability = {
      'ultra-fast': Math.random() > 0.3, // 70% availability
      'general': Math.random() > 0.2, // 80% availability
      'fast-thinking': Math.random() > 0.5, // 50% availability
    };
    
    return availability[tier] || false;
  }

  /**
   * Select the best local model for the given tier
   * TODO: This will be replaced with actual database query and model selection logic
   */
  private selectBestLocalModel(tier: string): string {
    const modelMap = {
      'ultra-fast': 'llama3.2:1b',
      'general': 'llama3.1:8b', 
      'fast-thinking': 'gpt-oss-20b',
    };
    
    return modelMap[tier] || 'llama3.1:8b';
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
