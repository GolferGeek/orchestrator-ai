import { Injectable, Logger } from '@nestjs/common';
import { DataSanitizationService } from '../llms/data-sanitization.service';

export interface PIIPolicyResult {
  allowed: boolean;
  sanitizedPrompt: string;
  sanitizationResult?: any;
  violations: string[];
  reasoningPath: string[];
}

export interface PIILLMSanitizationResult {
  sanitizedSystemPrompt: string;
  sanitizedUserMessage: string;
  reversalContext: any;
  sanitizationMetrics: any;
  shouldApplySanitization: boolean;
}

export interface PIIRestorationResult {
  restoredContent: string;
  success: boolean;
  error?: string;
}

/**
 * Unified PII service that handles both policy checking and LLM sanitization workflows
 */
@Injectable()
export class PIIService {
  private readonly logger = new Logger(PIIService.name);

  constructor(
    private readonly dataSanitizationService: DataSanitizationService,
  ) {}

  /**
   * Check if a prompt violates PII policy (used by routing service)
   */
  async checkPolicy(prompt: string, options: any = {}): Promise<PIIPolicyResult> {
    const violations: string[] = [];
    const reasoningPath: string[] = [];
    let sanitizedPrompt = prompt;
    let sanitizationResult: any = null;

    try {
      // Use existing DataSanitizationService for comprehensive PII handling
      sanitizationResult = await this.dataSanitizationService.sanitizeText(prompt, {
        enableRedaction: true,
        enablePseudonymization: true,
        pseudonymizationContext: options.conversationId || 'pii-policy-check'
      });

      const hasRedactions = sanitizationResult.redactionResult?.redactionCount > 0;
      const hasPseudonyms = sanitizationResult.pseudonymizationResult?.pseudonyms?.length > 0;
      const isSignificantlyChanged = sanitizationResult.sanitizedText !== prompt;

      if (hasRedactions) {
        // Redactions indicate secrets/credentials - this should block the request
        reasoningPath.push(`PII Policy: BLOCKED - Sensitive credentials detected`);
        reasoningPath.push(`Redacted patterns: ${sanitizationResult.redactionResult.patternsMatched?.join(', ') || 'classified'}`);
        violations.push('Sensitive credentials detected in prompt');
        
        this.logger.warn(`Credentials detected in prompt - request blocked`);
        
        return {
          allowed: false,
          sanitizedPrompt: prompt, // Don't return sanitized version for blocked requests
          sanitizationResult,
          violations,
          reasoningPath
        };
      } else if (hasPseudonyms) {
        reasoningPath.push(`PII Policy: SANITIZED - ${sanitizationResult.pseudonymizationResult.pseudonyms.length} PII items replaced`);
        const piiTypes = sanitizationResult.pseudonymizationResult.pseudonyms.map((p: any) => p.dataType);
        reasoningPath.push(`Pseudonymized types: ${[...new Set(piiTypes)].join(', ')}`);
        sanitizedPrompt = sanitizationResult.sanitizedText;
        
        this.logger.log(`PII pseudonymized: ${piiTypes.join(', ')}`);
      } else if (isSignificantlyChanged) {
        reasoningPath.push(`PII Policy: SANITIZED - Content cleaned`);
        sanitizedPrompt = sanitizationResult.sanitizedText;
        
        this.logger.log(`Content sanitized during PII check`);
      } else {
        reasoningPath.push(`PII Policy: CLEAN - No sensitive content detected`);
      }

      return {
        allowed: true,
        sanitizedPrompt,
        sanitizationResult,
        violations,
        reasoningPath
      };

    } catch (sanitizationError) {
      this.logger.error(`PII policy check failed: ${sanitizationError instanceof Error ? sanitizationError.message : String(sanitizationError)}`);
      reasoningPath.push(`PII Policy: ERROR - Sanitization check failed`);
      violations.push('PII policy check failed');
      
      // On error, allow but log the issue
      return {
        allowed: true,
        sanitizedPrompt: prompt,
        sanitizationResult: null,
        violations,
        reasoningPath
      };
    }
  }

  /**
   * Sanitize system prompt and user message for LLM calls (used by LLM service)
   */
  async sanitizeForLLM(
    systemPrompt: string,
    userMessage: string,
    isLocalProvider: boolean,
    options: any = {}
  ): Promise<PIILLMSanitizationResult> {
    this.logger.log(`🔍 [PII-DEBUG] sanitizeForLLM called - isLocalProvider: ${isLocalProvider}, userMessage length: ${userMessage.length}`);
    
    // Skip sanitization for local providers
    if (isLocalProvider) {
      this.logger.log(`🔍 [PII-DEBUG] Local provider detected - skipping sanitization`);
      await this.dataSanitizationService.debug(
        'Using local provider - skipping sanitization',
        undefined,
        'PIIService',
        { provider: 'local', sanitized: false }
      );

      return {
        sanitizedSystemPrompt: systemPrompt,
        sanitizedUserMessage: userMessage,
        reversalContext: null,
        sanitizationMetrics: this.getEmptySanitizationMetrics(),
        shouldApplySanitization: false
      };
    }

    // Apply sanitization for external providers
    this.logger.log(`🔍 [PII-DEBUG] External provider detected - applying sanitization`);
    this.logger.log(`🔍 [PII-DEBUG] User message preview: "${userMessage.substring(0, 100)}..."`);
    
    await this.dataSanitizationService.debug(
      'Using external provider - applying sanitization',
      undefined,
      'PIIService',
      { provider: 'external', sanitized: true }
    );

    try {
      const sanitizationResult = await this.dataSanitizationService.sanitizeForLLM(
        systemPrompt,
        userMessage,
        options.sessionId || options.conversationId || 'llm-call',
        {
          enableRedaction: process.env.ENABLE_REDACTION === 'true',
          enablePseudonymization: true,
          pseudonymizationContext: options.conversationId || 'llm-call'
        }
      );

      this.logger.log(`🔍 [PII-DEBUG] Sanitization completed - sanitized user message preview: "${sanitizationResult.sanitizedUserMessage.substring(0, 100)}..."`);
      this.logger.log(`🔍 [PII-DEBUG] Has reversal context: ${!!sanitizationResult.reversalContext}`);

      const sanitizationMetrics = this.dataSanitizationService.extractSanitizationMetrics(
        sanitizationResult.userSanitizationResult
      );

      await this.dataSanitizationService.debug(
        'Content sanitized for external provider',
        undefined,
        'PIIService',
        {
          systemPromptLength: sanitizationResult.sanitizedSystemPrompt.length,
          userMessageLength: sanitizationResult.sanitizedUserMessage.length,
          sanitized: true,
          hasReversalContext: !!sanitizationResult.reversalContext
        }
      );

      return {
        sanitizedSystemPrompt: sanitizationResult.sanitizedSystemPrompt,
        sanitizedUserMessage: sanitizationResult.sanitizedUserMessage,
        reversalContext: sanitizationResult.reversalContext,
        sanitizationMetrics,
        shouldApplySanitization: true
      };

    } catch (sanitizationError) {
      await this.dataSanitizationService.error(
        `Sanitization failed for external provider: ${sanitizationError instanceof Error ? sanitizationError.message : 'Unknown error'}`,
        undefined,
        'PIIService',
        {
          systemPromptLength: systemPrompt.length,
          userMessageLength: userMessage.length,
          error: sanitizationError instanceof Error ? sanitizationError.message : 'Unknown error'
        }
      );

      throw new Error(`Data sanitization failed for external provider: ${sanitizationError instanceof Error ? sanitizationError.message : 'Unknown error'}. Cannot proceed with unsanitized data to external provider.`);
    }
  }


  /**
   * Get policy violation details for logging/audit
   */
  getPolicyViolationDetails(result: PIIPolicyResult): any {
    if (result.allowed) return null;

    return {
      blocked: true,
      violations: result.violations,
      sanitizationMetadata: result.sanitizationResult,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get empty sanitization metrics for local providers
   */
  private getEmptySanitizationMetrics(): any {
    return {
      sanitizationLevel: 'none',
      piiDetected: false,
      piiTypes: [],
      pseudonymsUsed: 0,
      pseudonymTypes: [],
      redactionsApplied: 0,
      redactionTypes: [],
      sanitizationTimeMs: 0,
      reversalContextSize: 0
    };
  }

  /**
   * Restore response content from pseudonyms (used by LLM service)
   */
  async restoreResponse(
    responseContent: string,
    reversalContext: any
  ): Promise<PIIRestorationResult> {
    try {
      if (!reversalContext) {
        return {
          restoredContent: responseContent,
          success: true
        };
      }

      // Use DataSanitizationService to restore the content
      const restoredContent = await this.dataSanitizationService.reverseLLMResponse(
        responseContent,
        reversalContext
      );

      return {
        restoredContent,
        success: true
      };

    } catch (error) {
      this.logger.error(`Failed to restore response content: ${error instanceof Error ? error.message : String(error)}`);
      return {
        restoredContent: responseContent, // Return original on error
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Debug method to access underlying DataSanitizationService
   */
  async debug(message: string, metadata?: any): Promise<void> {
    return this.dataSanitizationService.debug(message, metadata);
  }

  /**
   * Info method to access underlying DataSanitizationService
   */
  async info(message: string, metadata?: any): Promise<void> {
    return this.dataSanitizationService.info(message, metadata);
  }

  /**
   * Error method to access underlying DataSanitizationService
   */
  async error(message: string, metadata?: any): Promise<void> {
    return this.dataSanitizationService.error(message, metadata);
  }

  /**
   * Warn method to access underlying DataSanitizationService
   */
  async warn(message: string, metadata?: any): Promise<void> {
    return this.dataSanitizationService.warn(message, metadata);
  }
}
