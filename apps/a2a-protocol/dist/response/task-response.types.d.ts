/**
 * A2A Task Response Types
 * Defines the structure of task responses in the A2A protocol
 */
/**
 * Task Response Payload
 * The actual result data returned by the agent
 */
export interface TaskResponsePayload {
    /**
     * The content of the response
     * Structure varies based on mode and action
     */
    content?: any;
    /**
     * Response metadata (usage stats, routing decisions, etc.)
     */
    metadata?: Record<string, any>;
}
/**
 * Task Response (A2A Protocol)
 * This is what goes in the `result` field of a JSON-RPC success response
 */
export interface TaskResponse {
    /**
     * Whether the task succeeded
     */
    success: boolean;
    /**
     * The mode that was executed
     * Using string instead of AgentTaskMode to allow internal orchestration modes
     */
    mode: string;
    /**
     * The response payload
     */
    payload?: TaskResponsePayload;
    /**
     * Human-readable response for display
     */
    humanResponse?: {
        message: string;
        [key: string]: any;
    };
    /**
     * Error information (if success is false)
     */
    error?: {
        message: string;
        code?: string;
        [key: string]: any;
    };
}
/**
 * Complete A2A Task Response (JSON-RPC 2.0 Success)
 */
export interface A2ATaskSuccessResponse {
    /** JSON-RPC version (always "2.0") */
    jsonrpc: '2.0';
    /** Request identifier (matches request) */
    id: string | number | null;
    /** Task response result */
    result: TaskResponse;
}
/**
 * Complete A2A Task Error Response (JSON-RPC 2.0 Error)
 */
export interface A2ATaskErrorResponse {
    /** JSON-RPC version (always "2.0") */
    jsonrpc: '2.0';
    /** Request identifier (matches request) */
    id: string | number | null;
    /** Error details */
    error: {
        /** JSON-RPC error code */
        code: number;
        /** Error message */
        message: string;
        /** Additional error data */
        data?: any;
    };
}
/**
 * A2A Task Response (Success or Error)
 */
export type A2ATaskResponse = A2ATaskSuccessResponse | A2ATaskErrorResponse;
//# sourceMappingURL=task-response.types.d.ts.map