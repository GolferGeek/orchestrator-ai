import { Injectable, Logger } from '@nestjs/common';
import { SecretRedactionService, RedactionResult } from './secret-redaction.service';
import { PseudonymizationService, PseudonymizationResult } from './pseudonymization.service';

export interface SanitizationOptions {
  enableRedaction?: boolean;
  enablePseudonymization?: boolean;
  pseudonymizationContext?: string;
  preserveFormatting?: boolean;
}

export interface SanitizationResult {
  sanitizedText: string;
  originalLength: number;
  sanitizedLength: number;
  redactionResult?: RedactionResult;
  pseudonymizationResult?: PseudonymizationResult;
  processingTimeMs: number;
  reversalContext?: any; // Context needed to reverse pseudonymization
}

export interface LogEntry {
  runId: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class DataSanitizationService {
  private readonly logger = new Logger(DataSanitizationService.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly enableVerboseLogging = process.env.ENABLE_VERBOSE_LOGGING === 'true';
  
  // In-memory cache for pseudonym contexts (fast lookup)
  private readonly contextCache = new Map<string, any>();
  private readonly cacheExpirationMs = 60 * 60 * 1000; // 1 hour
  private readonly maxCacheSize = 10000;

  constructor(
    private readonly secretRedactionService: SecretRedactionService,
    private readonly pseudonymizationService: PseudonymizationService
  ) {
    this.logger.log(`DataSanitizationService initialized (production: ${this.isProduction})`);
  }

  /**
   * Sanitize text by applying both redaction and pseudonymization
   */
  async sanitizeText(
    text: string,
    options: SanitizationOptions = {}
  ): Promise<SanitizationResult> {
    const startTime = Date.now();
    const originalLength = text?.length || 0;

    if (!text) {
      return {
        sanitizedText: text,
        originalLength: 0,
        sanitizedLength: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    const {
      enableRedaction = true,
      enablePseudonymization = true,
      pseudonymizationContext = 'general',
      preserveFormatting = true,
    } = options;

    let sanitizedText = text;
    let redactionResult: RedactionResult | undefined;
    let pseudonymizationResult: PseudonymizationResult | undefined;

    try {
      // First apply secret redaction
      if (enableRedaction) {
        const redactionResponse = this.secretRedactionService.redactSecrets(sanitizedText);
        sanitizedText = redactionResponse.redactedText;
        redactionResult = redactionResponse.result;
      }

      // Then apply pseudonymization to the redacted text
      if (enablePseudonymization) {
        pseudonymizationResult = await this.pseudonymizationService.pseudonymizeText(
          sanitizedText,
          { context: pseudonymizationContext }
        );
        sanitizedText = pseudonymizationResult.pseudonymizedText;
      }

      const result: SanitizationResult = {
        sanitizedText,
        originalLength,
        sanitizedLength: sanitizedText.length,
        redactionResult,
        pseudonymizationResult,
        processingTimeMs: Date.now() - startTime,
      };

      return result;
    } catch (error) {
      this.logger.error(`Error during text sanitization: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Sanitize object by recursively processing all string values
   */
  async sanitizeObject(
    obj: any,
    options: SanitizationOptions = {}
  ): Promise<{ sanitizedObject: any; result: SanitizationResult }> {
    const startTime = Date.now();

    if (!obj || typeof obj !== 'object') {
      const sanitizationResult = await this.sanitizeText(String(obj), options);
      return {
        sanitizedObject: sanitizationResult.sanitizedText,
        result: sanitizationResult,
      };
    }

    const sanitizedObject: any = Array.isArray(obj) ? [] : {};
    let totalOriginalLength = 0;
    let totalSanitizedLength = 0;
    let totalRedactionCount = 0;
    let totalPseudonymCount = 0;
    const allPatternsMatched: string[] = [];
    const allPiiTypesFound: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const sanitizationResult = await this.sanitizeText(value, options);
        sanitizedObject[key] = sanitizationResult.sanitizedText;
        
        totalOriginalLength += sanitizationResult.originalLength;
        totalSanitizedLength += sanitizationResult.sanitizedLength;
        
        if (sanitizationResult.redactionResult) {
          totalRedactionCount += sanitizationResult.redactionResult.redactionCount;
          allPatternsMatched.push(...sanitizationResult.redactionResult.patternsMatched);
        }
        
        if (sanitizationResult.pseudonymizationResult) {
          totalPseudonymCount += sanitizationResult.pseudonymizationResult.pseudonyms.length;
          allPiiTypesFound.push(...sanitizationResult.pseudonymizationResult.pseudonyms.map(p => p.dataType));
        }
      } else if (typeof value === 'object' && value !== null) {
        const nestedResult = await this.sanitizeObject(value, options);
        sanitizedObject[key] = nestedResult.sanitizedObject;
        
        totalOriginalLength += nestedResult.result.originalLength;
        totalSanitizedLength += nestedResult.result.sanitizedLength;
        
        if (nestedResult.result.redactionResult) {
          totalRedactionCount += nestedResult.result.redactionResult.redactionCount;
          allPatternsMatched.push(...nestedResult.result.redactionResult.patternsMatched);
        }
        
        if (nestedResult.result.pseudonymizationResult) {
          totalPseudonymCount += nestedResult.result.pseudonymizationResult.pseudonyms.length;
          allPiiTypesFound.push(...nestedResult.result.pseudonymizationResult.pseudonyms.map(p => p.dataType));
        }
      } else {
        sanitizedObject[key] = value;
      }
    }

    const result: SanitizationResult = {
      sanitizedText: JSON.stringify(sanitizedObject),
      originalLength: totalOriginalLength,
      sanitizedLength: totalSanitizedLength,
      redactionResult: totalRedactionCount > 0 ? {
        originalLength: totalOriginalLength,
        redactedLength: totalSanitizedLength,
        redactionCount: totalRedactionCount,
        patternsMatched: [...new Set(allPatternsMatched)],
      } : undefined,
      pseudonymizationResult: totalPseudonymCount > 0 ? {
        originalText: JSON.stringify(obj),
        pseudonymizedText: JSON.stringify(sanitizedObject),
        pseudonyms: [], // This would need to be properly aggregated if needed
        processingTime: 0,
      } : undefined,
      processingTimeMs: Date.now() - startTime,
    };

    return { sanitizedObject, result };
  }

  /**
   * Reversible sanitization for LLM requests - preserves context for reversal
   */
  async reversibleSanitizeText(
    text: string,
    requestId: string,
    options: SanitizationOptions = {}
  ): Promise<{
    sanitizedText: string;
    reversalContext: any;
    result: SanitizationResult;
  }> {
    const startTime = Date.now();
    const originalLength = text?.length || 0;

    if (!text) {
      return {
        sanitizedText: text,
        reversalContext: null,
        result: {
          sanitizedText: text,
          originalLength: 0,
          sanitizedLength: 0,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }

    const {
      enableRedaction = true,
      enablePseudonymization = true,
      pseudonymizationContext = 'llm-request',
    } = options;

    let sanitizedText = text;
    let redactionResult: RedactionResult | undefined;
    let pseudonymizationContext_internal: any = null;

    try {
      // Step 1: Apply secret redaction (irreversible)
      if (enableRedaction) {
        const redactionResponse = this.secretRedactionService.redactSecrets(sanitizedText);
        sanitizedText = redactionResponse.redactedText;
        redactionResult = redactionResponse.result;
      }

      // Step 2: Apply reversible pseudonymization
      if (enablePseudonymization) {
        const pseudonymResponse = await this.pseudonymizationService.createReversiblePseudonymization(
          sanitizedText,
          requestId,
          { context: pseudonymizationContext }
        );
        sanitizedText = pseudonymResponse.pseudonymizedText;
        pseudonymizationContext_internal = pseudonymResponse.reversalContext;
      }

      const result: SanitizationResult = {
        sanitizedText,
        originalLength,
        sanitizedLength: sanitizedText.length,
        redactionResult,
        pseudonymizationResult: pseudonymizationContext_internal ? {
          originalText: text,
          pseudonymizedText: sanitizedText,
          pseudonyms: pseudonymizationContext_internal,
          processingTime: 0,
        } : undefined,
        processingTimeMs: Date.now() - startTime,
        reversalContext: pseudonymizationContext_internal,
      };

      // Store in memory cache for fast lookup
      if (pseudonymizationContext_internal) {
        this.storeContextInCache(requestId, pseudonymizationContext_internal);
        
        // Async fire-and-forget persistence to database
        this.persistContextToDatabase(requestId, pseudonymizationContext_internal).catch(error => {
          this.logger.warn(`Failed to persist context to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });
      }

      return {
        sanitizedText,
        reversalContext: pseudonymizationContext_internal,
        result,
      };
    } catch (error) {
      this.logger.error(`Error during reversible text sanitization: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Reverse sanitization - convert pseudonyms back to original values
   * Uses hybrid lookup: memory first, database fallback
   */
  async reverseSanitization(
    sanitizedText: string,
    reversalContext: any,
    requestId?: string
  ): Promise<{
    originalText: string;
    reversalCount: number;
    processingTimeMs: number;
    source: 'memory' | 'database' | 'context';
  }> {
    const startTime = Date.now();

    if (!sanitizedText) {
      return {
        originalText: sanitizedText,
        reversalCount: 0,
        processingTimeMs: Date.now() - startTime,
        source: 'context',
      };
    }

    try {
      let contextToUse = reversalContext;
      let source: 'memory' | 'database' | 'context' = 'context';

      // Strategy 1: Use provided context (fastest)
      if (!contextToUse && requestId) {
        // Strategy 2: Check memory cache (fast)
        contextToUse = this.getContextFromCache(requestId);
        if (contextToUse) {
          source = 'memory';
        } else {
          // Strategy 3: Database fallback (slower)
          contextToUse = await this.getContextFromDatabase(requestId);
          if (contextToUse) {
            source = 'database';
            // Cache it for future use
            this.storeContextInCache(requestId, contextToUse);
          }
        }
      }

      if (!contextToUse) {
        return {
          originalText: sanitizedText,
          reversalCount: 0,
          processingTimeMs: Date.now() - startTime,
          source,
        };
      }

      // Reverse pseudonymization using the found context
      const reverseResult = await this.pseudonymizationService.reversePseudonymization(
        sanitizedText,
        contextToUse
      );

      return {
        originalText: reverseResult.originalText,
        reversalCount: reverseResult.reversalCount,
        processingTimeMs: Date.now() - startTime,
        source,
      };
    } catch (error) {
      this.logger.error(`Error during reverse sanitization: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      
      // Return the sanitized text if reversal fails
      return {
        originalText: sanitizedText,
        reversalCount: 0,
        processingTimeMs: Date.now() - startTime,
        source: 'context',
      };
    }
  }

  /**
   * Complete LLM request sanitization pipeline with reversal
   */
  async sanitizeForLLM(
    systemPrompt: string,
    userMessage: string,
    requestId: string,
    options: SanitizationOptions = {}
  ): Promise<{
    sanitizedSystemPrompt: string;
    sanitizedUserMessage: string;
    reversalContext: any;
  }> {
    // Sanitize both system prompt and user message
    const systemResult = await this.reversibleSanitizeText(systemPrompt, `${requestId}-system`, options);
    const userResult = await this.reversibleSanitizeText(userMessage, `${requestId}-user`, options);

    // Combine reversal contexts
    const combinedReversalContext = {
      system: systemResult.reversalContext,
      user: userResult.reversalContext,
    };

    return {
      sanitizedSystemPrompt: systemResult.sanitizedText,
      sanitizedUserMessage: userResult.sanitizedText,
      reversalContext: combinedReversalContext,
    };
  }

  /**
   * Reverse LLM response sanitization
   */
  async reverseLLMResponse(
    llmResponse: string,
    reversalContext: any
  ): Promise<string> {
    if (!reversalContext) {
      return llmResponse;
    }

    // Try to reverse using both system and user contexts
    let reversedResponse = llmResponse;

    if (reversalContext.system) {
      const systemReversal = await this.reverseSanitization(reversedResponse, reversalContext.system);
      reversedResponse = systemReversal.originalText;
    }

    if (reversalContext.user) {
      const userReversal = await this.reverseSanitization(reversedResponse, reversalContext.user);
      reversedResponse = userReversal.originalText;
    }

    return reversedResponse;
  }

  /**
   * Safe logging method that automatically sanitizes all content
   */
  async safeLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    runId?: string,
    context?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Skip verbose logging in production unless explicitly enabled
    if (this.isProduction && level === 'debug' && !this.enableVerboseLogging) {
      return;
    }

    try {
      // Sanitize the message
      const sanitizedMessageResult = await this.sanitizeText(message, {
        enableRedaction: true,
        enablePseudonymization: true,
        pseudonymizationContext: 'logging',
      });

      // Sanitize metadata if provided
      let sanitizedMetadata = metadata;
      if (metadata) {
        const sanitizedMetadataResult = await this.sanitizeObject(metadata, {
          enableRedaction: true,
          enablePseudonymization: true,
          pseudonymizationContext: 'logging',
        });
        sanitizedMetadata = sanitizedMetadataResult.sanitizedObject;
      }

      // Create structured log entry
      const logEntry: LogEntry = {
        runId: runId || 'system',
        timestamp: new Date().toISOString(),
        level,
        message: sanitizedMessageResult.sanitizedText,
        context,
        metadata: sanitizedMetadata,
      };

      // Log using NestJS logger with appropriate level
      const logMessage = this.formatLogMessage(logEntry);
      
      switch (level) {
        case 'debug':
          this.logger.debug(logMessage);
          break;
        case 'info':
          this.logger.log(logMessage);
          break;
        case 'warn':
          this.logger.warn(logMessage);
          break;
        case 'error':
          this.logger.error(logMessage);
          break;
      }
    } catch (error) {
      // Fallback to basic logging if sanitization fails
      this.logger.error(`Failed to sanitize log message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.logger[level === 'info' ? 'log' : level](`[UNSANITIZED] ${message}`);
    }
  }

  /**
   * Format log message for structured logging
   */
  private formatLogMessage(logEntry: LogEntry): string {
    const parts = [`[${logEntry.runId}]`, logEntry.message];
    
    if (logEntry.context) {
      parts.push(`(${logEntry.context})`);
    }

    if (logEntry.metadata && Object.keys(logEntry.metadata).length > 0) {
      parts.push(JSON.stringify(logEntry.metadata));
    }

    return parts.join(' ');
  }

  /**
   * Convenience methods for different log levels with automatic sanitization
   */
  async debug(message: string, runId?: string, context?: string, metadata?: Record<string, any>): Promise<void> {
    await this.safeLog('debug', message, runId, context, metadata);
  }

  async info(message: string, runId?: string, context?: string, metadata?: Record<string, any>): Promise<void> {
    await this.safeLog('info', message, runId, context, metadata);
  }

  async warn(message: string, runId?: string, context?: string, metadata?: Record<string, any>): Promise<void> {
    await this.safeLog('warn', message, runId, context, metadata);
  }

  async error(message: string, runId?: string, context?: string, metadata?: Record<string, any>): Promise<void> {
    await this.safeLog('error', message, runId, context, metadata);
  }

  /**
   * Get combined statistics from both services
   */
  async getStats(): Promise<{
    redactionStats: any;
    pseudonymizationStats: any;
    totalPatterns: number;
    productionMode: boolean;
    verboseLogging: boolean;
  }> {
    const redactionStats = this.secretRedactionService.getStats();
    const pseudonymizationStats = await this.pseudonymizationService.getStats();

    return {
      redactionStats,
      pseudonymizationStats,
      totalPatterns: redactionStats.totalPatterns + (pseudonymizationStats.totalPIIPatterns || 0),
      productionMode: this.isProduction,
      verboseLogging: this.enableVerboseLogging,
    };
  }

  /**
   * Test sanitization with detailed results
   */
  async testSanitization(text: string): Promise<{
    sanitizedText: string;
    result: SanitizationResult;
    redactionDetails?: any;
    pseudonymizationDetails?: any;
  }> {
    const sanitizationResult = await this.sanitizeText(text, {
      enableRedaction: true,
      enablePseudonymization: true,
      pseudonymizationContext: 'testing',
    });

    // Get detailed test results from individual services
    const redactionDetails = this.secretRedactionService.testRedaction(text);
    const pseudonymizationDetails = await this.pseudonymizationService.pseudonymizeText(text, { context: 'testing' });

    return {
      sanitizedText: sanitizationResult.sanitizedText,
      result: sanitizationResult,
      redactionDetails,
      pseudonymizationDetails,
    };
  }

  /**
   * Cache Management Methods
   */
  
  private storeContextInCache(requestId: string, context: any): void {
    try {
      // Implement LRU eviction if cache is full
      if (this.contextCache.size >= this.maxCacheSize) {
        const firstKey = this.contextCache.keys().next().value;
        if (firstKey !== undefined) {
          this.contextCache.delete(firstKey);
        }
      }

      this.contextCache.set(requestId, {
        context,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.warn(`Failed to store context in cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getContextFromCache(requestId: string): any {
    try {
      const cached = this.contextCache.get(requestId);
      if (!cached) return null;

      // Check if expired
      const isExpired = Date.now() - cached.timestamp > this.cacheExpirationMs;
      if (isExpired) {
        this.contextCache.delete(requestId);
        return null;
      }

      return cached.context;
    } catch (error) {
      this.logger.warn(`Failed to get context from cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  private async persistContextToDatabase(requestId: string, context: any): Promise<void> {
    try {
      // Store context as JSONB for flexible querying
      const contextData = {
        request_id: requestId,
        context_data: context,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      };

      // This would require a context storage table - for now just log
      this.logger.debug(`Would persist context for request ${requestId} to database`);
      
      // TODO: Implement actual database persistence
      // await client.from('pseudonym_contexts').insert(contextData);
    } catch (error) {
      this.logger.warn(`Failed to persist context to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getContextFromDatabase(requestId: string): Promise<any> {
    try {
      // TODO: Implement actual database lookup
      // const { data } = await client
      //   .from('pseudonym_contexts')
      //   .select('context_data')
      //   .eq('request_id', requestId)
      //   .gt('expires_at', new Date().toISOString())
      //   .single();
      
      this.logger.debug(`Would lookup context for request ${requestId} from database`);
      return null; // For now, return null until table is created
    } catch (error) {
      this.logger.warn(`Failed to get context from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.contextCache.entries()) {
      if (now - value.timestamp > this.cacheExpirationMs) {
        this.contextCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    expirationMs: number;
  } {
    return {
      size: this.contextCache.size,
      maxSize: this.maxCacheSize,
      expirationMs: this.cacheExpirationMs,
    };
  }
}