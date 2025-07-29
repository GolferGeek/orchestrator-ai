/**
 * JSON-RPC 2.0 Protocol Interfaces
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: JsonRpcError;
  id: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

/**
 * Agent Card and Metadata Interfaces
 */

export interface AgentEndpoints {
  tasks: string;
  health: string;
  agent?: string;
  [key: string]: string | undefined;
}

export interface AgentMetadata {
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * Task Management Interfaces
 */

export interface Task {
  id: string;
  method: string;
  params: any;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  result?: any;
  error?: JsonRpcError;
  timeout?: number;
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface TaskCreationRequest {
  method: string;
  params?: any;
  timeout?: number;
}

/**
 * Health and Monitoring Interfaces
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: HealthCheck[];
  uptime: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
}

export interface AgentMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  activeTasks: number;
  completedTasks: number;
  uptime: number;
  memoryUsage?: NodeJS.MemoryUsage;
  timestamp: Date;
}

/**
 * Configuration Interfaces
 */

export interface A2AConfig {
  agentName: string;
  agentType: string;
  version: string;
  capabilities: string[];
  maxConcurrentTasks?: number;
  defaultTimeout?: number;
  enableMetrics?: boolean;
  enableAuditLog?: boolean;
}

/**
 * Error Code Constants
 */

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000,
} as const;

export type JsonRpcErrorCode =
  (typeof JSON_RPC_ERRORS)[keyof typeof JSON_RPC_ERRORS];

// ============================================================================
// A2A AGENT CARD INTERFACES (Based on Google A2A Specification v0.2.1)
// ============================================================================

/**
 * Information about the organization or entity providing the agent
 */
export interface AgentProvider {
  /** Name of the organization/entity */
  organization: string;
  /** URL for the provider's website/contact */
  url: string;
}

/**
 * Extension to the A2A protocol supported by the agent
 */
export interface AgentExtension {
  /** The URI for the supported extension */
  uri: string;
  /** Whether the agent requires clients to follow extension protocol logic */
  required?: boolean;
  /** Description of how the extension is used by the agent */
  description?: string;
  /** Configuration parameters specific to the extension */
  params?: Record<string, any>;
}

/**
 * Optional A2A protocol features supported by the agent
 */
export interface AgentCapabilities {
  /** Indicates support for SSE streaming methods (message/stream, tasks/resubscribe) */
  streaming?: boolean;
  /** Indicates support for push notification methods */
  pushNotifications?: boolean;
  /** Placeholder for future feature: exposing detailed task status change history */
  stateTransitionHistory?: boolean;
  /** A list of extensions supported by this agent */
  extensions?: AgentExtension[];
}

/**
 * Security scheme for authenticating with the agent
 * Aligned with OpenAPI Security Scheme Object
 */
export interface SecurityScheme {
  /** The type of the security scheme */
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect' | 'mutualTLS';
  /** A short description for security scheme */
  description?: string;
  /** The name of the header, query or cookie parameter (for apiKey type) */
  name?: string;
  /** The location of the API key (for apiKey type) */
  in?: 'query' | 'header' | 'cookie';
  /** The name of the HTTP Authorization scheme (for http type) */
  scheme?: string;
  /** A hint to the client to identify how the bearer token is formatted (for http type with bearer scheme) */
  bearerFormat?: string;
  /** An object containing configuration information for OAuth2 flows (for oauth2 type) */
  flows?: Record<string, any>;
  /** OpenId Connect URL to discover OAuth2 configuration values (for openIdConnect type) */
  openIdConnectUrl?: string;
}

/**
 * Describes a specific capability, function, or area of expertise the agent can perform
 */
export interface AgentSkill {
  /** Unique skill identifier within this agent */
  id: string;
  /** Human-readable skill name */
  name: string;
  /** Detailed skill description (CommonMark supported) */
  description: string;
  /** Keywords/categories for discoverability */
  tags: string[];
  /** Example prompts or use cases demonstrating skill usage */
  examples?: string[];
  /** Overrides defaultInputModes for this specific skill - accepted Media Types */
  inputModes?: string[];
  /** Overrides defaultOutputModes for this specific skill - produced Media Types */
  outputModes?: string[];
}

/**
 * Complete A2A Agent Card structure
 * This is the JSON metadata document published by an A2A Server
 */
export interface AgentCard {
  /** Human-readable name of the agent */
  name: string;
  /** Agent type (e.g., 'orchestrator', 'specialists') */
  type?: string;
  /** Human-readable description (CommonMark supported) */
  description: string;
  /** Base URL for the agent's A2A service (HTTPS for production) */
  url: string;
  /** Information about the agent's provider */
  provider?: AgentProvider;
  /** URL to an icon for the agent */
  iconUrl?: string;
  /** Agent or A2A implementation version string */
  version: string;
  /** URL to human-readable documentation for the agent */
  documentationUrl?: string;
  /** Optional A2A protocol features supported */
  capabilities: AgentCapabilities;
  /** Security scheme details used for authenticating with this agent */
  securitySchemes?: Record<string, SecurityScheme>;
  /** Security requirements for contacting the agent */
  security?: Array<Record<string, string[]>>;
  /** Input Media Types accepted by the agent */
  defaultInputModes: string[];
  /** Output Media Types produced by the agent */
  defaultOutputModes: string[];
  /** Array of skills (must have at least one if the agent performs actions) */
  skills: AgentSkill[];
  /** Indicates support for retrieving a more detailed Agent Card via authenticated endpoint */
  supportsAuthenticatedExtendedCard?: boolean;
}

/**
 * Configuration for generating an Agent Card
 */
export interface AgentCardConfig {
  /** Base configuration for the agent card */
  card: Omit<AgentCard, 'url' | 'capabilities'>;
  /** Override capabilities (will be merged with service defaults) */
  capabilitiesOverride?: Partial<AgentCapabilities>;
  /** Whether to support authenticated extended card endpoint */
  enableAuthenticatedExtendedCard?: boolean;
  /** Additional skills for authenticated users only */
  authenticatedSkills?: AgentSkill[];
  /** Additional security schemes for authenticated card */
  authenticatedSecuritySchemes?: Record<string, SecurityScheme>;
}

// ============================================================================
// FUNCTION-BASED AGENT INTERFACES
// ============================================================================

/**
 * Parameters passed to agent functions from the base service
 */
export interface AgentFunctionParams {
  /** The user's message/input */
  userMessage: string;
  /** Session ID for maintaining conversation state */
  sessionId?: string;
  /** Previous conversation history */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    metadata?: any;
  }>;
  /** Current authenticated user information */
  currentUser?: any;
  /** Authentication token for external API calls */
  authToken?: string;
  /** LLM service instance for agent functions to use (pre-configured with user preferences) */
  llmService?: any;
  /** Progress callback for multi-step workflows */
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void;
  /** MCP service for database operations (if available) */
  mcpService?: {
    getSchema: (options?: {
      table_name?: string;
      refresh_cache?: boolean;
    }) => Promise<any>;
    readData: (params: {
      table_name: string;
      columns?: string[];
      filters?: Record<string, any>;
      limit?: number;
      offset?: number;
      order_by?: { column: string; ascending?: boolean };
      format?: 'json' | 'table' | 'csv';
    }) => Promise<any>;
    executeSQL: (params: {
      sql_query: string;
      parameters?: any[];
      dry_run?: boolean;
      max_rows?: number;
      format?: 'detailed' | 'compact' | 'csv' | 'json';
    }) => Promise<any>;
    generateSQL: (params: {
      natural_language_query: string;
      query_type?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'auto-detect';
      model_override?: string;
      include_explanation?: boolean;
      max_rows?: number;
      schema_tables?: string[];
    }) => Promise<any>;
    queryAndFormat: (params: {
      user_prompt: string;
      output_format?: 'table' | 'json' | 'summary' | 'chart-data' | 'report';
      include_explanation?: boolean;
      model_override?: string;
      max_rows?: number;
      include_schema_context?: boolean;
      suggested_tables?: string[];
    }) => Promise<any>;
    isAvailable: () => boolean;
    callTool: (server: string, toolName: string, params: any) => Promise<any>;
  } | null;
  /** Additional context or metadata */
  metadata?: Record<string, any>;
}

/**
 * Response structure returned by agent functions
 */
export interface AgentFunctionResponse {
  /** Indicates if the function executed successfully */
  success: boolean;
  /** The main response content to return to the user */
  response: string;
  /** Optional metadata about the function execution */
  metadata?: {
    /** Name of the agent that processed the request */
    agentName?: string;
    /** Processing time in milliseconds */
    processingTime?: number;
    /** Tools or services used during execution */
    toolsUsed?: string[];
    /** Type of response or processing performed */
    responseType?: string;
    /** Any additional metadata */
    [key: string]: any;
  };
}

/**
 * Interface for agent function modules that are dynamically imported
 */
export interface AgentFunction {
  /** The main execution function that processes requests */
  execute(params: AgentFunctionParams): Promise<AgentFunctionResponse>;
}
