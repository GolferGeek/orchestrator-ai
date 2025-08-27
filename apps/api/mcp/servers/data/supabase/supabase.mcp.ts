import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { LLMService } from '../../../../src/llms/llm.service';
import {
  IMCPServer,
  MCPServerInfo,
  MCPToolDefinition,
  MCPToolRequest,
  MCPToolResponse,
  SupabaseSchemaRequest,
  SupabaseSQLRequest,
  SupabaseExecuteRequest,
  SupabaseAnalyzeRequest,
} from '../../../clients/mcp-client.interface';
import { readFileSync } from 'fs';
import { join } from 'path';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  // Handle Supabase error objects
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return String(error);
}

/**
 * Supabase MCP Server
 * 
 * HTTP-based MCP server implementing 2025-03-26 specification
 * Context-driven SQL generation using schema files, not database introspection
 */
export class SupabaseMCPServer implements IMCPServer {
  private supabaseClient: SupabaseClient;
  private contextPath: string;
  private initialized = false;
  private supabaseUrl: string;

  constructor(
    private configService: ConfigService,
    private llmService: LLMService
  ) {
    // Initialize Supabase client with configuration service
    const supabaseUrl = 
      this.configService.get<string>('supabase.url') ||
      this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = 
      this.configService.get<string>('supabase.serviceKey') ||
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    }

    this.supabaseUrl = supabaseUrl;
    this.supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    // Point to source context directory, adjusting for current working directory
    // If we're running from the root, use the full path
    // If we're running from apps/api, use the relative path
    const cwd = process.cwd();
    if (cwd.endsWith('apps/api')) {
      this.contextPath = join(cwd, 'mcp/servers/data/supabase/context');
    } else {
      this.contextPath = join(cwd, 'apps/api/mcp/servers/data/supabase/context');
    }
  }

  /**
   * Initialize the MCP server
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Mark as initialized - connection will be tested when first used
    this.initialized = true;
    console.log('✅ Supabase MCP Server initialized successfully');
  }

  /**
   * Get server information (MCP standard method)
   */
  async getServerInfo(): Promise<MCPServerInfo> {
    return {
      name: 'Supabase Data MCP Server',
      version: '1.0.0',
      description: 'Context-driven SQL generation and database operations for Supabase',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
        logging: true,
      },
      metadata: {
        domain: 'data',
        transport: 'http',
        context_driven: true,
        supabase_url: this.supabaseUrl,
        supported_schemas: ['core', 'kpi'],
      },
    };
  }

  /**
   * List available tools (MCP standard method)
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    return [
      {
        name: 'get-schema',
        description: 'Get database schema information for specified tables',
        inputSchema: {
          type: 'object',
          properties: {
            tables: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific tables to include in schema (optional)',
            },
            domain: {
              type: 'string',
              enum: ['core', 'kpi'],
              description: 'Schema domain: core (platform) or kpi (analytics)',
            },
          },
          required: [],
        },
      },
      {
        name: 'generate-sql',
        description: 'Generate SQL from natural language using table context',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language query description',
            },
            tables: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tables that should be included in the SQL generation context',
            },
            domain_hint: {
              type: 'string',
              description: 'Domain hint for context selection (e.g., KPI & Analytics)',
            },
            max_rows: {
              type: 'number',
              default: 100,
              description: 'Maximum rows to return (adds LIMIT clause)',
            },
          },
          required: ['query', 'tables'],
        },
      },
      {
        name: 'execute-sql',
        description: 'Execute SQL query and return results',
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'SQL query to execute',
            },
            max_rows: {
              type: 'number',
              default: 1000,
              description: 'Maximum rows to return',
            },
            timeout: {
              type: 'number',
              default: 30000,
              description: 'Query timeout in milliseconds',
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'analyze-results',
        description: 'Analyze query results with LLM for insights',
        inputSchema: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              description: 'Query result data to analyze',
            },
            analysis_prompt: {
              type: 'string',
              description: 'Specific analysis request or question',
            },
            provider: {
              type: 'string',
              enum: ['anthropic', 'openai', 'google'],
              default: 'anthropic',
              description: 'LLM provider for analysis',
            },
            model: {
              type: 'string',
              default: 'claude-3-5-sonnet-20241022',
              description: 'Specific model to use for analysis',
            },
          },
          required: ['data', 'analysis_prompt'],
        },
      },
    ];
  }

  /**
   * Execute a tool call (MCP standard method)
   */
  async callTool(request: MCPToolRequest): Promise<MCPToolResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      switch (request.name) {
        case 'get-schema':
          return await this.handleGetSchema(request.arguments as SupabaseSchemaRequest);
        
        case 'generate-sql':
          return await this.handleGenerateSQL(request.arguments as SupabaseSQLRequest);
        
        case 'execute-sql':
          return await this.handleExecuteSQL(request.arguments as SupabaseExecuteRequest);
        
        case 'analyze-results':
          return await this.handleAnalyzeResults(request.arguments as SupabaseAnalyzeRequest);
        
        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown tool: ${request.name}`,
            }],
            isError: true,
            _meta: {
              error_type: 'unknown_tool',
              available_tools: ['get-schema', 'generate-sql', 'execute-sql', 'analyze-results'],
            },
          };
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        content: [{
          type: 'text',
          text: `Tool execution failed: ${getErrorMessage(error)}`,
        }],
        isError: true,
        _meta: {
          error_type: 'execution_error',
          error_message: getErrorMessage(error),
          execution_time_ms: executionTime,
          tool_name: request.name,
        },
      };
    }
  }

  /**
   * Handle get-schema tool
   */
  private async handleGetSchema(args: SupabaseSchemaRequest): Promise<MCPToolResponse> {
    const { tables, domain } = args || {};

    try {
      let schemaContent = '';

      // Determine which schema files to read based on domain and tables
      if (domain === 'kpi' || (tables && this.isKpiTables(tables))) {
        schemaContent += this.readContextFile('kpi-schema.md') + '\n\n';
      } 
      
      if (domain === 'core' || (tables && this.isCoreTables(tables))) {
        schemaContent += this.readContextFile('core-schema.md') + '\n\n';
      }

      // If no specific domain and no tables specified, provide overview
      if (!domain && (!tables || tables.length === 0)) {
        schemaContent = this.readContextFile('core-schema.md') + '\n\n' + 
                       this.readContextFile('kpi-schema.md');
      }

      // Add relationships if multiple domains are involved
      if ((!domain && tables && this.isKpiTables(tables)) || 
          (!domain && tables && this.hasCrossDomainTables(tables))) {
        schemaContent += '\n\n' + this.readContextFile('relationships.md');
      }

      // Filter schema for specific tables if requested
      if (tables && tables.length > 0) {
        schemaContent = this.filterSchemaByTables(schemaContent, tables);
      }

      return {
        content: [{
          type: 'text',
          text: schemaContent,
        }],
        _meta: {
          domain: domain || 'mixed',
          tables_requested: tables || [],
          schema_files_used: this.getSchemaFilesUsed(domain, tables),
        },
      };
    } catch (error) {
      throw new Error(`Schema retrieval failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Handle generate-sql tool
   */
  private async handleGenerateSQL(args: SupabaseSQLRequest): Promise<MCPToolResponse> {
    const { query, tables, domain_hint, max_rows = 100 } = args;

    try {
      // Get relevant schema context for specified tables
      const schemaContext = await this.buildSchemaContext(tables, domain_hint);
      
      // Generate SQL using simple pattern matching and templates
      // In a production system, you'd integrate with a proper LLM here
      const generatedSQL = await this.generateSQLFromQuery(query, tables, schemaContext, max_rows);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            sql: generatedSQL,
            explanation: `Generated SQL for: "${query}" using tables: ${tables.join(', ')}`,
            tables_used: tables,
            estimated_rows: max_rows,
          }, null, 2),
        }],
        _meta: {
          query_type: 'sql_generation',
          tables_context: tables,
          domain_hint: domain_hint,
          max_rows: max_rows,
        },
      };
    } catch (error) {
      throw new Error(`SQL generation failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Handle execute-sql tool
   */
  private async handleExecuteSQL(args: SupabaseExecuteRequest): Promise<MCPToolResponse> {
    const { sql, max_rows = 1000 } = args;
    const startTime = Date.now();

    try {
      // Add LIMIT if not present and max_rows specified
      let finalSQL = sql.trim();
      
      // Remove trailing semicolon which causes syntax errors in the exec_sql function
      if (finalSQL.endsWith(';')) {
        finalSQL = finalSQL.slice(0, -1);
      }
      
      if (!finalSQL.toLowerCase().includes('limit') && max_rows) {
        finalSQL += ` LIMIT ${max_rows}`;
      }

      // Log the SQL before execution so it's available if execution fails
      console.log('\n🔍 EXECUTING SQL:');
      console.log('='.repeat(50));
      console.log(finalSQL);
      console.log('='.repeat(50));

      // Execute SQL using Supabase RPC function
      const { data, error } = await this.supabaseClient.rpc('exec_sql', {
        query: finalSQL,
      });

      const executionTime = Date.now() - startTime;

      // Debug logging to understand what we're getting back
      console.log('\n📊 SUPABASE RPC RESPONSE:');
      console.log('='.repeat(50));
      console.log('data:', JSON.stringify(data));
      console.log('data type:', typeof data);
      console.log('data is array:', Array.isArray(data));
      console.log('error:', JSON.stringify(error));
      console.log('='.repeat(50));

      if (error) {
        throw new Error(`SQL execution error: ${getErrorMessage(error)}`);
      }

      // Check if the data itself is an error object (returned by exec_sql function)
      if (data && typeof data === 'object' && data.error === true) {
        throw new Error(`SQL execution error: ${data.message} (Code: ${data.code})`);
      }

      const results = Array.isArray(data) ? data : [];
      const columns = results.length > 0 ? Object.keys(results[0]) : [];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: results,
            row_count: results.length,
            execution_time_ms: executionTime,
            columns: columns,
            sql_executed: finalSQL,
          }, null, 2),
        }],
        _meta: {
          query_type: 'sql_execution',
          row_count: results.length,
          execution_time_ms: executionTime,
          columns_returned: columns.length,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      throw new Error(`SQL execution failed after ${executionTime}ms: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Handle analyze-results tool
   */
  private async handleAnalyzeResults(args: SupabaseAnalyzeRequest): Promise<MCPToolResponse> {
    const { data, analysis_prompt, provider = 'anthropic', model = 'claude-3-5-sonnet-20241022' } = args;

    try {
      // For now, provide structured analysis without external LLM
      // In production, this would call the specified LLM provider
      const analysis = this.generateDataAnalysis(data, analysis_prompt);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(analysis, null, 2),
        }],
        _meta: {
          query_type: 'data_analysis',
          data_points: data.length,
          analysis_provider: provider,
          analysis_model: model,
        },
      };
    } catch (error) {
      throw new Error(`Data analysis failed: ${getErrorMessage(error)}`);
    }
  }

  // Helper Methods

  private readContextFile(filename: string): string {
    try {
      const filePath = join(this.contextPath, filename);
      return readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Context file ${filename} not found: ${getErrorMessage(error)}`);
    }
  }

  private isKpiTables(tables: string[]): boolean {
    const kpiTables = ['companies', 'departments', 'kpi_metrics', 'kpi_goals', 'kpi_data'];
    return tables.some(table => kpiTables.includes(table.toLowerCase()));
  }

  private isCoreTables(tables: string[]): boolean {
    const coreTables = ['users', 'conversations', 'messages', 'tasks', 'agents', 'projects', 'deliverables'];
    return tables.some(table => coreTables.includes(table.toLowerCase()));
  }

  private hasCrossDomainTables(tables: string[]): boolean {
    return this.isKpiTables(tables) && this.isCoreTables(tables);
  }

  private getSchemaFilesUsed(domain?: string, tables?: string[]): string[] {
    const filesUsed: string[] = [];
    
    if (domain === 'kpi' || (tables && this.isKpiTables(tables))) {
      filesUsed.push('kpi-schema.md');
    }
    
    if (domain === 'core' || (tables && this.isCoreTables(tables))) {
      filesUsed.push('core-schema.md');
    }

    if (!domain && !tables) {
      filesUsed.push('core-schema.md', 'kpi-schema.md');
    }

    return filesUsed;
  }

  private filterSchemaByTables(schemaContent: string, tables: string[]): string {
    // Simple filtering - in production, you'd want more sophisticated parsing
    const tableNames = tables.map(t => t.toLowerCase());
    const lines = schemaContent.split('\n');
    const filtered: string[] = [];
    let includeSection = false;

    for (const line of lines) {
      // Check if this line starts a table section
      if (line.startsWith('### ') && tableNames.some(table => 
        line.toLowerCase().includes(table)
      )) {
        includeSection = true;
        filtered.push(line);
      } else if (line.startsWith('### ')) {
        includeSection = false;
      } else if (includeSection || line.startsWith('#') || line.startsWith('##')) {
        filtered.push(line);
      }
    }

    return filtered.join('\n');
  }

  private async buildSchemaContext(tables: string[], domain_hint?: string): Promise<string> {
    let context = '';

    // Add relevant schema information
    if (domain_hint?.toLowerCase().includes('kpi') || this.isKpiTables(tables)) {
      context += this.readContextFile('kpi-schema.md') + '\n\n';
    }
    
    if (this.isCoreTables(tables)) {
      context += this.readContextFile('core-schema.md') + '\n\n';
    }

    // Add SQL patterns for reference
    context += this.readContextFile('sql-patterns.md');

    return this.filterSchemaByTables(context, tables);
  }

  private async generateSQLFromQuery(
    query: string, 
    tables: string[], 
    schemaContext: string, 
    maxRows: number
  ): Promise<string> {
    // Use LLM to generate SQL with proper schema context
    const systemPrompt = `You are an expert SQL query generator for a Supabase PostgreSQL database. 

IMPORTANT SCHEMA CONTEXT:
${schemaContext}

SQL GENERATION GUIDELINES:
1. Generate ONLY the SQL query without any explanation or markdown formatting
2. Use proper PostgreSQL syntax and functions
3. Always include LIMIT clause (max ${maxRows} rows)
4. Use appropriate JOINs based on the schema relationships
5. Use proper table aliases as shown in the schema guidelines
6. Filter by user_id where applicable for security
7. Use date functions like CURRENT_DATE, INTERVAL for time ranges
8. For KPI queries, join through departments to connect companies with kpi_data
9. Handle NULL values appropriately
10. Use DECIMAL precision for financial data

CRITICAL SCHEMA NOTES:
- Companies table uses 'name' column, NOT 'company_name'
- Revenue data is in kpi_data table linked through kpi_metrics
- Always use proper foreign key relationships for JOINs
- Use appropriate aggregation functions (SUM, COUNT, AVG) for metrics

Generate a SQL query that answers this request accurately and efficiently.`;

    const userPrompt = `Generate a PostgreSQL SQL query to: ${query}

Available tables to query: ${tables.join(', ')}
Maximum rows to return: ${maxRows}

Return ONLY the SQL query, no explanation or formatting.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userPrompt,
        {
          provider: 'anthropic',
          temperature: 0.1,
          maxTokens: 1000
        }
      );

      // Clean up the response to ensure it's just SQL
      let sql = response.trim();
      
      // Remove common markdown formatting that might appear
      sql = sql.replace(/^```sql\n/, '').replace(/\n```$/, '');
      sql = sql.replace(/^```\n/, '').replace(/\n```$/, '');
      
      // Remove trailing semicolon - PostgreSQL functions don't handle them well
      // Supabase uses PostgreSQL but when calling functions via RPC, 
      // semicolons can cause syntax errors in dynamic SQL execution
      if (sql.endsWith(';')) {
        sql = sql.slice(0, -1);
      }
      
      // Ensure LIMIT is present
      if (!sql.toLowerCase().includes('limit')) {
        sql += ` LIMIT ${maxRows}`;
      }
      
      // Log the generated SQL for debugging
      console.log('\n🧠 GENERATED SQL:');
      console.log('='.repeat(50));
      console.log(`Query: ${query}`);
      console.log(`Tables: ${tables.join(', ')}`);
      console.log('Generated SQL:');
      console.log(sql);
      console.log('='.repeat(50));
      
      return sql;
      
    } catch (error) {
      // Fallback to simple query if LLM fails
      console.warn('LLM SQL generation failed, using fallback:', getErrorMessage(error));
      const primaryTable = tables[0] || 'users';
      return `SELECT * FROM ${primaryTable} LIMIT ${maxRows};`;
    }
  }

  private generateDataAnalysis(data: any[], prompt: string): any {
    // Simple analysis without external LLM
    // In production, this would call the specified LLM provider
    
    const rowCount = data.length;
    const columns = rowCount > 0 ? Object.keys(data[0]) : [];
    
    return {
      analysis: `Analysis of ${rowCount} records with ${columns.length} columns.`,
      insights: [
        `Dataset contains ${rowCount} rows`,
        `Available columns: ${columns.join(', ')}`,
        `Prompt: "${prompt}"`,
      ],
      recommendations: [
        'Consider filtering data for more specific insights',
        'Use time-based analysis for trend identification',
      ],
      data_summary: {
        row_count: rowCount,
        column_count: columns.length,
        columns: columns,
      },
    };
  }
}