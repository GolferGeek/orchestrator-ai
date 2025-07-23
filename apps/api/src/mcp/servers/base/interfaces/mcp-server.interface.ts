export interface MCPServerCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  description?: string;
  capabilities: MCPServerCapabilities;
  metadata?: Record<string, any>;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPromptDefinition {
  name: string;
  description?: string;
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];
}

export interface MCPServerContext {
  serverId: string;
  serverName: string;
  requestId: string;
  timestamp: Date;
  clientInfo?: {
    name?: string;
    version?: string;
  };
}

export interface MCPToolRequest {
  name: string;
  arguments?: Record<string, any>;
  context: MCPServerContext;
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string; // Base64 for images
    resource?: string; // URI for resources
    mimeType?: string;
  }>;
  isError?: boolean;
  _meta?: Record<string, any>;
}

export interface MCPResourceRequest {
  uri: string;
  context: MCPServerContext;
}

export interface MCPResourceResponse {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string; // Base64 encoded binary data
  }>;
}

export interface MCPPromptRequest {
  name: string;
  arguments?: Record<string, any>;
  context: MCPServerContext;
}

export interface MCPPromptResponse {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text' | 'image' | 'resource';
      text?: string;
      data?: string;
      resource?: string;
      mimeType?: string;
    };
  }>;
}

export interface MCPLogLevel {
  level:
    | 'debug'
    | 'info'
    | 'notice'
    | 'warning'
    | 'error'
    | 'critical'
    | 'alert'
    | 'emergency';
  data?: any;
  logger?: string;
}

export interface MCPProgressNotification {
  progressToken: number | string;
  progress: number; // 0-100
  total?: number;
}

// Response wrapper types for list operations
export interface MCPListToolsResponse {
  tools: MCPToolDefinition[];
}

export interface MCPListResourcesResponse {
  resources: MCPResourceDefinition[];
}

export interface MCPListPromptsResponse {
  prompts: MCPPromptDefinition[];
}

export interface MCPGetResourceRequest {
  uri: string;
}

export interface MCPGetResourceResponse {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string; // Base64 encoded binary data
  }>;
}

export interface MCPGetPromptRequest {
  name: string;
  arguments?: Record<string, any>;
}

export interface MCPGetPromptResponse {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text' | 'image' | 'resource';
      text?: string;
      data?: string;
      resource?: string;
      mimeType?: string;
    };
  }>;
}

// Base interface that all MCP servers must implement
export interface IMCPServer {
  getServerInfo?(): Promise<MCPServerInfo>;
  listTools(): Promise<MCPListToolsResponse>;
  callTool(
    request: MCPToolRequest,
    progressCallback?: (progress: any) => Promise<void>,
  ): Promise<MCPToolResponse>;
  listResources?(): Promise<MCPListResourcesResponse>;
  getResource?(request: MCPGetResourceRequest): Promise<MCPGetResourceResponse>;
  listPrompts?(): Promise<MCPListPromptsResponse>;
  getPrompt?(request: MCPGetPromptRequest): Promise<MCPGetPromptResponse>;
  initialize?(config?: any): Promise<void>;
  shutdown?(): Promise<void>;
}
