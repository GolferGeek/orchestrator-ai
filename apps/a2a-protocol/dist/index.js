"use strict";
/**
 * @orchestrator-ai/a2a-protocol
 *
 * Agent-to-Agent JSON-RPC 2.0 Protocol Types
 * Shared between frontend and backend to ensure API contract compliance
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
exports.AgentTaskMode = exports.A2AErrorCode = exports.JsonRpcErrorCode = void 0;
exports.isJsonRpcRequest = isJsonRpcRequest;
exports.isJsonRpcSuccessResponse = isJsonRpcSuccessResponse;
exports.isJsonRpcErrorResponse = isJsonRpcErrorResponse;
exports.isA2ATaskRequest = isA2ATaskRequest;
exports.isTaskResponse = isTaskResponse;
// ============================================================================
// STRICT TYPES (Recommended - Complete type safety for all mode × action combinations)
// ============================================================================
__exportStar(require("./strict"), exports);
// ============================================================================
// FLEXIBLE TYPES (Legacy - For backward compatibility)
// ============================================================================
// JSON-RPC 2.0 Base Types
var json_rpc_types_1 = require("./request/json-rpc.types");
Object.defineProperty(exports, "JsonRpcErrorCode", { enumerable: true, get: function () { return json_rpc_types_1.JsonRpcErrorCode; } });
Object.defineProperty(exports, "A2AErrorCode", { enumerable: true, get: function () { return json_rpc_types_1.A2AErrorCode; } });
// Shared Enums
var enums_1 = require("./shared/enums");
Object.defineProperty(exports, "AgentTaskMode", { enumerable: true, get: function () { return enums_1.AgentTaskMode; } });
/**
 * Type Guards
 */
function isJsonRpcRequest(obj) {
    return (obj &&
        typeof obj === 'object' &&
        obj.jsonrpc === '2.0' &&
        typeof obj.method === 'string' &&
        ('id' in obj));
}
function isJsonRpcSuccessResponse(obj) {
    return (obj &&
        typeof obj === 'object' &&
        obj.jsonrpc === '2.0' &&
        'result' in obj &&
        ('id' in obj));
}
function isJsonRpcErrorResponse(obj) {
    return (obj &&
        typeof obj === 'object' &&
        obj.jsonrpc === '2.0' &&
        'error' in obj &&
        ('id' in obj));
}
function isA2ATaskRequest(obj) {
    return (isJsonRpcRequest(obj) &&
        obj.params &&
        typeof obj.params === 'object');
}
function isTaskResponse(obj) {
    return (obj &&
        typeof obj === 'object' &&
        typeof obj.success === 'boolean' &&
        typeof obj.mode === 'string');
}
