import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { LLMService } from '../../../llms/llm.service';
import { isLLMResponse } from '@/llms/services/llm-interfaces';
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
} from '../../interfaces/mcp.interface';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  // Handle Supabase error objects
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Database result type for exec_sql RPC
 */
interface ExecSqlResult {
  error?: boolean;
  message?: string;
  code?: string;
  [key: string]: unknown;
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
    private llmService: LLMService,
  ) {
    // Initialize Supabase client with configuration service
    const supabaseUrl =
      this.configService.get<string>('supabase.url') ||
      this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey =
      this.configService.get<string>('supabase.serviceKey') ||
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required',
      );
    }

    this.supabaseUrl = supabaseUrl;
    this.supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
    ) as SupabaseClient;

    // Point to context directory - handle both development and production paths
    // In development: process.cwd() = project root
    // In production: process.cwd() = apps/api (where the server runs from)

    let contextPath: string;
    const devPath = join(
      process.cwd(),
      'apps/api/src/mcp/services/supabase/context',
    );
    const prodPath = join(process.cwd(), 'src/mcp/services/supabase/context');

    // Try development path first (from project root)
    if (existsSync(join(devPath, 'core-schema.md'))) {
      contextPath = devPath;
    }
    // Try production path (from apps/api directory)
    else if (existsSync(join(prodPath, 'core-schema.md'))) {
      contextPath = prodPath;
    }
    // Try relative to __dirname as fallback
    else if (existsSync(join(__dirname, 'context/core-schema.md'))) {
      contextPath = join(__dirname, 'context');
    } else {
      throw new Error(
        `Context files not found. Tried paths: ${devPath}, ${prodPath}, ${join(__dirname, 'context')}`,
      );
    }

    this.contextPath = contextPath;
  }

  /**
   * Initialize the MCP server
   */
  initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();

    // Mark as initialized - connection will be tested when first used
    this.initialized = true;
    console.log('✅ Supabase MCP Server initialized successfully');
    return Promise.resolve();
  }

  /**
   * Get server information (MCP standard method)
   */
  getServerInfo(): Promise<MCPServerInfo> {
    return Promise.resolve({
      protocolVersion: '2025-03-26',
      serverInfo: {
        name: 'Supabase Data MCP Server',
        version: '1.0.0',
        description:
          'Context-driven SQL generation and database operations for Supabase',
      },
      capabilities: {
        tools: {
          listChanged: false,
        },
        resources: {
          subscribe: false,
          listChanged: false,
        },
        prompts: {
          listChanged: false,
        },
        logging: {},
      },
    });
  }

  /**
   * List available tools (MCP standard method)
   */
  listTools(): Promise<MCPToolDefinition[]> {
    return Promise.resolve([
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
              description:
                'Tables that should be included in the SQL generation context',
            },
            domain_hint: {
              type: 'string',
              description:
                'Domain hint for context selection (e.g., KPI & Analytics)',
            },
            max_rows: {
              type: 'number',
              default: 100,
              description: 'Maximum rows to return (adds LIMIT clause)',
            },
            provider: {
              type: 'string',
              enum: ['openai', 'anthropic', 'google', 'grok', 'ollama'],
              description: 'LLM provider to use for SQL generation',
            },
            model: {
              type: 'string',
              description: 'Specific model to use for SQL generation',
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
    ]);
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
          return this.handleGetSchema(
            request.arguments as SupabaseSchemaRequest,
          );

        case 'generate-sql':
          return await this.handleGenerateSQL(
            request.arguments as unknown as SupabaseSQLRequest,
          );

        case 'execute-sql':
          return await this.handleExecuteSQL(
            request.arguments as unknown as SupabaseExecuteRequest,
          );

        case 'analyze-results':
          return await this.handleAnalyzeResults(
            request.arguments as unknown as SupabaseAnalyzeRequest,
          );

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${request.name}`,
              },
            ],
            isError: true,
            _meta: {
              error_type: 'unknown_tool',
              available_tools: [
                'get-schema',
                'generate-sql',
                'execute-sql',
                'analyze-results',
              ],
            },
          };
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        content: [
          {
            type: 'text',
            text: `Tool execution failed: ${getErrorMessage(error)}`,
          },
        ],
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
  private handleGetSchema(args: SupabaseSchemaRequest): MCPToolResponse {
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
        schemaContent =
          this.readContextFile('core-schema.md') +
          '\n\n' +
          this.readContextFile('kpi-schema.md');
      }

      // Add relationships if multiple domains are involved
      if (
        (!domain && tables && this.isKpiTables(tables)) ||
        (!domain && tables && this.hasCrossDomainTables(tables))
      ) {
        schemaContent += '\n\n' + this.readContextFile('relationships.md');
      }

      // Filter schema for specific tables if requested
      if (tables && tables.length > 0) {
        schemaContent = this.filterSchemaByTables(schemaContent, tables);
      }

      return {
        content: [
          {
            type: 'text',
            text: schemaContent,
          },
        ],
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
  private async handleGenerateSQL(
    args: SupabaseSQLRequest,
  ): Promise<MCPToolResponse> {
    const {
      query,
      tables,
      domain_hint,
      max_rows = 100,
      provider,
      model,
    } = args;

    console.log('\n[MCP-SQL-DEBUG] ====== handleGenerateSQL START ======');
    console.log('[MCP-SQL-DEBUG] Input args:', {
      query,
      tables,
      domain_hint,
      max_rows,
      provider,
      model,
    });
    console.log('[MCP-SQL-DEBUG] Full args object:', JSON.stringify(args));

    try {
      // Get relevant schema context for specified tables
      console.log(
        '[MCP-SQL-DEBUG] Building schema context for tables:',
        tables,
      );
      const schemaContext = this.buildSchemaContext(tables, domain_hint);
      console.log(
        '[MCP-SQL-DEBUG] Schema context length:',
        schemaContext.length,
      );
      console.log(
        '[MCP-SQL-DEBUG] Schema context preview:',
        schemaContext.substring(0, 500),
      );

      // Generate SQL using LLM with proper schema context
      console.log('[MCP-SQL-DEBUG] Calling generateSQLFromQuery...');
      const generatedSQL = await this.generateSQLFromQuery(
        query,
        tables,
        schemaContext,
        max_rows,
        provider,
        model,
      );
      console.log('[MCP-SQL-DEBUG] Generated SQL:', generatedSQL);

      // Return structured JSON so clients can reliably parse { sql, ... }
      const responsePayload = {
        sql: generatedSQL,
        explanation:
          'SQL generated from natural language using context-driven schema.',
        tables_used: tables || [],
        max_rows,
        domain_hint: domain_hint || null,
      };

      const response: MCPToolResponse = {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(responsePayload),
          },
        ],
        _meta: {
          query_type: 'sql_generation',
          tables_context: tables,
          domain_hint: domain_hint,
          max_rows: max_rows,
        },
      };

      console.log('[MCP-SQL-DEBUG] Response prepared successfully');
      console.log('[MCP-SQL-DEBUG] ====== handleGenerateSQL END ======\n');
      return response;
    } catch (error) {
      console.error('[MCP-SQL-DEBUG] ERROR in handleGenerateSQL:', error);
      console.error(
        '[MCP-SQL-DEBUG] Error stack:',
        error instanceof Error ? error.stack : 'No stack',
      );
      throw new Error(`SQL generation failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Handle execute-sql tool
   */
  private async handleExecuteSQL(
    args: SupabaseExecuteRequest,
  ): Promise<MCPToolResponse> {
    const { sql, max_rows = 1000 } = args;
    const startTime = Date.now();

    try {
      // Validate SQL parameter
      if (!sql || typeof sql !== 'string') {
        throw new Error(
          `Missing or invalid 'sql' parameter. Received: ${typeof sql}. Args: ${JSON.stringify(args).substring(0, 200)}`,
        );
      }

      // Security validation - deny destructive operations (PRD §7)
      // Use word boundaries to avoid false positives with column names like "updated_at"
      const deniedOperations = [
        'DROP',
        'TRUNCATE',
        'ALTER',
        'DELETE',
        'UPDATE',
      ];
      const sqlUpper = sql.toUpperCase();

      for (const operation of deniedOperations) {
        // Use regex with word boundaries to match only the SQL keyword, not substrings
        const regex = new RegExp(`\\b${operation}\\b`, 'i');
        if (regex.test(sqlUpper)) {
          throw new Error(
            `Security violation: Operation '${operation}' is not allowed in read-only mode. Denied operations: ${deniedOperations.join(', ')}`,
          );
        }
      }

      // Add LIMIT if not present and max_rows specified
      let finalSQL = sql.trim();

      // Remove trailing semicolon which causes syntax errors in the exec_sql function
      if (finalSQL.endsWith(';')) {
        finalSQL = finalSQL.slice(0, -1);
      }

      if (!finalSQL.toLowerCase().includes('limit') && max_rows) {
        finalSQL += ` LIMIT ${max_rows}`;
      }

      // Execute SQL using Supabase RPC function
      console.log('[SUPABASE-EXEC] ====== EXECUTING SQL ======');
      console.log('[SUPABASE-EXEC] SQL:', finalSQL);
      console.log('[SUPABASE-EXEC] max_rows:', max_rows);

      const rpcResponse = await this.supabaseClient.rpc('exec_sql', {
        query: finalSQL,
      });
      const { data: result, error } = rpcResponse as {
        data: unknown;
        error: unknown;
      };

      console.log('[SUPABASE-EXEC] Response error:', error);
      console.log('[SUPABASE-EXEC] Response data type:', typeof result);
      console.log(
        '[SUPABASE-EXEC] Response data:',
        JSON.stringify(result).substring(0, 500),
      );

      const executionTime = Date.now() - startTime;

      if (error) {
        throw new Error(`SQL execution error: ${getErrorMessage(error)}`);
      }

      const data = result as ExecSqlResult | ExecSqlResult[] | null;
      // Check if the data itself is an error object (returned by exec_sql function)
      if (
        data &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        data.error === true
      ) {
        throw new Error(
          `SQL execution error: ${data.message} (Code: ${data.code})`,
        );
      }

      const results = Array.isArray(data) ? data : [];
      const columns =
        results.length > 0 && results[0] ? Object.keys(results[0]) : [];

      // Return structured JSON so clients can reliably parse { data, ... }
      const payload = {
        data: results,
        row_count: results.length,
        execution_time_ms: executionTime,
        columns,
        sql_executed: finalSQL,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload),
          },
        ],
        _meta: {
          query_type: 'sql_execution',
          row_count: results.length,
          execution_time_ms: executionTime,
          columns_returned: columns.length,
          columns: columns,
          sql_executed: finalSQL,
        },
      };
    } catch (_error) {
      const executionTime = Date.now() - startTime;
      throw new Error(
        `SQL execution failed after ${executionTime}ms: ${getErrorMessage(_error)}`,
      );
    }
  }

  /**
   * Handle analyze-results tool
   */
  private async handleAnalyzeResults(
    args: SupabaseAnalyzeRequest,
  ): Promise<MCPToolResponse> {
    const {
      data,
      analysis_prompt,
      provider = 'anthropic',
      model = 'claude-3-5-sonnet-20241022',
    } = args;

    console.log('[ANALYZE-HANDLER] ====== handleAnalyzeResults CALLED ======');
    console.log(
      '[ANALYZE-HANDLER] Args received:',
      JSON.stringify(args).substring(0, 500),
    );
    console.log(
      '[ANALYZE-HANDLER] Data type:',
      typeof data,
      'isArray:',
      Array.isArray(data),
    );
    console.log(
      '[ANALYZE-HANDLER] Data length:',
      Array.isArray(data) ? data.length : 'N/A',
    );
    console.log('[ANALYZE-HANDLER] Provider:', provider, 'Model:', model);

    try {
      // Use LLM service for analysis
      const analysis = await this.generateLLMAnalysis(
        data,
        analysis_prompt,
        provider,
        model,
      );

      // Format analysis as clean string for the 4-step architecture
      const analysisText =
        typeof analysis === 'object'
          ? JSON.stringify(analysis, null, 2)
          : String(analysis);

      return {
        content: [
          {
            type: 'text',
            text: analysisText, // Return clean analysis string
          },
        ],
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
    const filePath = join(this.contextPath, filename);
    return readFileSync(filePath, 'utf-8');
  }

  private isKpiTables(tables: string[]): boolean {
    const kpiTables = [
      'companies',
      'departments',
      'kpi_metrics',
      'kpi_goals',
      'kpi_data',
    ];
    return tables.some((table) => kpiTables.includes(table.toLowerCase()));
  }

  private isCoreTables(tables: string[]): boolean {
    const coreTables = [
      'users',
      'conversations',
      'messages',
      'tasks',
      'agents',
      'projects',
      'deliverables',
    ];
    return tables.some((table) => coreTables.includes(table.toLowerCase()));
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

  private filterSchemaByTables(
    schemaContent: string,
    tables: string[],
  ): string {
    // Simple filtering - in production, you'd want more sophisticated parsing
    const tableNames = tables.map((t) => t.toLowerCase());
    const lines = schemaContent.split('\n');
    const filtered: string[] = [];
    let includeSection = false;

    for (const line of lines) {
      // Check if this line starts a table section
      if (
        line.startsWith('### ') &&
        tableNames.some((table) => line.toLowerCase().includes(table))
      ) {
        includeSection = true;
        filtered.push(line);
      } else if (line.startsWith('### ')) {
        includeSection = false;
      } else if (
        includeSection ||
        line.startsWith('#') ||
        line.startsWith('##')
      ) {
        filtered.push(line);
      }
    }

    return filtered.join('\n');
  }

  private buildSchemaContext(tables?: string[], domain_hint?: string): string {
    console.log(
      '[MCP-SQL-DEBUG] buildSchemaContext - tables:',
      tables,
      'domain_hint:',
      domain_hint,
    );
    let context = '';

    // Add relevant schema information
    // If no tables specified, include all schemas to let LLM infer
    const isKpi = tables ? this.isKpiTables(tables) : true;
    const isCore = tables ? this.isCoreTables(tables) : true;
    console.log(
      '[MCP-SQL-DEBUG] Table classification - isKpi:',
      isKpi,
      'isCore:',
      isCore,
    );

    if (domain_hint?.toLowerCase().includes('kpi') || isKpi) {
      console.log('[MCP-SQL-DEBUG] Adding KPI schema context');
      context += this.readContextFile('kpi-schema.md') + '\n\n';
    }

    if (isCore) {
      console.log('[MCP-SQL-DEBUG] Adding Core schema context');
      context += this.readContextFile('core-schema.md') + '\n\n';
    }

    // Add SQL patterns for reference
    console.log('[MCP-SQL-DEBUG] Adding SQL patterns');
    context += this.readContextFile('sql-patterns.md');

    // Only filter if tables are specified
    if (tables && tables.length > 0) {
      const filtered = this.filterSchemaByTables(context, tables);
      console.log(
        '[MCP-SQL-DEBUG] Context after filtering - length:',
        filtered.length,
      );
      return filtered;
    }

    console.log(
      '[MCP-SQL-DEBUG] No tables filter, returning full context - length:',
      context.length,
    );
    return context;
  }

  private async generateSQLFromQuery(
    query: string,
    tables: string[] | undefined,
    schemaContext: string,
    maxRows: number,
    provider?: string,
    model?: string,
  ): Promise<string> {
    console.log('[MCP-SQL-DEBUG] generateSQLFromQuery START');
    console.log('[MCP-SQL-DEBUG] Query:', query);
    console.log('[MCP-SQL-DEBUG] Tables:', tables);
    console.log('[MCP-SQL-DEBUG] MaxRows:', maxRows);

    // Let LLMService choose the best available provider/model combination
    // This allows the system to route to local models (Ollama) when available
    // or fall back to external providers as needed
    console.log(
      '[MCP-SQL-DEBUG] Using system default routing for provider/model selection',
    );
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

${tables ? `Available tables to query: ${tables.join(', ')}\n` : ''}Maximum rows to return: ${maxRows}

Return ONLY the SQL query, no explanation or formatting.`;

    try {
      console.log('[MCP-SQL-DEBUG] Calling llmService.generateResponse...');
      console.log('[MCP-SQL-DEBUG] System prompt length:', systemPrompt.length);
      console.log('[MCP-SQL-DEBUG] User prompt:', userPrompt);

      // Build options for LLM service
      const generateOptions: {
        temperature?: number;
        maxTokens?: number;
        callerType?: string;
        callerName?: string;
        dataClassification?: string;
        providerName?: string;
        modelName?: string;
        includeMetadata?: boolean;
        provider?: 'openai' | 'anthropic' | 'google' | 'ollama';
        cidafmOptions?: Record<string, unknown>;
        complexity?: 'simple' | 'medium' | 'complex' | 'reasoning';
      } = {
        temperature: 0.1,
        maxTokens: 1000,
        callerType: 'service' as const,
        callerName: 'supabase-mcp-service',
        dataClassification: 'internal' as const,
        providerName: provider,
        modelName: model,
        includeMetadata: false,
        provider: provider as
          | 'openai'
          | 'anthropic'
          | 'google'
          | 'ollama'
          | undefined,
      };
      console.log('[MCP-SQL-DEBUG] LLM params:', generateOptions);

      const response = await this.llmService.generateResponse(
        systemPrompt,
        userPrompt,
        generateOptions,
      );

      const responseIsLLM = isLLMResponse(response);

      console.log(
        '[MCP-SQL-DEBUG] LLM response received - type:',
        typeof response,
      );
      console.log(
        '[MCP-SQL-DEBUG] Response has content:',
        responseIsLLM ? !!response.content : false,
      );
      console.log(
        '[MCP-SQL-DEBUG] Response content type:',
        responseIsLLM ? typeof response.content : typeof response,
      );

      // Extract the actual response text from the LLM service response
      // The response is now an LLMResponse object with content and metadata
      let responseText: string;
      if (typeof response === 'string') {
        responseText = response;
        console.log('[MCP-SQL-DEBUG] Using string response directly');
      } else if (responseIsLLM) {
        responseText = response.content;
        console.log(
          '[MCP-SQL-DEBUG] Extracted content from LLM response object',
        );
      } else {
        responseText = String(response ?? '');
        console.log('[MCP-SQL-DEBUG] Using fallback string conversion');
      }

      console.log('[MCP-SQL-DEBUG] Extracted response text:', responseText);
      console.log('[MCP-SQL-DEBUG] Response text type:', typeof responseText);

      // Ensure we have a string to work with
      if (typeof responseText !== 'string') {
        responseText = String(responseText);
      }

      // Clean up the response to ensure it's just SQL
      let sql = responseText.trim();
      console.log('[MCP-SQL-DEBUG] Trimmed SQL:', sql);

      // Handle models that return structured responses with thinking
      // Some models return JSON like: { thinking: "...", sql: "..." }
      // Others return text with <thinking>...</thinking> tags
      if (sql.includes('<thinking>') && sql.includes('</thinking>')) {
        // Remove thinking tags and their content
        sql = sql.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
        console.log('[MCP-SQL-DEBUG] Removed <thinking> tags');
      }

      // Try to parse as JSON in case model returned structured response
      if (sql.startsWith('{') && sql.endsWith('}')) {
        try {
          const parsed = JSON.parse(sql) as Record<string, unknown>;
          if (parsed.sql) {
            sql = parsed.sql as string;
            console.log('[MCP-SQL-DEBUG] Extracted SQL from JSON response');
          } else if (parsed.query) {
            sql = parsed.query as string;
            console.log('[MCP-SQL-DEBUG] Extracted query from JSON response');
          } else if (parsed.result) {
            sql = parsed.result as string;
            console.log('[MCP-SQL-DEBUG] Extracted result from JSON response');
          }
        } catch {
          // Not valid JSON, continue with raw text
          console.log(
            '[MCP-SQL-DEBUG] Not a JSON response, continuing with raw text',
          );
        }
      }

      // If the response contains both thinking and SQL, extract just the SQL
      // Look for the SELECT statement and take everything from there
      if (sql.includes('SELECT') && !sql.startsWith('SELECT')) {
        const selectIndex = sql.indexOf('SELECT');
        // Check if there's thinking text before SELECT
        const beforeSelect = sql.substring(0, selectIndex);
        if (beforeSelect.length > 50) {
          // Likely contains thinking
          sql = sql.substring(selectIndex);
          console.log(
            '[MCP-SQL-DEBUG] Extracted SQL starting from SELECT statement',
          );
        }
      }

      // Remove common markdown formatting that might appear
      sql = sql.replace(/^```sql\n/, '').replace(/\n```$/, '');
      sql = sql.replace(/^```\n/, '').replace(/\n```$/, '');
      sql = sql.replace(/^```sql/, '').replace(/```$/, '');

      // Additional cleanup for edge cases
      sql = sql.trim();
      console.log('[MCP-SQL-DEBUG] Generated SQL:', sql);

      // Final guardrail: normalize any lingering 'sales' filters to revenue
      // and prefer km.name LIKE '%revenue%'
      const canonicalRewrites: Array<{ pattern: RegExp; replace: string }> = [
        {
          pattern: /km\.name\s+ILIKE\s+'%\s*sales\s*%'/gi,
          replace: "km.name ILIKE '%Revenue%'",
        },
        {
          pattern: /km\.name\s+LIKE\s+'%\s*sales\s*%'/gi,
          replace: "km.name ILIKE '%Revenue%'",
        },
        {
          pattern: /km\.name\s*=\s*'\s*sales\s*'/gi,
          replace: "km.name ILIKE '%Revenue%'",
        },
        {
          pattern: /km\.metric_type\s+ILIKE\s+'%\s*sales\s*%'/gi,
          replace: "km.name ILIKE '%Revenue%'",
        },
        {
          pattern: /km\.name\s+ILIKE\s+'%\s*revenue\s*%'/gi,
          replace: "km.name ILIKE '%Revenue%'",
        },
        {
          pattern: /km\.name\s+LIKE\s+'%\s*revenue\s*%'/gi,
          replace: "km.name ILIKE '%Revenue%'",
        },
        {
          pattern: /km\.name\s*=\s*'\s*Revenue\s*'/g,
          replace: "km.name ILIKE '%Revenue%'",
        },
      ];
      canonicalRewrites.forEach((r) => {
        if (r.pattern.test(sql)) sql = sql.replace(r.pattern, r.replace);
      });
      if (/\btotal_sales\b/i.test(sql))
        sql = sql.replace(/\btotal_sales\b/gi, 'total_revenue');

      // Validate that we have meaningful SQL content
      if (
        !sql ||
        sql.length < 10 ||
        sql === 'SELECT' ||
        sql === 'SELECT ' ||
        !sql.includes(' ')
      ) {
        console.log('[MCP-SQL-DEBUG] Invalid or incomplete SQL detected:', sql);
        throw new Error(
          `LLM generated incomplete or invalid SQL: "${sql}". The LLM response was too short or incomplete.`,
        );
      }

      // Ensure this is actually a SELECT statement
      if (!sql.toLowerCase().trim().startsWith('select')) {
        console.log(
          '[MCP-SQL-DEBUG] Generated content is not a SELECT statement:',
          sql,
        );
        throw new Error(
          `LLM did not generate a valid SELECT statement. Generated: "${sql}"`,
        );
      }

      // Remove trailing semicolon - PostgreSQL functions don't handle them well
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
      console.log(`Tables: ${tables ? tables.join(', ') : 'auto-detected'}`);
      console.log('Generated SQL:');
      console.log(sql);
      console.log('='.repeat(50));

      return sql;
    } catch (error) {
      // Do NOT fallback to a generic SELECT *; surface the failure for proper handling
      const msg = getErrorMessage(error);
      console.error('[MCP-SQL-DEBUG] ERROR in generateSQLFromQuery:', msg);
      console.error('[MCP-SQL-DEBUG] Full error:', error);
      console.error(
        '[MCP-SQL-DEBUG] Error stack:',
        error instanceof Error ? error.stack : 'No stack',
      );
      console.error('[MCP-SQL-DEBUG] userPrompt:', userPrompt);
      console.error('[MCP-SQL-DEBUG] tables:', tables);

      if (process.env.MCP_SQL_DEBUG === 'true') {
        console.error('[MCP SQL DEBUG] generation failed:', msg);
        console.error('[MCP SQL DEBUG] userPrompt:', userPrompt);
        console.error('[MCP SQL DEBUG] tables:', tables);
      }
      throw new Error(`LLM SQL generation failed: ${msg}`);
    }
  }

  private async generateLLMAnalysis(
    data: Array<Record<string, unknown>>,
    prompt: string,
    provider: string,
    model: string,
  ): Promise<Record<string, unknown>> {
    try {
      console.log('[SUPABASE-ANALYZE] ====== ANALYZING RESULTS ======');
      console.log('[SUPABASE-ANALYZE] Data length:', data.length);
      console.log(
        '[SUPABASE-ANALYZE] Data received:',
        JSON.stringify(data).substring(0, 500),
      );
      console.log('[SUPABASE-ANALYZE] Prompt:', prompt);
      console.log('[SUPABASE-ANALYZE] Provider:', provider);
      console.log('[SUPABASE-ANALYZE] Model:', model);

      const analysisPrompt = `Analyze the following data and provide insights based on this request: "${prompt}"

Data (${data.length} records):
${JSON.stringify(data.slice(0, 10), null, 2)}${data.length > 10 ? '\n... (showing first 10 records)' : ''}

CRITICAL: Use ONLY the actual numbers from the data above. Do NOT make up numbers. Do NOT hallucinate.

Please provide:
1. Key insights from the data
2. Patterns or trends identified
3. Actionable recommendations
4. Data quality observations
5. Summary statistics where relevant

Format your response as a structured JSON object with these sections.`;

      // Resolve local-only if requested
      const forceLocal =
        (process.env.MCP_LOCAL_ONLY || process.env.SOVEREIGN_MODE_ENFORCED) ===
        'true';
      let providerName = (
        provider ||
        process.env.MCP_SQL_PROVIDER ||
        ''
      ).toLowerCase();
      let modelName =
        model ||
        process.env.MCP_SQL_ANALYSIS_MODEL ||
        process.env.MCP_SQL_MODEL ||
        '';
      if (forceLocal) {
        providerName = 'ollama';
        if (!modelName) {
          try {
            // TODO: Fix this - getBestModelForTask doesn't exist on llmService
            const best = null; // await this.llmService.getBestModelForTask('medium', false, 'fast');
            modelName =
              best || process.env.LOCAL_LLM_DEFAULT_MODEL || 'llama3.2:latest';
          } catch {
            modelName =
              process.env.LOCAL_LLM_DEFAULT_MODEL || 'llama3.2:latest';
          }
        }
      }

      const response = await this.llmService.generateResponse(
        'You are a data analyst providing insights on business data.',
        analysisPrompt,
        {
          providerName: providerName || 'ollama',
          modelName: modelName || 'gpt-oss:20b',
          temperature: 0.3,
          maxTokens: 1500,
          callerType: 'service',
          callerName: 'supabase-mcp-service',
          dataClassification: 'internal',
          // Keep lean responses to reduce debug noise
          includeMetadata: false,
        },
      );

      // Extract the actual response text from the LLM service response
      // The response is now an LLMResponse object with content and metadata
      const analysisIsLLM = isLLMResponse(response);
      const responseText =
        typeof response === 'string'
          ? response
          : analysisIsLLM
            ? response.content
            : JSON.stringify(response ?? '');

      // Ensure we have a string to work with
      if (typeof responseText !== 'string') {
        throw new Error(
          `Expected string response, got ${typeof responseText}: ${JSON.stringify(responseText)}`,
        );
      }

      // Clean up the response text
      let analysisText = responseText.trim();

      // Handle models that return structured responses with thinking
      if (
        analysisText.includes('<thinking>') &&
        analysisText.includes('</thinking>')
      ) {
        // Remove thinking tags and their content
        analysisText = analysisText
          .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
          .trim();
      }

      // Try to parse as JSON, fallback to structured text
      try {
        return JSON.parse(analysisText) as Record<string, unknown>;
      } catch {
        return {
          analysis: analysisText,
          data_summary: {
            row_count: data.length,
            columns: data.length > 0 && data[0] ? Object.keys(data[0]) : [],
          },
        };
      }
    } catch {
      // Fallback analysis
      return this.generateSimpleAnalysis(data, prompt);
    }
  }

  private generateSimpleAnalysis(
    data: Array<Record<string, unknown>>,
    prompt: string,
  ): Record<string, unknown> {
    const rowCount = data.length;
    const columns = rowCount > 0 && data[0] ? Object.keys(data[0]) : [];

    return {
      analysis: `Analysis of ${rowCount} records with ${columns.length} columns for: "${prompt}"`,
      insights: [
        `Dataset contains ${rowCount} rows`,
        `Available columns: ${columns.join(', ')}`,
        `Data analysis requested: "${prompt}"`,
      ],
      recommendations: [
        'Consider filtering data for more specific insights',
        'Use time-based analysis for trend identification',
        'Apply statistical methods for deeper analysis',
      ],
      data_summary: {
        row_count: rowCount,
        column_count: columns.length,
        columns: columns,
      },
    };
  }
}
