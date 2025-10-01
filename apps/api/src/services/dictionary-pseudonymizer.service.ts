import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface DictionaryPseudonymMapping {
  originalValue: string;
  pseudonym: string;
  dataType: string;
  category: string;
}

export interface DictionaryPseudonymizationResult {
  originalText: string;
  pseudonymizedText: string;
  mappings: DictionaryPseudonymMapping[];
  processingTimeMs: number;
}

export interface DictionaryReversalResult {
  originalText: string;
  reversalCount: number;
  processingTimeMs: number;
}

/**
 * Dictionary-Based Pseudonymizer Service
 *
 * Simple, fast pseudonymization using a predefined dictionary.
 * No hashing, no complex pattern matching - just direct string replacement.
 *
 * Flow:
 * 1. Load dictionary entries from database
 * 2. Case-insensitive search and replace original_value → pseudonym
 * 3. Track what was replaced for reversal
 * 4. Reverse pseudonym → original_value after LLM response
 */
@Injectable()
export class DictionaryPseudonymizerService {
  private readonly logger = new Logger(DictionaryPseudonymizerService.name);

  // Cache dictionary entries to avoid repeated DB calls
  private dictionaryCache: DictionaryPseudonymMapping[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly supabaseService: SupabaseService) {
    this.logger.log(
      '🎯 DictionaryPseudonymizerService initialized - simple dictionary-based pseudonymization',
    );
  }

  /**
   * Load active dictionary entries from database, scoped by organization/agent when provided
   */
  private async loadDictionary(options?: {
    organizationSlug?: string | null;
    agentSlug?: string | null;
  }): Promise<DictionaryPseudonymMapping[]> {
    const now = Date.now();

    // Return cached entries if still valid
    if (this.dictionaryCache && now < this.cacheExpiry) {
      return this.dictionaryCache;
    }

    try {
      const client = this.supabaseService.getServiceClient();
      const { organizationSlug = null, agentSlug = null } = options || {};

      // Prefer agent-scoped -> org-scoped -> global
      const resultSets: any[][] = [];

      if (organizationSlug && agentSlug) {
        const { data } = await client
          .from('pseudonym_dictionaries')
          .select('original_value, pseudonym, data_type, category')
          .eq('is_active', true)
          .eq('organization_slug', organizationSlug)
          .eq('agent_slug', agentSlug)
          .not('original_value', 'is', null)
          .not('pseudonym', 'is', null);
        if (data) resultSets.push(data as any[]);
      }

      if (organizationSlug) {
        const { data } = await client
          .from('pseudonym_dictionaries')
          .select('original_value, pseudonym, data_type, category')
          .eq('is_active', true)
          .eq('organization_slug', organizationSlug)
          .is('agent_slug', null)
          .not('original_value', 'is', null)
          .not('pseudonym', 'is', null);
        if (data) resultSets.push(data as any[]);
      }

      const { data: globalData, error } = await client
        .from('pseudonym_dictionaries')
        .select('original_value, pseudonym, data_type, category')
        .eq('is_active', true)
        .is('organization_slug', null)
        .is('agent_slug', null)
        .not('original_value', 'is', null)
        .not('pseudonym', 'is', null);

      if (error) {
        this.logger.error('Failed to load pseudonym dictionary:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (globalData) resultSets.push(globalData as any[]);

      // Merge and de-duplicate by original_value/pseudonym pair
      const merged = ([] as any[]).concat(...resultSets);
      const seen = new Set<string>();
      const unique = merged.filter((row) => {
        const key = `${row.original_value}::${row.pseudonym}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const dictionary: DictionaryPseudonymMapping[] = (unique || []).map(
        (row: any) => ({
          originalValue: row.original_value,
          pseudonym: row.pseudonym,
          dataType: row.data_type,
          category: row.category,
        }),
      );

      // Cache the results
      this.dictionaryCache = dictionary;
      this.cacheExpiry = now + this.CACHE_TTL_MS;

      this.logger.log(`📚 Loaded ${dictionary.length} dictionary entries`);
      return dictionary;
    } catch (error) {
      this.logger.error('Failed to load dictionary:', error);
      throw error;
    }
  }

  /**
   * Pseudonymize text using dictionary entries
   */
  async pseudonymizeText(
    text: string,
    options?: { organizationSlug?: string | null; agentSlug?: string | null },
  ): Promise<DictionaryPseudonymizationResult> {
    const startTime = Date.now();
    let processedText = text;
    const mappings: DictionaryPseudonymMapping[] = [];

    try {
      // Load dictionary entries
      const dictionary = await this.loadDictionary(options);

      // Process each dictionary entry
      for (const entry of dictionary) {
        // Case-insensitive search for the original value
        const regex = new RegExp(this.escapeRegex(entry.originalValue), 'gi');
        const matches = processedText.match(regex);

        if (matches && matches.length > 0) {
          // Replace all occurrences with the pseudonym
          processedText = processedText.replace(regex, entry.pseudonym);

          // Track this mapping for reversal
          mappings.push(entry);

          this.logger.log(
            `🎯 Replaced "${entry.originalValue}" → "${entry.pseudonym}" (${matches.length} occurrences)`,
          );
        }
      }

      const processingTimeMs = Date.now() - startTime;

      return {
        originalText: text,
        pseudonymizedText: processedText,
        mappings,
        processingTimeMs,
      };
    } catch (error) {
      this.logger.error('Pseudonymization failed:', error);
      throw error;
    }
  }

  /**
   * Reverse pseudonyms back to original values
   */
  async reversePseudonyms(
    text: string,
    mappings: DictionaryPseudonymMapping[],
  ): Promise<DictionaryReversalResult> {
    const startTime = Date.now();
    let processedText = text;
    let reversalCount = 0;

    try {
      // Process each mapping in reverse
      for (const mapping of mappings) {
        // Case-insensitive search for the pseudonym
        const regex = new RegExp(this.escapeRegex(mapping.pseudonym), 'gi');
        const matches = processedText.match(regex);

        if (matches && matches.length > 0) {
          // Replace all occurrences with the original value
          processedText = processedText.replace(regex, mapping.originalValue);
          reversalCount += matches.length;

          this.logger.log(
            `🔄 Reversed "${mapping.pseudonym}" → "${mapping.originalValue}" (${matches.length} occurrences)`,
          );
        }
      }

      const processingTimeMs = Date.now() - startTime;

      return {
        originalText: processedText,
        reversalCount,
        processingTimeMs,
      };
    } catch (error) {
      this.logger.error('Reversal failed:', error);
      throw error;
    }
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Clear the dictionary cache (useful for testing or when dictionary is updated)
   */
  clearCache(): void {
    this.dictionaryCache = null;
    this.cacheExpiry = 0;
    this.logger.log('🗑️ Dictionary cache cleared');
  }

  /**
   * Get current dictionary entries (for debugging/testing)
   */
  async getDictionary(): Promise<DictionaryPseudonymMapping[]> {
    return this.loadDictionary();
  }
}
