/**
 * MCP (Model Context Protocol) Client Interfaces
 * 
 * Defines TypeScript interfaces for MCP 2025-03-26 specification compliance
 * HTTP transport with JSON-RPC messaging
 */

// Core MCP Types
export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: MCPCapabilities;
  description?: string;
  metadata?: Record<string, any>;
}

export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
}

// Tool Definitions
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Request/Response Types
export interface MCPToolRequest {
  name: string;
  arguments?: Record<string, any>;
  context?: MCPServerContext;
}

export interface MCPToolResponse {
  content: MCPContent[];
  isError?: boolean;
  _meta?: Record<string, any>;
}

export interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  resource?: string;
  mimeType?: string;
}

export interface MCPServerContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
}

// JSON-RPC Types (2025 MCP HTTP transport)
export interface MCPJsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPJsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPJsonRpcError;
}

export interface MCPJsonRpcError {
  code: number;
  message: string;
  data?: any;
}

// Client Interface
export interface IMCPClient {
  /**
   * Get server information
   */
  getServerInfo(): Promise<MCPServerInfo>;

  /**
   * List available tools
   */
  listTools(): Promise<MCPToolDefinition[]>;

  /**
   * Call a specific tool
   */
  callTool(request: MCPToolRequest): Promise<MCPToolResponse>;

  /**
   * Check if server is healthy
   */
  ping(): Promise<boolean>;
}

// Server Interface  
export interface IMCPServer {
  /**
   * Get server information
   */
  getServerInfo?(): Promise<MCPServerInfo>;

  /**
   * List available tools
   */
  listTools(): Promise<MCPToolDefinition[]>;

  /**
   * Execute a tool call
   */
  callTool(request: MCPToolRequest): Promise<MCPToolResponse>;

  /**
   * Initialize server
   */
  initialize?(config?: any): Promise<void>;

  /**
   * Shutdown server
   */
  shutdown?(): Promise<void>;
}

// Configuration Types
export interface MCPClientConfig {
  serverUrl: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export interface MCPServerConfig {
  port: number;
  host?: string;
  cors?: boolean;
  timeout?: number;
}

// Supabase-specific Tool Types
export interface SupabaseSchemaRequest {
  tables?: string[];
  domain?: 'core' | 'kpi';
}

export interface SupabaseSQLRequest {
  query: string;
  tables: string[];
  domain_hint?: string;
  max_rows?: number;
}

export interface SupabaseExecuteRequest {
  sql: string;
  max_rows?: number;
  timeout?: number;
}

export interface SupabaseAnalyzeRequest {
  data: any[];
  analysis_prompt: string;
  provider?: string;
  model?: string;
}

export interface SupabaseSQLResponse {
  sql: string;
  explanation?: string;
  tables_used: string[];
  estimated_rows?: number;
}

export interface SupabaseQueryResult {
  data: any[];
  row_count: number;
  execution_time_ms: number;
  columns: string[];
}

export interface SupabaseAnalysisResult {
  analysis: string;
  insights: string[];
  recommendations?: string[];
  charts_suggested?: string[];
}