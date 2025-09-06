import { Injectable, Logger } from '@nestjs/common';
import { LocalModelStatusService } from './local-model-status.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SovereignPolicyService } from '../config/sovereign-policy.service';
import { FeatureFlagService, FeatureFlagContext } from '../config/feature-flag.service';

export interface RoutingDecision {
  provider: string;
  model: string;
  isLocal: boolean;
  modelTier?: string;
  fallbackUsed: boolean;
  complexityScore: number;
  reasoningPath: string[];
  sovereignModeEnforced?: boolean;
  sovereignModeViolation?: boolean;
}

export interface LLMRequest {
  prompt: string;
  options?: {
    provider?: string;
    model?: string;
    preferLocal?: boolean;
    maxComplexity?: 'simple' | 'medium' | 'complex';
    userId?: string;
    organizationId?: string;
    userSovereignMode?: boolean;
    [key: string]: any;
  };
}

export type ComplexityLevel = 'simple' | 'medium' | 'complex';

@Injectable()
export class CentralizedRoutingService {
  private readonly logger = new Logger(CentralizedRoutingService.name);

  constructor(
    private readonly localModelStatusService: LocalModelStatusService,
    private readonly supabaseService: SupabaseService,
    private readonly sovereignPolicyService: SovereignPolicyService,
    private readonly featureFlagService: FeatureFlagService,
  ) {
    this.logger.log('CentralizedRoutingService initialized');
  }

  /**
   * Main routing method that determines the best provider/model for a request
   */
  async determineRoute(prompt: string, options: any = {}): Promise<RoutingDecision> {
    const request: LLMRequest = { prompt, options };
    const reasoningPath: string[] = [];

    try {
      // Step 1: Check feature flag for sovereign routing
      const featureFlagContext: FeatureFlagContext = {
        userId: options.userId,
        organizationId: options.organizationId,
      };
      const sovereignRoutingEnabled = this.featureFlagService.isSovereignRoutingEnabled(featureFlagContext);
      
      let sovereignModeActive = false;
      let sovereignPolicy = null;
      
      if (sovereignRoutingEnabled) {
        reasoningPath.push('Sovereign routing feature flag: ENABLED');
        
        // Check sovereign mode policy
        sovereignPolicy = this.sovereignPolicyService.getPolicy();
        const userSovereignMode = options.userSovereignMode || false;
        sovereignModeActive = sovereignPolicy.enforced || userSovereignMode;
        
        if (sovereignModeActive) {
          reasoningPath.push(`Sovereign mode active (enforced: ${sovereignPolicy.enforced}, user: ${userSovereignMode})`);
          reasoningPath.push(`Allowed providers: ollama only`);
        }
      } else {
        reasoningPath.push('Sovereign routing feature flag: DISABLED - using legacy routing');
        // Legacy behavior: no sovereign mode restrictions
      }

      // Step 2: Honor explicit provider/model requests (with sovereign mode validation)
      if (options.provider && options.model) {
        reasoningPath.push(`Explicit provider/model requested: ${options.provider}/${options.model}`);
        
        // Validate against sovereign mode if active and feature flag is enabled
        if (sovereignRoutingEnabled && sovereignModeActive && sovereignPolicy && !this.sovereignPolicyService.isProviderAllowed(options.provider)) {
          reasoningPath.push(`SOVEREIGN MODE VIOLATION: Provider ${options.provider} not allowed`);
          this.logger.warn(`Sovereign mode violation: Provider ${options.provider} not allowed (only ollama permitted)`);
          
          // Fall through to sovereign-compliant routing
        } else {
          return {
            provider: options.provider,
            model: options.model,
            isLocal: options.provider === 'ollama',
            fallbackUsed: false,
            complexityScore: 0,
            reasoningPath,
            sovereignModeEnforced: sovereignModeActive,
            sovereignModeViolation: false,
          };
        }
      }

      // Step 3: Analyze request complexity
      const complexity = this.analyzeComplexity(request);
      const complexityScore = this.getComplexityScore(complexity);
      reasoningPath.push(`Complexity analysis: ${complexity} (score: ${complexityScore})`);

      // Step 4: Select appropriate tier based on complexity
      const tier = this.selectTierForComplexity(complexity);
      reasoningPath.push(`Selected tier: ${tier}`);

      // Step 5: Determine provider preference (sovereign mode overrides user preference)
      let preferLocal = options.preferLocal !== false; // Default to true
      
      if (sovereignRoutingEnabled && sovereignModeActive) {
        // In sovereign mode, only local providers are allowed
        preferLocal = true;
        reasoningPath.push('Sovereign mode: forced local preference (local providers only)');
      }
      if (preferLocal) {
        reasoningPath.push('Attempting local-first routing');
        
        // For now, simulate local model availability check
        const localModelAvailable = await this.checkLocalModelAvailability(tier);
        
        if (localModelAvailable) {
          const localModel = await this.selectBestLocalModel(tier, sovereignPolicy);
          reasoningPath.push(`Selected local model: ${localModel}`);
          
          return {
            provider: 'ollama',
            model: localModel,
            isLocal: true,
            modelTier: tier,
            fallbackUsed: false,
            complexityScore,
            reasoningPath,
            sovereignModeEnforced: sovereignModeActive,
            sovereignModeViolation: false,
          };
        } else {
          reasoningPath.push('No local models available, falling back to external');
        }
      }

      // Step 6: Fall back to external provider (blocked in sovereign mode)
      if (sovereignRoutingEnabled && sovereignModeActive) {
        // In sovereign mode, no external providers are allowed
        reasoningPath.push('SOVEREIGN MODE: No external providers allowed, no fallback available');
        this.logger.error('Sovereign mode violation: No external providers allowed but local models unavailable');
        
        // Return a sovereign mode violation response
        return {
          provider: 'none',
          model: 'none',
          isLocal: false,
          modelTier: tier,
          fallbackUsed: true,
          complexityScore,
          reasoningPath,
          sovereignModeEnforced: true,
          sovereignModeViolation: true,
        };
      }
      
      const externalDecision = this.getExternalFallback(tier, request);
      reasoningPath.push(`External fallback: ${externalDecision.provider}/${externalDecision.model}`);

      // External provider selected (sovereign mode already handled above)

      return {
        ...externalDecision,
        complexityScore,
        reasoningPath,
        fallbackUsed: true,
        sovereignModeEnforced: sovereignModeActive,
        sovereignModeViolation: false,
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
        sovereignModeEnforced: false,
        sovereignModeViolation: false,
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
  private async selectBestLocalModel(tier: string, sovereignPolicy?: any): Promise<string> {
    try {
      const models = await this.localModelStatusService.getModelsByTier(tier);
      let availableModels = models.filter(model => model.status === 'loaded');
      
      // If sovereign mode is active, we could add additional filtering here
      // For now, all local models are considered compliant with sovereign mode
      // since they're from the 'ollama' provider which should be in allowedProviders
      
      if (availableModels.length > 0) {
        // Return the first available model (they're already sorted by priority)
        return availableModels[0]?.name || 'qwen3:8b';
      }
      
      // Fallback to any model in the tier
      if (models.length > 0) {
        return models[0]?.name || 'qwen3:8b';
      }
      
      // Final fallback - query database for any model in this tier
      const fallbackModel = await this.getFallbackModelFromDatabase(tier);
      if (fallbackModel) {
        return fallbackModel;
      }
      
      // Ultimate emergency fallback
      return 'qwen3:8b';
    } catch (error) {
      this.logger.error(`Failed to select best local model for tier ${tier}:`, error);
      
      // Emergency fallback - try database query even in error case
      try {
        const fallbackModel = await this.getFallbackModelFromDatabase(tier);
        if (fallbackModel) {
          return fallbackModel;
        }
      } catch (fallbackError) {
        this.logger.error(`Database fallback also failed:`, fallbackError);
      }
      
      // Ultimate emergency fallback
      return 'qwen3:8b';
    }
  }

  /**
   * Get fallback model from database for the given tier
   */
  private async getFallbackModelFromDatabase(tier: string): Promise<string | null> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      const { data: models, error } = await client
        .from('llm_models')
        .select('model_name')
        .eq('is_local', true)
        .eq('model_tier', tier)
        .eq('is_active', true)
        .order('loading_priority', { ascending: false })
        .limit(1);

      if (error) {
        this.logger.error(`Failed to query fallback model for tier ${tier}:`, error);
        return null;
      }

      return models?.[0]?.model_name || null;
    } catch (error) {
      this.logger.error(`Database query failed for fallback model:`, error);
      return null;
    }
  }

  /**
   * Get external provider fallback for the given tier
   */
  private getExternalFallback(tier: string, request: LLMRequest): Omit<RoutingDecision, 'complexityScore' | 'reasoningPath' | 'fallbackUsed'> {
    // Define tier-based provider preferences (in order of preference)
    const tierProviderMap: Record<string, Array<{provider: string, model: string, modelTier: string}>> = {
      'fast-thinking': [
        { provider: 'openai', model: 'gpt-4', modelTier: 'external-advanced' },
        { provider: 'anthropic', model: 'claude-3-opus', modelTier: 'external-advanced' },
        { provider: 'openai', model: 'gpt-3.5-turbo', modelTier: 'external-standard' },
      ],
      'general': [
        { provider: 'openai', model: 'gpt-3.5-turbo', modelTier: 'external-standard' },
        { provider: 'anthropic', model: 'claude-3-haiku', modelTier: 'external-standard' },
        { provider: 'openai', model: 'gpt-4', modelTier: 'external-advanced' },
      ],
      'ultra-fast': [
        { provider: 'openai', model: 'gpt-3.5-turbo', modelTier: 'external-fast' },
        { provider: 'anthropic', model: 'claude-3-haiku', modelTier: 'external-fast' },
      ],
    };

    const candidates = tierProviderMap[tier] || tierProviderMap['general'];
    
    // Use first available external provider (sovereign mode is handled by caller)
    if (candidates && candidates.length > 0) {
      const selected = candidates[0]!; // We know it exists because we checked length > 0
      return {
        provider: selected.provider,
        model: selected.model,
        isLocal: false,
        modelTier: selected.modelTier,
      };
    }
    
    // Fallback if no candidates available
    return {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      isLocal: false,
      modelTier: 'external-standard',
    };
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
