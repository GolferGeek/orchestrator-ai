import { 
  Controller, 
  Get, 
  HttpException, 
  HttpStatus,
  Logger,
} from '@nestjs/common';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Main MCP (Model Context Protocol) Controller
 * 
 * Provides basic MCP system endpoints:
 * - Overall health checks
 * - Server discovery
 * - System status
 */
@Controller('mcp')
export class MCPController {
  private readonly logger = new Logger(MCPController.name);

  constructor() {}

  /**
   * Overall MCP system health check
   * GET /mcp/health
   */
  @Get('health')
  async healthCheck(): Promise<{ status: string; ready: boolean; servers: string[] }> {
    try {
      // List available MCP servers
      const servers = ['supabase']; // Add more as they're implemented
      
      return {
        status: 'healthy',
        ready: true,
        servers,
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${getErrorMessage(error)}`);
      throw new HttpException(
        'MCP system health check failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * MCP system status overview
   * GET /mcp/status
   */
  @Get('status')
  async getStatus(): Promise<any> {
    try {
      return {
        system_healthy: true,
        available_servers: ['supabase'],
        timestamp: new Date().toISOString(),
        mcp_version: '2025-03-26',
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