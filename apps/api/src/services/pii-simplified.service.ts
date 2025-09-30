/**
 * Simplified PII Service
 *
 * Clean, single-responsibility service for PII detection and tracking.
 * This replaces the complex legacy PII service with a simple, understandable flow.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PIIPatternService } from '../llms/pii-pattern.service';
import { DictionaryPseudonymizerService } from './dictionary-pseudonymizer.service';
import {
  SimplifiedPIIMetadata,
  PIIFlag,
  PIIPseudonym,
} from '../common/types/simplified-pii-metadata.types';

@Injectable()
export class SimplifiedPIIService {
  private readonly logger = new Logger(SimplifiedPIIService.name);

  constructor(
    private readonly patternService: PIIPatternService,
    private readonly dictionaryService: DictionaryPseudonymizerService,
  ) {}

  /**
   * Main entry point for PII processing
   * ONLY detects flags - does NOT apply pseudonymization
   * LLM service handles all pseudonymization
   */
  async processPII(
    text: string,
    options: {
      provider?: string;
      conversationId?: string;
      applyDictionary?: boolean;
    } = {},
  ): Promise<{
    processedText: string;
    metadata: SimplifiedPIIMetadata;
    dictionaryMappings?: any[]; // For reversal later
  }> {
    const startTime = Date.now();

    // Step 1: Pattern detection (flags ONLY)
    const detectionResult = await this.patternService.detectPII(text);
    const flags: PIIFlag[] = detectionResult.matches.map((p: any) => ({
      value: p.value,
      dataType: p.dataType,
      severity: p.severity,
      confidence: p.confidence,
      pattern: p.pattern,
    }));

    // Check for showstoppers
    const hasShowstopper = flags.some((f) => f.severity === 'showstopper');
    if (hasShowstopper) {
      this.logger.warn(
        `🛑 [SIMPLIFIED-PII] Showstopper PII detected - blocking request`,
      );
      return {
        processedText: text,
        metadata: {
          flags,
          pseudonyms: [],
          flagCount: flags.length,
          pseudonymCount: 0,
          blocked: true,
          blockingReason: 'showstopper-pii',
        },
      };
    }

    const processingTime = Date.now() - startTime;
    this.logger.debug(
      `✅ [SIMPLIFIED-PII] Detected ${flags.length} flags in ${processingTime}ms`,
    );

    // Return original text with just the flags
    // LLM service will handle pseudonymization
    return {
      processedText: text,
      metadata: {
        flags,
        pseudonyms: [], // LLM service will populate this
        flagCount: flags.length,
        pseudonymCount: 0, // LLM service will update this
      },
      dictionaryMappings: [], // LLM service will handle this
    };
  }

  /**
   * Reverse pseudonyms in response text
   */
  async reversePseudonyms(
    text: string,
    mappings: any[],
  ): Promise<{
    originalText: string;
    reversalCount: number;
  }> {
    if (!mappings || mappings.length === 0) {
      return { originalText: text, reversalCount: 0 };
    }

    const _result = await this.dictionaryService.reversePseudonyms(
      text,
      mappings,
    );
    this.logger.debug(
      `🔄 [SIMPLIFIED-PII] Reversed ${result.reversalCount} pseudonyms`,
    );

    return {
      originalText: result.originalText,
      reversalCount: result.reversalCount,
    };
  }

  /**
   * Check if text contains showstopper PII
   * Quick check for early exit
   */
  async hasShowstoppers(text: string): Promise<boolean> {
    const detectionResult = await this.patternService.detectPII(text);
    return detectionResult.matches.some(
      (p: any) => p.severity === 'showstopper',
    );
  }
}
