/**
 * Enhanced Query and Format Tool
 * 
 * Combines SQL generation and execution with formatted output.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ContextLearningService } from '../services/context-learning.service';
import { LLMService } from '../../../../llms/llm.service';
import { MCPToolExecutionOptions } from '../base/intelligent-mcp-base.service';
import { EnhancedGenerateSQLTool } from './generate-sql.tool';
import { EnhancedExecuteSQLTool } from './enhanced-execute-sql.tool';

export interface QueryAndFormatParameters {
  prompt: string;
  format?: 'json' | 'csv' | 'markdown' | 'table';
  execute?: boolean;
  use_context?: boolean;
}

export interface QueryAndFormatResult {
  sql: string;
  formatted_data?: string;
  execution_success: boolean;
  format_used: string;
  row_count?: number;
  execution_time_ms: number;
}

export class EnhancedQueryAndFormatTool {
  private generateSQLTool: EnhancedGenerateSQLTool;
  private executeSQLTool: EnhancedExecuteSQLTool;

  constructor(
    private readonly supabaseClient: SupabaseClient,
    private readonly contextLearning: ContextLearningService,
    private readonly llmService: LLMService
  ) {
    this.generateSQLTool = new EnhancedGenerateSQLTool(
      supabaseClient,
      contextLearning,
      llmService
    );
    this.executeSQLTool = new EnhancedExecuteSQLTool(supabaseClient);
  }

  async execute(
    parameters: QueryAndFormatParameters,
    options: MCPToolExecutionOptions
  ): Promise<QueryAndFormatResult> {
    const startTime = Date.now();
    const format = parameters.format || 'json';
    const shouldExecute = parameters.execute === true;

    // Generate SQL
    const sqlResult = await this.generateSQLTool.execute({
      prompt: parameters.prompt,
      use_context: parameters.use_context
    }, options);

    if (!shouldExecute) {
      return {
        sql: sqlResult.sql,
        execution_success: false,
        format_used: format,
        execution_time_ms: Date.now() - startTime
      };
    }

    // Execute SQL
    const executeResult = await this.executeSQLTool.execute({
      sql: sqlResult.sql,
      dry_run: false
    }, options);

    // Format results
    const formattedData = this.formatData(executeResult.data || [], format);

    return {
      sql: sqlResult.sql,
      formatted_data: formattedData,
      execution_success: executeResult.success,
      format_used: format,
      row_count: executeResult.row_count,
      execution_time_ms: Date.now() - startTime
    };
  }

  private formatData(data: any[], format: string): string {
    switch (format) {
      case 'csv':
        return this.formatAsCSV(data);
      case 'markdown':
        return this.formatAsMarkdown(data);
      case 'table':
        return this.formatAsTable(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private formatAsCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ];
    
    return csvRows.join('\n');
  }

  private formatAsMarkdown(data: any[]): string {
    if (data.length === 0) return 'No data returned';
    
    const headers = Object.keys(data[0]);
    let md = `| ${headers.join(' | ')} |\n`;
    md += `| ${headers.map(() => '---').join(' | ')} |\n`;
    
    for (const row of data) {
      md += `| ${headers.map(h => row[h] || '').join(' | ')} |\n`;
    }
    
    return md;
  }

  private formatAsTable(data: any[]): string {
    if (data.length === 0) return 'No data returned';
    
    const headers = Object.keys(data[0]);
    const maxWidths = headers.map(h => Math.max(h.length, 
      ...data.map(row => String(row[h] || '').length)
    ));
    
    let table = '';
    // Header
    table += '┌' + maxWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐\n';
    table += '│ ' + headers.map((h, i) => h.padEnd(maxWidths[i] || 0)).join(' │ ') + ' │\n';
    table += '├' + maxWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤\n';
    
    // Data rows
    for (const row of data) {
      table += '│ ' + headers.map((h, i) => 
        String(row[h] || '').padEnd(maxWidths[i] || 0)
      ).join(' │ ') + ' │\n';
    }
    
    table += '└' + maxWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';
    
    return table;
  }
}