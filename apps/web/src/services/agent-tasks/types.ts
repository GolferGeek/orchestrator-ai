/**
 * Agent Task Service Types
 *
 * Common types and interfaces for the agent task service layer.
 * These types define the service contracts and internal structures.
 */

import type {
  AgentTaskMode,
  PlanAction,
  BuildAction,
  SSEEvent,
  SSEEventHandler,
  ConverseResponseContent,
  ConverseRequestMetadata,
  ConverseResponseMetadata,
  PlanCreateResponseContent,
  PlanReadResponseContent,
  PlanListResponseContent,
  PlanRequestMetadata,
  PlanResponseMetadata,
  BuildCreateResponseContent,
  BuildRequestMetadata,
  BuildResponseMetadata,
} from '@orchestrator-ai/transport-types';

// Re-export transport types for convenience
export type {
  AgentTaskMode,
  PlanAction,
  BuildAction,
  SSEEvent,
  SSEEventHandler,
};

// ============================================================================
// FRONTEND-SPECIFIC TYPES
// ============================================================================

/**
 * LLM Selection Configuration
 */
export interface LLMSelection {
  providerName?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Base metadata common to all requests
 */
export interface BaseRequestMetadata {
  source: string;
  userId: string;
  conversationId?: string;
  stream?: boolean;
}

/**
 * Base metadata common to all responses
 */
export interface BaseResponseMetadata {
  provider: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
  routingDecision?: Record<string, any>;
  streamId?: string;
}

/**
 * Converse Request
 */
export interface ConverseRequest {
  message: string;
  metadata: BaseRequestMetadata;
  llmSelection: LLMSelection;
}

/**
 * Converse Response
 */
export interface ConverseResponse {
  success: boolean;
  mode: 'converse';
  content: ConverseResponseContent;
  metadata: BaseResponseMetadata;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Plan Create Request
 */
export interface PlanCreateRequest {
  message: string;
  metadata: BaseRequestMetadata;
  llmSelection: LLMSelection;
}

/**
 * Plan Read Request
 */
export interface PlanReadRequest {
  planId: string;
  versionId?: string;
  metadata: BaseRequestMetadata;
}

/**
 * Plan List Request
 */
export interface PlanListRequest {
  conversationId?: string;
  limit?: number;
  offset?: number;
  metadata: BaseRequestMetadata;
}

/**
 * Plan Create Response
 */
export interface PlanCreateResponse {
  success: boolean;
  mode: 'plan';
  action: 'create';
  content: PlanCreateResponseContent;
  metadata: BaseResponseMetadata;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Plan Read Response
 */
export interface PlanReadResponse {
  success: boolean;
  mode: 'plan';
  action: 'read';
  content: PlanReadResponseContent;
  metadata: BaseResponseMetadata;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Plan List Response
 */
export interface PlanListResponse {
  success: boolean;
  mode: 'plan';
  action: 'list';
  content: PlanListResponseContent;
  metadata: BaseResponseMetadata;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Build Create Request
 */
export interface BuildCreateRequest {
  planId: string;
  planVersionId?: string;
  message?: string;
  metadata: BaseRequestMetadata;
  llmSelection: LLMSelection;
}

/**
 * Build Create Response
 */
export interface BuildCreateResponse {
  success: boolean;
  mode: 'build';
  action: 'create';
  content: BuildCreateResponseContent;
  metadata: BaseResponseMetadata;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

/**
 * Base service configuration
 */
export interface ServiceConfig {
  /** Whether to enable debug logging */
  debug?: boolean;
  /** Timeout for requests in milliseconds */
  timeout?: number;
}

/**
 * Service error with additional context
 */
export interface ServiceError extends Error {
  /** Error code for classification */
  code: string;
  /** Additional error details */
  details?: any;
  /** Original error if wrapped */
  cause?: Error;
}

/**
 * Standard service response wrapper
 */
export interface ServiceResponse<T = any> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Response data if successful */
  data?: T;
  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ============================================================================
// COMMON PARAMETERS
// ============================================================================

/**
 * Parameters for sending an agent task
 */
export interface SendTaskParams {
  /** Agent slug/identifier */
  agentSlug: string;
  /** Organization/namespace (optional, defaults to 'demo') */
  namespace?: string;
  /** Task mode (converse, plan, build) */
  mode: AgentTaskMode;
  /** Action for modes that use actions (plan, build) */
  action?: string;
  /** User's message/prompt */
  userMessage: string;
  /** Conversation ID for context */
  conversationId?: string;
  /** LLM selection (provider, model, config) */
  llmSelection: LLMSelection;
  /** Additional parameters specific to mode/action */
  additionalParams?: Record<string, any>;
  /** Whether to stream the response */
  stream?: boolean;
}

/**
 * Parameters for handling SSE streaming
 */
export interface StreamParams {
  /** Callback for chunk events */
  onChunk?: (content: string, index: number) => void;
  /** Callback for complete event */
  onComplete?: (response: any) => void;
  /** Callback for error events */
  onError?: (error: ServiceError) => void;
  /** Callback for connection close */
  onClose?: () => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a ServiceError with proper typing
 */
export function createServiceError(
  code: string,
  message: string,
  details?: any,
  cause?: Error
): ServiceError {
  const error = new Error(message) as ServiceError;
  error.code = code;
  error.details = details;
  error.cause = cause;
  return error;
}

/**
 * Creates a successful ServiceResponse
 */
export function createSuccessResponse<T>(data: T): ServiceResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Creates an error ServiceResponse
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: any
): ServiceResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Validates required fields in an object
 */
export function validateRequired(
  obj: Record<string, any>,
  fields: string[]
): void {
  const missing = fields.filter(field => {
    const value = obj[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw createServiceError(
      'VALIDATION_ERROR',
      `Missing required fields: ${missing.join(', ')}`,
      { missing }
    );
  }
}

/**
 * Builds base request metadata
 */
export function buildRequestMetadata(
  userId: string,
  conversationId?: string,
  stream?: boolean
): BaseRequestMetadata {
  return {
    source: 'web-ui',
    userId,
    conversationId,
    stream: stream ?? false,
  };
}

/**
 * Logs debug information if debug mode is enabled
 */
export function debugLog(config: ServiceConfig | undefined, ...args: any[]): void {
  if (config?.debug) {
    console.log('[AgentTaskService]', ...args);
  }
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: any): response is { success: false; error: any } {
  return (
    response &&
    typeof response === 'object' &&
    response.success === false &&
    'error' in response
  );
}

/**
 * Extracts error message from various error formats
 */
export function extractErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error?.message) return error.error.message;
  return 'An unknown error occurred';
}

/**
 * Extracts error code from various error formats
 */
export function extractErrorCode(error: any): string {
  if (error?.code) return error.code;
  if (error?.error?.code) return error.error.code;
  return 'UNKNOWN_ERROR';
}
