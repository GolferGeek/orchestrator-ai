/**
 * Simplified Centralized Routing Service
 *
 * Clean routing logic that:
 * 1. Checks for showstoppers (blocks early)
 * 2. Selects appropriate provider/model
 * 3. Passes metadata through without modification
 */

import { Injectable, Logger } from '@nestjs/common';
import { SimplifiedPIIService } from './pii/pii-simplified.service';
import { SimplifiedPIIMetadata } from './types/simplified-pii-metadata.types';
import { FeatureFlagService } from '../config/feature-flag.service';
import { SovereignPolicyService } from './config/sovereign-policy.service';

export interface SimplifiedRoutingDecision {
  provider: string;
  model: string;
  isLocal: boolean;
  shouldRoute: boolean;
  blockingReason?: string;
  piiMetadata?: SimplifiedPIIMetadata;
  dictionaryMappings?: any[]; // For reversal later
}

@Injectable()
export class SimplifiedCentralizedRoutingService {
  private readonly logger = new Logger(
    SimplifiedCentralizedRoutingService.name,
  );

  constructor(
    private readonly piiService: SimplifiedPIIService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly sovereignPolicyService: SovereignPolicyService,
  ) {}

  /**
   * Main routing decision - simple and clean
   */
  async route(
    prompt: string,
    options: {
      systemPrompt?: string;
      provider?: string;
      model?: string;
      conversationId?: string;
      userId?: string;
    } = {},
  ): Promise<SimplifiedRoutingDecision> {
    try {
      // Step 1: Quick showstopper check
      const hasShowstoppers = await this.piiService.hasShowstoppers(prompt);
      if (hasShowstoppers) {
        this.logger.warn(
          '🛑 [ROUTING] Showstopper PII detected - blocking request',
        );

        // Get full PII details for metadata
        const { metadata } = await this.piiService.processPII(prompt, {
          provider: options.provider,
          conversationId: options.conversationId,
          applyDictionary: false, // Don't apply dictionary for blocked requests
        });

        return {
          provider: 'blocked',
          model: 'showstopper-pii',
          isLocal: true,
          shouldRoute: false,
          blockingReason: 'showstopper-pii',
          piiMetadata: metadata,
        };
      }

      // Step 2: Determine provider/model
      let provider =
        options.provider || process.env.DEFAULT_PROVIDER || 'openai';
      let model = options.model || this.getDefaultModel(provider);

      // Check sovereign mode
      const sovereignMode = this.featureFlagService.isEnabled(
        'sovereign-mode',
        { userId: options.userId },
      );

      if (sovereignMode) {
        // Force local provider in sovereign mode
        provider = 'ollama';
        model = 'llama3.2:latest';
        this.logger.debug(
          '🔒 [ROUTING] Sovereign mode active - using local model',
        );
      }

      const isLocal =
        provider.toLowerCase() === 'ollama' ||
        provider.toLowerCase() === 'local';

      // Step 3: Process PII (flags ONLY - no pseudonymization here)
      const { metadata } = await this.piiService.processPII(prompt, {
        provider,
        conversationId: options.conversationId,
      });

      this.logger.debug(
        `✅ [ROUTING] Decision: ${provider}/${model} (local: ${isLocal})`,
      );
      this.logger.debug(
        `✅ [ROUTING] PII: ${metadata.flagCount} flags detected`,
      );

      return {
        provider,
        model,
        isLocal,
        shouldRoute: true,
        piiMetadata: metadata,
        dictionaryMappings: [], // LLM service will handle this
      };
    } catch (error) {
      this.logger.error(
        `❌ [ROUTING] Error: ${error instanceof Error ? error.message : String(error)}`,
      );

      // On error, use fallback provider
      return {
        provider: 'ollama',
        model: 'llama3.2:latest',
        isLocal: true,
        shouldRoute: true,
        piiMetadata: {
          flags: [],
          pseudonyms: [],
          flagCount: 0,
          pseudonymCount: 0,
        },
      };
    }
  }

  /**
   * Process agent response - just reverse pseudonyms
   */
  async processResponse(
    response: string,
    dictionaryMappings?: any[],
  ): Promise<{
    processedResponse: string;
    reversalCount: number;
  }> {
    if (!dictionaryMappings || dictionaryMappings.length === 0) {
      return {
        processedResponse: response,
        reversalCount: 0,
      };
    }

    const result = await this.piiService.reversePseudonyms(
      response,
      dictionaryMappings,
    );
    this.logger.debug(
      `🔄 [ROUTING] Reversed ${result.reversalCount} pseudonyms in response`,
    );

    return {
      processedResponse: result.originalText,
      reversalCount: result.reversalCount,
    };
  }

  /**
   * Get default model for provider
   */
  private getDefaultModel(provider: string): string {
    const defaults: Record<string, string> = {
      openai: 'gpt-4-turbo-preview',
      anthropic: 'claude-3-opus-20240229',
      google: 'gemini-pro',
      ollama: 'llama3.2:latest',
      groq: 'llama-3.1-70b-versatile',
    };

    return defaults[provider.toLowerCase()] || 'gpt-4-turbo-preview';
  }
}
