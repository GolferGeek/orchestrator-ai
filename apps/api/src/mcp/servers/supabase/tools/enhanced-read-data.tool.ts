/**
 * Enhanced Read Data Tool
 * 
 * Simple data reading with filtering and pagination.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { MCPToolExecutionOptions } from '../base/intelligent-mcp-base.service';

export interface ReadDataParameters {
  table_name: string;
  columns?: string[];
  limit?: number;
  offset?: number;
}

export interface ReadDataResult {
  data: any[];
  row_count: number;
  total_count?: number;
  table_name: string;
  columns_selected: string[];
  execution_time_ms: number;
}

export class EnhancedReadDataTool {
  constructor(private readonly supabaseClient: SupabaseClient) {}

  async execute(
    parameters: ReadDataParameters,
    options: MCPToolExecutionOptions
  ): Promise<ReadDataResult> {
    const startTime = Date.now();
    const limit = Math.min(parameters.limit || 100, 1000);
    const offset = parameters.offset || 0;
    
    try {
      let query = this.supabaseClient.from(parameters.table_name);
      
      // Select specific columns or all
      const columns = parameters.columns?.join(',') || '*';
      const selectQuery = query.select(columns, { count: 'exact' });
      
      // Apply pagination
      const paginatedQuery = selectQuery.range(offset, offset + limit - 1);
      
      const { data, error, count } = await paginatedQuery;
      
      if (error) {
        throw new Error(`Failed to read from ${parameters.table_name}: ${error.message}`);
      }
      
      return {
        data: data || [],
        row_count: data?.length || 0,
        total_count: count || undefined,
        table_name: parameters.table_name,
        columns_selected: parameters.columns || ['*'],
        execution_time_ms: Date.now() - startTime
      };
      
    } catch (error) {
      throw new Error(`Read operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}