import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type PIIDataType = 'email' | 'phone' | 'name' | 'address' | 'ip_address' | 'username' | 'credit_card' | 'ssn' | 'custom';

export interface PIIPattern {
  name: string;
  dataType: PIIDataType;
  pattern: RegExp;
  validator?: (match: string) => boolean;
  description: string;
  priority?: number; // Lower number = higher priority
  enabled?: boolean;
}

export interface PIIMatch {
  value: string;
  dataType: PIIDataType;
  patternName: string;
  startIndex: number;
  endIndex: number;
  confidence: number; // 0-1 score based on validator
}

export interface PIIDetectionResult {
  matches: PIIMatch[];
  processingTime: number;
  patternsChecked: number;
}

@Injectable()
export class PIIPatternService {
  private readonly logger = new Logger(PIIPatternService.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  // Core PII detection patterns for pseudonymization
  private readonly builtInPatterns: PIIPattern[] = [
    {
      name: 'email_standard',
      dataType: 'email',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      validator: (email) => email.includes('@') && email.includes('.') && email.length <= 254,
      description: 'Standard email addresses',
      priority: 10,
      enabled: true,
    },
    {
      name: 'email_obfuscated',
      dataType: 'email',
      pattern: /\b[A-Za-z0-9._%+-]+\s+(?:at|AT)\s+[A-Za-z0-9.-]+\s+(?:dot|DOT)\s+[A-Za-z]{2,}\b/g,
      validator: (email) => email.includes(' at ') || email.includes(' AT '),
      description: 'Obfuscated email addresses (john at company dot com)',
      priority: 20,
      enabled: true,
    },
    {
      name: 'phone_us_standard',
      dataType: 'phone',
      pattern: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
      validator: (phone) => {
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 11;
      },
      description: 'US phone numbers (various formats)',
      priority: 10,
      enabled: true,
    },
    {
      name: 'phone_international',
      dataType: 'phone',
      pattern: /\+(?:[0-9] ?){6,14}[0-9]/g,
      validator: (phone) => {
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15;
      },
      description: 'International phone numbers',
      priority: 15,
      enabled: true,
    },
    {
      name: 'name_first_last',
      dataType: 'name',
      pattern: /\b[A-Z][a-z]{1,}(?: [A-Z][a-z]{1,}){1,3}\b/g,
      validator: (name) => {
        const parts = name.split(' ');
        return parts.length >= 2 && parts.length <= 4 && 
               parts.every(part => part.length > 1 && /^[A-Z][a-z]+$/.test(part));
      },
      description: 'First and last names (Title case)',
      priority: 30,
      enabled: true,
    },
    {
      name: 'ip_address_v4',
      dataType: 'ip_address',
      pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      validator: (ip) => {
        const parts = ip.split('.');
        return parts.length === 4 && 
               parts.every(part => {
                 const num = parseInt(part);
                 return num >= 0 && num <= 255 && part === num.toString();
               });
      },
      description: 'IPv4 addresses',
      priority: 10,
      enabled: true,
    },
    {
      name: 'ip_address_v6',
      dataType: 'ip_address',
      pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
      validator: (ip) => ip.includes(':') && ip.split(':').length === 8,
      description: 'IPv6 addresses (full format)',
      priority: 15,
      enabled: true,
    },
    {
      name: 'ssn_standard',
      dataType: 'ssn',
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      validator: (ssn) => {
        const parts = ssn.split('-');
        return parts.length === 3 && parts[0] !== '000' && parts[1] !== '00' && parts[2] !== '0000';
      },
      description: 'Social Security Numbers (XXX-XX-XXXX)',
      priority: 5,
      enabled: true,
    },
    {
      name: 'credit_card_visa',
      dataType: 'credit_card',
      pattern: /\b4[0-9]{12}(?:[0-9]{3})?\b/g,
      validator: (cc) => cc.length === 13 || cc.length === 16,
      description: 'Visa credit card numbers',
      priority: 5,
      enabled: true,
    },
    {
      name: 'credit_card_mastercard',
      dataType: 'credit_card',
      pattern: /\b5[1-5][0-9]{14}\b/g,
      validator: (cc) => cc.length === 16,
      description: 'Mastercard credit card numbers',
      priority: 5,
      enabled: true,
    },
    {
      name: 'username_handle',
      dataType: 'username',
      pattern: /\b@[a-zA-Z0-9_]{3,15}\b/g,
      validator: (username) => username.length >= 4 && username.length <= 16,
      description: 'Social media usernames/handles',
      priority: 40,
      enabled: true,
    },
    {
      name: 'address_us_street',
      dataType: 'address',
      pattern: /\b\d{1,5}\s+[A-Za-z0-9\s]{3,}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court)\b/gi,
      validator: (addr) => /\d/.test(addr) && addr.length >= 10,
      description: 'US street addresses',
      priority: 25,
      enabled: true,
    },
  ];

  // Dynamic patterns loaded from database
  private customPatterns: PIIPattern[] = [];
  private lastPatternRefresh = 0;
  private readonly patternCacheMs = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly supabaseService: SupabaseService) {
    this.logger.log(`PIIPatternService initialized with ${this.builtInPatterns.length} built-in patterns`);
    this.logger.log(`✅ SupabaseService injected: ${!!this.supabaseService}`);
  }

  /**
   * Detect PII in text using all enabled patterns
   */
  async detectPII(
    text: string,
    options: {
      dataTypes?: PIIDataType[];
      minConfidence?: number;
      maxMatches?: number;
    } = {}
  ): Promise<PIIDetectionResult> {
    const startTime = Date.now();
    const {
      dataTypes,
      minConfidence = 0.7,
      maxMatches = 100,
    } = options;

    this.logger.log(`🔍 PIIPatternService.detectPII called with text length: ${text?.length || 0}`);
    this.logger.log(`🔍 Options: ${JSON.stringify(options)}`);

    // Refresh custom patterns if needed
    await this.refreshCustomPatternsIfNeeded();

    // Get all enabled patterns
    const allPatterns = [...this.builtInPatterns, ...this.customPatterns]
      .filter(pattern => pattern.enabled !== false)
      .filter(pattern => !dataTypes || dataTypes.includes(pattern.dataType))
      .sort((a, b) => (a.priority || 50) - (b.priority || 50));

    const matches: PIIMatch[] = [];
    let patternsChecked = 0;

    for (const pattern of allPatterns) {
      if (matches.length >= maxMatches) break;

      patternsChecked++;
      
      // Reset regex to avoid issues with global flag
      pattern.pattern.lastIndex = 0;
      
      let match: RegExpExecArray | null;
      while ((match = pattern.pattern.exec(text)) !== null && matches.length < maxMatches) {
        const value = match[0];
        
        // Apply validator if present
        let confidence = 1.0;
        if (pattern.validator) {
          const isValid = pattern.validator(value);
          confidence = isValid ? 1.0 : 0.3;
        }

        // Skip matches below confidence threshold
        if (confidence < minConfidence) {
          continue;
        }

        // Check for overlapping matches (keep higher priority)
        const hasOverlap = matches.some(existingMatch => {
          if (!match) return false;
          const start1 = match.index;
          const end1 = match.index + value.length;
          const start2 = existingMatch.startIndex;
          const end2 = existingMatch.endIndex;
          
          return (start1 < end2 && end1 > start2);
        });

        if (!hasOverlap && match) {
          matches.push({
            value,
            dataType: pattern.dataType,
            patternName: pattern.name,
            startIndex: match.index,
            endIndex: match.index + value.length,
            confidence,
          });
        }
      }
    }

    // Sort matches by position in text
    matches.sort((a, b) => a.startIndex - b.startIndex);

    const processingTime = Date.now() - startTime;

    return {
      matches,
      processingTime,
      patternsChecked,
    };
  }

  /**
   * Add custom PII pattern
   */
  async addCustomPattern(pattern: Omit<PIIPattern, 'enabled'>): Promise<void> {
    try {
      // Validate pattern
      if (!pattern.name || !pattern.pattern || !pattern.dataType) {
        throw new Error('Invalid pattern: name, pattern, and dataType are required');
      }

      // Test pattern compilation
      new RegExp(pattern.pattern.source, pattern.pattern.flags);

      // Save to database
      const client = this.supabaseService.getServiceClient();
      await client.from('redaction_patterns').insert({
        name: pattern.name,
        pattern_regex: pattern.pattern.source,
        replacement: `[${pattern.dataType.toUpperCase()}_REDACTED]`,
        description: pattern.description,
        category: 'pii_custom',
        priority: pattern.priority || 50,
      });

      // Add to local cache
      this.customPatterns.push({ ...pattern, enabled: true });
      
      this.logger.log(`Added custom PII pattern: ${pattern.name}`);
    } catch (error) {
      this.logger.error(`Failed to add custom pattern: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get all available patterns
   */
  getAllPatterns(): PIIPattern[] {
    return [...this.builtInPatterns, ...this.customPatterns];
  }

  /**
   * Get patterns by data type
   */
  getPatternsByDataType(dataType: PIIDataType): PIIPattern[] {
    return this.getAllPatterns().filter(pattern => pattern.dataType === dataType);
  }

  /**
   * Test a pattern against sample text
   */
  testPattern(pattern: PIIPattern, testText: string): {
    matches: string[];
    validMatches: string[];
    performance: number;
  } {
    const startTime = Date.now();
    
    pattern.pattern.lastIndex = 0;
    const matches: string[] = [];
    const validMatches: string[] = [];
    
    let match;
    while ((match = pattern.pattern.exec(testText)) !== null) {
      const value = match[0];
      matches.push(value);
      
      if (!pattern.validator || pattern.validator(value)) {
        validMatches.push(value);
      }
    }
    
    const performance = Date.now() - startTime;
    
    return { matches, validMatches, performance };
  }

  /**
   * Refresh custom patterns from database
   */
  private async refreshCustomPatternsIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPatternRefresh < this.patternCacheMs) {
      return;
    }

    try {
      const client = this.supabaseService.getServiceClient();
      const { data } = await client
        .from('redaction_patterns')
        .select('*')
        .eq('category', 'pii_custom')
        .eq('is_active', true);

      if (data) {
        this.customPatterns = data.map(row => ({
          name: row.name,
          dataType: this.mapDatabaseDataType(row.description || 'custom'),
          pattern: new RegExp(row.pattern_regex, 'g'),
          description: row.description,
          priority: row.priority,
          enabled: true,
        }));
      }

      this.lastPatternRefresh = now;
      this.logger.debug(`Refreshed ${this.customPatterns.length} custom PII patterns`);
    } catch (error) {
      this.logger.warn(`Failed to refresh custom patterns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map database description to PIIDataType
   */
  private mapDatabaseDataType(description: string): PIIDataType {
    const desc = description.toLowerCase();
    if (desc.includes('email')) return 'email';
    if (desc.includes('phone')) return 'phone';
    if (desc.includes('name')) return 'name';
    if (desc.includes('address')) return 'address';
    if (desc.includes('ip')) return 'ip_address';
    if (desc.includes('username')) return 'username';
    if (desc.includes('credit') || desc.includes('card')) return 'credit_card';
    if (desc.includes('ssn') || desc.includes('social')) return 'ssn';
    return 'custom';
  }

  /**
   * Get service statistics
   */
  getStats(): {
    builtInPatterns: number;
    customPatterns: number;
    totalPatterns: number;
    enabledPatterns: number;
    lastRefresh: Date | null;
  } {
    const allPatterns = this.getAllPatterns();
    
    return {
      builtInPatterns: this.builtInPatterns.length,
      customPatterns: this.customPatterns.length,
      totalPatterns: allPatterns.length,
      enabledPatterns: allPatterns.filter(p => p.enabled !== false).length,
      lastRefresh: this.lastPatternRefresh ? new Date(this.lastPatternRefresh) : null,
    };
  }
}