import {
  MCPToolDefinition,
  MCPToolRequest,
  MCPToolResponse,
} from '../../base/interfaces/mcp-server.interface';
import {
  QueryExecutorService,
  QueryExecutionRequest,
} from '../services/query-executor.service';
import { SupabaseClient } from '@supabase/supabase-js';

export class ExecuteSQLTool {
  static getDefinition(): MCPToolDefinition {
    return {
      name: 'execute-sql',
      description:
        'Execute SQL queries safely with validation, caching, and detailed results',
      inputSchema: {
        type: 'object',
        properties: {
          sql_query: {
            type: 'string',
            description: 'The SQL query to execute',
          },
          parameters: {
            type: 'array',
            items: {},
            description: 'Parameters for parameterized queries (optional)',
          },
          dry_run: {
            type: 'boolean',
            description: 'Validate the query without executing it',
            default: false,
          },
          max_rows: {
            type: 'integer',
            description: 'Maximum number of rows to return',
            default: 1000,
            minimum: 1,
            maximum: 10000,
          },
          timeout: {
            type: 'integer',
            description: 'Query timeout in milliseconds',
            default: 30000,
            minimum: 1000,
            maximum: 300000,
          },
          format: {
            type: 'string',
            enum: ['detailed', 'compact', 'csv', 'json'],
            description: 'Output format for results',
            default: 'detailed',
          },
        },
        required: ['sql_query'],
      },
    };
  }

  static async execute(
    request: MCPToolRequest,
    supabaseClient: SupabaseClient,
    queryExecutorService: QueryExecutorService,
  ): Promise<MCPToolResponse> {
    try {
      const {
        sql_query,
        parameters,
        dry_run = false,
        max_rows = 1000,
        timeout = 30000,
        format = 'detailed',
      } = request.arguments || {};

      if (!sql_query?.trim()) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: sql_query is required and cannot be empty',
            },
          ],
          isError: true,
          _meta: {
            tool: 'execute-sql',
            error: 'Missing required parameter: sql_query',
          },
        };
      }

      // Prepare execution request
      const executionRequest: QueryExecutionRequest = {
        sql: sql_query.trim(),
        parameters,
        dryRun: dry_run,
        maxRows: max_rows,
        timeout,
      };

      // Execute the query
      const executionResult = await queryExecutorService.executeQuery(
        supabaseClient,
        executionRequest,
      );

      // Format the response based on requested format
      let formattedResult;
      switch (format) {
        case 'compact':
          formattedResult = this.formatCompact(executionResult);
          break;
        case 'csv':
          formattedResult = this.formatCSV(executionResult);
          break;
        case 'json':
          formattedResult = this.formatJSON(executionResult);
          break;
        case 'detailed':
        default:
          formattedResult = this.formatDetailed(executionResult);
          break;
      }

      return {
        content: [
          {
            type: 'text',
            text:
              typeof formattedResult === 'string'
                ? formattedResult
                : JSON.stringify(formattedResult, null, 2),
          },
        ],
        isError: !executionResult.success,
        _meta: {
          tool: 'execute-sql',
          success: executionResult.success,
          execution_time: executionResult.metadata.executionTime,
          record_count: executionResult.metadata.recordCount,
          query_type: executionResult.metadata.queryType,
          was_cached: executionResult.metadata.wasCached,
          dry_run,
          format,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing SQL: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
        _meta: {
          tool: 'execute-sql',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Format result in detailed format
   */
  private static formatDetailed(result: any): any {
    return {
      sql_execution: {
        success: result.success,
        query_info: {
          type: result.metadata.queryType,
          execution_time_ms: result.metadata.executionTime,
          was_cached: result.metadata.wasCached,
          affected_rows: result.metadata.affectedRows,
        },
        results: {
          record_count: result.metadata.recordCount,
          columns: result.metadata.columnsReturned,
          data: result.data || [],
        },
        warnings: result.warnings || [],
        error: result.error || null,
        metadata: {
          timestamp: new Date().toISOString(),
          cache_status: result.metadata.wasCached ? 'hit' : 'miss',
        },
      },
    };
  }

  /**
   * Format result in compact format
   */
  private static formatCompact(result: any): any {
    if (!result.success) {
      return {
        error: result.error,
        warnings: result.warnings,
      };
    }

    return {
      success: true,
      rows: result.metadata.recordCount,
      time: `${result.metadata.executionTime}ms`,
      data: result.data || [],
      warnings: result.warnings?.length > 0 ? result.warnings : undefined,
    };
  }

  /**
   * Format result as CSV string
   */
  private static formatCSV(result: any): string {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    if (!result.data || result.data.length === 0) {
      return 'No data returned';
    }

    const columns = result.metadata.columnsReturned;
    const rows = result.data;

    // Create CSV header
    let csv = columns.join(',') + '\n';

    // Add data rows
    for (const row of rows) {
      const values = columns.map((col: string) => {
        const value = row[col];
        if (value === null || value === undefined) {
          return '';
        }
        // Escape quotes and wrap in quotes if contains comma or quote
        const stringValue = String(value);
        if (
          stringValue.includes(',') ||
          stringValue.includes('"') ||
          stringValue.includes('\n')
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csv += values.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Format result as pure JSON
   */
  private static formatJSON(result: any): any {
    if (!result.success) {
      return {
        error: result.error,
        success: false,
      };
    }

    return {
      success: true,
      data: result.data || [],
      metadata: {
        record_count: result.metadata.recordCount,
        execution_time_ms: result.metadata.executionTime,
        columns: result.metadata.columnsReturned,
      },
    };
  }

  /**
   * Execute multiple SQL queries as a transaction
   */
  static async executeTransaction(
    request: MCPToolRequest,
    supabaseClient: SupabaseClient,
    queryExecutorService: QueryExecutorService,
  ): Promise<MCPToolResponse> {
    try {
      const {
        sql_queries,
        dry_run = false,
        timeout = 60000,
      } = request.arguments || {};

      if (!Array.isArray(sql_queries) || sql_queries.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: sql_queries must be a non-empty array',
            },
          ],
          isError: true,
          _meta: {
            tool: 'execute-sql-transaction',
            error: 'Invalid sql_queries parameter',
          },
        };
      }

      // Prepare execution requests
      const executionRequests: QueryExecutionRequest[] = sql_queries.map(
        (sql: string) => ({
          sql: sql.trim(),
          dryRun: dry_run,
          timeout: timeout / sql_queries.length, // Distribute timeout across queries
        }),
      );

      // Execute transaction
      const results = await queryExecutorService.executeTransaction(
        supabaseClient,
        executionRequests,
      );

      // Format response
      const response = {
        transaction_execution: {
          total_queries: sql_queries.length,
          successful_queries: results.filter((r) => r.success).length,
          failed_queries: results.filter((r) => !r.success).length,
          total_execution_time_ms: results.reduce(
            (sum, r) => sum + r.metadata.executionTime,
            0,
          ),
          results: results.map((result, index) => ({
            query_index: index,
            sql: sql_queries[index],
            success: result.success,
            execution_time_ms: result.metadata.executionTime,
            record_count: result.metadata.recordCount,
            error: result.error || null,
            warnings: result.warnings || [],
          })),
          dry_run,
        },
      };

      const hasErrors = results.some((r) => !r.success);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
        isError: hasErrors,
        _meta: {
          tool: 'execute-sql-transaction',
          total_queries: sql_queries.length,
          successful_queries: response.transaction_execution.successful_queries,
          total_time: response.transaction_execution.total_execution_time_ms,
          dry_run,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing SQL transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
        _meta: {
          tool: 'execute-sql-transaction',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
