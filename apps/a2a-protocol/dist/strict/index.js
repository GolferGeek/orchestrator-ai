"use strict";
/**
 * Strict A2A Protocol Types
 *
 * Complete, strongly-typed request and response structures for every mode × action combination.
 * Provides maximum type safety and prevents inconsistencies.
 *
 * Total: 21 unique request types, 21 unique response types
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStrictErrorResponse = isStrictErrorResponse;
exports.isStrictSuccessResponse = isStrictSuccessResponse;
exports.isStrictPlanResponse = isStrictPlanResponse;
exports.isStrictBuildResponse = isStrictBuildResponse;
exports.isStrictConverseResponse = isStrictConverseResponse;
exports.isStrictOrchestrateResponse = isStrictOrchestrateResponse;
// Base types
__exportStar(require("./base.types"), exports);
// Plan mode (9 actions)
__exportStar(require("./plan.strict"), exports);
// Build mode (10 actions)
__exportStar(require("./build.strict"), exports);
// Converse mode (1 action)
__exportStar(require("./converse.strict"), exports);
// Orchestrate mode (1 action)
__exportStar(require("./orchestrate.strict"), exports);
// ============================================================================
// TYPE GUARDS
// ============================================================================
/**
 * Type guard for error responses
 */
function isStrictErrorResponse(response) {
    return 'error' in response;
}
/**
 * Type guard for success responses
 */
function isStrictSuccessResponse(response) {
    return 'result' in response && response.result.success === true;
}
/**
 * Type guard for plan mode responses
 */
function isStrictPlanResponse(response) {
    return response.result.mode === 'plan';
}
/**
 * Type guard for build mode responses
 */
function isStrictBuildResponse(response) {
    return response.result.mode === 'build';
}
/**
 * Type guard for converse mode responses
 */
function isStrictConverseResponse(response) {
    return response.result.mode === 'converse';
}
/**
 * Type guard for orchestrate mode responses
 */
function isStrictOrchestrateResponse(response) {
    return response.result.mode === 'orchestrate';
}
