/**
 * Transport Types
 *
 * Shared TypeScript types for agent-to-agent communication
 * Used by both frontend (web) and backend (api) for type-safe API contracts
 */

// ============================================================================
// SHARED ENUMS
// ============================================================================
export {
  AgentTaskMode,
  JsonRpcMethod,
  JsonRpcErrorCode,
  A2AErrorCode,
} from './shared/enums';

// ============================================================================
// SHARED DATA TYPES
// ============================================================================
export {
  PlanData,
  PlanVersionData,
  DeliverableData,
  DeliverableVersionData,
} from './shared/data-types';

// ============================================================================
// JSON-RPC 2.0 BASE TYPES
// ============================================================================
export {
  JsonRpcRequest,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  JsonRpcResponse,
  JsonRpcError,
} from './request/json-rpc.types';

// ============================================================================
// REQUEST TYPES
// ============================================================================
export {
  TaskMessage,
  TaskRequestParams,
  A2ATaskRequest,
} from './request/task-request.types';

// ============================================================================
// RESPONSE TYPES
// ============================================================================
export {
  TaskResponsePayload,
  TaskResponse,
  A2ATaskSuccessResponse,
  A2ATaskErrorResponse,
  A2ATaskResponse,
} from './response/task-response.types';

// ============================================================================
// MODE-SPECIFIC TYPES
// ============================================================================

// Plan Mode
export {
  PlanAction,
  PlanCreatePayload,
  PlanReadPayload,
  PlanListPayload,
  PlanEditPayload,
  PlanSetCurrentPayload,
  PlanDeleteVersionPayload,
  PlanMergeVersionsPayload,
  PlanCopyVersionPayload,
  PlanDeletePayload,
  PlanModePayload,
  PlanRequestMetadata,
  PlanResponseMetadata,
  PlanCreateResponseContent,
  PlanReadResponseContent,
  PlanListResponseContent,
} from './modes/plan.types';

// Build Mode
export {
  BuildAction,
  BuildCreatePayload,
  BuildReadPayload,
  BuildListPayload,
  BuildEditPayload,
  BuildRerunPayload,
  BuildSetCurrentPayload,
  BuildDeleteVersionPayload,
  BuildMergeVersionsPayload,
  BuildCopyVersionPayload,
  BuildDeletePayload,
  BuildModePayload,
  BuildRequestMetadata,
  BuildResponseMetadata,
  BuildCreateResponseContent,
} from './modes/build.types';

// Converse Mode
export {
  ConverseModePayload,
  ConverseRequestMetadata,
  ConverseResponseMetadata,
  ConverseResponseContent,
} from './modes/converse.types';

// ============================================================================
// STRICT TYPE ALIASES (for web compatibility)
// ============================================================================
export {
  StrictPlanResponse,
  StrictBuildResponse,
  StrictConverseResponse,
  StrictOrchestrateResponse,
  StrictA2ASuccessResponse,
  StrictA2AErrorResponse,
  StrictA2AResponse,
  StrictA2ARequest,
  isStrictPlanResponse,
  isStrictBuildResponse,
  isStrictConverseResponse,
  isStrictErrorResponse,
  isStrictSuccessResponse,
} from './shared/strict-aliases';

// ============================================================================
// TYPE GUARDS
// ============================================================================

import type {
  JsonRpcRequest,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
} from './request/json-rpc.types';
import type { A2ATaskRequest } from './request/task-request.types';
import type { TaskResponse } from './response/task-response.types';

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
