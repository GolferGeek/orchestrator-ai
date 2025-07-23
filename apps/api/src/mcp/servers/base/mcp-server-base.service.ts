import { Injectable, Logger } from '@nestjs/common';
import {
  IMCPServer,
  MCPServerInfo,
  MCPToolDefinition,
  MCPToolRequest,
  MCPToolResponse,
  MCPResourceDefinition,
  MCPResourceRequest,
  MCPResourceResponse,
  MCPPromptDefinition,
  MCPPromptRequest,
  MCPPromptResponse,
  MCPServerCapabilities,
  MCPListToolsResponse,
  MCPListResourcesResponse,
  MCPListPromptsResponse,
  MCPGetResourceRequest,
  MCPGetResourceResponse,
  MCPGetPromptRequest,
  MCPGetPromptResponse,
} from './interfaces/mcp-server.interface';

/**
 * Base MCP Server Service
 * Provides common functionality for all MCP server implementations
 */
@Injectable()
export abstract class MCPServerBaseService implements IMCPServer {
  protected readonly logger = new Logger(this.constructor.name);
  protected initialized = false;

  /**
   * Get server information - must be implemented by subclasses
   */
  abstract getServerInfo(): Promise<MCPServerInfo>;

  /**
   * List available tools - must be implemented by subclasses
   */
  abstract listTools(): Promise<MCPListToolsResponse>;

  /**
   * Execute a tool - must be implemented by subclasses
   */
  abstract callTool(
    request: MCPToolRequest,
    progressCallback?: (progress: any) => Promise<void>,
  ): Promise<MCPToolResponse>;

  /**
   * Initialize the server (optional override)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Server already initialized');
      return;
    }

    this.logger.log('Initializing MCP server...');
    await this.onInitialize();
    this.initialized = true;
    this.logger.log('MCP server initialized successfully');
  }

  /**
   * Shutdown the server (optional override)
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('Server not initialized');
      return;
    }

    this.logger.log('Shutting down MCP server...');
    await this.onShutdown();
    this.initialized = false;
    this.logger.log('MCP server shutdown complete');
  }

  /**
   * List available resources (optional implementation)
   */
  async listResources(): Promise<MCPListResourcesResponse> {
    return { resources: [] };
  }

  /**
   * Get a resource (optional implementation)
   */
  async getResource(
    request: MCPGetResourceRequest,
  ): Promise<MCPGetResourceResponse> {
    throw new Error(`Resource reading not supported: ${request.uri}`);
  }

  /**
   * List available prompts (optional implementation)
   */
  async listPrompts(): Promise<MCPListPromptsResponse> {
    return { prompts: [] };
  }

  /**
   * Get a prompt (optional implementation)
   */
  async getPrompt(request: MCPGetPromptRequest): Promise<MCPGetPromptResponse> {
    throw new Error(`Prompt not found: ${request.name}`);
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create a successful tool response
   */
  protected createSuccessResponse(
    content: string | Record<string, any>,
    metadata?: Record<string, any>,
  ): MCPToolResponse {
    const textContent =
      typeof content === 'string' ? content : JSON.stringify(content, null, 2);

    return {
      content: [
        {
          type: 'text',
          text: textContent,
        },
      ],
      isError: false,
      _meta: metadata,
    };
  }

  /**
   * Create an error tool response
   */
  protected createErrorResponse(
    error: string | Error,
    metadata?: Record<string, any>,
  ): MCPToolResponse {
    const errorMessage = error instanceof Error ? error.message : error;

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
      _meta: {
        ...metadata,
        error: errorMessage,
      },
    };
  }

  /**
   * Validate tool request parameters
   */
  protected validateToolRequest(
    request: MCPToolRequest,
    requiredParams: string[] = [],
    optionalParams: string[] = [],
  ): void {
    const args = request.arguments || {};

    // Check required parameters
    for (const param of requiredParams) {
      if (!(param in args)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }

    // Check for unknown parameters
    const allValidParams = [...requiredParams, ...optionalParams];
    for (const param in args) {
      if (!allValidParams.includes(param)) {
        this.logger.warn(`Unknown parameter: ${param}`);
      }
    }
  }

  /**
   * Log tool execution
   */
  protected logToolExecution(
    toolName: string,
    args: Record<string, any>,
    executionTime: number,
    success: boolean,
  ): void {
    const logData = {
      tool: toolName,
      args: this.sanitizeArgsForLogging(args),
      executionTime: `${executionTime}ms`,
      success,
    };

    if (success) {
      this.logger.log(`Tool executed successfully: ${JSON.stringify(logData)}`);
    } else {
      this.logger.error(`Tool execution failed: ${JSON.stringify(logData)}`);
    }
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   */
  protected sanitizeArgsForLogging(
    args: Record<string, any>,
  ): Record<string, any> {
    const sanitized = { ...args };

    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Override for custom initialization logic
   */
  protected async onInitialize(): Promise<void> {
    // Default implementation - no additional setup required
  }

  /**
   * Override for custom shutdown logic
   */
  protected async onShutdown(): Promise<void> {
    // Default implementation - no cleanup required
  }

  /**
   * Get default server capabilities
   */
  protected getDefaultCapabilities(): MCPServerCapabilities {
    return {
      tools: true,
      resources: false,
      prompts: false,
      logging: true,
    };
  }
}
