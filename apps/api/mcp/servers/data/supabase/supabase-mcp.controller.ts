import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  HttpException, 
  HttpStatus,
  Logger,
  Param,
} from '@nestjs/common';
import { SupabaseMCPService } from './supabase-mcp.service';
import {
  MCPJsonRpcRequest,
  MCPJsonRpcResponse,
  MCPServerInfo,
  MCPToolDefinition,
} from '../../../clients/mcp-client.interface';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * HTTP Controller for Supabase MCP Server Operations
 * 
 * Provides REST endpoints for Supabase MCP server functionality:
 * - Server info and health checks
 * - Tool discovery and execution
 * - JSON-RPC message handling
 * - Direct database operations
 */
@Controller('mcp/supabase')
export class SupabaseMCPController {
  private readonly logger = new Logger(SupabaseMCPController.name);

  constructor(
    private readonly supabaseMcpService: SupabaseMCPService,
  ) {}

  /**
   * Health check endpoint
   * GET /mcp/supabase/health
   */
  @Get('health')
  async healthCheck(): Promise<{ status: string; ready: boolean }> {
    try {
      const isHealthy = await this.supabaseMcpService.healthCheck();
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        ready: isHealthy,
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        'MCP server health check failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Get server information
   * GET /mcp/supabase/server-info
   */
  @Get('server-info')
  async getServerInfo(): Promise<MCPServerInfo> {
    try {
      return await this.supabaseMcpService.getServerInfo();
    } catch (error) {
      this.logger.error(`Get server info failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        'Failed to retrieve server information',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List available tools
   * GET /mcp/supabase/tools
   */
  @Get('tools')
  async listTools(): Promise<{ tools: MCPToolDefinition[] }> {
    try {
      const tools = await this.supabaseMcpService.listTools();
      return { tools };
    } catch (error) {
      this.logger.error(`List tools failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        'Failed to list available tools',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get server metrics and statistics
   * GET /mcp/supabase/metrics
   */
  @Get('metrics')
  async getServerMetrics(): Promise<any> {
    try {
      return this.supabaseMcpService.getServerMetrics();
    } catch (error) {
      this.logger.error(`Get metrics failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        'Failed to retrieve server metrics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Handle JSON-RPC requests (main MCP entry point)
   * POST /mcp/supabase/jsonrpc
   */
  @Post('jsonrpc')
  async handleJsonRpc(@Body() request: MCPJsonRpcRequest): Promise<MCPJsonRpcResponse> {
    const startTime = Date.now();

    try {
      // Validate JSON-RPC request structure
      if (!request.jsonrpc || request.jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC version. Expected "2.0"');
      }

      if (request.id === undefined) {
        throw new Error('JSON-RPC request ID is required');
      }

      if (!request.method) {
        throw new Error('JSON-RPC method is required');
      }

      this.logger.debug(
        `Processing Supabase MCP JSON-RPC: ${request.method} (ID: ${request.id})`,
      );

      const response = await this.supabaseMcpService.handleJsonRpcRequest(request);
      
      const executionTime = Date.now() - startTime;
      this.logger.debug(
        `Supabase MCP JSON-RPC ${request.method} completed in ${executionTime}ms`,
      );

      return response;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error(
        `Supabase MCP JSON-RPC failed after ${executionTime}ms: ${getErrorMessage(error)}`,
      );

      // Return proper JSON-RPC error response
      return {
        jsonrpc: '2.0',
        id: request.id || 'unknown',
        error: {
          code: -32603,
          message: getErrorMessage(error),
          data: {
            execution_time_ms: executionTime,
            request_method: request.method,
          },
        },
      };
    }
  }

  /**
   * Convenience endpoint for schema retrieval
   * POST /mcp/supabase/schema
   */
  @Post('schema')
  async getSchema(
    @Body() body: { tables?: string[]; domain?: 'core' | 'kpi' },
  ): Promise<{ schema: string }> {
    try {
      const schema = await this.supabaseMcpService.getSchema(
        body.tables,
        body.domain,
      );
      return { schema };
    } catch (error) {
      this.logger.error(`Get schema failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        `Schema retrieval failed: ${getErrorMessage(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Convenience endpoint for SQL generation
   * POST /mcp/supabase/generate-sql
   */
  @Post('generate-sql')
  async generateSQL(
    @Body() body: {
      query: string;
      tables: string[];
      domainHint?: string;
      maxRows?: number;
    },
  ): Promise<any> {
    try {
      if (!body.query) {
        throw new Error('Query is required');
      }

      if (!body.tables || !Array.isArray(body.tables)) {
        throw new Error('Tables array is required');
      }

      const result = await this.supabaseMcpService.generateSQL(
        body.query,
        body.tables,
        body.domainHint,
        body.maxRows,
      );

      return result;
    } catch (error) {
      this.logger.error(`Generate SQL failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        `SQL generation failed: ${getErrorMessage(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Convenience endpoint for SQL execution
   * POST /mcp/supabase/execute-sql
   */
  @Post('execute-sql')
  async executeSQL(
    @Body() body: { sql: string; maxRows?: number },
  ): Promise<any> {
    try {
      if (!body.sql) {
        throw new Error('SQL query is required');
      }

      const result = await this.supabaseMcpService.executeSQL(
        body.sql,
        body.maxRows,
      );

      return result;
    } catch (error) {
      this.logger.error(`Execute SQL failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        `SQL execution failed: ${getErrorMessage(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Convenience endpoint for result analysis
   * POST /mcp/supabase/analyze-results
   */
  @Post('analyze-results')
  async analyzeResults(
    @Body() body: {
      data: any[];
      prompt: string;
      provider?: string;
      model?: string;
    },
  ): Promise<any> {
    try {
      if (!body.data || !Array.isArray(body.data)) {
        throw new Error('Data array is required');
      }

      if (!body.prompt) {
        throw new Error('Analysis prompt is required');
      }

      const result = await this.supabaseMcpService.analyzeResults(
        body.data,
        body.prompt,
        body.provider,
        body.model,
      );

      return result;
    } catch (error) {
      this.logger.error(`Analyze results failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        `Result analysis failed: ${getErrorMessage(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generic tool execution endpoint
   * POST /mcp/supabase/tools/:toolName
   */
  @Post('tools/:toolName')
  async executeTool(
    @Param('toolName') toolName: string,
    @Body() args: any,
  ): Promise<any> {
    try {
      if (!toolName) {
        throw new Error('Tool name is required');
      }

      this.logger.debug(`Executing Supabase tool: ${toolName}`);

      const result = await this.supabaseMcpService.executeTool(toolName, args);
      return { result };

    } catch (error) {
      this.logger.error(`Tool execution failed for ${toolName}: ${getErrorMessage(error)}`);
      throw new HttpException(
        `Tool execution failed: ${getErrorMessage(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Batch tool execution endpoint
   * POST /mcp/supabase/tools/batch
   */
  @Post('tools/batch')
  async executeToolsBatch(
    @Body() body: { tools: { name: string; arguments: any }[] },
  ): Promise<any> {
    try {
      if (!body.tools || !Array.isArray(body.tools)) {
        throw new Error('Tools array is required');
      }

      const results = await Promise.allSettled(
        body.tools.map(async (tool) => {
          try {
            const result = await this.supabaseMcpService.executeTool(
              tool.name,
              tool.arguments,
            );
            return { tool: tool.name, success: true, result };
          } catch (error) {
            return {
              tool: tool.name,
              success: false,
              error: getErrorMessage(error),
            };
          }
        }),
      );

      return { results };
    } catch (error) {
      this.logger.error(`Batch tool execution failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        `Batch execution failed: ${getErrorMessage(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Supabase MCP status endpoint
   * GET /mcp/supabase/status
   */
  @Get('status')
  async getStatus(): Promise<any> {
    try {
      const [serverHealth, serverInfo, metrics] = await Promise.allSettled([
        this.supabaseMcpService.healthCheck(),
        this.supabaseMcpService.getServerInfo(),
        this.supabaseMcpService.getServerMetrics(),
      ]);

      return {
        server_healthy: serverHealth.status === 'fulfilled' ? serverHealth.value : false,
        server_info: serverInfo.status === 'fulfilled' ? serverInfo.value : null,
        metrics: metrics.status === 'fulfilled' ? metrics.value : null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Status check failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        'Failed to retrieve MCP status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}