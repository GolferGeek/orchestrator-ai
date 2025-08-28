import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MCPToolDefinition, MCPToolRequest, MCPToolResponse, IMCPToolHandler } from '../interfaces/mcp.interface';

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
  async getTools(): Promise<MCPToolDefinition[]> {
    return [
      {
        name: 'get-schema',
        description: 'Get database schema information including tables, columns, and relationships',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Specific table name to get schema for (optional - returns all tables if not specified)'
            },
            include_system: {
              type: 'boolean',
              description: 'Include system tables in results',
              default: false
            }
          },
          required: [],
          additionalProperties: false
        }
      },
      {
        name: 'execute-sql',
        description: 'Execute a SQL query against the Supabase database',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL query to execute'
            },
            params: {
              type: 'array',
              description: 'Query parameters for prepared statement',
              items: { type: 'string' }
            }
          },
          required: ['query'],
          additionalProperties: false
        }
      },
      {
        name: 'read-data',
        description: 'Read data from a specific table with filtering and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Name of the table to read from'
            },
            columns: {
              type: 'array',
              description: 'Columns to select (default: all)',
              items: { type: 'string' }
            },
            where: {
              type: 'object',
              description: 'WHERE conditions as key-value pairs',
              additionalProperties: true
            },
            limit: {
              type: 'number',
              description: 'Maximum number of rows to return',
              default: 100
            },
            offset: {
              type: 'number',
              description: 'Number of rows to skip',
              default: 0
            },
            order_by: {
              type: 'string',
              description: 'Column to order by'
            },
            format: {
              type: 'string',
              enum: ['json', 'table', 'csv'],
              description: 'Output format',
              default: 'json'
            }
          },
          required: ['table_name'],
          additionalProperties: false
        }
      },
      {
        name: 'query-and-format',
        description: 'Execute a custom query and format the results for analysis',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL query to execute'
            },
            format: {
              type: 'string',
              enum: ['json', 'table', 'csv', 'summary'],
              description: 'Output format for results',
              default: 'table'
            },
            analysis_type: {
              type: 'string',
              enum: ['metrics', 'trends', 'comparison', 'raw'],
              description: 'Type of analysis to perform on results',
              default: 'raw'
            }
          },
          required: ['query'],
          additionalProperties: false
        }
      },
      {
        name: 'generate-sql',
        description: 'Generate SQL query from natural language description',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Natural language description of desired query'
            },
            table_context: {
              type: 'array',
              description: 'Specific tables to focus on',
              items: { type: 'string' }
            },
            query_type: {
              type: 'string',
              enum: ['select', 'insert', 'update', 'delete', 'analyze'],
              description: 'Type of SQL operation',
              default: 'select'
            }
          },
          required: ['description'],
          additionalProperties: false
        }
      }
    ];
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
          return await this.generateSql(args);
        default:
          return this.createErrorResponse(`Unknown Supabase tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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
      const supabaseUrl = this.configService.get('SUPABASE_URL');
      const supabaseKey = this.configService.get('SUPABASE_SERVICE_ROLE_KEY') || this.configService.get('SUPABASE_ANON_KEY');
      
      if (!supabaseUrl || !supabaseKey) {
        this.logger.debug('Supabase configuration not available - tools will be available but may fail at execution');
        return false;
      }

      // Try a lightweight connection test
      const response = await this.makeSupabaseRequest('/rest/v1/', 'GET');
      return response.ok;
    } catch (error) {
      this.logger.debug(`Supabase ping failed: ${error instanceof Error ? error.message : String(error)}`);
      // Return false but don't prevent MCP server from being healthy overall
      return false;
    }
  }

  /**
   * Get database schema information
   */
  private async getSchema(args: any): Promise<MCPToolResponse> {
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
        query += ` AND table_name = '${table_name}'`;
      }

      if (!include_system) {
        query += ` AND table_name NOT LIKE 'pg_%' AND table_name NOT LIKE 'information_schema%'`;
      }

      query += ` ORDER BY table_name, ordinal_position`;

      const response = await this.makeSupabaseRequest('/rest/v1/rpc/exec', 'POST', {
        query
      });

      if (!response.ok) {
        throw new Error(`Schema query failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            schema: data,
            timestamp: new Date().toISOString(),
            table_filter: table_name || 'all tables'
          }, null, 2)
        }]
      };

    } catch (error) {
      return this.createErrorResponse(`Schema retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute SQL query
   */
  private async executeSql(args: any): Promise<MCPToolResponse> {
    const { query, params = [] } = args;

    try {
      const response = await this.makeSupabaseRequest('/rest/v1/rpc/exec', 'POST', {
        query,
        params
      });

      if (!response.ok) {
        throw new Error(`SQL execution failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            results: data,
            query: query,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };

    } catch (error) {
      return this.createErrorResponse(`SQL execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Read data from table
   */
  private async readData(args: any): Promise<MCPToolResponse> {
    const { 
      table_name, 
      columns = ['*'], 
      where = {}, 
      limit = 100, 
      offset = 0, 
      order_by,
      format = 'json'
    } = args;

    try {
      let url = `/rest/v1/${table_name}`;
      const params = new URLSearchParams();

      // Add column selection
      if (columns.length > 0 && !columns.includes('*')) {
        params.append('select', columns.join(','));
      }

      // Add WHERE conditions
      Object.entries(where).forEach(([key, value]) => {
        params.append(key, `eq.${value}`);
      });

      // Add limit and offset
      params.append('limit', limit.toString());
      if (offset > 0) {
        params.append('offset', offset.toString());
      }

      // Add ordering
      if (order_by) {
        params.append('order', order_by);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await this.makeSupabaseRequest(url, 'GET');

      if (!response.ok) {
        throw new Error(`Data read failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: [{
          type: 'text',
          text: this.formatData(data, format)
        }]
      };

    } catch (error) {
      return this.createErrorResponse(`Data read failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Query and format results
   */
  private async queryAndFormat(args: any): Promise<MCPToolResponse> {
    const { query, format = 'table', analysis_type = 'raw' } = args;

    try {
      const response = await this.makeSupabaseRequest('/rest/v1/rpc/exec', 'POST', {
        query
      });

      if (!response.ok) {
        throw new Error(`Query execution failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: [{
          type: 'text',
          text: this.formatData(data, format, analysis_type)
        }]
      };

    } catch (error) {
      return this.createErrorResponse(`Query and format failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate SQL from natural language
   */
  private async generateSql(args: any): Promise<MCPToolResponse> {
    const { description, table_context = [], query_type = 'select' } = args;

    try {
      // This would typically use an AI service to generate SQL
      // For now, return a template response
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            description,
            suggested_query: `-- Generated SQL for: ${description}\n-- Query type: ${query_type}\n-- TODO: Implement AI-powered SQL generation`,
            table_context,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };

    } catch (error) {
      return this.createErrorResponse(`SQL generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Make authenticated request to Supabase
   */
  private async makeSupabaseRequest(endpoint: string, method: string, body?: any): Promise<Response> {
    const supabaseUrl = this.configService.get('SUPABASE_URL');
    const supabaseKey = this.configService.get('SUPABASE_SERVICE_ROLE_KEY') || this.configService.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
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
  private formatData(data: any, format: string, analysisType?: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'table':
        return this.formatAsTable(data);
      case 'csv':
        return this.formatAsCsv(data);
      case 'summary':
        return this.formatAsSummary(data, analysisType);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Format data as ASCII table
   */
  private formatAsTable(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return 'No data to display';
    }

    const keys = Object.keys(data[0]);
    const maxWidths = keys.map(key => 
      Math.max(key.length, ...data.map(row => String(row[key] || '').length))
    );

    let table = '';
    
    // Header
    table += '| ' + keys.map((key, i) => key.padEnd(maxWidths[i] || 0)).join(' | ') + ' |\n';
    table += '| ' + maxWidths.map(width => '-'.repeat(width || 0)).join(' | ') + ' |\n';
    
    // Rows
    data.forEach(row => {
      table += '| ' + keys.map((key, i) => 
        String(row[key] || '').padEnd(maxWidths[i] || 0)
      ).join(' | ') + ' |\n';
    });

    return table;
  }

  /**
   * Format data as CSV
   */
  private formatAsCsv(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const keys = Object.keys(data[0]);
    const csv = [keys.join(',')];
    
    data.forEach(row => {
      csv.push(keys.map(key => {
        const value = row[key];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : String(value || '');
      }).join(','));
    });

    return csv.join('\n');
  }

  /**
   * Format data as summary with analysis
   */
  private formatAsSummary(data: any[], analysisType?: string): string {
    if (!Array.isArray(data)) {
      return JSON.stringify(data, null, 2);
    }

    let summary = `Data Summary (${data.length} records)\n\n`;
    
    if (data.length > 0) {
      const keys = Object.keys(data[0]);
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

  /**
   * Create error response
   */
  private createErrorResponse(message: string): MCPToolResponse {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: message,
          timestamp: new Date().toISOString()
        })
      }],
      isError: true
    };
  }
}