// MCP (Model Context Protocol) Type Definitions

export type MCPType = 'database' | 'api' | 'file' | 'communication' | 'computation' | 'external';
export type MCPStatus = 'online' | 'offline' | 'discovering';
export type MCPCapabilityCategory = 'data' | 'api' | 'file' | 'computation' | 'communication' | 'other';

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  examples: string[];
}

export interface MCPCapability {
  name: string;
  description: string;
  category: MCPCapabilityCategory;
  tools: string[];
  examples: string[];
}

export interface MCPMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  errorRate: number;
  lastExecutionAt?: Date;
  toolsUsed?: Record<string, number>;
}

export interface MCPRegistration {
  id: string;
  name: string;
  type: MCPType;
  url: string;
  description: string;
  capabilities: MCPCapability[];
  tools: MCPTool[];
  version: string;
  provider: string;
  status: MCPStatus;
  discoveredAt: Date;
  registeredAt?: Date;
  lastHeartbeat?: Date;
  healthEndpoint?: string;
  discoveryEndpoint?: string;
  metrics?: MCPMetrics;
  metadata?: Record<string, any>;
}

export interface MCPPoolStats {
  total: number;
  online: number;
  offline: number;
  discovering: number;
  byType: Record<MCPType, number>;
  byProvider: Record<string, number>;
  totalTools: number;
  totalCapabilities: number;
  healthScore: number;
}

export interface MCPDiscoveryError {
  source: string;
  error: string;
  timestamp: Date;
  retryable: boolean;
}

export interface MCPDiscoveryResult {
  discovered: MCPRegistration[];
  errors: MCPDiscoveryError[];
  discoveredAt: Date;
  totalFound: number;
  successfulRegistrations: number;
}

export interface MCPCapabilitiesDocument {
  generatedAt: Date;
  totalMCPs: number;
  mcpsByType: Record<MCPType, number>;
  mcpsByProvider: Record<string, number>;
  totalTools: number;
  totalCapabilities: number;
  capabilitiesByCategory: Record<MCPCapabilityCategory, MCPCapability[]>;
  mcps: MCPInfo[];
}

export interface MCPInfo {
  id: string;
  name: string;
  type: MCPType;
  url: string;
  description: string;
  capabilities: MCPCapability[];
  tools: MCPTool[];
  provider: string;
  version: string;
  status: MCPStatus;
  lastHeartbeat?: Date;
  metrics?: MCPMetrics;
  metadata?: Record<string, any>;
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

export interface MCPHeartbeat {
  mcpId: string;
  timestamp: Date;
  status: MCPStatus;
  metrics?: MCPMetrics;
  metadata?: Record<string, any>;
}

export interface MCPOrchestrationInfo {
  mcpCount: number;
  toolCount: number;
  mcpList: string;
}

export interface MCPToolsInfo {
  totalTools: number;
  mcpsIncluded: number;
  tools: Array<{
    name: string;
    description: string;
    mcpId: string;
    mcpName: string;
    parameters: Record<string, any>;
    examples: string[];
  }>;
}

// UI-specific types
export interface MCPListItem {
  id: string;
  name: string;
  type: MCPType;
  status: MCPStatus;
  provider: string;
  toolCount: number;
  capabilityCount: number;
  lastSeen?: Date;
  healthScore?: number;
}

export interface MCPHealthInfo {
  status: 'healthy' | 'degraded' | 'offline';
  poolSize: number;
  onlineMCPs: number;
  healthScore: number;
  lastCheck: Date;
}