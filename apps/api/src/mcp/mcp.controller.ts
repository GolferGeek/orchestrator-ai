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
    // Auto-initialize the Supabase MCP server with config from environment
    await this.initializeSupabaseServer();
  }

  /**
   * Auto-initialize Supabase MCP server using environment configuration
   */
  private async initializeSupabaseServer(): Promise<void> {
    try {
      const config: SupabaseMCPConfig = {
        supabaseUrl: this.configService.get<string>('SUPABASE_URL') || '',
        supabaseKey:
          this.configService.get<string>('SUPABASE_ANON_KEY') ||
          this.configService.get<string>('SUPABASE_KEY') ||
          '',
        enableCaching: true,
        cacheTTL: 5 * 60 * 1000, // 5 minutes
        maxQueryTimeout: 30000, // 30 seconds
        sqlModels: ['gpt-4', 'claude-3-sonnet', 'gpt-3.5-turbo'],
      };

      if (!config.supabaseUrl || !config.supabaseKey) {
        this.logger.warn(
          'Supabase credentials not found in environment. MCP server will not be initialized.',
        );
        return;
      }

      await this.supabaseMCPServer.initialize(config);
      this.initialized = true;
      this.logger.log('✅ Supabase MCP Server auto-initialized successfully');
    } catch (error) {
      this.logger.error(
        '❌ Failed to auto-initialize Supabase MCP Server:',
        error,
      );
      // Don't throw - let the API start even if MCP isn't working
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

      return {
        mcp_system: {
          status: 'active',
          servers_registered: servers.length,
          timestamp: new Date().toISOString(),
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
