import { Controller, Get, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { PseudonymizationService } from './pseudonymization.service';

@Controller('llm/sanitization')
export class SanitizationController {
  private readonly logger = new Logger(SanitizationController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly pseudonymizationService: PseudonymizationService,
  ) {}

  /**
   * Basic stats endpoint consumed by the web admin dashboard
   */
  @Get('stats')
  async getStats() {
    try {
      const patternStats = await this.pseudonymizationService.getStats();

      const client = this.supabaseService.getServiceClient();
      const { count: dictCount } = await client
        .from('pseudonym_dictionaries')
        .select('id', { count: 'exact', head: true });

      return {
        sanitizationStats: {
          productionMode: patternStats.productionMode,
          pseudonymizationStats: {
            patternServiceStats: {
              totalPatterns:
                patternStats.patternServiceStats?.totalPatterns || 0,
              builtInPatterns:
                patternStats.patternServiceStats?.builtInPatterns || 0,
              customPatterns:
                patternStats.patternServiceStats?.customPatterns || 0,
              enabledPatterns:
                patternStats.patternServiceStats?.enabledPatterns || 0,
              lastRefresh: new Date().toISOString(),
            },
          },
          redactionStats: {
            totalPatterns: patternStats.patternServiceStats?.totalPatterns || 0,
            customPatterns:
              patternStats.patternServiceStats?.customPatterns || 0,
          },
          verboseLogging: false,
        },
        databaseStats: {
          totalOperations: 0,
          dictionaries: dictCount || 0,
        },
        cacheStats: {
          size: 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get sanitization stats', error as any);
      // Provide minimal safe structure
      return {
        sanitizationStats: {
          productionMode: false,
          pseudonymizationStats: {
            patternServiceStats: {
              totalPatterns: 0,
              builtInPatterns: 0,
              customPatterns: 0,
              enabledPatterns: 0,
              lastRefresh: new Date().toISOString(),
            },
          },
          redactionStats: { totalPatterns: 0, customPatterns: 0 },
          verboseLogging: false,
        },
        databaseStats: { totalOperations: 0, dictionaries: 0 },
        cacheStats: { size: 0 },
      };
    }
  }

  /**
   * Return effective PII patterns (built-in + any custom)
   */
  @Get('pii/patterns')
  getPIIPatterns() {
    const patterns = this.pseudonymizationService.getPIIPatterns();
    return Promise.resolve({ patterns });
  }

  /**
   * Return pseudonym dictionaries grouped for the UI
   */
  @Get('pseudonym/dictionaries')
  async getPseudonymDictionaries() {
    const client = this.supabaseService.getServiceClient();
    const { data, error } = await client
      .from('pseudonym_dictionaries')
      .select('id, category, data_type, pseudonym, is_active, created_at');

    if (error) {
      this.logger.error('Failed to load pseudonym dictionaries', error);
      return { dictionaries: [] };
    }

    // Group rows by category + data_type to fit frontend PseudonymDictionaryEntry shape
    const groups: Record<
      string,
      {
        id: string;
        category: string;
        dataType: string;
        isActive: boolean;
        words: string[];
        createdAt?: string;
      }
    > = {};
    for (const row of data || []) {
      const key = `${row.category || 'uncategorized'}::${row.data_type || 'custom'}::${row.is_active ? '1' : '0'}`;
      if (!groups[key]) {
        groups[key] = {
          id: row.id,
          category: row.category || 'uncategorized',
          dataType: row.data_type || 'custom',
          isActive: !!row.is_active,
          words: [],
          createdAt: row.created_at,
        } as any;
      }
      if (row.pseudonym && groups[key]) {
        groups[key].words.push(row.pseudonym);
      }
    }

    const dictionaries = Object.values(groups);
    return { dictionaries };
  }
}
