import { Injectable, Logger } from '@nestjs/common';
import {
  IMCPClient,
  MCPServerInfo,
  MCPToolDefinition,
  MCPToolRequest,
  MCPToolResponse,
  MCPClientConfig,
  MCPJsonRpcRequest,
  MCPJsonRpcResponse,
  MCPJsonRpcError,
} from './mcp-client.interface';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Universal MCP Client Service
 * 
 * HTTP-based client for communicating with MCP servers
 * Implements 2025-03-26 MCP specification with JSON-RPC over HTTP
 */
@Injectable()
export class MCPClientService implements IMCPClient {
  private readonly logger = new Logger(MCPClientService.name);
  private requestId = 0;

  constructor(private readonly config: MCPClientConfig) {}

  /**
   * Get server information
   */
  async getServerInfo(): Promise<MCPServerInfo> {
    const response = await this.sendRequest('get_server_info', {});
    return response.result;
  }

  /**
   * List available tools from server
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    const response = await this.sendRequest('list_tools', {});
    return response.result.tools || [];
  }

  /**
   * Execute a tool on the MCP server
   */
  async callTool(request: MCPToolRequest): Promise<MCPToolResponse> {
    const response = await this.sendRequest('call_tool', {
      name: request.name,
      arguments: request.arguments || {},
      context: request.context || {},
    });

    if (response.error) {
      return {
        content: [
          {
            type: 'text',
            text: `MCP Tool Error: ${response.error.message}`,
          },
        ],
        isError: true,
        _meta: {
          error_code: response.error.code,
          error_data: response.error.data,
        },
      };
    }

    return response.result;
  }

  /**
   * Health check - ping the server
   */
  async ping(): Promise<boolean> {
    try {
      await this.getServerInfo();
      return true;
    } catch (error) {
      this.logger.warn(`MCP server ping failed: ${getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Send JSON-RPC request to MCP server
   */
  private async sendRequest(
    method: string,
    params: any,
  ): Promise<MCPJsonRpcResponse> {
    const request: MCPJsonRpcRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    };

    const startTime = Date.now();
    let response: Response;

    try {
      response = await fetch(this.config.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          ...this.config.headers,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(
        `MCP request failed after ${executionTime}ms: ${getErrorMessage(error)}`,
      );
      throw new Error(`MCP server connection failed: ${getErrorMessage(error)}`);
    }

    if (!response.ok) {
      const executionTime = Date.now() - startTime;
      this.logger.error(
        `MCP server returned ${response.status} after ${executionTime}ms`,
      );
      throw new Error(`MCP server error: ${response.status} ${response.statusText}`);
    }

    let jsonResponse: MCPJsonRpcResponse;
    try {
      jsonResponse = await response.json();
    } catch (error) {
      throw new Error(`Invalid JSON response from MCP server: ${getErrorMessage(error)}`);
    }

    const executionTime = Date.now() - startTime;
    this.logger.debug(
      `MCP ${method} completed in ${executionTime}ms`,
    );

    // Validate JSON-RPC response format
    if (jsonResponse.jsonrpc !== '2.0' || jsonResponse.id !== request.id) {
      throw new Error('Invalid JSON-RPC response format');
    }

    return jsonResponse;
  }

  /**
   * Create a configured MCP client for Supabase server
   */
  static createSupabaseClient(): MCPClientService {
    const config: MCPClientConfig = {
      serverUrl: 'http://localhost:9000/mcp/supabase',
      timeout: 30000,
      retries: 3,
      headers: {
        'User-Agent': 'Orchestrator-AI-MCP-Client/1.0',
      },
    };

    return new MCPClientService(config);
  }

  /**
   * Create a configured MCP client for external server
   */
  static createExternalClient(serverUrl: string): MCPClientService {
    const config: MCPClientConfig = {
      serverUrl,
      timeout: 45000,
      retries: 2,
      headers: {
        'User-Agent': 'Orchestrator-AI-MCP-Client/1.0',
      },
    };

    return new MCPClientService(config);
  }
}

/**
 * Injectable factory for creating MCP clients
 */
@Injectable()
export class MCPClientFactory {
  private readonly logger = new Logger(MCPClientFactory.name);

  /**
   * Get the Supabase MCP client
   */
  getSupabaseClient(): MCPClientService {
    return MCPClientService.createSupabaseClient();
  }

  /**
   * Get an external MCP client
   */
  getExternalClient(serverUrl: string): MCPClientService {
    return MCPClientService.createExternalClient(serverUrl);
  }

  /**
   * Test connectivity to a MCP server
   */
  async testConnection(client: MCPClientService): Promise<boolean> {
    try {
      const isHealthy = await client.ping();
      if (isHealthy) {
        const serverInfo = await client.getServerInfo();
        this.logger.log(`Connected to MCP server: ${serverInfo.name} v${serverInfo.version}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`MCP connection test failed: ${getErrorMessage(error)}`);
      return false;
    }
  }
}