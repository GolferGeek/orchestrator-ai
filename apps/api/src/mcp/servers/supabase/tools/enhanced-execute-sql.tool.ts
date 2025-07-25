/**
 * Enhanced Execute SQL Tool
 * 
 * Executes SQL queries with comprehensive safety checks and validation.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { MCPToolExecutionOptions } from '../base/intelligent-mcp-base.service';

export interface ExecuteSQLParameters {
  sql: string;
  dry_run?: boolean;
  timeout_ms?: number;
  max_rows?: number;
}

export interface ExecuteSQLResult {
  success: boolean;
  data?: any[];
  row_count?: number;
  execution_time_ms: number;
  is_dry_run: boolean;
  validation_results: {
    is_safe: boolean;
    security_warnings: string[];
    estimated_cost: 'low' | 'medium' | 'high';
  };
}

export class EnhancedExecuteSQLTool {
  constructor(private readonly supabaseClient: SupabaseClient) {}

  async execute(
    parameters: ExecuteSQLParameters,
    options: MCPToolExecutionOptions
  ): Promise<ExecuteSQLResult> {
    const startTime = Date.now();
    const isDryRun = parameters.dry_run !== false;
    
    const validation = this.validateSQL(parameters.sql);
    if (!validation.is_safe) {
      throw new Error(`Unsafe SQL: ${validation.security_warnings.join(', ')}`);
    }

    if (isDryRun) {
      return {
        success: true,
        execution_time_ms: Date.now() - startTime,
        is_dry_run: true,
        validation_results: validation
      };
    }

    try {
      const { data, error } = await this.supabaseClient.rpc('execute_sql', {
        sql: parameters.sql
      });

      if (error) throw new Error(error.message);

      return {
        success: true,
        data: data || [],
        row_count: Array.isArray(data) ? data.length : 0,
        execution_time_ms: Date.now() - startTime,
        is_dry_run: false,
        validation_results: validation
      };
    } catch (error) {
      throw new Error(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateSQL(sql: string) {
    const warnings: string[] = [];
    
    if (sql.match(/\b(DROP|TRUNCATE|DELETE|ALTER)\b/i)) {
      warnings.push('Destructive operations detected');
    }

    if (sql.match(/--|\*\/|\bUNION\b.*\bSELECT\b/i)) {
      warnings.push('SQL injection patterns');
    }

    let cost: 'low' | 'medium' | 'high' = 'low';
    if (sql.match(/\bJOIN\b/i)) cost = 'medium';
    if (sql.match(/\b(WITH|WINDOW|RECURSIVE)\b/i)) cost = 'high';

    return {
      is_safe: warnings.length === 0,
      security_warnings: warnings,
      estimated_cost: cost
    };
  }
}