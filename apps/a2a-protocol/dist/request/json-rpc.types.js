"use strict";
/**
 * JSON-RPC 2.0 Base Types
 * Specification: https://www.jsonrpc.org/specification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.A2AErrorCode = exports.JsonRpcErrorCode = void 0;
/**
 * Standard JSON-RPC 2.0 Error Codes
 */
var JsonRpcErrorCode;
(function (JsonRpcErrorCode) {
    /** Invalid JSON was received by the server */
    JsonRpcErrorCode[JsonRpcErrorCode["PARSE_ERROR"] = -32700] = "PARSE_ERROR";
    /** The JSON sent is not a valid Request object */
    JsonRpcErrorCode[JsonRpcErrorCode["INVALID_REQUEST"] = -32600] = "INVALID_REQUEST";
    /** The method does not exist / is not available */
    JsonRpcErrorCode[JsonRpcErrorCode["METHOD_NOT_FOUND"] = -32601] = "METHOD_NOT_FOUND";
    /** Invalid method parameter(s) */
    JsonRpcErrorCode[JsonRpcErrorCode["INVALID_PARAMS"] = -32602] = "INVALID_PARAMS";
    /** Internal JSON-RPC error */
    JsonRpcErrorCode[JsonRpcErrorCode["INTERNAL_ERROR"] = -32603] = "INTERNAL_ERROR";
    /** Reserved for implementation-defined server-errors (-32000 to -32099) */
    JsonRpcErrorCode[JsonRpcErrorCode["SERVER_ERROR_START"] = -32099] = "SERVER_ERROR_START";
    JsonRpcErrorCode[JsonRpcErrorCode["SERVER_ERROR_END"] = -32000] = "SERVER_ERROR_END";
})(JsonRpcErrorCode || (exports.JsonRpcErrorCode = JsonRpcErrorCode = {}));
/**
 * Custom A2A Error Codes (extend JSON-RPC reserved range)
 */
var A2AErrorCode;
(function (A2AErrorCode) {
    /** Unauthorized access */
    A2AErrorCode[A2AErrorCode["UNAUTHORIZED"] = -32001] = "UNAUTHORIZED";
    /** Forbidden access */
    A2AErrorCode[A2AErrorCode["FORBIDDEN"] = -32003] = "FORBIDDEN";
    /** Resource not found */
    A2AErrorCode[A2AErrorCode["NOT_FOUND"] = -32004] = "NOT_FOUND";
    /** Resource conflict */
    A2AErrorCode[A2AErrorCode["CONFLICT"] = -32009] = "CONFLICT";
    /** Rate limit exceeded */
    A2AErrorCode[A2AErrorCode["RATE_LIMITED"] = -32042] = "RATE_LIMITED";
})(A2AErrorCode || (exports.A2AErrorCode = A2AErrorCode = {}));
