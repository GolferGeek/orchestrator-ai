import {
  Controller,
  Post,
  Body,
  Get,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { SupabaseMCPServer, SupabaseMCPConfig } from '../supabase-mcp.server';
import { MCPToolRequest } from '../../base/interfaces/mcp-server.interface';
import { LLMService } from '@/llms/llm.service';

@Controller('mcp/supabase')
export class SupabaseMCPController {
  private readonly logger = new Logger(SupabaseMCPController.name);
  private mcpServer: SupabaseMCPServer;
  private initialized = false;

  constructor(
    private readonly llmService: LLMService,
    private readonly httpService: HttpService
  ) {
    this.mcpServer = new SupabaseMCPServer(this.llmService, this.httpService);
  }

  /**
   * Initialize the MCP server (call this first)
   */
  @Post('initialize')
  async initialize(@Body() config: SupabaseMCPConfig) {
    try {
      this.logger.log('Initializing Supabase MCP Server via HTTP...');
      await this.mcpServer.initialize(config);
      this.initialized = true;
      return {
        success: true,
        message: 'Supabase MCP Server initialized successfully',
        server_info: await this.mcpServer.getServerInfo(),
      };
    } catch (error) {
      this.logger.error('Failed to initialize MCP server:', error);
      throw new HttpException(
        `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get server information and capabilities
   */
  @Get('info')
  async getServerInfo() {
    this.ensureInitialized();
    try {
      return await this.mcpServer.getServerInfo();
    } catch (error) {
      this.logger.error('Failed to get server info:', error);
      throw new HttpException(
        `Failed to get server info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List all available tools
   */
  @Get('tools')
  async listTools() {
    this.ensureInitialized();
    try {
      return await this.mcpServer.listTools();
    } catch (error) {
      this.logger.error('Failed to list tools:', error);
      throw new HttpException(
        `Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Execute the get-schema tool
   */
  @Post('tools/get-schema')
  async getSchema(@Body() request: { arguments?: any }) {
    return this.executeTool('get-schema', request.arguments);
  }

  /**
   * Execute the generate-sql tool
   */
  @Post('tools/generate-sql')
  async generateSQL(@Body() request: { arguments?: any }) {
    return this.executeTool('generate-sql', request.arguments);
  }

  /**
   * Execute the execute-sql tool
   */
  @Post('tools/execute-sql')
  async executeSQL(@Body() request: { arguments?: any }) {
    return this.executeTool('execute-sql', request.arguments);
  }

  /**
   * Execute the query-and-format tool
   */
  @Post('tools/query-and-format')
  async queryAndFormat(@Body() request: { arguments?: any }) {
    return this.executeTool('query-and-format', request.arguments);
  }

  /**
   * Execute the read-data tool
   */
  @Post('tools/read-data')
  async readData(@Body() request: { arguments?: any }) {
    return this.executeTool('read-data', request.arguments);
  }

  /**
   * List available resources
   */
  @Get('resources')
  async listResources() {
    this.ensureInitialized();
    try {
      return await this.mcpServer.listResources();
    } catch (error) {
      this.logger.error('Failed to list resources:', error);
      throw new HttpException(
        `Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific resource
   */
  @Post('resources')
  async getResource(@Body() request: { uri: string }) {
    this.ensureInitialized();
    try {
      return await this.mcpServer.getResource({ uri: request.uri });
    } catch (error) {
      this.logger.error(`Failed to get resource ${request.uri}:`, error);
      throw new HttpException(
        `Failed to get resource: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List available prompts
   */
  @Get('prompts')
  async listPrompts() {
    this.ensureInitialized();
    try {
      return await this.mcpServer.listPrompts();
    } catch (error) {
      this.logger.error('Failed to list prompts:', error);
      throw new HttpException(
        `Failed to list prompts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific prompt
   */
  @Post('prompts')
  async getPrompt(@Body() request: { name: string; arguments?: any }) {
    this.ensureInitialized();
    try {
      return await this.mcpServer.getPrompt({
        name: request.name,
        arguments: request.arguments,
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
   * Health check endpoint
   */
  @Get('health')
  async healthCheck() {
    this.ensureInitialized();
    try {
      return await this.mcpServer.healthCheck();
    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw new HttpException(
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Shutdown the MCP server
   */
  @Post('shutdown')
  async shutdown() {
    try {
      if (this.initialized) {
        await this.mcpServer.shutdown();
        this.initialized = false;
      }
      return {
        success: true,
        message: 'Supabase MCP Server shutdown successfully',
      };
    } catch (error) {
      this.logger.error('Failed to shutdown MCP server:', error);
      throw new HttpException(
        `Failed to shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generic tool execution with progress tracking
   */
  private async executeTool(toolName: string, args?: any) {
    this.ensureInitialized();

    try {
      const progressMessages: any[] = [];

      const progressCallback = async (progress: any) => {
        this.logger.debug(`Progress for ${toolName}:`, progress);
        progressMessages.push({
          timestamp: new Date().toISOString(),
          ...progress,
        });
      };

      const toolRequest: MCPToolRequest = {
        name: toolName,
        arguments: args,
        context: {
          serverId: 'test-supabase-mcp',
          serverName: 'Test Supabase MCP Server',
          requestId: `test-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          clientInfo: {
            name: 'Test MCP Controller',
            version: '1.0.0',
          },
        },
      };

      this.logger.log(`Executing tool: ${toolName}`);
      const result = await this.mcpServer.callTool(
        toolRequest,
        progressCallback,
      );

      return {
        tool_result: result,
        progress_messages: progressMessages,
        execution_info: {
          tool_name: toolName,
          execution_time: result._meta?.execution_time || null,
          success: !result.isError,
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
   * Ensure the MCP server is initialized before executing operations
   */
  private ensureInitialized() {
    if (!this.initialized) {
      throw new HttpException(
        'MCP server not initialized. Call POST /mcp/supabase/initialize first.',
        HttpStatus.PRECONDITION_FAILED,
      );
    }
  }
}
