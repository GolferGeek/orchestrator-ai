import type { JsonValue, JsonObject } from '@orchestrator-ai/transport-types';

/**
 * Agent Type Definitions
 * Domain-specific types for agent management and hierarchy
 */

// =====================================
// AGENT HIERARCHY
// =====================================

/**
 * Agent hierarchy node metadata
 */
export interface AgentNodeMetadata {
  /** Display name for the node */
  displayName?: string;

  /** Description of the agent/node */
  description?: string;

  /** Icon identifier */
  icon?: string;

  /** Color for UI display */
  color?: string;

  /** Namespace for organization */
  namespace?: string;

  /** Node order/priority */
  order?: number;

  /** Visibility flags */
  visibility?: {
    hidden?: boolean;
    collapsed?: boolean;
    featured?: boolean;
  };

  /** Capabilities */
  capabilities?: string[];

  /** Tags for categorization */
  tags?: string[];

  /** Custom metadata fields */
  custom?: Record<string, string | number | boolean>;
}

/**
 * Agent hierarchy node
 * Represents a node in the agent tree structure
 */
export interface HierarchyNode {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Node type */
  type: 'agent' | 'group' | 'category';

  /** Agent type (for agent nodes) */
  agentType?: string;

  /** Parent node ID */
  parentId?: string | null;

  /** Child nodes */
  children?: HierarchyNode[];

  /** Node level in hierarchy (0 = root) */
  level?: number;

  /** Whether node is expanded in UI */
  expanded?: boolean;

  /** Whether node is selectable */
  selectable?: boolean;

  /** Namespace for organizational grouping */
  namespace?: string;

  /** Node metadata */
  metadata?: AgentNodeMetadata;

  /** Creation/update timestamps */
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Flat hierarchy data for tree building
 */
export interface FlatHierarchyData {
  id: string;
  name: string;
  type: string;
  agentType?: string;
  parentId?: string | null;
  namespace?: string;
  metadata?: AgentNodeMetadata;
  [key: string]: JsonValue;
}

// =====================================
// AGENT DEFINITIONS
// =====================================

/**
 * Agent capability definition
 */
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  requiredPermissions?: string[];
}

/**
 * Agent configuration
 */
export interface AgentConfiguration {
  /** Model configuration */
  model?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };

  /** Available tools */
  tools?: string[];

  /** System prompt */
  systemPrompt?: string;

  /** Context window size */
  contextWindow?: number;

  /** Response preferences */
  responsePreferences?: {
    format?: 'text' | 'json' | 'markdown';
    maxLength?: number;
    style?: string;
  };

  /** Safety settings */
  safety?: {
    contentFilter?: boolean;
    piiDetection?: boolean;
    toxicityFilter?: boolean;
  };

  /** Performance settings */
  performance?: {
    cacheEnabled?: boolean;
    streamingEnabled?: boolean;
    batchEnabled?: boolean;
  };

  /** Custom configuration */
  custom?: Record<string, JsonValue>;
}

/**
 * Agent definition
 */
export interface Agent {
  id: string;
  name: string;
  type: string;
  description?: string;
  status: 'active' | 'inactive' | 'archived';
  namespace?: string;
  capabilities?: AgentCapability[];
  configuration?: AgentConfiguration;
  metadata?: AgentNodeMetadata;
  createdAt: string;
  updatedAt: string;
}

export type AgentHierarchyResponse = {
  data?: HierarchyNode[];
  metadata?: AgentNodeMetadata | null;
} & JsonObject;

// =====================================
// AGENT STATISTICS
// =====================================

/**
 * Agent usage statistics
 */
export interface AgentStatistics {
  agentId: string;
  agentType: string;

  /** Usage counts */
  usage: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskDuration: number;
  };

  /** Performance metrics */
  performance: {
    successRate: number;
    averageResponseTime: number;
    qualityScore?: number;
    userSatisfaction?: number;
  };

  /** Resource consumption */
  resources: {
    totalTokens: number;
    totalCost: number;
    averageTokensPerTask: number;
    averageCostPerTask: number;
  };

  /** Time range */
  period: {
    from: string;
    to: string;
  };

  /** Last activity */
  lastActivity?: {
    taskId: string;
    timestamp: string;
    status: string;
  };
}

/**
 * Agent health status
 */
export interface AgentHealthStatus {
  agentId: string;
  agentType: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    timestamp: string;
  }>;
  lastCheckedAt: string;
}

// =====================================
// HIERARCHY OPERATIONS
// =====================================

/**
 * Options for building agent hierarchy
 */
export interface BuildHierarchyOptions {
  /** Maximum depth to traverse */
  maxDepth?: number;

  /** Include metadata in nodes */
  includeMetadata?: boolean;

  /** Filter function for nodes */
  filter?: (node: HierarchyNode) => boolean;

  /** Sort function for children */
  sort?: (a: HierarchyNode, b: HierarchyNode) => number;

  /** Whether to expand all nodes by default */
  expandAll?: boolean;
}

/**
 * Result of hierarchy operations
 */
export interface HierarchyOperationResult {
  success: boolean;
  message?: string;
  affectedNodes?: string[];
  hierarchy?: HierarchyNode;
  errors?: Array<{
    nodeId: string;
    error: string;
  }>;
}

// =====================================
// FILTERING & SORTING
// =====================================

/**
 * Filters for querying agents
 */
export interface AgentFilters {
  type?: string | string[];
  status?: 'active' | 'inactive' | 'archived';
  namespace?: string | string[];
  capabilities?: string[];
  tags?: string[];
  search?: string;
}

/**
 * Sort options for agents
 */
export interface AgentSortOptions {
  field: 'name' | 'type' | 'createdAt' | 'updatedAt' | 'usageCount';
  direction: 'asc' | 'desc';
}

// =====================================
// CREATION PAYLOADS
// =====================================

/**
 * Payload for creating a new agent
 */
export interface CreateAgentPayload {
  name: string;
  type: string;
  description?: string;
  namespace?: string;
  capabilities?: string[];
  configuration?: AgentConfiguration;
  metadata?: AgentNodeMetadata;
}

/**
 * Payload for updating an agent
 */
export interface UpdateAgentPayload {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive' | 'archived';
  namespace?: string;
  capabilities?: string[];
  configuration?: Partial<AgentConfiguration>;
  metadata?: Partial<AgentNodeMetadata>;
}
