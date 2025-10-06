/**
 * @orchestrator-ai/a2a-protocol
 *
 * Agent-to-Agent JSON-RPC 2.0 Protocol Types
 * Shared between frontend and backend to ensure API contract compliance
 */

// ============================================================================
// STRICT TYPES (Recommended - Complete type safety for all mode × action combinations)
// ============================================================================
export * from './strict';

// ============================================================================
// FLEXIBLE TYPES (Legacy - For backward compatibility)
// ============================================================================

// JSON-RPC 2.0 Base Types
export {
  JsonRpcRequest,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcErrorCode,
  A2AErrorCode,
} from './request/json-rpc.types';

// Shared Enums
export {
  AgentTaskMode,
  JsonRpcMethod,
} from './shared/enums';

// Request Types
export {
  TaskMessage,
  TaskRequestParams,
  A2ATaskRequest,
} from './request/task-request.types';

// Response Types
export {
  TaskResponsePayload,
  TaskResponse,
  A2ATaskSuccessResponse,
  A2ATaskErrorResponse,
  A2ATaskResponse,
} from './response/task-response.types';

// Import types for use in type guards
import type {
  JsonRpcRequest,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
} from './request/json-rpc.types';
import type { A2ATaskRequest } from './request/task-request.types';
import type { TaskResponse } from './response/task-response.types';

/**
 * Type Guards
 */

export function isJsonRpcRequest(obj: any): obj is JsonRpcRequest {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.jsonrpc === '2.0' &&
    typeof obj.method === 'string' &&
    ('id' in obj)
  );
}

export function isJsonRpcSuccessResponse(obj: any): obj is JsonRpcSuccessResponse {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.jsonrpc === '2.0' &&
    'result' in obj &&
    ('id' in obj)
  );
}

export function isJsonRpcErrorResponse(obj: any): obj is JsonRpcErrorResponse {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.jsonrpc === '2.0' &&
    'error' in obj &&
    ('id' in obj)
  );
}

export function isA2ATaskRequest(obj: any): obj is A2ATaskRequest {
  return (
    isJsonRpcRequest(obj) &&
    obj.params &&
    typeof obj.params === 'object'
  );
}

export function isTaskResponse(obj: any): obj is TaskResponse {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.success === 'boolean' &&
    typeof obj.mode === 'string'
  );
}
