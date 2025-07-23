// Client interfaces and services
export {
  MCPServerConfig,
  MCPAuthConfig,
  MCPHealthCheckConfig,
  MCPServerStatus,
  MCPTool,
  MCPToolExample,
  MCPResource,
  MCPConnection,
  MCPToolResult,
  MCPProgressCallback,
  IMCPClient,
  MCPConnectionState,
  MCPServerHealth,
} from './client/interfaces/mcp-client.interface';

// Re-export client types with aliases to avoid conflicts
export {
  MCPServerInfo as MCPClientServerInfo,
  MCPToolRequest as MCPClientToolRequest,
} from './client/interfaces/mcp-client.interface';

// Base server interfaces and services
export {
  MCPServerCapabilities,
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPPromptDefinition,
  MCPServerContext,
  MCPToolResponse,
  MCPResourceRequest,
  MCPResourceResponse,
  MCPPromptRequest,
  MCPPromptResponse,
  MCPLogLevel,
  MCPProgressNotification,
  IMCPServer,
} from './servers/base/interfaces/mcp-server.interface';

// Re-export server types with aliases to avoid conflicts
export {
  MCPServerInfo as MCPServerServerInfo,
  MCPToolRequest as MCPServerToolRequest,
} from './servers/base/interfaces/mcp-server.interface';

export { MCPServerBaseService } from './servers/base/mcp-server-base.service';

// Supabase MCP Server
export * from './servers/supabase';
