import {
  MCPToolDefinition,
  MCPToolRequest,
  MCPToolResponse,
} from '../../base/interfaces/mcp-server.interface';
import { SupabaseClient } from '@supabase/supabase-js';

export class ReadDataTool {
  static getDefinition(): MCPToolDefinition {
    return {
      name: 'read-data',
      description:
        'Read data from Supabase tables with filtering, sorting, and pagination',
      inputSchema: {
        type: 'object',
        properties: {
          table_name: {
            type: 'string',
            description: 'Name of the table to read from',
          },
          columns: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Specific columns to select (optional, defaults to all columns)',
          },
          filters: {
            type: 'object',
            description:
              'WHERE conditions as key-value pairs (e.g., {"status": "active", "age": {"gt": 18}})',
            additionalProperties: true,
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of rows to return',
            default: 100,
            minimum: 1,
            maximum: 10000,
          },
          offset: {
            type: 'integer',
            description: 'Number of rows to skip (for pagination)',
            default: 0,
            minimum: 0,
          },
          order_by: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              ascending: { type: 'boolean', default: true },
            },
            description: 'Column to sort by and direction',
          },
          format: {
            type: 'string',
            enum: ['json', 'table', 'csv'],
            description: 'Output format for the data',
            default: 'json',
          },
        },
        required: ['table_name'],
      },
    };
  }

  static async execute(
    request: MCPToolRequest,
    supabaseClient: SupabaseClient,
  ): Promise<MCPToolResponse> {
    try {
      const {
        table_name,
        columns,
        filters,
        limit = 100,
        offset = 0,
        order_by,
        format = 'json',
      } = request.arguments || {};

      if (!table_name?.trim()) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: table_name is required and cannot be empty',
            },
          ],
          isError: true,
          _meta: {
            tool: 'read-data',
            error: 'Missing required parameter: table_name',
          },
        };
      }

      const startTime = Date.now();

      // Build the query with proper Supabase client flow
      const queryBuilder = supabaseClient.from(table_name);

      // Select specific columns or all
      let selectQuery;
      if (columns && columns.length > 0) {
        selectQuery = queryBuilder.select(columns.join(', '));
      } else {
        selectQuery = queryBuilder.select('*');
      }

      // Apply filters
      let filteredQuery = selectQuery;
      if (filters) {
        filteredQuery = this.applyFilters(selectQuery, filters);
      }

      // Apply ordering
      let orderedQuery = filteredQuery;
      if (order_by && order_by.column) {
        orderedQuery = (filteredQuery as any).order(order_by.column, {
          ascending: order_by.ascending !== false,
        });
      }

      // Apply pagination
      const endRange = offset + limit - 1;
      const finalQuery = (orderedQuery as any).range(offset, endRange);

      // Execute the query
      const result = await finalQuery;
      const { data, error, count } = result;

      if (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Database error: ${error.message}`,
            },
          ],
          isError: true,
          _meta: {
            tool: 'read-data',
            table: table_name,
            error: error.message,
          },
        };
      }

      const executionTime = Date.now() - startTime;

      // Format the response
      const formattedResult = this.formatData(data || [], format, {
        table_name,
        columns: columns || Object.keys(data?.[0] || {}),
        record_count: data?.length || 0,
        total_count: count,
        execution_time_ms: executionTime,
        filters_applied: filters ? Object.keys(filters).length : 0,
        offset,
        limit,
      });

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
        isError: false,
        _meta: {
          tool: 'read-data',
          table: table_name,
          record_count: data?.length || 0,
          execution_time: executionTime,
          format,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reading data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
        _meta: {
          tool: 'read-data',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Apply filters to the Supabase query
   */
  private static applyFilters(query: any, filters: Record<string, any>): any {
    for (const [column, condition] of Object.entries(filters)) {
      if (typeof condition === 'object' && condition !== null) {
        // Handle complex conditions like {"gt": 18}, {"in": ["active", "pending"]}
        for (const [operator, value] of Object.entries(condition)) {
          switch (operator) {
            case 'eq':
              query = query.eq(column, value);
              break;
            case 'neq':
              query = query.neq(column, value);
              break;
            case 'gt':
              query = query.gt(column, value);
              break;
            case 'gte':
              query = query.gte(column, value);
              break;
            case 'lt':
              query = query.lt(column, value);
              break;
            case 'lte':
              query = query.lte(column, value);
              break;
            case 'in':
              if (Array.isArray(value)) {
                query = query.in(column, value);
              }
              break;
            case 'like':
              query = query.like(column, value);
              break;
            case 'ilike':
              query = query.ilike(column, value);
              break;
            case 'is':
              query = query.is(column, value);
              break;
            default:
              // Unknown operator, treat as equals
              query = query.eq(column, value);
          }
        }
      } else {
        // Simple equality condition
        query = query.eq(column, condition);
      }
    }
    return query;
  }

  /**
   * Format data based on requested format
   */
  private static formatData(data: any[], format: string, metadata: any): any {
    switch (format) {
      case 'table':
        return {
          table_data: {
            table_name: metadata.table_name,
            columns: metadata.columns,
            rows: data,
            metadata: {
              record_count: metadata.record_count,
              total_available: metadata.total_count,
              execution_time_ms: metadata.execution_time_ms,
              pagination: {
                offset: metadata.offset,
                limit: metadata.limit,
                has_more: metadata.total_count
                  ? metadata.offset + metadata.limit < metadata.total_count
                  : false,
              },
            },
          },
        };

      case 'csv':
        return this.formatAsCSV(data, metadata.columns);

      case 'json':
      default:
        return {
          data: data,
          metadata: {
            table_name: metadata.table_name,
            record_count: metadata.record_count,
            total_available: metadata.total_count,
            execution_time_ms: metadata.execution_time_ms,
            columns: metadata.columns,
            filters_applied: metadata.filters_applied,
            pagination: {
              offset: metadata.offset,
              limit: metadata.limit,
            },
          },
        };
    }
  }

  /**
   * Format data as CSV string
   */
  private static formatAsCSV(data: any[], columns: string[]): string {
    if (data.length === 0) {
      return 'No data available';
    }

    // Use actual columns from first row if columns not specified
    const actualColumns = columns.length > 0 ? columns : Object.keys(data[0]);

    // Create CSV header
    let csv = actualColumns.join(',') + '\n';

    // Add data rows
    for (const row of data) {
      const values = actualColumns.map((col) => {
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
   * Get data with count for pagination
   */
  static async executeWithCount(
    request: MCPToolRequest,
    supabaseClient: SupabaseClient,
  ): Promise<MCPToolResponse> {
    try {
      const { table_name } = request.arguments || {};

      // First get the total count
      const { count: totalCount, error: countError } = await supabaseClient
        .from(table_name)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting count: ${countError.message}`,
            },
          ],
          isError: true,
          _meta: {
            tool: 'read-data-with-count',
            error: countError.message,
          },
        };
      }

      // Execute the main query with count information
      const result = await this.execute(request, supabaseClient);

      // Add total count to metadata if successful
      if (!result.isError && result._meta) {
        result._meta.total_count = totalCount;
      }

      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reading data with count: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
        _meta: {
          tool: 'read-data-with-count',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
