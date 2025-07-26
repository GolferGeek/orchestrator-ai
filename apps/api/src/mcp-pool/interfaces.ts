/**
 * MCP Pool Interfaces
 * 
 * Defines the structure for MCP (Model Context Protocol) service discovery,
 * registration, and pool management - mirroring the AgentPoolService architecture.
 */

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  examples?: string[];
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
}

export interface MCPCapability {
  name: string;
  description: string;
  category: 'data' | 'api' | 'file' | 'computation' | 'communication' | 'other';
  tools: string[]; // Tool names that provide this capability
  examples?: string[];
}

export interface MCPRegistration {
  id: string; // e.g., "supabase-mcp", "gmail-mcp", "file-mcp"
  name: string; // e.g., "Supabase Database MCP"
  type: 'database' | 'api' | 'file' | 'communication' | 'computation' | 'external';
  url: string; // HTTP endpoint for MCP service
  description: string;
  capabilities: MCPCapability[];
  tools: MCPTool[];
  version: string;
  provider: string; // e.g., "supabase", "google", "microsoft", "internal"
  status: 'online' | 'offline' | 'starting' | 'error' | 'discovering';
  registeredAt?: Date;
  lastHeartbeat?: Date;
  discoveredAt?: Date;
  metrics?: MCPMetrics;
  metadata?: Record<string, any>;
  healthEndpoint?: string;
  discoveryEndpoint?: string;
}

export interface MCPHeartbeat {
  mcpId: string;
  timestamp: Date;
  metrics?: MCPMetrics;
  status?: string;
  toolsAvailable?: number;
  lastExecutionTime?: Date;
}

export interface MCPMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageResponseTime: number;
  averageExecutionTime: number;
  toolsUsed: Record<string, number>; // tool name -> usage count
  uptime: number;
  errorRate: number;
  lastExecutionAt?: Date;
  memoryUsage?: number;
  diskUsage?: number;
}

export interface MCPDiscoveryResult {
  discovered: MCPRegistration[];
  errors: MCPDiscoveryError[];
  discoveredAt: Date;
  totalFound: number;
  successfulRegistrations: number;
}

export interface MCPDiscoveryError {
  source: string; // URL or service name
  error: string;
  timestamp: Date;
  retryable: boolean;
}

export interface MCPCapabilitiesDocument {
  generatedAt: Date;
  totalMCPs: number;
  mcpsByType: {
    database: number;
    api: number;
    file: number;
    communication: number;
    computation: number;
    external: number;
  };
  mcpsByProvider: Record<string, number>;
  totalTools: number;
  totalCapabilities: number;
  mcps: MCPInfo[];
  capabilitiesByCategory: {
    data: MCPCapability[];
    api: MCPCapability[];
    file: MCPCapability[];
    computation: MCPCapability[];
    communication: MCPCapability[];
    other: MCPCapability[];
  };
}

export interface MCPInfo {
  id: string;
  name: string;
  type: string;
  url: string;
  description: string;
  capabilities: MCPCapability[];
  tools: MCPTool[];
  provider: string;
  version: string;
  status: string;
  lastHeartbeat?: Date;
  metrics?: MCPMetrics;
  metadata?: Record<string, any>;
}

export interface MCPPoolStats {
  total: number;
  online: number;
  offline: number;
  discovering: number;
  byType: {
    database: number;
    api: number;
    file: number;
    communication: number;
    computation: number;
    external: number;
  };
  byProvider: Record<string, number>;
  totalTools: number;
  totalCapabilities: number;
  healthScore: number; // 0-100 based on online/total ratio
}

export interface MCPExecutionRequest {
  mcpId: string;
  toolName: string;
  parameters: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timeout?: number;
}

export interface MCPExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  mcpId: string;
  toolName: string;
  timestamp: Date;
  executionId: string;
}

// Discovery configuration interfaces
export interface MCPDiscoveryConfig {
  enabled: boolean;
  intervalMs: number; // How often to run discovery
  discoveryEndpoints: string[]; // URLs to check for MCP services
  autoRegister: boolean; // Automatically register discovered MCPs
  healthCheckIntervalMs: number; // How often to check MCP health
  timeoutMs: number; // Discovery request timeout
}

export interface MCPServiceEndpoint {
  url: string;
  type: 'http' | 'websocket';
  authRequired?: boolean;
  healthPath?: string;
  discoveryPath?: string;
  metadata?: Record<string, any>;
}