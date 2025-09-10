import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PIIPatternService, PIIDataType } from '../llms/pii-pattern.service';
import { createHash, randomBytes } from 'crypto';

export interface PseudonymMapping {
  originalValue: string;
  pseudonym: string;
  dataType: PIIDataType;
  isNew: boolean;
  context?: string;
}

export interface PseudonymizationResult {
  originalText: string;
  pseudonymizedText: string;
  mappings: PseudonymMapping[];
  processingTimeMs: number;
  requestId: string;
}

export interface ReversalResult {
  originalText: string;
  reversalCount: number;
  processingTimeMs: number;
  source: 'memory' | 'database' | 'mappings';
}

/**
 * Centralized Pseudonymizer Service
 * 
 * This service handles ALL pseudonymization concerns:
 * - Detecting PII in text
 * - Generating consistent pseudonyms
 * - Storing pseudonym mappings in database
 * - Reversing pseudonyms back to original values
 * - Managing pseudonym lifecycle and audit trails
 * 
 * Usage:
 * 1. Agents call pseudonymizeText() before sending to LLM
 * 2. Agents call reversePseudonyms() after getting LLM response
 * 3. LLM service is completely unaware of pseudonymization
 */
@Injectable()
export class PseudonymizerService {
  private readonly logger = new Logger(PseudonymizerService.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';
  
  // In-memory cache for fast reversal lookups
  private readonly reversalCache = new Map<string, PseudonymMapping[]>();
  private readonly cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly piiPatternService: PIIPatternService
  ) {
    this.logger.log(`🎭 PseudonymizerService initialized (production: ${this.isProduction})`);
  }

  /**
   * Main pseudonymization method - detects PII and replaces with pseudonyms
   */
  async pseudonymizeText(
    text: string,
    requestId: string,
    options?: {
      context?: string;
      dataTypes?: PIIDataType[];
    }
  ): Promise<PseudonymizationResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🎭 Pseudonymizing text for request ${requestId}`);
      
      // This service should no longer detect PII. It should only generate pseudonyms when asked.
      // The detection logic is now centralized in PIIService.

      const processingTimeMs = Date.now() - startTime;

      const result: PseudonymizationResult = {
        originalText: text,
        pseudonymizedText: text, // Return original text as no processing is done here
        mappings: [], // No mappings generated here
        processingTimeMs,
        requestId,
      };

      return result;

    } catch (error) {
      this.logger.error(`Pseudonymization failed for request ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Reverse pseudonyms back to original values
   */
  async reversePseudonyms(
    pseudonymizedText: string,
    requestId: string
  ): Promise<ReversalResult> {
    const startTime = Date.now();
    let reversedText = pseudonymizedText;
    let reversalCount = 0;
    let source: 'memory' | 'database' | 'mappings' = 'memory';

    try {
      this.logger.log(`🔄 Reversing pseudonyms for request ${requestId}`);

      // Step 1: Try to get mappings from cache (fastest)
      let mappings = this.getReversalContext(requestId);
      
      if (!mappings) {
        // Step 2: Fallback to database lookup (slower)
        this.logger.log(`🔄 Cache miss, looking up mappings in database`);
        mappings = await this.getReversalContextFromDatabase(requestId);
        source = 'database';
        
        if (mappings && mappings.length > 0) {
          // Cache for future use
          this.storeReversalContext(requestId, mappings);
        }
      }

      if (!mappings || mappings.length === 0) {
        this.logger.warn(`No reversal context found for request ${requestId}`);
        return {
          originalText: pseudonymizedText,
          reversalCount: 0,
          processingTimeMs: Date.now() - startTime,
          source: 'mappings'
        };
      }

      // Step 3: Apply reversals (longest pseudonyms first to avoid partial matches)
      const sortedMappings = [...mappings].sort((a, b) => b.pseudonym.length - a.pseudonym.length);

      for (const mapping of sortedMappings) {
        if (reversedText.includes(mapping.pseudonym)) {
          // Use word boundaries for exact matches
          const regex = new RegExp(`\\b${this.escapeRegExp(mapping.pseudonym)}\\b`, 'g');
          const beforeLength = reversedText.length;
          reversedText = reversedText.replace(regex, mapping.originalValue);
          const afterLength = reversedText.length;
          
          if (beforeLength !== afterLength) {
            reversalCount++;
            this.logger.log(`🔄 Reversed "${mapping.pseudonym}" → "${mapping.originalValue}"`);
          }
        }
      }

      const processingTimeMs = Date.now() - startTime;
      
      this.logger.log(`🔄 Reversal complete: ${reversalCount} reversals in ${processingTimeMs}ms`);

      return {
        originalText: reversedText,
        reversalCount,
        processingTimeMs,
        source,
      };

    } catch (error) {
      this.logger.error(`Failed to reverse pseudonyms: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Generate or retrieve existing pseudonym for a value
   */
  private async generateOrRetrievePseudonym(
    originalValue: string,
    dataType: PIIDataType,
    context?: string
  ): Promise<PseudonymMapping> {
    try {
      // Create hash for consistent lookup
      const originalHash = this.hashValue(originalValue);
      
      // Check if pseudonym already exists
      const existingPseudonym = await this.lookupExistingPseudonym(originalHash);
      if (existingPseudonym) {
        // Update usage count
        await this.incrementPseudonymUsage(existingPseudonym.id);
        
        return {
          originalValue,
          pseudonym: existingPseudonym.pseudonym,
          dataType,
          isNew: false,
          context,
        };
      }

      // Generate new pseudonym
      const pseudonym = await this.createNewPseudonym(dataType, originalValue);
      
      // Store in database
      await this.storePseudonymMapping(originalHash, pseudonym, dataType, context);

      return {
        originalValue,
        pseudonym,
        dataType,
        isNew: true,
        context,
      };
    } catch (error) {
      this.logger.error(`Failed to generate pseudonym: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Store reversal context in memory cache
   */
  private storeReversalContext(requestId: string, mappings: PseudonymMapping[]): void {
    this.reversalCache.set(requestId, mappings);
    this.cacheExpiry.set(requestId, Date.now() + this.CACHE_TTL_MS);
  }

  /**
   * Get reversal context from memory cache
   */
  private getReversalContext(requestId: string): PseudonymMapping[] | null {
    const expiry = this.cacheExpiry.get(requestId);
    if (expiry && Date.now() > expiry) {
      // Expired, clean up
      this.reversalCache.delete(requestId);
      this.cacheExpiry.delete(requestId);
      return null;
    }
    
    return this.reversalCache.get(requestId) || null;
  }

  /**
   * Get reversal context from database (fallback)
   */
  private async getReversalContextFromDatabase(requestId: string): Promise<PseudonymMapping[] | null> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      const { data: contextData } = await client
        .from('pseudonym_reversal_contexts')
        .select('reversal_context')
        .eq('request_id', requestId)
        .single();

      if (contextData?.reversal_context) {
        return JSON.parse(contextData.reversal_context);
      }
      
      return null;
    } catch (error) {
      this.logger.warn(`Failed to retrieve reversal context from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Create hash of value for consistent lookup
   */
  private hashValue(value: string): string {
    return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
  }

  /**
   * Escape regex special characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Lookup existing pseudonym by hash
   */
  private async lookupExistingPseudonym(originalHash: string): Promise<any> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      const { data } = await client
        .from('pseudonym_mappings')
        .select('id, pseudonym')
        .eq('original_hash', originalHash)
        .single();

      return data;
    } catch (error) {
      // Not found is expected for new values
      return null;
    }
  }

  /**
   * Create new pseudonym based on data type
   */
  private async createNewPseudonym(dataType: PIIDataType, originalValue: string): Promise<string> {
    switch (dataType) {
      case 'email':
        return `user${randomBytes(4).toString('hex')}@example.com`;
      case 'phone':
        return `(555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
      case 'name':
        const names = ['John Smith', 'Jane Doe', 'Bob Johnson', 'Alice Brown', 'Charlie Wilson', 'Diana Davis', 'Frank Miller', 'Grace Taylor', 'Henry Anderson', 'Linda Williams'];
        return names[Math.floor(Math.random() * names.length)] || 'John Smith';
      case 'username':
        return `@${randomBytes(6).toString('hex')}`;
      case 'custom':
        return `[PSEUDONYM_CUSTOM_${randomBytes(4).toString('hex')}]`;
      default:
        return `[PSEUDONYM_${dataType.toUpperCase()}_${randomBytes(4).toString('hex')}]`;
    }
  }

  /**
   * Store pseudonym mapping in database
   */
  private async storePseudonymMapping(
    originalHash: string,
    pseudonym: string,
    dataType: PIIDataType,
    context?: string
  ): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      await client.from('pseudonym_mappings').insert({
        original_hash: originalHash,
        pseudonym,
        data_type: dataType,
        context: context || null,
        usage_count: 1,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to store pseudonym mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Increment usage count for existing pseudonym
   */
  private async incrementPseudonymUsage(mappingId: string): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // First get the current usage count
      const { data: currentData } = await client
        .from('pseudonym_mappings')
        .select('usage_count')
        .eq('id', mappingId)
        .single();

      const newUsageCount = (currentData?.usage_count || 0) + 1;

      await client
        .from('pseudonym_mappings')
        .update({ 
          usage_count: newUsageCount,
          last_used_at: new Date().toISOString()
        })
        .eq('id', mappingId);
    } catch (error) {
      this.logger.warn(`Failed to increment usage count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Log pseudonymization operation for audit trail
   */
  private async logPseudonymizationOperation(
    requestId: string,
    mappings: PseudonymMapping[],
    processingTimeMs: number
  ): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();
      
      // Store reversal context for future use
      await client.from('pseudonym_reversal_contexts').upsert({
        request_id: requestId,
        reversal_context: JSON.stringify(mappings),
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + this.CACHE_TTL_MS).toISOString(),
      });

      // Log audit trail
      await client.from('pseudonym_audit_log').insert({
        request_id: requestId,
        operation: 'pseudonymize',
        pseudonym_count: mappings.length,
        processing_time_ms: processingTimeMs,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(`Failed to log pseudonymization operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up expired cache entries (call periodically)
   */
  public cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [requestId, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.reversalCache.delete(requestId);
        this.cacheExpiry.delete(requestId);
      }
    }
  }
}
