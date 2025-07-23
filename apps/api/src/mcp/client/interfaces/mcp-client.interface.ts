export interface MCPServerConfig {
  id: string;
  name: string;
  type: 'local' | 'same-box' | 'external';
  transport:
    | 'stdio'
    | 'http-sse'
    | 'streamable-http'
    | 'http'
    | 'http+sse'
    | 'websocket';
  endpoint?: string; // Required for HTTP transports
  url?: string; // URL for HTTP-based transports
  port?: number; // For local servers
  authentication?: MCPAuthConfig;
  auth?: MCPAuthConfig; // Alternative auth field name
  capabilities?: string[];
  healthCheck?: MCPHealthCheckConfig;
  autoStart?: boolean; // For same-box servers
  command?: string; // For same-box servers
  args?: string[]; // For same-box servers
  timeout?: number; // Request timeout in ms
  maxRetries?: number; // Max retry attempts
  metadata?: Record<string, any>; // Additional metadata
}

export interface MCPAuthConfig {
  type: 'none' | 'bearer' | 'api_key' | 'oauth' | 'api-key' | 'basic';
  token?: string;
  apiKey?: string;
  header?: string; // Custom header name for API key
  headerName?: string; // Alternative header name field
  clientId?: string; // For OAuth
  clientSecret?: string; // For OAuth
  username?: string; // For basic auth
  password?: string; // For basic auth
}

export interface MCPHealthCheckConfig {
  enabled: boolean;
  endpoint?: string; // Health check URL
  interval: number; // Check interval in ms
  timeout: number; // Request timeout in ms
  retries: number; // Failed attempts before marking unhealthy
}

export interface MCPServerStatus {
  id: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'starting' | 'stopped';
  lastChecked: Date;
  responseTime?: number; // ms
  error?: string;
  uptime?: number; // seconds
  version?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
  examples?: MCPToolExample[];
}

export interface MCPToolExample {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface MCPResource {
  name: string;
  description: string;
  mimeType: string;
  uri: string;
}

export interface MCPConnection {
  serverId: string;
  transport: 'stdio' | 'http-sse' | 'streamable-http';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  client: any; // MCP SDK client instance
  tools: MCPTool[];
  resources: MCPResource[];
  lastActivity: Date;
  error?: string;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime?: number;
    recordCount?: number;
    queryGenerated?: string;
    modelUsed?: string;
    safetyScore?: number;
    serverName?: string;
    transport?: string;
    [key: string]: any; // Allow additional metadata
  };
}

export interface MCPProgressCallback {
  (progress: {
    taskId?: string;
    step?: string;
    stepIndex?: number;
    totalSteps?: number;
    message: string;
    status?: 'in_progress' | 'completed' | 'error';
    substep?: string;
    metadata?: any;
    serverName?: string;
    toolName?: string;
    timestamp?: string;
  }): Promise<void>;
}

// Additional interfaces needed by MCP client service
export interface IMCPClient {
  registerServer(config: MCPServerConfig): Promise<void>;
  unregisterServer(serverName: string): Promise<void>;
  listServers(): Promise<MCPServerInfo[]>;
  getServerHealth(serverName: string): Promise<MCPServerHealth>;
  callTool(
    serverName: string,
    toolRequest: MCPToolRequest,
    progressCallback?: MCPProgressCallback,
  ): Promise<MCPToolResult>;
}

export interface MCPToolRequest {
  name: string;
  arguments?: Record<string, any>;
}

export type MCPConnectionState =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'disconnecting'
  | 'failed';

export interface MCPServerInfo {
  name: string;
  url: string;
  transport: string;
  state: MCPConnectionState;
  health: MCPServerHealth;
  lastHealthCheck: Date;
  capabilities: Record<string, any>;
  metadata: Record<string, any>;
}

export interface MCPServerHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  details?: any;
  error?: string;
  lastCheck?: Date;
}
