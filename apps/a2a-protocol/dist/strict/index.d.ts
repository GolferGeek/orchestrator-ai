/**
 * Strict A2A Protocol Types
 *
 * Complete, strongly-typed request and response structures for every mode × action combination.
 * Provides maximum type safety and prevents inconsistencies.
 *
 * Total: 21 unique request types, 21 unique response types
 */
export * from './base.types';
export * from './plan.strict';
export * from './build.strict';
export * from './converse.strict';
export * from './orchestrate.strict';
import { StrictPlanRequest, StrictPlanResponse } from './plan.strict';
import { StrictBuildRequest, StrictBuildResponse } from './build.strict';
import { StrictConverseRequest, StrictConverseResponse } from './converse.strict';
import { StrictOrchestrateRequest, StrictOrchestrateResponse } from './orchestrate.strict';
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
/**
 * Complete union of ALL possible A2A requests (21 total)
 * - Plan: 9 actions
 * - Build: 10 actions
 * - Converse: 1 action
 * - Orchestrate: 1 action
 */
export type StrictA2ARequest = StrictPlanRequest | StrictBuildRequest | StrictConverseRequest | StrictOrchestrateRequest;
/**
 * Complete union of ALL possible A2A success responses (21 total)
 * - Plan: 9 actions
 * - Build: 10 actions
 * - Converse: 1 action
 * - Orchestrate: 1 action
 */
export type StrictA2ASuccessResponse = StrictPlanResponse | StrictBuildResponse | StrictConverseResponse | StrictOrchestrateResponse;
/**
 * Complete union of ALL possible A2A responses (success + error)
 */
export type StrictA2AResponse = StrictA2ASuccessResponse | StrictA2AErrorResponse;
/**
 * Type guard for error responses
 */
export declare function isStrictErrorResponse(response: StrictA2AResponse): response is StrictA2AErrorResponse;
/**
 * Type guard for success responses
 */
export declare function isStrictSuccessResponse(response: StrictA2AResponse): response is StrictA2ASuccessResponse;
/**
 * Type guard for plan mode responses
 */
export declare function isStrictPlanResponse(response: StrictA2ASuccessResponse): response is StrictPlanResponse;
/**
 * Type guard for build mode responses
 */
export declare function isStrictBuildResponse(response: StrictA2ASuccessResponse): response is StrictBuildResponse;
/**
 * Type guard for converse mode responses
 */
export declare function isStrictConverseResponse(response: StrictA2ASuccessResponse): response is StrictConverseResponse;
/**
 * Type guard for orchestrate mode responses
 */
export declare function isStrictOrchestrateResponse(response: StrictA2ASuccessResponse): response is StrictOrchestrateResponse;
//# sourceMappingURL=index.d.ts.map