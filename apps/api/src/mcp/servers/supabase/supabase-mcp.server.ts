/**
 * Enhanced Supabase MCP Server
 * 
 * Intelligent MCP server with execution tracking, context learning, and comprehensive analytics.
 * Replaces the existing implementation with the new infrastructure.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { IntelligentMCPBaseService, MCPServerInfo, MCPToolDefinition, MCPToolExecutionOptions } from './base/intelligent-mcp-base.service';
import { MCPExecutionTrackerService } from './services/mcp-execution-tracker.service';
import { ContextLearningService } from './services/context-learning.service';
import { SupabaseService } from '../../../supabase/supabase.service';
import { LLMService } from '../../../llms/llm.service';
import { 
  IMCPServer, 
  MCPListToolsResponse, 
  MCPToolRequest, 
  MCPToolResponse,
  MCPListResourcesResponse,
  MCPGetResourceRequest,
  MCPGetResourceResponse,
  MCPListPromptsResponse,
  MCPGetPromptRequest,
  MCPGetPromptResponse
} from '../base/interfaces/mcp-server.interface';

// Tool implementations
import { EnhancedGenerateSQLTool } from './tools/generate-sql.tool';
import { EnhancedGetSchemaTool } from './tools/get-schema.tool';
import { ExecuteSQLTool as EnhancedExecuteSQLTool } from './tools/execute-sql.tool';
import { QueryAndFormatTool as EnhancedQueryAndFormatTool } from './tools/query-and-format.tool';
import { ReadDataTool as EnhancedReadDataTool } from './tools/read-data.tool';

export interface SupabaseMCPConfig {
  supabaseUrl: string;
  supabaseKey: string;
  enableCaching: boolean;
  cacheTTL: number;
  maxQueryTimeout: number;
  sqlModels: string[];
  enableContextLearning?: boolean;
  defaultLLMProvider?: string;
  defaultLLMModel?: string;
}

@Injectable()
export class SupabaseMCPServer extends IntelligentMCPBaseService implements IMCPServer {
  private readonly logger = new Logger(SupabaseMCPServer.name);
  private supabaseClient!: SupabaseClient;
  private config!: SupabaseMCPConfig;

  // Tool instances
  private generateSQLTool!: EnhancedGenerateSQLTool;
  private getSchemaTool!: EnhancedGetSchemaTool;
  private executeSQLTool!: EnhancedExecuteSQLTool;
  private queryAndFormatTool!: EnhancedQueryAndFormatTool;
  private readDataTool!: EnhancedReadDataTool;

  protected serverInfo: MCPServerInfo = {
    name: 'supabase',
    version: '2.0.0',
    description: 'Intelligent Supabase MCP server with context learning and execution tracking',
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
      logging: true
    },
    tools: [
      {
        name: 'generate-sql',
        description: 'Generate SQL from natural language with context learning',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Natural language description of the desired query'
            },
            use_context: {
              type: 'boolean',
              description: 'Apply context learning patterns',
              default: true
            },
            llm_provider: {
              type: 'string',
              description: 'LLM provider to use (anthropic, openai, google)',
              default: 'anthropic'
            },
            llm_model: {
              type: 'string',
              description: 'Specific model to use',
              default: 'claude-3-5-sonnet'
            },
            max_retries: {
              type: 'integer',
              description: 'Maximum retry attempts',
              default: 3,
              minimum: 0,
              maximum: 5
            }
          },
          required: ['prompt']
        }
      },
      {
        name: 'get-schema',
        description: 'Get database schema information with caching',
        inputSchema: {
          type: 'object',
          properties: {
            table_names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific tables to get schema for (optional)'
            },
            format: {
              type: 'string',
              enum: ['json', 'markdown', 'sql'],
              description: 'Output format for schema',
              default: 'json'
            },
            refresh_cache: {
              type: 'boolean',
              description: 'Force refresh of cached schema',
              default: false
            }
          }
        }
      },
      {
        name: 'execute-sql',
        description: 'Execute SQL queries with safety checks',
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'SQL query to execute'
            },
            dry_run: {
              type: 'boolean',
              description: 'Perform validation only without execution',
              default: true
            },
            timeout_ms: {
              type: 'integer',
              description: 'Query timeout in milliseconds',
              default: 30000,
              minimum: 1000,
              maximum: 60000
            },
            max_rows: {
              type: 'integer',
              description: 'Maximum rows to return',
              default: 1000,
              minimum: 1,
              maximum: 10000
            }
          },
          required: ['sql']
        }
      },
      {
        name: 'query-and-format',
        description: 'Generate SQL from prompt and execute with formatting',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Natural language query description'
            },
            format: {
              type: 'string',
              enum: ['json', 'csv', 'markdown', 'table'],
              description: 'Output format for results',
              default: 'json'
            },
            execute: {
              type: 'boolean',
              description: 'Execute the generated query',
              default: false
            },
            use_context: {
              type: 'boolean',
              description: 'Apply context learning',
              default: true
            }
          },
          required: ['prompt']
        }
      },
      {
        name: 'read-data',
        description: 'Read data from tables with filtering',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Name of the table to read from'
            },
            columns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific columns to select (optional)'
            },
            limit: {
              type: 'integer',
              description: 'Maximum number of rows',
              default: 100,
              minimum: 1,
              maximum: 1000
            },
            offset: {
              type: 'integer',
              description: 'Number of rows to skip',
              default: 0,
              minimum: 0
            }
          },
          required: ['table_name']
        }
      }
    ]
  };

  constructor(
    private readonly llmService: LLMService,
    executionTracker?: MCPExecutionTrackerService,
    supabaseService?: SupabaseService,
    private readonly contextLearning?: ContextLearningService
  ) {
    // Create dummy services if not provided (for testing purposes)
    const dummyTracker = executionTracker || ({} as MCPExecutionTrackerService);
    const dummySupabase = supabaseService || ({} as SupabaseService);
    super(dummyTracker, dummySupabase);
  }

  /**
   * Initialize the server with configuration
   */
  async initialize(config: SupabaseMCPConfig): Promise<void> {
    try {
      this.logger.log('Initializing Enhanced Supabase MCP Server...');
      this.config = config;

      // Create Supabase client
      const { createClient } = await import('@supabase/supabase-js');
      this.supabaseClient = createClient(config.supabaseUrl, config.supabaseKey);

      // Test connection
      await this.testConnection();

      // Initialize context learning if enabled
      if (config.enableContextLearning !== false && this.contextLearning) {
        await this.contextLearning.onModuleInit();
        this.logger.log('Context learning system initialized');
      }

      // Initialize tool instances
      this.initializeTools();

      this.logger.log('Enhanced Supabase MCP Server initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase MCP Server:', error);
      throw error;
    }
  }

  /**
   * Initialize all tool instances
   */
  private initializeTools(): void {
    this.generateSQLTool = new EnhancedGenerateSQLTool(
      this.supabaseClient,
      this.contextLearning || ({} as ContextLearningService),
      this.llmService
    );

    this.getSchemaTool = new EnhancedGetSchemaTool(this.supabaseClient);
    this.executeSQLTool = new EnhancedExecuteSQLTool(this.supabaseClient);
    this.queryAndFormatTool = new EnhancedQueryAndFormatTool(
      this.supabaseClient,
      this.contextLearning || ({} as ContextLearningService),
      this.llmService
    );
    this.readDataTool = new EnhancedReadDataTool(this.supabaseClient);
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    try {
      const { data, error } = await this.supabaseClient
        .from('users')
        .select('id')
        .limit(1);

      if (error && !error.message.includes('relation')) {
        throw new Error(`Database connection failed: ${error.message}`);
      }

      this.logger.log('Database connection verified');
    } catch (error) {
      throw new Error(`Failed to verify database connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute tool implementation with our enhanced infrastructure
   */
  protected async executeToolImplementation(
    toolName: string,
    parameters: any,
    options: MCPToolExecutionOptions
  ): Promise<any> {
    // Validate parameters
    const validation = this.validateParameters(toolName, parameters);
    if (!validation.valid) {
      throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`);
    }

    // Set default LLM options
    const enhancedOptions = {
      ...options,
      llmProvider: options.llmProvider || this.config.defaultLLMProvider || 'anthropic',
      llmModel: options.llmModel || this.config.defaultLLMModel || 'claude-3-5-sonnet'
    };

    // Execute the appropriate tool
    switch (toolName) {
      case 'generate-sql':
        return await this.generateSQLTool.execute(parameters, enhancedOptions);

      case 'get-schema':
        return await this.getSchemaTool.execute(parameters, enhancedOptions);

      case 'execute-sql':
        return await this.executeSQLTool.execute(parameters, enhancedOptions);

      case 'query-and-format':
        return await this.queryAndFormatTool.execute(parameters, enhancedOptions);

      case 'read-data':
        return await this.readDataTool.execute(parameters, enhancedOptions);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Get enhanced server capabilities
   */
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
        contextLearning: this.config.enableContextLearning !== false,
        executionTracking: true,
        performanceAnalytics: true,
        multiModelSupport: true,
        smartRetry: true,
        securityValidation: true
      },
    };
  }

  /**
   * Enhanced health check with detailed diagnostics
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details?: any;
  }> {
    try {
      // Test database connection
      const { data, error } = await this.supabaseClient
        .from('users')
        .select('id')
        .limit(1);

      const dbStatus = error && !error.message.includes('relation') ? 'unhealthy' : 'healthy';

      // Test context learning
      const contextStats = this.contextLearning?.getContextStats() || { totalPatterns: 0, lastReload: null };

      // Test execution tracking (basic check)
      const userStats = await this.getServerStats('test-user-id', 1).catch(() => null);

      return {
        status: dbStatus,
        details: {
          database: {
            status: dbStatus,
            connection: 'verified'
          },
          contextLearning: {
            status: 'healthy',
            totalPatterns: contextStats.totalPatterns,
            lastReload: contextStats.lastReload
          },
          executionTracking: {
            status: userStats ? 'healthy' : 'available',
            tables: ['mcp_executions', 'mcp_failures', 'mcp_feedback']
          },
          tools: {
            available: this.serverInfo.tools.length,
            status: 'healthy'
          },
          performance: {
            caching: this.config.enableCaching,
            timeout: this.config.maxQueryTimeout,
            llmModels: this.config.sqlModels
          }
        }
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get context learning statistics
   */
  async getContextStats(): Promise<any> {
    return this.contextLearning?.getContextStats() || { totalPatterns: 0, lastReload: null };
  }

  /**
   * Force reload context learning data
   */
  async reloadContext(): Promise<void> {
    if (this.contextLearning) {
      await this.contextLearning.forceReload();
    }
  }

  /**
   * Shutdown the server gracefully
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.log('Shutting down Enhanced Supabase MCP Server...');

      // Cleanup context learning
      if (this.contextLearning) {
        await this.contextLearning.onModuleDestroy();
      }

      // Clear any caches
      // (Individual tools would handle their own cleanup)

      this.logger.log('Enhanced Supabase MCP Server shutdown complete');
    } catch (error) {
      this.logger.error('Error during server shutdown:', error);
    }
  }

  /**
   * Get server configuration (sanitized)
   */
  getServerConfig(): Partial<SupabaseMCPConfig> {
    return {
      enableCaching: this.config.enableCaching,
      cacheTTL: this.config.cacheTTL,
      maxQueryTimeout: this.config.maxQueryTimeout,
      sqlModels: this.config.sqlModels,
      enableContextLearning: this.config.enableContextLearning,
      defaultLLMProvider: this.config.defaultLLMProvider,
      defaultLLMModel: this.config.defaultLLMModel
      // Note: Sensitive data (URLs, keys) are excluded
    };
  }

  /**
   * MCP Protocol Implementation
   */

  async listTools(): Promise<MCPListToolsResponse> {
    return {
      tools: this.serverInfo.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  }

  async callTool(
    request: MCPToolRequest,
    progressCallback?: (progress: any) => Promise<void>
  ): Promise<MCPToolResponse> {
    try {
      const result = await this.executeTool(
        request.name,
        request.arguments || {},
        {
          userId: 'mcp-user',
          agentConversationId: 'mcp-conversation',
          sessionId: 'mcp-session',
          llmProvider: 'anthropic',
          llmModel: 'claude-3-5-sonnet'
        }
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }],
        isError: false,
        _meta: {
          tool_name: request.name,
          execution_time: Date.now()
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error executing tool ${request.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true,
        _meta: {
          tool_name: request.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async listResources(): Promise<MCPListResourcesResponse> {
    return {
      resources: [
        {
          uri: 'supabase://schema',
          name: 'Database Schema',
          description: 'Complete database schema information',
          mimeType: 'application/json'
        },
        {
          uri: 'supabase://context',
          name: 'SQL Context',
          description: 'SQL generation context and patterns',
          mimeType: 'text/markdown'
        }
      ]
    };
  }

  async getResource(request: MCPGetResourceRequest): Promise<MCPGetResourceResponse> {
    if (request.uri === 'supabase://schema') {
      const schemaResult = await this.getSchemaTool.execute({}, {
        userId: 'mcp-user',
        agentConversationId: 'mcp-conversation',
        sessionId: 'mcp-session',
        llmProvider: 'anthropic',
        llmModel: 'claude-3-5-sonnet'
      });

      return {
        contents: [{
          uri: request.uri,
          mimeType: 'application/json',
          text: JSON.stringify(schemaResult, null, 2)
        }]
      };
    }

    if (request.uri === 'supabase://context') {
      const contextStats = this.contextLearning?.getContextStats() || { totalPatterns: 0, lastReload: null };
      return {
        contents: [{
          uri: request.uri,
          mimeType: 'text/markdown',
          text: `# SQL Context Learning\n\nTotal patterns: ${contextStats.totalPatterns}\nLast reload: ${contextStats.lastReload}\n\nThis resource contains SQL generation patterns learned from successful queries.`
        }]
      };
    }

    throw new Error(`Resource not found: ${request.uri}`);
  }

  async listPrompts(): Promise<MCPListPromptsResponse> {
    return {
      prompts: [
        {
          name: 'generate-optimized-sql',
          description: 'Generate an optimized SQL query with performance considerations',
          arguments: [
            { name: 'query_description', description: 'Natural language description of the query', required: true },
            { name: 'performance_level', description: 'Performance optimization level (low, medium, high)', required: false }
          ]
        },
        {
          name: 'analyze-query-performance',
          description: 'Analyze and suggest improvements for an existing SQL query',
          arguments: [
            { name: 'sql_query', description: 'The SQL query to analyze', required: true }
          ]
        }
      ]
    };
  }

  async getPrompt(request: MCPGetPromptRequest): Promise<MCPGetPromptResponse> {
    if (request.name === 'generate-optimized-sql') {
      const queryDescription = request.arguments?.query_description || 'data retrieval query';
      const performanceLevel = request.arguments?.performance_level || 'medium';

      return {
        description: 'Generate an optimized SQL query with performance considerations',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Generate an optimized SQL query for: ${queryDescription}\n\nOptimization level: ${performanceLevel}\n\nPlease consider:\n- Proper indexing strategies\n- Efficient JOIN operations\n- Query plan optimization\n- Performance best practices`
          }
        }]
      };
    }

    if (request.name === 'analyze-query-performance') {
      const sqlQuery = request.arguments?.sql_query || '';

      return {
        description: 'Analyze and suggest improvements for an existing SQL query',
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Analyze this SQL query for performance improvements:\n\n\`\`\`sql\n${sqlQuery}\n\`\`\`\n\nPlease provide:\n- Performance bottlenecks\n- Optimization suggestions\n- Index recommendations\n- Alternative query patterns`
          }
        }]
      };
    }

    throw new Error(`Prompt not found: ${request.name}`);
  }
}