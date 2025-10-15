/**
 * Orchestrate Transport Types
 *
 * Frontend-specific transport types that mirror backend transport types.
 * These types define the structure of data sent to and received from the backend
 * via the orchestrate service layer.
 *
 * @module types/orchestrate
 */

// ============================================================================
// AGENT TASK MODE
// ============================================================================

/**
 * Defines the execution mode for an agent task.
 * Each mode represents a different type of agent behavior.
 */
export enum AgentTaskMode {
  /** Interactive conversation mode for back-and-forth dialogue */
  CONVERSE = 'converse',
  /** Planning mode for creating and managing project plans */
  PLAN = 'plan',
  /** Build mode for executing plans and creating deliverables */
  BUILD = 'build',
  /** Context mode for agents that provide reference information */
  CONTEXT = 'context',
}

// ============================================================================
// LLM CONFIGURATION
// ============================================================================

/**
 * Configuration for LLM provider and model selection.
 * This is sent in requests to specify which LLM to use for a task.
 */
export interface LLMSelection {
  /** The LLM provider name (e.g., 'anthropic', 'openai') */
  providerName: string;
  /** The specific model identifier (e.g., 'claude-3-5-sonnet-20241022') */
  modelName: string;
  /** Temperature for response randomness (0-1, optional) */
  temperature?: number;
  /** Maximum tokens to generate (optional) */
  maxTokens?: number;
}

// ============================================================================
// BASE REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Base metadata included in all agent task requests.
 * Provides context and configuration for task execution.
 */
export interface BaseRequestMetadata {
  /** Source of the request (e.g., 'web-ui', 'api') */
  source: string;
  /** User ID making the request (REQUIRED) */
  userId: string;
  /** Session ID for tracking related requests (optional) */
  sessionId?: string;
  /** Conversation ID for maintaining context (optional) */
  conversationId?: string;
  /** Whether to stream the response (default: false) */
  stream?: boolean;
}

/**
 * Base metadata included in all agent task responses.
 * Provides information about execution and LLM usage.
 */
export interface BaseResponseMetadata {
  /** LLM provider used (REQUIRED) */
  provider: string;
  /** LLM model used (REQUIRED) */
  model: string;
  /** Token usage statistics (REQUIRED) */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
  /** Execution time in milliseconds (optional) */
  executionTimeMs?: number;
  /** Stream ID if streaming was used (optional) */
  streamId?: string;
}

// ============================================================================
// CONVERSE MODE TYPES
// ============================================================================

/**
 * Request payload for Converse mode.
 * Contains LLM configuration and optional parameters for conversation.
 */
export interface ConverseRequest {
  /** The task mode (must be 'converse') */
  mode: AgentTaskMode.CONVERSE;
  /** The user's message (REQUIRED) */
  userMessage: string;
  /** LLM provider and model selection (REQUIRED) */
  llmSelection: LLMSelection;
  /** Request metadata (REQUIRED) */
  metadata: BaseRequestMetadata;
  /** Optional temperature override */
  temperature?: number;
  /** Optional max tokens override */
  maxTokens?: number;
  /** Optional stop sequences */
  stop?: string[];
}

/**
 * Response payload for Converse mode.
 * Contains the assistant's reply and execution metadata.
 */
export interface ConverseResponse {
  /** Whether the request was successful */
  success: boolean;
  /** The task mode (will be 'converse') */
  mode: AgentTaskMode.CONVERSE;
  /** The response content */
  content: {
    /** The assistant's message */
    message: string;
  };
  /** Response metadata with LLM usage info */
  metadata: BaseResponseMetadata;
  /** Error information if success is false (optional) */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ============================================================================
// PLAN MODE TYPES
// ============================================================================

/**
 * Actions available in Plan mode.
 * Defines operations for creating and managing plans.
 */
export enum PlanAction {
  CREATE = 'create',
  READ = 'read',
  LIST = 'list',
  EDIT = 'edit',
  SET_CURRENT = 'set-current',
  DELETE_VERSION = 'delete-version',
  MERGE_VERSIONS = 'merge-versions',
  COPY_VERSION = 'copy-version',
  DELETE = 'delete',
}

/**
 * Data structure for a plan.
 * Represents a project plan with versions.
 */
export interface PlanData {
  /** Unique identifier for the plan */
  id: string;
  /** Human-readable title */
  title: string;
  /** Optional description */
  description?: string;
  /** Current version number */
  currentVersion: number;
  /** Array of plan versions */
  versions: PlanVersionData[];
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** User who created the plan */
  createdBy: string;
}

/**
 * Data structure for a plan version.
 * Represents a specific version of a plan.
 */
export interface PlanVersionData {
  /** Version number (1-based) */
  version: number;
  /** Plan content in markdown */
  content: string;
  /** Optional version notes */
  notes?: string;
  /** Creation timestamp */
  createdAt: string;
  /** User who created this version */
  createdBy: string;
}

/**
 * Request payload for Plan mode CREATE action.
 */
export interface PlanCreateRequest {
  /** The task mode (must be 'plan') */
  mode: AgentTaskMode.PLAN;
  /** The action to perform (must be 'create') */
  action: PlanAction.CREATE;
  /** The user's planning request (REQUIRED) */
  userMessage: string;
  /** LLM provider and model selection (REQUIRED) */
  llmSelection: LLMSelection;
  /** Request metadata (REQUIRED) */
  metadata: BaseRequestMetadata;
  /** Plan title (optional, can be generated) */
  title?: string;
  /** Plan description (optional) */
  description?: string;
}

/**
 * Request payload for Plan mode READ action.
 */
export interface PlanReadRequest {
  /** The task mode (must be 'plan') */
  mode: AgentTaskMode.PLAN;
  /** The action to perform (must be 'read') */
  action: PlanAction.READ;
  /** The plan ID to read (REQUIRED) */
  planId: string;
  /** The version number to read (optional, defaults to current) */
  version?: number;
  /** Request metadata (REQUIRED) */
  metadata: BaseRequestMetadata;
}

/**
 * Request payload for Plan mode LIST action.
 */
export interface PlanListRequest {
  /** The task mode (must be 'plan') */
  mode: AgentTaskMode.PLAN;
  /** The action to perform (must be 'list') */
  action: PlanAction.LIST;
  /** Request metadata (REQUIRED) */
  metadata: BaseRequestMetadata;
  /** Optional filter by title */
  titleFilter?: string;
  /** Optional pagination limit */
  limit?: number;
  /** Optional pagination offset */
  offset?: number;
}

/**
 * Response payload for Plan mode CREATE action.
 */
export interface PlanCreateResponse {
  /** Whether the request was successful */
  success: boolean;
  /** The task mode (will be 'plan') */
  mode: AgentTaskMode.PLAN;
  /** The action performed (will be 'create') */
  action: PlanAction.CREATE;
  /** The response content */
  content: {
    /** The created plan data */
    plan: PlanData;
    /** Optional assistant message */
    message?: string;
  };
  /** Response metadata with LLM usage info */
  metadata: BaseResponseMetadata;
  /** Error information if success is false (optional) */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Response payload for Plan mode READ action.
 */
export interface PlanReadResponse {
  /** Whether the request was successful */
  success: boolean;
  /** The task mode (will be 'plan') */
  mode: AgentTaskMode.PLAN;
  /** The action performed (will be 'read') */
  action: PlanAction.READ;
  /** The response content */
  content: {
    /** The plan data */
    plan: PlanData;
  };
  /** Response metadata (no LLM usage for READ) */
  metadata: Partial<BaseResponseMetadata>;
  /** Error information if success is false (optional) */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Response payload for Plan mode LIST action.
 */
export interface PlanListResponse {
  /** Whether the request was successful */
  success: boolean;
  /** The task mode (will be 'plan') */
  mode: AgentTaskMode.PLAN;
  /** The action performed (will be 'list') */
  action: PlanAction.LIST;
  /** The response content */
  content: {
    /** Array of plan data */
    plans: PlanData[];
    /** Total count of plans (before pagination) */
    total: number;
  };
  /** Response metadata (no LLM usage for LIST) */
  metadata: Partial<BaseResponseMetadata>;
  /** Error information if success is false (optional) */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ============================================================================
// BUILD MODE TYPES
// ============================================================================

/**
 * Actions available in Build mode.
 * Defines operations for creating and managing deliverables.
 */
export enum BuildAction {
  CREATE = 'create',
  READ = 'read',
  LIST = 'list',
  EDIT = 'edit',
  RERUN = 'rerun',
  SET_CURRENT = 'set-current',
  DELETE_VERSION = 'delete-version',
  MERGE_VERSIONS = 'merge-versions',
  COPY_VERSION = 'copy-version',
  DELETE = 'delete',
}

/**
 * Data structure for a deliverable.
 * Represents a build output with versions.
 */
export interface DeliverableData {
  /** Unique identifier for the deliverable */
  id: string;
  /** Human-readable title */
  title: string;
  /** Optional description */
  description?: string;
  /** Associated plan ID (optional) */
  planId?: string;
  /** Current version number */
  currentVersion: number;
  /** Array of deliverable versions */
  versions: DeliverableVersionData[];
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** User who created the deliverable */
  createdBy: string;
}

/**
 * Data structure for a deliverable version.
 * Represents a specific version of a deliverable.
 */
export interface DeliverableVersionData {
  /** Version number (1-based) */
  version: number;
  /** Deliverable content/artifacts */
  content: string;
  /** Optional version notes */
  notes?: string;
  /** Execution status */
  status: 'success' | 'error' | 'partial';
  /** Creation timestamp */
  createdAt: string;
  /** User who created this version */
  createdBy: string;
}

/**
 * Request payload for Build mode CREATE action.
 */
export interface BuildCreateRequest {
  /** The task mode (must be 'build') */
  mode: AgentTaskMode.BUILD;
  /** The action to perform (must be 'create') */
  action: BuildAction.CREATE;
  /** The user's build request or plan reference (REQUIRED) */
  userMessage: string;
  /** LLM provider and model selection (REQUIRED) */
  llmSelection: LLMSelection;
  /** Request metadata (REQUIRED) */
  metadata: BaseRequestMetadata;
  /** Associated plan ID (optional) */
  planId?: string;
  /** Deliverable title (optional, can be generated) */
  title?: string;
  /** Deliverable description (optional) */
  description?: string;
}

/**
 * Response payload for Build mode CREATE action.
 */
export interface BuildCreateResponse {
  /** Whether the request was successful */
  success: boolean;
  /** The task mode (will be 'build') */
  mode: AgentTaskMode.BUILD;
  /** The action performed (will be 'create') */
  action: BuildAction.CREATE;
  /** The response content */
  content: {
    /** The created deliverable data */
    deliverable: DeliverableData;
    /** Optional assistant message */
    message?: string;
  };
  /** Response metadata with LLM usage info */
  metadata: BaseResponseMetadata;
  /** Error information if success is false (optional) */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

/**
 * Server-Sent Event (SSE) event types.
 * Defines the different types of streaming events.
 */
export enum SSEEventType {
  /** A chunk of streamed content */
  CHUNK = 'agent-stream-chunk',
  /** The stream has completed */
  COMPLETE = 'agent-stream-complete',
  /** An error occurred during streaming */
  ERROR = 'agent-stream-error',
  /** Task progress update */
  PROGRESS = 'task-progress',
}

/**
 * Base structure for all SSE events.
 */
export interface BaseSSEEvent {
  /** The event type */
  event: SSEEventType;
  /** The event data payload */
  data: any;
  /** Event ID for tracking (optional) */
  id?: string;
}

/**
 * SSE event for streaming content chunks.
 */
export interface SSEChunkEvent extends BaseSSEEvent {
  event: SSEEventType.CHUNK;
  data: {
    /** The content chunk */
    content: string;
    /** Chunk index in the stream */
    index: number;
    /** Stream context information */
    context: {
      agentSlug: string;
      mode: AgentTaskMode;
      conversationId?: string;
    };
  };
}

/**
 * SSE event for stream completion.
 */
export interface SSECompleteEvent extends BaseSSEEvent {
  event: SSEEventType.COMPLETE;
  data: {
    /** The complete response payload */
    response: ConverseResponse | PlanCreateResponse | BuildCreateResponse;
    /** Total execution time in milliseconds */
    executionTimeMs: number;
  };
}

/**
 * SSE event for streaming errors.
 */
export interface SSEErrorEvent extends BaseSSEEvent {
  event: SSEEventType.ERROR;
  data: {
    /** Error code */
    code: string;
    /** Error message */
    message: string;
    /** Additional error details (optional) */
    details?: any;
  };
}

/**
 * Union type for all SSE events.
 */
export type SSEEvent = SSEChunkEvent | SSECompleteEvent | SSEErrorEvent;

/**
 * Callback function type for handling SSE events.
 */
export type SSEEventHandler = (event: SSEEvent) => void;

/**
 * Configuration options for SSE connections.
 */
export interface SSEConnectionOptions {
  /** Callback for received events */
  onEvent: SSEEventHandler;
  /** Callback for connection errors (optional) */
  onError?: (error: Error) => void;
  /** Callback for connection close (optional) */
  onClose?: () => void;
  /** Timeout in milliseconds (optional) */
  timeout?: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a response is a ConverseResponse.
 */
export function isConverseResponse(response: any): response is ConverseResponse {
  return (
    response &&
    typeof response === 'object' &&
    response.mode === AgentTaskMode.CONVERSE &&
    typeof response.success === 'boolean' &&
    response.content &&
    typeof response.content.message === 'string'
  );
}

/**
 * Type guard to check if a response is a PlanCreateResponse.
 */
export function isPlanCreateResponse(response: any): response is PlanCreateResponse {
  return (
    response &&
    typeof response === 'object' &&
    response.mode === AgentTaskMode.PLAN &&
    response.action === PlanAction.CREATE &&
    typeof response.success === 'boolean' &&
    response.content &&
    response.content.plan
  );
}

/**
 * Type guard to check if a response is a BuildCreateResponse.
 */
export function isBuildCreateResponse(response: any): response is BuildCreateResponse {
  return (
    response &&
    typeof response === 'object' &&
    response.mode === AgentTaskMode.BUILD &&
    response.action === BuildAction.CREATE &&
    typeof response.success === 'boolean' &&
    response.content &&
    response.content.deliverable
  );
}

/**
 * Type guard to check if an SSE event is a chunk event.
 */
export function isSSEChunkEvent(event: SSEEvent): event is SSEChunkEvent {
  return event.event === SSEEventType.CHUNK;
}

/**
 * Type guard to check if an SSE event is a complete event.
 */
export function isSSECompleteEvent(event: SSEEvent): event is SSECompleteEvent {
  return event.event === SSEEventType.COMPLETE;
}

/**
 * Type guard to check if an SSE event is an error event.
 */
export function isSSEErrorEvent(event: SSEEvent): event is SSEErrorEvent {
  return event.event === SSEEventType.ERROR;
}
