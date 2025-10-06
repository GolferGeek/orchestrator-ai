/**
 * Strict A2A Protocol Types
 *
 * Complete, strongly-typed request and response structures for every mode × action combination.
 * Provides maximum type safety and prevents inconsistencies.
 *
 * Total: 21 unique request types, 21 unique response types
 */

// Base types
export * from './base.types';

// Plan mode (9 actions)
export * from './plan.strict';

// Build mode (10 actions)
export * from './build.strict';

// Converse mode (1 action)
export * from './converse.strict';

// Orchestrate mode (1 action)
export * from './orchestrate.strict';

// Import for union types
import { StrictPlanRequest, StrictPlanResponse } from './plan.strict';
import { StrictBuildRequest, StrictBuildResponse } from './build.strict';
import { StrictConverseRequest, StrictConverseResponse } from './converse.strict';
import { StrictOrchestrateRequest, StrictOrchestrateResponse } from './orchestrate.strict';

// ============================================================================
// ERROR RESPONSE TYPE
// ============================================================================

/**
 * A2A Error Response (JSON-RPC 2.0 error format)
 */
export interface StrictA2AErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: {
      mode?: string;
      action?: string;
      conversationId?: string;
      details?: any;
    };
  };
}

// ============================================================================
// COMPLETE UNION TYPES
// ============================================================================

/**
 * Complete union of ALL possible A2A requests (21 total)
 * - Plan: 9 actions
 * - Build: 10 actions
 * - Converse: 1 action
 * - Orchestrate: 1 action
 */
export type StrictA2ARequest =
  | StrictPlanRequest
  | StrictBuildRequest
  | StrictConverseRequest
  | StrictOrchestrateRequest;

/**
 * Complete union of ALL possible A2A success responses (21 total)
 * - Plan: 9 actions
 * - Build: 10 actions
 * - Converse: 1 action
 * - Orchestrate: 1 action
 */
export type StrictA2ASuccessResponse =
  | StrictPlanResponse
  | StrictBuildResponse
  | StrictConverseResponse
  | StrictOrchestrateResponse;

/**
 * Complete union of ALL possible A2A responses (success + error)
 */
export type StrictA2AResponse =
  | StrictA2ASuccessResponse
  | StrictA2AErrorResponse;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for error responses
 */
export function isStrictErrorResponse(response: StrictA2AResponse): response is StrictA2AErrorResponse {
  return 'error' in response;
}

/**
 * Type guard for success responses
 */
export function isStrictSuccessResponse(response: StrictA2AResponse): response is StrictA2ASuccessResponse {
  return 'result' in response && response.result.success === true;
}

/**
 * Type guard for plan mode responses
 */
export function isStrictPlanResponse(response: StrictA2ASuccessResponse): response is StrictPlanResponse {
  return response.result.mode === 'plan';
}

/**
 * Type guard for build mode responses
 */
export function isStrictBuildResponse(response: StrictA2ASuccessResponse): response is StrictBuildResponse {
  return response.result.mode === 'build';
}

/**
 * Type guard for converse mode responses
 */
export function isStrictConverseResponse(response: StrictA2ASuccessResponse): response is StrictConverseResponse {
  return response.result.mode === 'converse';
}

/**
 * Type guard for orchestrate mode responses
 */
export function isStrictOrchestrateResponse(response: StrictA2ASuccessResponse): response is StrictOrchestrateResponse {
  return response.result.mode === 'orchestrate';
}
