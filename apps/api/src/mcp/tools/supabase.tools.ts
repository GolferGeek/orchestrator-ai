import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MCPToolDefinition,
  MCPToolRequest,
  MCPToolResponse,
  IMCPToolHandler,
} from '../interfaces/mcp.interface';

/**
 * Supabase MCP Tools Handler
 *
 * Implements data namespace tools for Supabase PostgreSQL operations
 * Provides: schema discovery, SQL execution, data querying, and table operations
 */
@Injectable()
export class SupabaseMCPTools implements IMCPToolHandler {
  private readonly logger = new Logger(SupabaseMCPTools.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get all Supabase tools available
   */
  getTools(): Promise<MCPToolDefinition[]> {
    return Promise.resolve([
      {
        name: 'get-schema',
        description:
          'Get database schema information including tables, columns, and relationships',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description:
                'Specific table name to get schema for (optional - returns all tables if not specified)',
            },
            include_system: {
              type: 'boolean',
              description: 'Include system tables in results',
              default: false,
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
      {
        name: 'execute-sql',
        description: 'Execute a SQL query against the Supabase database',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL query to execute',
            },
            params: {
              type: 'array',
              description: 'Query parameters for prepared statement',
              items: { type: 'string' },
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      {
        name: 'read-data',
        description:
          'Read data from a specific table with filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Name of the table to read from',
            },
            columns: {
              type: 'array',
              description: 'Columns to select (default: all)',
              items: { type: 'string' },
            },
            where: {
              type: 'object',
              description: 'WHERE conditions as key-value pairs',
              additionalProperties: true,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of rows to return',
              default: 100,
            },
            offset: {
              type: 'number',
              description: 'Number of rows to skip',
              default: 0,
            },
            order_by: {
              type: 'string',
              description: 'Column to order by',
            },
            format: {
              type: 'string',
              enum: ['json', 'table', 'csv'],
              description: 'Output format',
              default: 'json',
            },
          },
          required: ['table_name'],
          additionalProperties: false,
        },
      },
      {
        name: 'query-and-format',
        description:
          'Execute a custom query and format the results for analysis',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL query to execute',
            },
            format: {
              type: 'string',
              enum: ['json', 'table', 'csv', 'summary'],
              description: 'Output format for results',
              default: 'table',
            },
            analysis_type: {
              type: 'string',
              enum: ['metrics', 'trends', 'comparison', 'raw'],
              description: 'Type of analysis to perform on results',
              default: 'raw',
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      {
        name: 'generate-sql',
        description: 'Generate SQL query from natural language description',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Natural language description of desired query',
            },
            table_context: {
              type: 'array',
              description: 'Specific tables to focus on',
              items: { type: 'string' },
            },
            query_type: {
              type: 'string',
              enum: ['select', 'insert', 'update', 'delete', 'analyze'],
              description: 'Type of SQL operation',
              default: 'select',
            },
          },
          required: ['description'],
          additionalProperties: false,
        },
      },
    ]);
  }

  /**
   * Execute a Supabase tool
   */
  async executeTool(request: MCPToolRequest): Promise<MCPToolResponse> {
    const { name, arguments: args = {} } = request;

    try {
      switch (name) {
        case 'get-schema':
          return await this.getSchema(args);
        case 'execute-sql':
          return await this.executeSql(args);
        case 'read-data':
          return await this.readData(args);
        case 'query-and-format':
          return await this.queryAndFormat(args);
        case 'generate-sql':
          return this.generateSql(args);
        default:
          return this.createErrorResponse(`Unknown Supabase tool: ${name}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Supabase tool ${name} failed: ${errorMessage}`);
      return this.createErrorResponse(`Tool execution failed: ${errorMessage}`);
    }
  }

  /**
   * Health check for Supabase connection
   */
  async ping(): Promise<boolean> {
    try {
      // Check if basic configuration is available
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey =
        this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
        this.configService.get<string>('SUPABASE_ANON_KEY');

      if (!supabaseUrl || !supabaseKey) {
        this.logger.debug(
          'Supabase configuration not available - tools will be available but may fail at execution',
        );
        return false;
      }

      // Try a lightweight connection test
      const response = await this.makeSupabaseRequest('/rest/v1/', 'GET');
      return response.ok;
    } catch (error) {
      this.logger.debug(
        `Supabase ping failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return false but don't prevent MCP server from being healthy overall
      return false;
    }
  }

  /**
   * Get database schema information
   */
  private async getSchema(
    args: Record<string, unknown>,
  ): Promise<MCPToolResponse> {
    const { table_name, include_system = false } = args;

    try {
      let query = `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
      `;

      if (table_name) {
        const tableName =
          typeof table_name === 'string'
            ? table_name
            : JSON.stringify(table_name);
        query += ` AND table_name = '${tableName}'`;
      }

      if (!include_system) {
        query += ` AND table_name NOT LIKE 'pg_%' AND table_name NOT LIKE 'information_schema%'`;
      }

      query += ` ORDER BY table_name, ordinal_position`;

      const response = await this.makeSupabaseRequest(
        '/rest/v1/rpc/exec',
        'POST',
        {
          query,
        },
      );

      if (!response.ok) {
        throw new Error(`Schema query failed: ${response.statusText}`);
      }

      const data = await this.parseJsonValue(response, 'Supabase schema query');
      const schema = this.ensureJsonCollection(data, 'Supabase schema query');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                schema,
                timestamp: new Date().toISOString(),
                table_filter: table_name || 'all tables',
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        `Schema retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Execute SQL query
   */
  private async executeSql(
    args: Record<string, unknown>,
  ): Promise<MCPToolResponse> {
    const { query, params = [] } = args;

    try {
      const response = await this.makeSupabaseRequest(
        '/rest/v1/rpc/exec',
        'POST',
        {
          query,
          params,
        },
      );

      if (!response.ok) {
        throw new Error(`SQL execution failed: ${response.statusText}`);
      }

      const data = await this.parseJsonValue(
        response,
        'Supabase SQL execution',
      );
      const results = this.ensureJsonCollection(data, 'Supabase SQL execution');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                results,
                query,
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        `SQL execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Read data from table
   */
  private async readData(
    args: Record<string, unknown>,
  ): Promise<MCPToolResponse> {
    const {
      table_name,
      columns = ['*'],
      where = {},
      limit = 100,
      offset = 0,
      order_by,
      format = 'json',
    } = args;

    try {
      let url = `/rest/v1/${String(table_name)}`;
      const params = new URLSearchParams();

      // Add column selection
      const columnsArray = columns as string[];
      if (columnsArray.length > 0 && !columnsArray.includes('*')) {
        params.append('select', columnsArray.join(','));
      }

      // Add WHERE conditions
      const whereObj = where as Record<string, unknown>;
      Object.entries(whereObj).forEach(([key, value]) => {
        params.append(key, `eq.${String(value)}`);
      });

      // Add limit and offset
      const limitNum = limit as number;
      const offsetNum = offset as number;
      params.append('limit', limitNum.toString());
      if (offsetNum > 0) {
        params.append('offset', offsetNum.toString());
      }

      // Add ordering
      const orderBy = order_by as string | undefined;
      if (orderBy) {
        params.append('order', orderBy);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await this.makeSupabaseRequest(url, 'GET');

      if (!response.ok) {
        throw new Error(`Data read failed: ${response.statusText}`);
      }

      const data = await this.parseJsonValue(response, 'Supabase data read');
      const payload = this.ensureJsonCollection(data, 'Supabase data read');

      const formatStr = format as string;
      return {
        content: [
          {
            type: 'text',
            text: this.formatData(payload, formatStr),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        `Data read failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Query and format results
   */
  private async queryAndFormat(
    args: Record<string, unknown>,
  ): Promise<MCPToolResponse> {
    const { query, format = 'table', analysis_type = 'raw' } = args;

    try {
      const response = await this.makeSupabaseRequest(
        '/rest/v1/rpc/exec',
        'POST',
        {
          query,
        },
      );

      if (!response.ok) {
        throw new Error(`Query execution failed: ${response.statusText}`);
      }

      const data = await this.parseJsonValue(
        response,
        'Supabase query execution',
      );
      const payload = this.ensureJsonCollection(
        data,
        'Supabase query execution',
      );

      const formatStr = format as string;
      const analysisType = analysis_type as string;
      return {
        content: [
          {
            type: 'text',
            text: this.formatData(payload, formatStr, analysisType),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        `Query and format failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate SQL from natural language
   */
  private generateSql(args: Record<string, unknown>): MCPToolResponse {
    const { description, table_context = [], query_type = 'select' } = args;

    try {
      // This would typically use an AI service to generate SQL
      // For now, return a template response
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                description,
                suggested_query: `-- Generated SQL for: ${String(description)}\n-- Query type: ${String(query_type)}\n-- TODO: Implement AI-powered SQL generation`,
                table_context,
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.createErrorResponse(
        `SQL generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Make authenticated request to Supabase
   */
  private async makeSupabaseRequest(
    endpoint: string,
    method: string,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
      'Content-Type': 'application/json',
    };

    return fetch(`${supabaseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Format data according to specified format
   */
  private formatData(
    data: unknown,
    format: string,
    analysisType?: string,
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'table':
        return this.formatAsTable(data as unknown[]);
      case 'csv':
        return this.formatAsCsv(data as unknown[]);
      case 'summary':
        return this.formatAsSummary(data as unknown[], analysisType);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Format data as ASCII table
   */
  private formatAsTable(data: unknown[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return 'No data to display';
    }

    const firstRow = data[0] as Record<string, unknown>;
    const keys = Object.keys(firstRow);
    const maxWidths = keys.map((key) =>
      Math.max(
        key.length,
        ...data.map((row) => {
          const rowRec = row as Record<string, unknown>;
          const value = rowRec[key];
          if (value == null) return 0;
          if (typeof value === 'object') return JSON.stringify(value).length;
          if (typeof value === 'string') return value.length;
          if (typeof value === 'number' || typeof value === 'boolean')
            return String(value).length;
          return 0;
        }),
      ),
    );

    let table = '';

    // Header
    table +=
      '| ' +
      keys.map((key, i) => key.padEnd(maxWidths[i] || 0)).join(' | ') +
      ' |\n';
    table +=
      '| ' +
      maxWidths.map((width) => '-'.repeat(width || 0)).join(' | ') +
      ' |\n';

    // Rows
    data.forEach((row) => {
      const rowRec = row as Record<string, unknown>;
      table +=
        '| ' +
        keys
          .map((key, i) => {
            const value = rowRec[key];
            if (value == null) return ''.padEnd(maxWidths[i] || 0);
            if (typeof value === 'object')
              return JSON.stringify(value).padEnd(maxWidths[i] || 0);
            if (typeof value === 'string')
              return value.padEnd(maxWidths[i] || 0);
            if (typeof value === 'number' || typeof value === 'boolean')
              return String(value).padEnd(maxWidths[i] || 0);
            return ''.padEnd(maxWidths[i] || 0);
          })
          .join(' | ') +
        ' |\n';
    });

    return table;
  }

  /**
   * Format data as CSV
   */
  private formatAsCsv(data: unknown[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const firstRow = data[0] as Record<string, unknown>;
    const keys = Object.keys(firstRow);
    const csv = [keys.join(',')];

    data.forEach((row) => {
      const rowRec = row as Record<string, unknown>;
      csv.push(
        keys
          .map((key) => {
            const value = rowRec[key];
            if (typeof value === 'string') {
              return value.includes(',') ? `"${value}"` : value;
            }
            if (value == null) return '';
            if (typeof value === 'object') {
              const jsonStr = JSON.stringify(value);
              return jsonStr.includes(',') ? `"${jsonStr}"` : jsonStr;
            }
            if (typeof value === 'number' || typeof value === 'boolean') {
              const strValue = String(value);
              return strValue.includes(',') ? `"${strValue}"` : strValue;
            }
            return '';
          })
          .join(','),
      );
    });

    return csv.join('\n');
  }

  /**
   * Format data as summary with analysis
   */
  private formatAsSummary(data: unknown[], analysisType?: string): string {
    if (!Array.isArray(data)) {
      return JSON.stringify(data, null, 2);
    }

    let summary = `Data Summary (${data.length} records)\n\n`;

    if (data.length > 0) {
      const firstRow = data[0] as Record<string, unknown>;
      const keys = Object.keys(firstRow);
      summary += `Columns: ${keys.join(', ')}\n\n`;

      // Add basic statistics based on analysis type
      if (analysisType === 'metrics' || analysisType === 'trends') {
        summary += 'Sample Data:\n';
        summary += this.formatAsTable(data.slice(0, 5));
        summary += data.length > 5 ? '\n... and more\n' : '';
      } else {
        summary += this.formatAsTable(data);
      }
    }

    return summary;
  }

  private async parseJsonValue(
    response: { json(): Promise<unknown> },
    context: string,
  ): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      throw new Error(
        `${context} did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private ensureJsonCollection(
    value: unknown,
    context: string,
  ): unknown[] | Record<string, unknown> {
    if (Array.isArray(value)) {
      return value as unknown[];
    }
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }
    throw new Error(`${context} expected JSON object or array payload`);
  }

  /**
   * Create error response
   */
  private createErrorResponse(message: string): MCPToolResponse {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: message,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
      isError: true,
    };
  }
}
