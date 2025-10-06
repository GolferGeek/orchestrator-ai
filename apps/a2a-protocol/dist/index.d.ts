/**
 * @orchestrator-ai/a2a-protocol
 *
 * Agent-to-Agent JSON-RPC 2.0 Protocol Types
 * Shared between frontend and backend to ensure API contract compliance
 */
export * from './strict';
export { JsonRpcRequest, JsonRpcSuccessResponse, JsonRpcErrorResponse, JsonRpcResponse, JsonRpcError, JsonRpcErrorCode, A2AErrorCode, } from './request/json-rpc.types';
export { AgentTaskMode, JsonRpcMethod, } from './shared/enums';
export { TaskMessage, TaskRequestParams, A2ATaskRequest, } from './request/task-request.types';
export { TaskResponsePayload, TaskResponse, A2ATaskSuccessResponse, A2ATaskErrorResponse, A2ATaskResponse, } from './response/task-response.types';
import type { JsonRpcRequest, JsonRpcSuccessResponse, JsonRpcErrorResponse } from './request/json-rpc.types';
import type { A2ATaskRequest } from './request/task-request.types';
import type { TaskResponse } from './response/task-response.types';
/**
 * Type Guards
 */
export declare function isJsonRpcRequest(obj: any): obj is JsonRpcRequest;
export declare function isJsonRpcSuccessResponse(obj: any): obj is JsonRpcSuccessResponse;
export declare function isJsonRpcErrorResponse(obj: any): obj is JsonRpcErrorResponse;
export declare function isA2ATaskRequest(obj: any): obj is A2ATaskRequest;
export declare function isTaskResponse(obj: any): obj is TaskResponse;
//# sourceMappingURL=index.d.ts.map