import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
  HttpException,
  HttpStatus,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import {
  SupabaseMCPServer,
  SupabaseMCPConfig,
} from './servers/supabase/supabase-mcp.server';
import { MCPClientService } from './client/mcp-client.service';
import { MCPToolRequest } from './servers/base/interfaces/mcp-server.interface';
import { ConfigService } from '@nestjs/config';

@Controller('mcp')
export class MCPController implements OnModuleInit {
  private readonly logger = new Logger(MCPController.name);
  private initialized = false;

  constructor(
    private readonly supabaseMCPServer: SupabaseMCPServer,
    private readonly mcpClientService: MCPClientService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Note: Server initialization is handled by MCPModule discovery process
    // This controller just provides REST API endpoints for the initialized server
    this.logger.log(
      '📡 MCP Controller initialized - using server from discovery process',
    );

    // Wait a bit for the discovery process to complete, then check if server is ready
    setTimeout(async () => {
      try {
        const serverInfo = await this.supabaseMCPServer.getServerInfo();
        this.initialized = true;
        this.logger.log('✅ Controller connected to initialized MCP server');
      } catch (error) {
        this.logger.warn(
          '⚠️ MCP server not yet initialized by discovery process',
        );
      }
    }, 1000);
  }

  /**
   * Check if the server was initialized by the discovery process
   */
  private async checkServerInitialization(): Promise<boolean> {
    try {
      await this.supabaseMCPServer.getServerInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Manual initialization endpoint (for testing or reconfiguration)
   * POST /mcp/supabase/initialize
   */
  @Post('supabase/initialize')
  async initializeManual(@Body() config: SupabaseMCPConfig) {
    try {
      this.logger.log(
        'Manual initialization requested for Supabase MCP Server',
      );
      await this.supabaseMCPServer.initialize(config);
      this.initialized = true;

      return {
        success: true,
        message: 'Supabase MCP Server initialized successfully',
        server_info: await this.supabaseMCPServer.getServerInfo(),
      };
    } catch (error) {
      this.logger.error('Failed to manually initialize MCP server:', error);
      throw new HttpException(
        `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get Supabase MCP server information and capabilities
   * GET /mcp/supabase/info
   */
  @Get('supabase/info')
  async getSupabaseServerInfo() {
    this.ensureInitialized();
    try {
      return await this.supabaseMCPServer.getServerInfo();
    } catch (error) {
      this.logger.error('Failed to get server info:', error);
      throw new HttpException(
        `Failed to get server info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check for Supabase MCP server
   * GET /mcp/supabase/health
   */
  @Get('supabase/health')
  async getSupabaseHealth() {
    this.ensureInitialized();
    try {
      return await this.supabaseMCPServer.healthCheck();
    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw new HttpException(
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * List all available tools for Supabase MCP server
   * GET /mcp/supabase/tools
   */
  @Get('supabase/tools')
  async listSupabaseTools() {
    this.ensureInitialized();
    try {
      const result = await this.supabaseMCPServer.listTools();
      return {
        server: 'supabase',
        ...result,
      };
    } catch (error) {
      this.logger.error('Failed to list tools:', error);
      throw new HttpException(
        `Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Execute a specific tool on the Supabase MCP server
   * POST /mcp/supabase/tools/:toolName
   */
  @Post('supabase/tools/:toolName')
  async executeSupabaseTool(
    @Param('toolName') toolName: string,
    @Body() request: { arguments?: any },
  ) {
    console.log(
      '🌐 HTTP ENDPOINT DEBUG: MCP Controller received request for tool:',
      toolName,
    );
    console.log(
      '🌐 HTTP ENDPOINT DEBUG: Request body:',
      JSON.stringify(request, null, 2),
    );

    this.ensureInitialized();

    try {
      const progressMessages: any[] = [];

      // Progress callback to capture real-time updates
      const progressCallback = async (progress: any) => {
        this.logger.debug(`Progress for ${toolName}:`, progress);
        progressMessages.push({
          timestamp: new Date().toISOString(),
          ...progress,
        });
      };

      const toolRequest: MCPToolRequest = {
        name: toolName,
        arguments: request.arguments || {},
        context: {
          serverId: 'supabase-mcp',
          serverName: 'Supabase MCP Server',
          requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          clientInfo: {
            name: 'NestJS MCP Controller',
            version: '1.0.0',
          },
        },
      };

      this.logger.log(`Executing Supabase MCP tool: ${toolName}`);
      const startTime = Date.now();

      const result = await this.supabaseMCPServer.callTool(
        toolRequest,
        progressCallback,
      );

      const executionTime = Date.now() - startTime;

      return {
        tool_result: result,
        progress_messages: progressMessages,
        execution_info: {
          tool_name: toolName,
          server: 'supabase',
          execution_time_ms: executionTime,
          success: !result.isError,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to execute tool ${toolName}:`, error);
      throw new HttpException(
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List available resources for Supabase MCP server
   * GET /mcp/supabase/resources
   */
  @Get('supabase/resources')
  async listSupabaseResources() {
    this.ensureInitialized();
    try {
      const result = await this.supabaseMCPServer.listResources();
      return {
        server: 'supabase',
        ...result,
      };
    } catch (error) {
      this.logger.error('Failed to list resources:', error);
      throw new HttpException(
        `Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific resource from Supabase MCP server
   * POST /mcp/supabase/resources
   */
  @Post('supabase/resources')
  async getSupabaseResource(@Body() request: { uri: string }) {
    this.ensureInitialized();

    if (!request.uri) {
      throw new BadRequestException('URI is required');
    }

    try {
      return await this.supabaseMCPServer.getResource({ uri: request.uri });
    } catch (error) {
      this.logger.error(`Failed to get resource ${request.uri}:`, error);
      throw new HttpException(
        `Failed to get resource: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List available prompts for Supabase MCP server
   * GET /mcp/supabase/prompts
   */
  @Get('supabase/prompts')
  async listSupabasePrompts() {
    this.ensureInitialized();
    try {
      const result = await this.supabaseMCPServer.listPrompts();
      return {
        server: 'supabase',
        ...result,
      };
    } catch (error) {
      this.logger.error('Failed to list prompts:', error);
      throw new HttpException(
        `Failed to list prompts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific prompt from Supabase MCP server
   * POST /mcp/supabase/prompts
   */
  @Post('supabase/prompts')
  async getSupabasePrompt(@Body() request: { name: string; arguments?: any }) {
    this.ensureInitialized();

    if (!request.name) {
      throw new BadRequestException('Prompt name is required');
    }

    try {
      return await this.supabaseMCPServer.getPrompt({
        name: request.name,
        arguments: request.arguments || {},
      });
    } catch (error) {
      this.logger.error(`Failed to get prompt ${request.name}:`, error);
      throw new HttpException(
        `Failed to get prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get overall MCP status and available servers
   * GET /mcp/status
   */
  @Get('status')
  async getMCPStatus() {
    try {
      const servers = await this.mcpClientService.listServers();
      const instanceId = (this.mcpClientService as any).instanceId || 'unknown';
      const isAvailable = this.mcpClientService.isAvailable();
      const availableServers =
        this.mcpClientService.getAvailableServers?.() || [];

      return {
        mcp_system: {
          status: 'active',
          servers_registered: servers.length,
          timestamp: new Date().toISOString(),
        },
        debug_info: {
          controller_instance_id: instanceId,
          is_available: isAvailable,
          available_servers_count: availableServers.length,
          available_server_names: availableServers,
        },
        servers: servers,
        available_endpoints: {
          supabase: {
            initialized: this.initialized,
            endpoints: [
              'GET /mcp/supabase/info',
              'GET /mcp/supabase/health',
              'GET /mcp/supabase/tools',
              'POST /mcp/supabase/tools/{toolName}',
              'GET /mcp/supabase/resources',
              'POST /mcp/supabase/resources',
              'GET /mcp/supabase/prompts',
              'POST /mcp/supabase/prompts',
            ],
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get MCP status:', error);
      throw new HttpException(
        `Failed to get MCP status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Convenience endpoint: Execute get-schema tool
   * GET /mcp/supabase/schema
   */
  @Get('supabase/schema')
  async getSchema() {
    return this.executeSupabaseTool('get-schema', {
      arguments: { format: 'summary' },
    });
  }

  /**
   * Convenience endpoint: Execute read-data tool
   * POST /mcp/supabase/data
   */
  @Post('supabase/data')
  async readData(
    @Body() request: { table_name: string; limit?: number; format?: string },
  ) {
    if (!request.table_name) {
      throw new BadRequestException('table_name is required');
    }

    return this.executeSupabaseTool('read-data', {
      arguments: {
        table_name: request.table_name,
        limit: request.limit || 10,
        format: request.format || 'json',
      },
    });
  }

  /**
   * Convenience endpoint: Execute SQL query
   * POST /mcp/supabase/query
   */
  @Post('supabase/query')
  async executeQuery(@Body() request: { sql: string; format?: string }) {
    if (!request.sql) {
      throw new BadRequestException('SQL query is required');
    }

    return this.executeSupabaseTool('execute-sql', {
      arguments: {
        sql_query: request.sql,
        format: request.format || 'json',
      },
    });
  }

  /**
   * Submit feedback for an MCP execution
   * POST /mcp/supabase/feedback
   */
  @Post('supabase/feedback')
  async submitFeedback(
    @Body()
    request: {
      feedbackToken: string;
      userId: string;
      feedback: {
        rating?: 'up' | 'down';
        ratingScore?: number;
        comment?: string;
        helpfulTags?: string[];
      };
    },
  ) {
    this.ensureInitialized();

    if (!request.feedbackToken || !request.userId) {
      throw new BadRequestException('feedbackToken and userId are required');
    }

    try {
      await this.supabaseMCPServer
        .getExecutionTracker()
        .storeFeedback(request.feedbackToken, request.userId, request.feedback);

      return {
        success: true,
        message: 'Feedback submitted successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to submit feedback:', error);
      throw new HttpException(
        `Failed to submit feedback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get overall MCP client health status
   * GET /mcp/health
   */
  @Get('health')
  async getHealthStatus() {
    try {
      const mcpStatus = await this.getMCPStatus();
      const supabaseHealth = this.initialized
        ? await this.getSupabaseHealth()
        : { status: 'offline', message: 'Server not initialized' };

      return {
        status:
          this.initialized && supabaseHealth.status === 'operational'
            ? 'healthy'
            : 'degraded',
        poolSize: 1, // We have one MCP server (Supabase)
        onlineMCPs: this.initialized ? 1 : 0,
        healthScore: this.initialized
          ? supabaseHealth.status === 'operational'
            ? 100
            : 50
          : 0,
        lastCheck: new Date(),
        services: {
          supabase: supabaseHealth.status,
          mcp_client: mcpStatus.mcp_system.status,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get health status:', error);
      return {
        status: 'offline',
        poolSize: 1,
        onlineMCPs: 0,
        healthScore: 0,
        lastCheck: new Date(),
        services: {
          supabase: 'offline',
          mcp_client: 'offline',
        },
      };
    }
  }

  /**
   * Get list of registered MCP services
   * GET /mcp/mcps
   */
  @Get('mcps')
  async getRegisteredMCPs() {
    try {
      const supabaseInfo = this.initialized
        ? await this.getSupabaseServerInfo()
        : { name: 'supabase-mcp', version: 'unknown', status: 'offline' };

      const supabaseHealth = this.initialized
        ? await this.getSupabaseHealth()
        : { status: 'offline' };

      const supabaseTools = this.initialized
        ? await this.listSupabaseTools()
        : { tools: [] };

      return [
        {
          id: 'supabase-mcp',
          name: 'Supabase MCP Server',
          type: 'database',
          provider: 'supabase',
          status: this.initialized
            ? supabaseHealth.status === 'operational'
              ? 'online'
              : 'degraded'
            : 'offline',
          version: supabaseInfo.version || '1.0.0',
          url: 'internal://supabase-mcp',
          discoveredAt: new Date(),
          registeredAt: new Date(),
          lastHeartbeat: new Date(),
          capabilities: ['tools', 'resources', 'prompts'],
          tools: supabaseTools.tools || [],
          toolCount: supabaseTools.tools?.length || 0,
          metadata: {
            database: 'supabase',
            enhanced: true,
            context_learning: true,
          },
        },
      ];
    } catch (error) {
      this.logger.error('Failed to get MCP services list:', error);
      return [
        {
          id: 'supabase-mcp',
          name: 'Supabase MCP Server',
          type: 'database',
          provider: 'supabase',
          status: 'offline',
          version: 'unknown',
          url: 'internal://supabase-mcp',
          discoveredAt: new Date(),
          registeredAt: new Date(),
          lastHeartbeat: new Date(),
          capabilities: [],
          tools: [],
          toolCount: 0,
          metadata: {
            database: 'supabase',
            enhanced: true,
            context_learning: true,
          },
        },
      ];
    }
  }

  /**
   * Get all available tools across MCP services
   * GET /mcp/tools
   */
  @Get('tools')
  async getAllTools() {
    try {
      const supabaseTools = this.initialized
        ? await this.listSupabaseTools()
        : { tools: [] };

      const tools = supabaseTools.tools || [];
      return {
        totalTools: tools.length,
        mcpsIncluded: 1,
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          mcpId: 'supabase-mcp',
          mcpName: 'Supabase MCP Server',
          parameters: tool.inputSchema || {},
          examples: [],
        })),
        categories: {
          database: tools.length,
          analytics: 0,
          automation: 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get all tools:', error);
      return {
        totalTools: 0,
        mcpsIncluded: 0,
        tools: [],
        categories: {
          database: 0,
          analytics: 0,
          automation: 0,
        },
      };
    }
  }

  /**
   * Ensure the MCP server is initialized before executing operations
   */
  private ensureInitialized() {
    if (!this.initialized) {
      throw new HttpException(
        'Supabase MCP server not initialized. Check server logs for initialization errors.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
