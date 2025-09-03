import { Injectable, Logger } from '@nestjs/common';

export interface LogEntry {
  runId: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: string;
  metadata?: Record<string, any>;
}

export interface RedactionPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
  description: string;
}

export interface RedactionResult {
  originalLength: number;
  redactedLength: number;
  redactionCount: number;
  patternsMatched: string[];
}

@Injectable()
export class SecretRedactionService {
  private readonly logger = new Logger(SecretRedactionService.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly enableVerboseLogging = process.env.ENABLE_VERBOSE_LOGGING === 'true';

  // Predefined redaction patterns for common secrets
  // More specific patterns first to avoid generic API key pattern conflicts
  private readonly redactionPatterns: RedactionPattern[] = [
    {
      name: 'openai_key',
      pattern: /sk-[a-zA-Z0-9]{48}/g,
      replacement: 'sk-[REDACTED]',
      description: 'OpenAI API keys',
    },
    {
      name: 'anthropic_key',
      pattern: /sk-ant-api03-[a-zA-Z0-9_\-]{95}/g,
      replacement: 'sk-ant-[REDACTED]',
      description: 'Anthropic API keys',
    },
    {
      name: 'google_key',
      pattern: /AIza[a-zA-Z0-9_\-]{35}/g,
      replacement: 'AIza[REDACTED]',
      description: 'Google API keys',
    },
    {
      name: 'aws_key',
      pattern: /AKIA[0-9A-Z]{16}/g,
      replacement: 'AKIA[REDACTED]',
      description: 'AWS access keys',
    },
    {
      name: 'jwt_token',
      pattern: /eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]*/g,
      replacement: 'eyJ[REDACTED]',
      description: 'JWT tokens',
    },
    {
      name: 'bearer_token',
      pattern: /(?:Authorization\s*:\s*Bearer\s+|bearer[\s:]+|Bearer[\s:]+|[a-zA-Z_-]*(?:access[_-]?token|auth[_-]?token|session[_-]?token|refresh[_-]?token|id[_-]?token)[_-]*\s+|[a-zA-Z_-]*(?:access[_-]?token|auth[_-]?token|session[_-]?token|refresh[_-]?token|id[_-]?token)[_-]*\s*[:=]\s*|token[\s:=]+)([a-zA-Z0-9_\-\.]{20,})/gi,
      replacement: 'bearer [REDACTED]',
      description: 'Bearer tokens',
    },
    {
      name: 'password',
      pattern: /\b(?:[a-zA-Z_-]*(?:password|pwd|pass)[_-]*)\s*[:=]\s*['"]?([^\s'"]{8,})['"]?/gi,
      replacement: 'password=[REDACTED]',
      description: 'Passwords',
    },
    {
      name: 'database_url',
      pattern: /(?:postgresql|mysql|mongodb):\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
      replacement: 'database://[REDACTED]',
      description: 'Database connection strings',
    },
    {
      name: 'credit_card',
      pattern: /\b(?:(?:\d{4}[-\s]?){3}\d{4}|\d{4}[-\s]?\d{6}[-\s]?\d{5}|\d{15,16})\b/g,
      replacement: '[CREDIT_CARD_REDACTED]',
      description: 'Credit card numbers',
    },
    {
      name: 'ssh_key',
      pattern: /-----BEGIN (?:[A-Z\s]*)?PRIVATE KEY-----[\s\S]+?-----END (?:[A-Z\s]*)?PRIVATE KEY-----/gi,
      replacement: '-----BEGIN [REDACTED] PRIVATE KEY-----',
      description: 'SSH private keys',
    },
    // Generic API key pattern last to avoid conflicts with specific patterns
    {
      name: 'api_key',
      pattern: /\b(?:[a-zA-Z_-]*(?:api[_-]?key|apikey|key|secret|token)[_-]*)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
      replacement: 'api_key=[REDACTED]',
      description: 'API keys and similar tokens',
    },
  ];

  constructor() {
    this.logger.log(`SecretRedactionService initialized (production: ${this.isProduction})`);
  }

  /**
   * Redact secrets from text using predefined patterns
   */
  redactSecrets(text: string): { redactedText: string; result: RedactionResult } {
    if (!text) {
      return {
        redactedText: text,
        result: {
          originalLength: 0,
          redactedLength: 0,
          redactionCount: 0,
          patternsMatched: [],
        },
      };
    }

    let redactedText = text;
    let totalRedactionCount = 0;
    const patternsMatched: string[] = [];
    const originalLength = text.length;

    // Apply each redaction pattern
    for (const pattern of this.redactionPatterns) {
      const matches = redactedText.match(pattern.pattern);
      if (matches) {
        redactedText = redactedText.replace(pattern.pattern, pattern.replacement);
        totalRedactionCount += matches.length;
        patternsMatched.push(pattern.name);
      }
    }

    const result: RedactionResult = {
      originalLength,
      redactedLength: redactedText.length,
      redactionCount: totalRedactionCount,
      patternsMatched,
    };

    return { redactedText, result };
  }

  /**
   * Safe logging method that automatically redacts secrets
   */
  safeLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    runId?: string,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    // Skip verbose logging in production unless explicitly enabled
    if (this.isProduction && level === 'debug' && !this.enableVerboseLogging) {
      return;
    }

    // Redact secrets from the message
    const { redactedText } = this.redactSecrets(message);

    // Redact secrets from metadata if provided
    let redactedMetadata = metadata;
    if (metadata) {
      redactedMetadata = this.redactObjectSecrets(metadata);
    }

    // Create structured log entry
    const logEntry: LogEntry = {
      runId: runId || 'system',
      timestamp: new Date().toISOString(),
      level,
      message: redactedText,
      context,
      metadata: redactedMetadata,
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
  }

  /**
   * Redact secrets from an object (recursive)
   */
  private redactObjectSecrets(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      if (typeof obj === 'string') {
        return this.redactSecrets(obj).redactedText;
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObjectSecrets(item));
    }

    const redactedObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if the key itself suggests sensitive data
      const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
      const isSensitiveKey = sensitiveKeys.some(sensitiveKey => 
        key.toLowerCase().includes(sensitiveKey)
      );

      if (isSensitiveKey && typeof value === 'string') {
        redactedObj[key] = '[REDACTED]';
      } else {
        redactedObj[key] = this.redactObjectSecrets(value);
      }
    }

    return redactedObj;
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
   * Add custom redaction pattern
   */
  addRedactionPattern(pattern: RedactionPattern): void {
    this.redactionPatterns.push(pattern);
    this.logger.debug(`Added custom redaction pattern: ${pattern.name}`);
  }

  /**
   * Remove redaction pattern by name
   */
  removeRedactionPattern(name: string): boolean {
    const index = this.redactionPatterns.findIndex(p => p.name === name);
    if (index >= 0) {
      this.redactionPatterns.splice(index, 1);
      this.logger.debug(`Removed redaction pattern: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Get all available redaction patterns
   */
  getRedactionPatterns(): RedactionPattern[] {
    return [...this.redactionPatterns];
  }

  /**
   * Test redaction patterns against sample text
   */
  testRedaction(text: string): {
    redactedText: string;
    result: RedactionResult;
    patternDetails: Array<{
      name: string;
      matches: number;
      description: string;
    }>;
  } {
    const { redactedText, result } = this.redactSecrets(text);
    
    const patternDetails = this.redactionPatterns.map(pattern => {
      const matches = text.match(pattern.pattern);
      return {
        name: pattern.name,
        matches: matches ? matches.length : 0,
        description: pattern.description,
      };
    }).filter(detail => detail.matches > 0);

    return {
      redactedText,
      result,
      patternDetails,
    };
  }

  /**
   * Convenience methods for different log levels with runId correlation
   */
  debug(message: string, runId?: string, context?: string, metadata?: Record<string, any>): void {
    this.safeLog('debug', message, runId, context, metadata);
  }

  info(message: string, runId?: string, context?: string, metadata?: Record<string, any>): void {
    this.safeLog('info', message, runId, context, metadata);
  }

  warn(message: string, runId?: string, context?: string, metadata?: Record<string, any>): void {
    this.safeLog('warn', message, runId, context, metadata);
  }

  error(message: string, runId?: string, context?: string, metadata?: Record<string, any>): void {
    this.safeLog('error', message, runId, context, metadata);
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalPatterns: number;
    productionMode: boolean;
    verboseLogging: boolean;
    customPatterns: number;
  } {
    const defaultPatternCount = 11; // Number of predefined patterns
    const customPatterns = Math.max(0, this.redactionPatterns.length - defaultPatternCount);

    return {
      totalPatterns: this.redactionPatterns.length,
      productionMode: this.isProduction,
      verboseLogging: this.enableVerboseLogging,
      customPatterns,
    };
  }

}
