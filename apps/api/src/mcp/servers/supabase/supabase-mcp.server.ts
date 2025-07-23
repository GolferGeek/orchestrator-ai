import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { MCPServerBaseService } from '../base/mcp-server-base.service';
import {
  IMCPServer,
  MCPServerInfo,
  MCPToolRequest,
  MCPToolResponse,
  MCPListToolsResponse,
  MCPListResourcesResponse,
  MCPListPromptsResponse,
  MCPGetResourceRequest,
  MCPGetResourceResponse,
  MCPGetPromptRequest,
  MCPGetPromptResponse,
} from '../base/interfaces/mcp-server.interface';

// Services
import { SimpleSchemaService } from './services/simple-schema.service';
import { SQLGeneratorService } from './services/sql-generator.service';
import { QueryExecutorService } from './services/query-executor.service';

// Tools
import { GetSchemaTool } from './tools/get-schema.tool';
import { GenerateSQLTool } from './tools/generate-sql.tool';
import { ExecuteSQLTool } from './tools/execute-sql.tool';
import { QueryAndFormatTool } from './tools/query-and-format.tool';
import { ReadDataTool } from './tools/read-data.tool';

export interface SupabaseMCPConfig {
  supabaseUrl: string;
  supabaseKey: string;
  enableCaching: boolean;
  cacheTTL: number;
  maxQueryTimeout: number;
  sqlModels: string[];
}

@Injectable()
export class SupabaseMCPServer
  extends MCPServerBaseService
  implements IMCPServer
{
  private readonly serverLogger = new Logger(SupabaseMCPServer.name);
  private supabaseClient!: SupabaseClient;
  private simpleSchemaService!: SimpleSchemaService;
  private sqlGeneratorService!: SQLGeneratorService;
  private queryExecutorService!: QueryExecutorService;

  constructor() {
    super();
  }

  async getServerInfo(): Promise<MCPServerInfo> {
    return {
      name: 'Supabase MCP Server',
      version: '1.0.0',
      description:
        'MCP server for Supabase database operations with AI-powered SQL generation',
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
        logging: false,
      },
      metadata: {
        database_type: 'postgresql',
        features: [
          'schema_introspection',
          'sql_generation',
          'query_execution',
          'data_analysis',
        ],
        transport: 'http+sse',
        models_supported: [],
      },
    };
  }

  async initialize(config?: SupabaseMCPConfig): Promise<void> {
    if (!config) {
      throw new Error('Supabase MCP server requires configuration');
    }
    try {
      this.serverLogger.log('Initializing Supabase MCP Server...');

      // Import Supabase client dynamically to avoid potential issues
      const { createClient } = await import('@supabase/supabase-js');

      this.supabaseClient = createClient(
        config.supabaseUrl,
        config.supabaseKey,
      );

      // Initialize services
      this.simpleSchemaService = new SimpleSchemaService();
      // Note: SQLGeneratorService requires LLMService dependency - will need proper DI setup
      // this.sqlGeneratorService = new SQLGeneratorService();
      this.queryExecutorService = new QueryExecutorService();

      // Test connection with a simple query
      const { data, error } = await this.supabaseClient.rpc(
        'test_connection',
        {},
      );

      // If RPC doesn't exist, try a direct SQL query
      if (error && error.code === 'PGRST202') {
        // Try a basic query instead - check if we can access any tables
        const { data: tables, error: tablesError } = await this.supabaseClient
          .from('pg_tables')
          .select('tablename')
          .eq('schemaname', 'public')
          .limit(1);

        if (tablesError) {
          // Fall back to most basic test - just verify we can make a connection
          this.serverLogger.warn(
            'Cannot query system tables, testing basic connection...',
          );
          const { data: basicTest, error: basicError } =
            await this.supabaseClient
              .from('nonexistent_table_test')
              .select('*')
              .limit(1);

          // We expect this to fail, but if it fails with "relation does not exist"
          // that means we connected successfully
          if (
            basicError &&
            !basicError.message.includes('relation') &&
            !basicError.message.includes('does not exist')
          ) {
            throw new Error(
              `Failed to connect to Supabase: ${basicError.message}`,
            );
          }
        }
      } else if (error) {
        throw new Error(`Failed to connect to Supabase: ${error.message}`);
      }

      this.serverLogger.log('Supabase MCP Server initialized successfully');
    } catch (error) {
      this.serverLogger.error(
        'Failed to initialize Supabase MCP Server:',
        error,
      );
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      this.serverLogger.log('Shutting down Supabase MCP Server...');

      // Clear caches
      if (this.simpleSchemaService) {
        await this.simpleSchemaService.clearCache();
      }

      this.serverLogger.log('Supabase MCP Server shutdown complete');
    } catch (error) {
      this.serverLogger.error(
        'Error during Supabase MCP Server shutdown:',
        error,
      );
    }
  }

  async listTools(): Promise<MCPListToolsResponse> {
    return this.formatResponse({
      tools: [
        GetSchemaTool.getDefinition(),
        GenerateSQLTool.getDefinition(),
        ExecuteSQLTool.getDefinition(),
        QueryAndFormatTool.getDefinition(),
        ReadDataTool.getDefinition(),
      ],
    });
  }

  async callTool(
    request: MCPToolRequest,
    progressCallback?: (progress: any) => Promise<void>,
  ): Promise<MCPToolResponse> {
    try {
      this.serverLogger.debug(`Calling tool: ${request.name}`, {
        arguments: request.arguments,
      });

      switch (request.name) {
        case 'get-schema':
          return await GetSchemaTool.execute(
            request,
            this.supabaseClient,
            this.simpleSchemaService,
          );

        case 'generate-sql':
          return await GenerateSQLTool.execute(
            request,
            this.supabaseClient,
            this.simpleSchemaService,
            this.sqlGeneratorService,
          );

        case 'execute-sql':
          return await ExecuteSQLTool.execute(
            request,
            this.supabaseClient,
            this.queryExecutorService,
          );

        case 'query-and-format':
          return await QueryAndFormatTool.execute(
            request,
            this.supabaseClient,
            this.simpleSchemaService,
            this.sqlGeneratorService,
            this.queryExecutorService,
            progressCallback,
          );

        case 'read-data':
          return await ReadDataTool.execute(request, this.supabaseClient);

        default:
          return this.formatErrorResponse(
            `Unknown tool: ${request.name}`,
            request.name,
          );
      }
    } catch (error) {
      this.serverLogger.error(`Error calling tool ${request.name}:`, error);
      return this.formatErrorResponse(
        error instanceof Error ? error.message : 'Unknown error',
        request.name,
      );
    }
  }

  async listResources(): Promise<MCPListResourcesResponse> {
    try {
      // Get database schema to list tables as resources
      const schema = await this.simpleSchemaService.getSchema(
        this.supabaseClient,
      );

      const resources = [];

      // Add database schema as a resource
      resources.push({
        uri: 'supabase://schema/database',
        name: 'Database Schema',
        description:
          'Complete database schema with all tables, columns, and relationships',
        mimeType: 'application/json',
      });

      // Add each table as a resource
      if ('tables' in schema) {
        for (const table of schema.tables) {
          resources.push({
            uri: `supabase://table/${table.table_name}`,
            name: `Table: ${table.table_name}`,
            description: `Schema for table ${table.table_name} with ${table.sample_columns.length} columns`,
            mimeType: 'application/json',
          });
        }
      }

      return this.formatResponse({ resources });
    } catch (error) {
      this.serverLogger.error('Error listing resources:', error);
      return this.formatResponse({ resources: [] });
    }
  }

  async getResource(
    request: MCPGetResourceRequest,
  ): Promise<MCPGetResourceResponse> {
    try {
      const uri = request.uri;

      if (uri === 'supabase://schema/database') {
        // Return full database schema
        const schema = await this.simpleSchemaService.getSchema(
          this.supabaseClient,
        );
        return this.formatResponse({
          contents: [
            {
              uri: uri,
              mimeType: 'application/json',
              text: JSON.stringify(schema, null, 2),
            },
          ],
        });
      }

      if (uri.startsWith('supabase://table/')) {
        // Return specific table schema
        const tableName = uri.replace('supabase://table/', '');
        const tableSchema = await this.simpleSchemaService.getTableInfo(
          this.supabaseClient,
          tableName,
        );
        return this.formatResponse({
          contents: [
            {
              uri: uri,
              mimeType: 'application/json',
              text: JSON.stringify(tableSchema, null, 2),
            },
          ],
        });
      }

      return this.formatResponse({
        contents: [
          {
            uri: uri,
            mimeType: 'text/plain',
            text: `Error: Resource not found: ${uri}`,
          },
        ],
      });
    } catch (error) {
      this.serverLogger.error(`Error getting resource ${request.uri}:`, error);
      return this.formatResponse({
        contents: [
          {
            uri: request.uri,
            mimeType: 'text/plain',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      });
    }
  }

  async listPrompts(): Promise<MCPListPromptsResponse> {
    return this.formatResponse({
      prompts: [
        {
          name: 'analyze-data',
          description: 'Analyze data patterns and generate insights',
          arguments: [
            {
              name: 'table_name',
              description: 'Name of the table to analyze',
              required: true,
            },
            {
              name: 'analysis_type',
              description:
                'Type of analysis: summary, trends, anomalies, correlations',
              required: false,
            },
          ],
        },
        {
          name: 'generate-report',
          description: 'Generate a comprehensive data report',
          arguments: [
            {
              name: 'query_description',
              description: 'Natural language description of what to report on',
              required: true,
            },
            {
              name: 'format',
              description: 'Report format: executive, detailed, technical',
              required: false,
            },
          ],
        },
        {
          name: 'optimize-query',
          description: 'Suggest optimizations for a SQL query',
          arguments: [
            {
              name: 'sql_query',
              description: 'The SQL query to optimize',
              required: true,
            },
            {
              name: 'performance_target',
              description: 'Performance target: speed, memory, readability',
              required: false,
            },
          ],
        },
      ],
    });
  }

  async getPrompt(request: MCPGetPromptRequest): Promise<MCPGetPromptResponse> {
    try {
      const { name, arguments: args } = request;

      switch (name) {
        case 'analyze-data':
          return await this.generateAnalysisPrompt(args);
        case 'generate-report':
          return await this.generateReportPrompt(args);
        case 'optimize-query':
          return await this.generateOptimizationPrompt(args);
        default:
          return this.formatResponse({
            description: `Error: Unknown prompt: ${name}`,
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Error: Unknown prompt: ${name}`,
                },
              },
            ],
          });
      }
    } catch (error) {
      this.serverLogger.error(`Error getting prompt ${request.name}:`, error);
      return this.formatResponse({
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          },
        ],
      });
    }
  }

  private async generateAnalysisPrompt(
    args: any,
  ): Promise<MCPGetPromptResponse> {
    const tableName = args?.table_name;
    const analysisType = args?.analysis_type || 'summary';

    if (!tableName) {
      return this.formatPromptErrorResponse(
        'table_name is required for analysis prompt',
      );
    }

    try {
      // Get table schema for context
      const tableSchema = await this.simpleSchemaService.getTableInfo(
        this.supabaseClient,
        tableName,
      );

      const prompt = `Analyze the data in table "${tableName}" and provide ${analysisType} insights.

Table Schema:
${JSON.stringify(tableSchema, null, 2)}

Please provide:
1. Data overview and basic statistics
2. Key patterns and trends
3. Notable findings or anomalies
4. Recommendations for further analysis

Use the available MCP tools to query the data and generate comprehensive insights.`;

      return this.formatResponse({
        description: `Data analysis prompt for ${tableName}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: prompt,
            },
          },
        ],
      });
    } catch (error) {
      return this.formatPromptErrorResponse(
        `Failed to generate analysis prompt: ${error}`,
      );
    }
  }

  private async generateReportPrompt(args: any): Promise<MCPGetPromptResponse> {
    const queryDescription = args?.query_description;
    const format = args?.format || 'detailed';

    if (!queryDescription) {
      return this.formatPromptErrorResponse(
        'query_description is required for report prompt',
      );
    }

    const prompt = `Generate a ${format} report based on the following request:

"${queryDescription}"

Please:
1. First understand what data is needed by examining the database schema
2. Generate appropriate SQL queries to gather the required data
3. Execute the queries and analyze the results
4. Format the findings into a comprehensive ${format} report
5. Include visualizations or charts recommendations where appropriate

Use the query-and-format tool with report output format to get structured results.`;

    return this.formatResponse({
      description: `Report generation prompt for: ${queryDescription}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
    });
  }

  private async generateOptimizationPrompt(
    args: any,
  ): Promise<MCPGetPromptResponse> {
    const sqlQuery = args?.sql_query;
    const performanceTarget = args?.performance_target || 'speed';

    if (!sqlQuery) {
      return this.formatPromptErrorResponse(
        'sql_query is required for optimization prompt',
      );
    }

    const prompt = `Analyze and optimize the following SQL query for ${performanceTarget}:

\`\`\`sql
${sqlQuery}
\`\`\`

Please:
1. Analyze the current query structure and performance characteristics
2. Identify potential bottlenecks or inefficiencies
3. Suggest specific optimizations based on the ${performanceTarget} target
4. Provide the optimized query with explanations
5. Compare expected performance improvements

Use the database schema information and query execution tools to validate suggestions.`;

    return this.formatResponse({
      description: `Query optimization prompt for ${performanceTarget}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
    });
  }

  // Helper methods
  private formatResponse<T>(data: T): T {
    return data;
  }

  private formatErrorResponse(
    error: string,
    toolName: string,
  ): MCPToolResponse {
    return this.createErrorResponse(error, { tool: toolName });
  }

  private formatPromptErrorResponse(error: string): MCPGetPromptResponse {
    return this.formatResponse({
      description: `Error: ${error}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Error: ${error}`,
          },
        },
      ],
    });
  }

  // Health check method
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details?: any;
  }> {
    try {
      // Test database connection using raw SQL query for information_schema
      const { data, error } = await this.supabaseClient.rpc('exec_sql', {
        query: `SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE' 
                LIMIT 1`,
      });

      // If the RPC function doesn't exist, try alternative health check methods
      if (error && error.code === 'PGRST202') {
        // Try using pg_tables system view instead
        const { data: pgData, error: pgError } = await this.supabaseClient
          .from('pg_tables')
          .select('tablename')
          .eq('schemaname', 'public')
          .limit(1);

        if (pgError) {
          // Final fallback: try to query a non-existent table to test basic connectivity
          const { data: basicTest, error: basicError } =
            await this.supabaseClient
              .from('health_check_test_table_that_should_not_exist')
              .select('*')
              .limit(1);

          // We expect this to fail with "relation does not exist" which means we're connected
          if (
            basicError &&
            !basicError.message.includes('relation') &&
            !basicError.message.includes('does not exist') &&
            !basicError.message.includes('table') &&
            !basicError.message.includes('not found')
          ) {
            return {
              status: 'unhealthy',
              details: { database: `Connection failed: ${basicError.message}` },
            };
          }
        }
      } else if (error) {
        return {
          status: 'unhealthy',
          details: { database: error.message },
        };
      }

      // Test service health
      const serviceHealth = {
        schema_cache: { status: 'available' },
        sql_generator: { status: 'not_initialized' }, // TODO: Initialize with proper DI
        query_executor: { status: 'available' },
      };

      return {
        status: 'healthy',
        details: {
          database: 'connected',
          services: serviceHealth,
          tools_available: 5,
          resources_available: 'dynamic',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // Get server capabilities
  getCapabilities(): any {
    return {
      tools: {
        listChanged: false,
      },
      resources: {
        subscribe: false,
        listChanged: true,
      },
      prompts: {
        listChanged: false,
      },
      experimental: {
        sqlGeneration: true,
        modelComparison: true,
        realTimeProgress: true,
        caching: true,
      },
    };
  }
}
