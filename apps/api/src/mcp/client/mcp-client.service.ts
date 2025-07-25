import { Injectable, Logger } from '@nestjs/common';
import {
  IMCPClient,
  MCPServerConfig,
  MCPAuthConfig,
  MCPToolRequest,
  MCPToolResult,
  MCPProgressCallback,
  MCPConnectionState,
  MCPServerInfo,
  MCPServerHealth,
} from './interfaces/mcp-client.interface';

interface MCPServerConnection {
  config: MCPServerConfig;
  state: MCPConnectionState;
  lastHealthCheck: Date;
  healthStatus: MCPServerHealth;
  retryCount: number;
  maxRetries: number;
}

@Injectable()
export class MCPClientService implements IMCPClient {
  private readonly logger = new Logger(MCPClientService.name);
  private servers = new Map<string, MCPServerConnection>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;

  private readonly instanceId = `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

  constructor() {
    this.logger.log(`🚀 MCPClientService constructor called - Instance ID: ${this.instanceId}`);
    this.logger.log(`📊 isAvailable method exists: ${typeof this.isAvailable === 'function'}`);
    this.startHealthCheckLoop();
  }

  async registerServer(config: MCPServerConfig): Promise<void> {
    try {
      this.logger.log(`Registering MCP server: ${config.name}`);

      // Validate server configuration
      this.validateServerConfig(config);

      // Create connection entry
      const connection: MCPServerConnection = {
        config,
        state: 'connecting',
        lastHealthCheck: new Date(),
        healthStatus: { status: 'unknown' },
        retryCount: 0,
        maxRetries: config.maxRetries || this.MAX_RETRIES,
      };

      this.servers.set(config.name, connection);

      // Attempt initial connection
      await this.connectToServer(config.name);

      this.logger.log(`MCP server registered successfully: ${config.name}`);
    } catch (error) {
      this.logger.error(`Failed to register MCP server ${config.name}:`, error);
      throw error;
    }
  }

  async unregisterServer(serverName: string): Promise<void> {
    try {
      this.logger.log(`Unregistering MCP server: ${serverName}`);

      const connection = this.servers.get(serverName);
      if (!connection) {
        throw new Error(`Server not found: ${serverName}`);
      }

      // Update state to disconnecting
      connection.state = 'disconnecting';

      // Perform cleanup if needed
      await this.disconnectFromServer(serverName);

      // Remove from registry
      this.servers.delete(serverName);

      this.logger.log(`MCP server unregistered: ${serverName}`);
    } catch (error) {
      this.logger.error(
        `Failed to unregister MCP server ${serverName}:`,
        error,
      );
      throw error;
    }
  }

  async listServers(): Promise<MCPServerInfo[]> {
    const serverInfos: MCPServerInfo[] = [];

    for (const [name, connection] of this.servers.entries()) {
      serverInfos.push({
        name: connection.config.name,
        url: connection.config.url || connection.config.endpoint || '',
        transport: connection.config.transport,
        state: connection.state,
        health: connection.healthStatus,
        lastHealthCheck: connection.lastHealthCheck,
        capabilities: connection.config.capabilities || {},
        metadata: connection.config.metadata || {},
      });
    }

    return serverInfos;
  }

  async getServerHealth(serverName: string): Promise<MCPServerHealth> {
    const connection = this.servers.get(serverName);
    if (!connection) {
      throw new Error(`Server not found: ${serverName}`);
    }

    // If health check is stale, perform a fresh one
    const staleThreshold = 60000; // 1 minute
    const isStale =
      Date.now() - connection.lastHealthCheck.getTime() > staleThreshold;

    if (isStale || connection.healthStatus.status === 'unknown') {
      await this.performHealthCheck(serverName);
    }

    return connection.healthStatus;
  }

  async callTool(
    serverName: string,
    toolRequest: MCPToolRequest,
    progressCallback?: MCPProgressCallback,
  ): Promise<MCPToolResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Calling tool ${toolRequest.name} on server ${serverName}`,
      );

      const connection = this.servers.get(serverName);
      if (!connection) {
        throw new Error(`Server not found: ${serverName}`);
      }

      if (connection.state !== 'connected') {
        throw new Error(
          `Server ${serverName} is not connected (state: ${connection.state})`,
        );
      }

      // Prepare progress callback wrapper
      const wrappedProgressCallback = progressCallback
        ? async (progress: any) => {
            try {
              await progressCallback({
                ...progress,
                serverName,
                toolName: toolRequest.name,
                timestamp: new Date().toISOString(),
              });
            } catch (error) {
              this.logger.warn(
                `Progress callback error for ${serverName}:`,
                error,
              );
            }
          }
        : undefined;

      // Make the actual call based on transport type
      let result: MCPToolResult;

      switch (connection.config.transport) {
        case 'http':
          result = await this.callToolHTTP(
            connection,
            toolRequest,
            wrappedProgressCallback,
          );
          break;
        case 'http+sse':
          result = await this.callToolHTTPSSE(
            connection,
            toolRequest,
            wrappedProgressCallback,
          );
          break;
        case 'websocket':
          result = await this.callToolWebSocket(
            connection,
            toolRequest,
            wrappedProgressCallback,
          );
          break;
        default:
          throw new Error(
            `Unsupported transport: ${connection.config.transport}`,
          );
      }

      const executionTime = Date.now() - startTime;

      this.logger.debug(
        `Tool call completed in ${executionTime}ms: ${toolRequest.name}`,
      );

      return {
        ...result,
        metadata: {
          ...result.metadata,
          serverName,
          executionTime,
          transport: connection.config.transport,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Tool call failed after ${executionTime}ms:`, error);

      // Mark server as potentially unhealthy if tool call fails
      const connection = this.servers.get(serverName);
      if (connection) {
        connection.healthStatus = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date(),
        };
      }

      throw error;
    }
  }

  private async callToolHTTP(
    connection: MCPServerConnection,
    toolRequest: MCPToolRequest,
    progressCallback?: (progress: any) => Promise<void>,
  ): Promise<MCPToolResult> {
    const baseUrl = connection.config.url || connection.config.endpoint;
    const url = `${baseUrl}/tools/${toolRequest.name}`;

    const requestBody = {
      arguments: toolRequest.arguments,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: new Date().toISOString(),
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Add authentication headers
    const authConfig =
      connection.config.auth || connection.config.authentication;
    if (authConfig) {
      this.addAuthHeaders(headers, authConfig);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(connection.config.timeout || 30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Parse the MCP server response correctly
      let parsedData = null;
      
      if (!result.isError && result.content?.[0]?.text) {
        try {
          // Try to parse the JSON text from the content
          parsedData = JSON.parse(result.content[0].text);
        } catch (parseError) {
          // If JSON parsing fails, use the raw text
          parsedData = result.content[0].text;
        }
      } else if (!result.isError && result.content) {
        // Fallback to raw content if no text field
        parsedData = result.content;
      }

      return {
        success: !result.isError,
        data: parsedData,
        error: result.isError ? result.content?.[0]?.text : undefined,
        metadata: result._meta || {},
      };
    } catch (error) {
      throw new Error(
        `HTTP call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async callToolHTTPSSE(
    connection: MCPServerConnection,
    toolRequest: MCPToolRequest,
    progressCallback?: (progress: any) => Promise<void>,
  ): Promise<MCPToolResult> {
    // For HTTP+SSE, we make an HTTP call but also listen for progress events
    const baseUrl = connection.config.url || connection.config.endpoint;
    const url = `${baseUrl}/tools/${toolRequest.name}`;
    const sseUrl = `${baseUrl}/tools/${toolRequest.name}/progress`;

    const requestId = this.generateRequestId();

    // Start SSE connection for progress updates if callback provided
    let sseCleanup: (() => void) | null = null;

    if (progressCallback) {
      const authConfig =
        connection.config.auth || connection.config.authentication;
      sseCleanup = await this.setupSSEProgressListener(
        sseUrl,
        requestId,
        authConfig,
        progressCallback,
      );
    }

    try {
      const result = await this.callToolHTTP(connection, {
        ...toolRequest,
        arguments: {
          ...toolRequest.arguments,
          _requestId: requestId,
          _enableProgress: !!progressCallback,
        },
      });

      return result;
    } finally {
      // Clean up SSE connection
      if (sseCleanup) {
        sseCleanup();
      }
    }
  }

  private async callToolWebSocket(
    connection: MCPServerConnection,
    toolRequest: MCPToolRequest,
    progressCallback?: (progress: any) => Promise<void>,
  ): Promise<MCPToolResult> {
    // WebSocket implementation would go here
    // For now, throw an error indicating it's not implemented
    throw new Error('WebSocket transport not yet implemented');
  }

  private async setupSSEProgressListener(
    sseUrl: string,
    requestId: string,
    auth: MCPAuthConfig | undefined,
    progressCallback: (progress: any) => Promise<void>,
  ): Promise<() => void> {
    // This would set up an EventSource connection for progress updates
    // For now, return a no-op cleanup function
    return () => {};
  }

  private async connectToServer(serverName: string): Promise<void> {
    const connection = this.servers.get(serverName);
    if (!connection) {
      throw new Error(`Server not found: ${serverName}`);
    }

    try {
      connection.state = 'connecting';

      // Test connection with a health check
      const health = await this.performHealthCheck(serverName);

      if (health.status === 'healthy') {
        connection.state = 'connected';
        connection.retryCount = 0;
      } else {
        throw new Error(
          `Server health check failed: ${health.error || 'Unknown error'}`,
        );
      }
    } catch (error) {
      connection.state = 'failed';
      connection.retryCount++;

      this.logger.error(`Failed to connect to server ${serverName}:`, error);

      // Schedule retry if within limits
      if (connection.retryCount < connection.maxRetries) {
        setTimeout(
          () => {
            this.connectToServer(serverName).catch((err) => {
              this.logger.error(
                `Retry connection failed for ${serverName}:`,
                err,
              );
            });
          },
          Math.min(1000 * Math.pow(2, connection.retryCount), 30000),
        ); // Exponential backoff
      }

      throw error;
    }
  }

  private async disconnectFromServer(serverName: string): Promise<void> {
    const connection = this.servers.get(serverName);
    if (!connection) {
      return;
    }

    connection.state = 'disconnected';
    // Additional cleanup logic would go here
  }

  private async performHealthCheck(
    serverName: string,
  ): Promise<MCPServerHealth> {
    const connection = this.servers.get(serverName);
    if (!connection) {
      throw new Error(`Server not found: ${serverName}`);
    }

    try {
      const baseUrl = connection.config.url || connection.config.endpoint;
      const healthUrl = `${baseUrl}/health`;
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      const authConfig =
        connection.config.auth || connection.config.authentication;
      if (authConfig) {
        this.addAuthHeaders(headers, authConfig);
      }

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000), // 5 second timeout for health check
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const healthData = await response.json();

      const health: MCPServerHealth = {
        status: healthData.status === 'healthy' ? 'healthy' : 'unhealthy',
        details: healthData.details,
        lastCheck: new Date(),
      };

      connection.healthStatus = health;
      connection.lastHealthCheck = new Date();

      return health;
    } catch (error) {
      const health: MCPServerHealth = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
      };

      connection.healthStatus = health;
      connection.lastHealthCheck = new Date();

      return health;
    }
  }

  private startHealthCheckLoop(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [serverName, connection] of this.servers.entries()) {
        if (connection.state === 'connected') {
          try {
            await this.performHealthCheck(serverName);
          } catch (error) {
            this.logger.warn(`Health check failed for ${serverName}:`, error);
          }
        }
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private validateServerConfig(config: MCPServerConfig): void {
    if (!config.name?.trim()) {
      throw new Error('Server name is required');
    }

    const serverUrl = config.url || config.endpoint;
    if (!serverUrl?.trim()) {
      throw new Error('Server URL or endpoint is required');
    }

    if (!['http', 'http+sse', 'websocket'].includes(config.transport)) {
      throw new Error(`Unsupported transport: ${config.transport}`);
    }

    try {
      new URL(serverUrl);
    } catch {
      throw new Error('Invalid server URL');
    }
  }

  private addAuthHeaders(
    headers: Record<string, string>,
    auth: MCPAuthConfig,
  ): void {
    switch (auth.type) {
      case 'bearer':
        if (auth.token) {
          headers['Authorization'] = `Bearer ${auth.token}`;
        }
        break;
      case 'api-key':
      case 'api_key':
        if (auth.apiKey) {
          const headerName = auth.headerName || auth.header || 'X-API-Key';
          headers[headerName] = auth.apiKey;
        }
        break;
      case 'basic':
        if (auth.username && auth.password) {
          const credentials = btoa(`${auth.username}:${auth.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
    }
  }

  private generateRequestId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down MCP Client Service...');

    // Stop health check loop
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Disconnect from all servers
    const disconnectPromises = Array.from(this.servers.keys()).map(
      (serverName) =>
        this.disconnectFromServer(serverName).catch((error) =>
          this.logger.error(`Error disconnecting from ${serverName}:`, error),
        ),
    );

    await Promise.allSettled(disconnectPromises);
    this.servers.clear();

    this.logger.log('MCP Client Service shutdown complete');
  }

  /**
   * Check if MCP service is available and has connected servers
   */
  isAvailable(): boolean {
    const hasServers = this.servers.size > 0;
    const connectedServers = Array.from(this.servers.values()).filter(
      connection => connection.state === 'connected'
    );
    
    this.logger.debug(`isAvailable check [${this.instanceId}]: hasServers=${hasServers}, connectedCount=${connectedServers.length}`);
    
    if (this.servers.size === 0) {
      return false;
    }

    // Check if any server is connected
    return connectedServers.length > 0;
  }

  /**
   * Get list of available servers
   */
  getAvailableServers(): string[] {
    return Array.from(this.servers.entries())
      .filter(([_, connection]) => connection.state === 'connected')
      .map(([name, _]) => name);
  }
}
