/**
 * Enhanced Supabase MCP Server
 * 
 * Intelligent MCP server with execution tracking, context learning, and comprehensive analytics.
 * Replaces the existing implementation with the new infrastructure.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
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
export class SupabaseMCPServer extends IntelligentMCPBaseService implements IMCPServer, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupabaseMCPServer.name);
  private config!: SupabaseMCPConfig;
  
  // Heartbeat mechanism
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly heartbeatIntervalMs = 60000; // 60 seconds
  // MCP Pool Service removed - using direct MCP Client Service
  private startTime = new Date();

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
    private readonly httpService: HttpService,
    executionTracker?: MCPExecutionTrackerService,
    private readonly supabaseService?: SupabaseService,
    private readonly contextLearning?: ContextLearningService,
    private readonly configService?: ConfigService
  ) {
    // Create execution tracker with proper SupabaseService injection
    const workingTracker = executionTracker || new MCPExecutionTrackerService(supabaseService);
    super(workingTracker);
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
      
      // Set the client in the base class for execution tracking
      this.setSupabaseClient(this.supabaseClient);
      
      // Also set the client in the execution tracker if it exists
      if (this.executionTracker && typeof this.executionTracker.setSupabaseClient === 'function') {
        this.executionTracker.setSupabaseClient(this.supabaseClient);
      }

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
   * Module lifecycle - start heartbeat when module initializes
   */
  async onModuleInit() {
    this.startHeartbeat();
  }

  /**
   * Module lifecycle - stop heartbeat when module destroys
   */
  onModuleDestroy() {
    this.stopHeartbeat();
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

    this.getSchemaTool = new EnhancedGetSchemaTool(
      this.supabaseClient,
      this.config.supabaseKey // Pass the service role key
    );
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
    console.log(`🔧 TOOL EXECUTION DEBUG: Starting ${toolName}`);
    console.log(`🔧 TOOL EXECUTION DEBUG: this.supabaseClient = ${!!this.supabaseClient}`);
    console.log(`🔧 TOOL EXECUTION DEBUG: Parameters:`, JSON.stringify(parameters, null, 2));
    
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

    try {
      // Execute the appropriate tool
      switch (toolName) {
        case 'generate-sql':
          console.log('🚀 SERVER DEBUG: About to call generateSQLTool.execute');
          console.log('🚀 SERVER DEBUG: Parameters:', JSON.stringify(parameters, null, 2));
          const result = await this.generateSQLTool.execute(parameters, enhancedOptions);
          console.log('🚀 SERVER DEBUG: Result from generateSQLTool.execute completed');
          return result;

        case 'get-schema':
          console.log('🔧 TOOL DEBUG: About to call getSchemaTool.execute');
          console.log(`🔧 TOOL DEBUG: getSchemaTool exists = ${!!this.getSchemaTool}`);
          return await this.getSchemaTool.execute(parameters, enhancedOptions);

        case 'execute-sql':
          console.log('🔧 TOOL DEBUG: About to call executeSQLTool.execute');
          console.log(`🔧 TOOL DEBUG: executeSQLTool exists = ${!!this.executeSQLTool}`);
          return await this.executeSQLTool.execute(parameters, enhancedOptions);

        case 'query-and-format':
          console.log('🔧 TOOL DEBUG: About to call queryAndFormatTool.execute');
          return await this.queryAndFormatTool.execute(parameters, enhancedOptions);

        case 'read-data':
          console.log('🔧 TOOL DEBUG: About to call readDataTool.execute');
          return await this.readDataTool.execute(parameters, enhancedOptions);

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`❌ TOOL EXECUTION ERROR: ${toolName} failed:`, error);
      throw error;
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
   * Start heartbeat mechanism to keep MCP pool registration alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return; // Already started
    }

    this.logger.log('Starting heartbeat mechanism for MCP pool integration');
    
    // Send initial heartbeat
    this.sendHeartbeat();
    
    // Set up recurring heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
      this.logger.log('Heartbeat mechanism stopped');
    }
  }

  /**
   * Send heartbeat to MCP pool
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      
      const heartbeat = {
        mcpId: 'supabase-mcp',
        timestamp: new Date(),
        metrics,
        status: 'healthy',
        toolsAvailable: 5
      };

      // MCP Pool heartbeat removed - using direct MCP Client Service

      this.logger.debug('Heartbeat mechanism disabled - using direct MCP Client Service');
    } catch (error) {
      this.logger.warn(`Heartbeat mechanism disabled: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Collect metrics for heartbeat
   */
  private async collectMetrics(): Promise<any> {
    try {
      const uptime = Date.now() - this.startTime.getTime();
      
      // Get execution stats from tracker if available
      let executionStats = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageResponseTime: 0,
        averageExecutionTime: 0,
        toolsUsed: {},
        errorRate: 0,
        lastExecutionAt: undefined
      };

      if (this.executionTracker && typeof this.executionTracker.getExecutionStats === 'function') {
        try {
          const trackerStats = await this.executionTracker.getExecutionStats('system', 30);
          const successfulExecutions = Math.round((trackerStats.successRate / 100) * trackerStats.totalExecutions);
          const failedExecutions = trackerStats.totalExecutions - successfulExecutions;
          
          executionStats = {
            totalExecutions: trackerStats.totalExecutions,
            successfulExecutions,
            failedExecutions,
            averageResponseTime: trackerStats.avgExecutionTime || 0,
            averageExecutionTime: trackerStats.avgExecutionTime || 0,
            toolsUsed: trackerStats.topTools?.reduce((acc: any, tool: any) => {
              acc[tool.tool_name] = tool.count;
              return acc;
            }, {}) || {},
            errorRate: 100 - trackerStats.successRate,
            lastExecutionAt: undefined // Not available in current stats
          };
        } catch (error) {
          this.logger.debug('Could not get execution metrics from tracker');
        }
      }

      return {
        ...executionStats,
        uptime,
        memoryUsage: process.memoryUsage().heapUsed,
        diskUsage: 0 // Not easily available in Node.js
      };
    } catch (error) {
      this.logger.warn(`Failed to collect metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageResponseTime: 0,
        averageExecutionTime: 0,
        toolsUsed: {},
        uptime: Date.now() - this.startTime.getTime(),
        errorRate: 0
      };
    }
  }

  /**
   * Enhanced health check with detailed diagnostics
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details?: any;
  }> {
    try {
      // Check if client is initialized
      if (!this.supabaseClient) {
        return {
          status: 'unhealthy',
          details: {
            error: 'Supabase client not initialized',
            database: { status: 'not_initialized' }
          }
        };
      }

      // Test database connection
      const { data, error } = await this.supabaseClient
        .from('users')
        .select('id')
        .limit(1);

      const dbStatus = error && !error.message.includes('relation') ? 'unhealthy' : 'healthy';

      // Test context learning
      const contextStats = this.contextLearning?.getContextStats() || { totalPatterns: 0, lastReload: null };

      // Test execution tracking (basic check) - only if client is available
      let userStats = null;
      try {
        if (this.supabaseClient) {
          userStats = await this.getServerStats('test-user-id', 1);
        }
      } catch (error) {
        // Execution tracking might fail if tables don't exist yet
        userStats = null;
      }

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
      console.log('🎯 CALLTOOL DEBUG: callTool method called with:', request.name);
      console.log('🎯 CALLTOOL DEBUG: arguments:', JSON.stringify(request.arguments, null, 2));
      
      // Execute with proper tracking
      const executionResult = await this.executeTool(
        request.name,
        request.arguments || {},
        {
          userId: this.configService?.get<string>('SUPABASE_TEST_USERID') || 
                  'db94682e-5184-496f-93fd-dc739aa0f9e7', // Fallback to hardcoded value
          agentConversationId: undefined, // Use null for optional foreign key
          sessionId: undefined, // Use null for optional foreign key  
          llmProvider: 'anthropic',
          llmModel: 'claude-3-5-sonnet'
        }
      );
      
      // Check if execution was successful
      if (!executionResult.success) {
        return {
          content: [{
            type: 'text',
            text: `Tool execution failed: ${executionResult.error}`
          }],
          isError: true,
          _meta: {
            tool_name: request.name,
            execution_id: executionResult.executionId,
            feedback_token: executionResult.feedbackToken,
            error: executionResult.error
          }
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(executionResult.data, null, 2)
        }],
        isError: false,
        _meta: {
          tool_name: request.name,
          execution_id: executionResult.executionId,
          feedback_token: executionResult.feedbackToken,
          execution_time: executionResult.executionTime
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

  /**
   * Get the execution tracker service for feedback and analytics
   */
  getExecutionTracker(): MCPExecutionTrackerService {
    return this.executionTracker;
  }

  async getResource(request: MCPGetResourceRequest): Promise<MCPGetResourceResponse> {
    if (request.uri === 'supabase://schema') {
      const schemaResult = await this.getSchemaTool.execute({}, {
        userId: this.configService?.get<string>('SUPABASE_TEST_USERID') || 
                'db94682e-5184-496f-93fd-dc739aa0f9e7', // Fallback to hardcoded value
        agentConversationId: undefined, // Use null for optional foreign key
        sessionId: undefined, // Use null for optional foreign key
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