import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

export interface QueryExecutionRequest {
  sql: string;
  parameters?: any[];
  dryRun?: boolean;
  maxRows?: number;
  timeout?: number; // milliseconds
}

export interface QueryExecutionResponse {
  success: boolean;
  data?: any[];
  error?: string;
  metadata: {
    executionTime: number;
    recordCount: number;
    columnsReturned: string[];
    affectedRows?: number;
    queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
    wasCached: boolean;
  };
  warnings: string[];
}

/**
 * Service for safely executing SQL queries against Supabase
 */
@Injectable()
export class QueryExecutorService {
  private readonly logger = new Logger(QueryExecutorService.name);
  private readonly queryCache = new Map<
    string,
    { result: any; timestamp: number }
  >();
  private readonly cacheTTL = 2 * 60 * 1000; // 2 minutes
  private readonly maxCacheSize = 100;

  /**
   * Execute a SQL query with safety checks
   */
  async executeQuery(
    supabaseClient: SupabaseClient,
    request: QueryExecutionRequest,
  ): Promise<QueryExecutionResponse> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      this.logger.log(
        `Executing SQL query: ${request.sql.substring(0, 100)}...`,
      );

      // Validate the SQL query
      const validation = this.validateQuery(request.sql);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          metadata: {
            executionTime: Date.now() - startTime,
            recordCount: 0,
            columnsReturned: [],
            queryType: this.detectQueryType(request.sql),
            wasCached: false,
          },
          warnings: validation.warnings,
        };
      }

      warnings.push(...validation.warnings);

      // Check if this is a dry run
      if (request.dryRun) {
        return {
          success: true,
          data: [],
          metadata: {
            executionTime: Date.now() - startTime,
            recordCount: 0,
            columnsReturned: [],
            queryType: this.detectQueryType(request.sql),
            wasCached: false,
          },
          warnings: [...warnings, 'Dry run - query not executed'],
        };
      }

      // Check cache for SELECT queries
      const queryType = this.detectQueryType(request.sql);
      if (queryType === 'SELECT') {
        const cacheKey = this.generateCacheKey(request.sql, request.parameters);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.logger.debug('Query result served from cache');
          return {
            ...cached,
            metadata: {
              ...cached.metadata,
              wasCached: true,
            },
            warnings,
          };
        }
      }

      // Execute the query
      const result = await this.executeWithTimeout(
        supabaseClient,
        request.sql,
        request.parameters,
        request.timeout || 30000,
      );

      // Process the result
      const response = this.processQueryResult(
        result,
        queryType,
        startTime,
        warnings,
      );

      // Cache SELECT results
      if (queryType === 'SELECT' && response.success) {
        const cacheKey = this.generateCacheKey(request.sql, request.parameters);
        this.addToCache(cacheKey, response);
      }

      return response;
    } catch (error) {
      this.logger.error('Query execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: 0,
          columnsReturned: [],
          queryType: this.detectQueryType(request.sql),
          wasCached: false,
        },
        warnings,
      };
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async executeTransaction(
    supabaseClient: SupabaseClient,
    queries: QueryExecutionRequest[],
  ): Promise<QueryExecutionResponse[]> {
    const results: QueryExecutionResponse[] = [];

    try {
      this.logger.log(`Executing transaction with ${queries.length} queries`);

      // For now, execute queries sequentially
      // In the future, this could be enhanced with proper transaction support
      for (const query of queries) {
        const result = await this.executeQuery(supabaseClient, query);
        results.push(result);

        // If any query fails, we might want to rollback
        if (!result.success) {
          this.logger.warn(
            'Transaction query failed, continuing with remaining queries',
          );
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Transaction execution failed:', error);
      throw error;
    }
  }

  /**
   * Validate SQL query for safety
   */
  private validateQuery(sql: string): {
    isValid: boolean;
    error?: string;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const trimmedSql = sql.trim();

    // Check for empty query
    if (!trimmedSql) {
      return {
        isValid: false,
        error: 'Empty SQL query',
        warnings,
      };
    }

    // Check for multiple statements (basic check)
    const statementCount = trimmedSql.split(';').filter((s) => s.trim()).length;
    if (statementCount > 1) {
      return {
        isValid: false,
        error: 'Multiple SQL statements not allowed',
        warnings,
      };
    }

    // Check for dangerous operations
    const dangerousPatterns = [
      {
        pattern: /DROP\s+(TABLE|DATABASE|SCHEMA|INDEX)/i,
        message: 'DROP operations not allowed',
      },
      { pattern: /TRUNCATE/i, message: 'TRUNCATE operations not allowed' },
      {
        pattern: /ALTER\s+TABLE/i,
        message: 'ALTER TABLE operations not allowed',
      },
      {
        pattern: /CREATE\s+(TABLE|DATABASE|SCHEMA)/i,
        message: 'CREATE operations not allowed',
      },
      {
        pattern: /GRANT|REVOKE/i,
        message: 'Permission modification not allowed',
      },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(trimmedSql)) {
        return {
          isValid: false,
          error: message,
          warnings,
        };
      }
    }

    // Warning for queries without LIMIT
    if (
      /SELECT\s+.*\s+FROM/i.test(trimmedSql) &&
      !/LIMIT\s+\d+/i.test(trimmedSql)
    ) {
      warnings.push('SELECT query without LIMIT may return large result sets');
    }

    // Warning for DELETE/UPDATE without WHERE
    if (
      /DELETE\s+FROM\s+\w+\s*$/i.test(trimmedSql) ||
      /UPDATE\s+\w+\s+SET\s+.*\s*$/i.test(trimmedSql)
    ) {
      warnings.push('DELETE/UPDATE without WHERE clause affects all rows');
    }

    return {
      isValid: true,
      warnings,
    };
  }

  /**
   * Detect the type of SQL query
   */
  private detectQueryType(
    sql: string,
  ): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' {
    const trimmedSql = sql.trim().toUpperCase();

    if (trimmedSql.startsWith('SELECT')) return 'SELECT';
    if (trimmedSql.startsWith('INSERT')) return 'INSERT';
    if (trimmedSql.startsWith('UPDATE')) return 'UPDATE';
    if (trimmedSql.startsWith('DELETE')) return 'DELETE';

    return 'OTHER';
  }

  /**
   * Execute query with timeout
   */
  private async executeWithTimeout(
    supabaseClient: SupabaseClient,
    sql: string,
    parameters?: any[],
    timeout = 30000,
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query timeout after ${timeout}ms`));
      }, timeout);

      try {
        // Use Supabase RPC to execute raw SQL
        // Note: This requires a custom function in Supabase or alternative approach
        const { data, error } = await supabaseClient.rpc('execute_sql', {
          query: sql,
          params: parameters || [],
        });

        clearTimeout(timeoutId);

        if (error) {
          reject(new Error(error.message));
        } else {
          resolve(data);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Process query result into standardized format
   */
  private processQueryResult(
    result: any,
    queryType: string,
    startTime: number,
    warnings: string[],
  ): QueryExecutionResponse {
    try {
      const executionTime = Date.now() - startTime;

      if (queryType === 'SELECT') {
        const data = Array.isArray(result) ? result : [result];
        const columnsReturned = data.length > 0 ? Object.keys(data[0]) : [];

        return {
          success: true,
          data,
          metadata: {
            executionTime,
            recordCount: data.length,
            columnsReturned,
            queryType: queryType as any,
            wasCached: false,
          },
          warnings,
        };
      } else {
        // For INSERT/UPDATE/DELETE, result might contain affected row count
        const affectedRows = typeof result === 'number' ? result : 1;

        return {
          success: true,
          data: [],
          metadata: {
            executionTime,
            recordCount: 0,
            columnsReturned: [],
            affectedRows,
            queryType: queryType as any,
            wasCached: false,
          },
          warnings,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to process query result: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: 0,
          columnsReturned: [],
          queryType: queryType as any,
          wasCached: false,
        },
        warnings,
      };
    }
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(sql: string, parameters?: any[]): string {
    const key = sql + (parameters ? JSON.stringify(parameters) : '');
    return Buffer.from(key).toString('base64');
  }

  /**
   * Get result from cache
   */
  private getFromCache(key: string): QueryExecutionResponse | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.cacheTTL;
    if (isExpired) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Add result to cache
   */
  private addToCache(key: string, result: QueryExecutionResponse): void {
    // Implement LRU eviction if cache is full
    if (this.queryCache.size >= this.maxCacheSize) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }

    this.queryCache.set(key, {
      result: { ...result, metadata: { ...result.metadata, wasCached: false } },
      timestamp: Date.now(),
    });
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
    this.logger.log('Query cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { entries: number; hitRate?: number } {
    return {
      entries: this.queryCache.size,
      // Hit rate calculation would require tracking hits/misses
    };
  }
}
