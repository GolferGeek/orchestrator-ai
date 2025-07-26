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
      // Parse the SQL to determine the operation and table
      const result = await this.executeParsedSQL(parameters.sql, parameters.max_rows || 1000);

      return {
        success: true,
        data: result.data || [],
        row_count: Array.isArray(result.data) ? result.data.length : 0,
        execution_time_ms: Date.now() - startTime,
        is_dry_run: false,
        validation_results: validation
      };
    } catch (error) {
      throw new Error(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute SQL by parsing it and using appropriate Supabase client methods
   */
  private async executeParsedSQL(sql: string, maxRows: number): Promise<{ data: any[] }> {
    const cleanSQL = sql.trim().replace(/;$/, ''); // Remove trailing semicolon
    
    // Parse basic SELECT statements
    if (cleanSQL.toLowerCase().startsWith('select')) {
      return await this.executeSelectStatement(cleanSQL, maxRows);
    }
    
    // For now, only support SELECT statements for safety
    throw new Error('Only SELECT statements are supported for direct execution');
  }

  /**
   * Execute SELECT statements using Supabase client
   */
  private async executeSelectStatement(sql: string, maxRows: number): Promise<{ data: any[] }> {
    // Simple parsing for basic SELECT statements
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    if (!fromMatch || !fromMatch[1]) {
      throw new Error('Could not parse table name from SELECT statement');
    }
    
    const tableName = fromMatch[1].trim();
    
    // Check if it's a COUNT query
    if (sql.toLowerCase().includes('count(')) {
      const { count, error } = await this.supabaseClient
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (error) throw new Error(error.message);
      
      return { 
        data: [{ count: count || 0 }] 
      };
    }
    
    // Check for other aggregate functions (AVG, MAX, MIN, SUM)
    const aggMatch = sql.match(/SELECT\s+(AVG|MAX|MIN|SUM)\((\w+)\)/i);
    if (aggMatch && aggMatch[1] && aggMatch[2]) {
      const aggFunction = aggMatch[1].toUpperCase();
      const column = aggMatch[2];
      
      // For aggregate functions, we need to fetch the data and calculate manually
      // since Supabase client doesn't support these aggregates directly
      
      // Parse WHERE clause for filtering
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
      let query = this.supabaseClient.from(tableName).select(column);
      
      if (whereMatch && whereMatch[1]) {
        const whereClause = whereMatch[1].trim();
        
        // Handle basic WHERE conditions - this is simplified
        if (whereClause.includes('>=') && whereClause.includes('NOW()')) {
          // Handle date comparisons like "created_at >= NOW() - INTERVAL '30 days'"
          const intervalMatch = whereClause.match(/(\w+)\s*>=\s*NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*days?'/i);
          if (intervalMatch && intervalMatch[1] && intervalMatch[2]) {
            const dateField = intervalMatch[1];
            const days = parseInt(intervalMatch[2]);
            const dateThreshold = new Date();
            dateThreshold.setDate(dateThreshold.getDate() - days);
            query = query.gte(dateField, dateThreshold.toISOString());
          }
        }
      }
      
      // Execute query to get raw data
      const { data: rawData, error } = await query;
      if (error) throw new Error(error.message);
      
      if (!rawData || rawData.length === 0) {
        return { data: [{ [aggFunction.toLowerCase()]: null }] };
      }
      
      // Calculate aggregate manually
      const values = rawData.map(row => parseFloat((row as any)[column])).filter(val => !isNaN(val));
      if (values.length === 0) {
        return { data: [{ [aggFunction.toLowerCase()]: null }] };
      }
      
      let result;
      switch (aggFunction) {
        case 'AVG':
          result = values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case 'MAX':
          result = Math.max(...values);
          break;
        case 'MIN':
          result = Math.min(...values);
          break;
        case 'SUM':
          result = values.reduce((sum, val) => sum + val, 0);
          break;
        default:
          throw new Error(`Unsupported aggregate function: ${aggFunction}`);
      }
      
      return { 
        data: [{ [aggFunction.toLowerCase()]: result }] 
      };
    }
    
    // Parse column selection
    const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);
    let selectClause = '*';
    
    if (selectMatch && selectMatch[1] && selectMatch[1].trim() !== '*') {
      selectClause = selectMatch[1].trim();
    }
    
    // Build the query
    let query = this.supabaseClient.from(tableName).select(selectClause);
    
    // Parse ORDER BY
    const orderMatch = sql.match(/ORDER BY\s+(.*?)(?:\s+LIMIT|\s*$)/i);
    if (orderMatch && orderMatch[1]) {
      const orderClause = orderMatch[1].trim();
      const [column, direction] = orderClause.split(/\s+/);
      if (column) {
        const ascending = !direction || direction.toLowerCase() !== 'desc';
        query = query.order(column, { ascending });
      }
    }
    
    // Parse LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch && limitMatch[1] ? Math.min(parseInt(limitMatch[1]), maxRows) : maxRows;
    query = query.limit(limit);
    
    const { data, error } = await query;
    
    if (error) throw new Error(error.message);
    
    return { data: data || [] };
  }

  private validateSQL(sql: string) {
    const warnings: string[] = [];
    
    if (sql.match(/\b(DROP|TRUNCATE|DELETE|ALTER|INSERT|UPDATE)\b/i)) {
      warnings.push('Only SELECT statements are allowed');
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