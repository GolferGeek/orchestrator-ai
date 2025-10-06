/**
 * A2A Task Request Types
 * Defines the structure of task requests in the A2A protocol
 */
import { AgentTaskMode } from '../shared/enums';
/**
 * Message in a conversation
 */
export interface TaskMessage {
    /** Role of the message sender (e.g., 'user', 'assistant', 'system') */
    role: string;
    /** Content of the message */
    content?: any;
}
/**
 * Task Request Parameters (A2A Extension to JSON-RPC)
 * This is what goes in the `params` field of a JSON-RPC request
 */
export interface TaskRequestParams {
    /**
     * The operational mode for the agent
     * Note: In JSON-RPC, this is derived from the `method` field
     * but can also be explicitly set in params
     */
    mode?: AgentTaskMode;
    /**
     * Unique identifier for the conversation
     */
    conversationId?: string;
    /**
     * Session identifier for grouping related requests
     */
    sessionId?: string;
    /**
     * Plan identifier for plan-related operations
     */
    planId?: string;
    /**
     * Orchestration identifier
     */
    orchestrationId?: string;
    /**
     * Orchestration run identifier
     */
    orchestrationRunId?: string;
    /**
     * Orchestration slug for named orchestrations
     */
    orchestrationSlug?: string;
    /**
     * Action-specific parameters and configuration
     * This is where mode/action-specific data goes
     */
    payload?: {
        /**
         * The action to perform within the mode (e.g., 'create', 'read', 'update', 'delete')
         */
        action?: string;
        /**
         * Additional action-specific parameters
         */
        [key: string]: any;
    };
    /**
     * Parameters for prompt template interpolation
     */
    promptParameters?: Record<string, any>;
    /**
     * User's message or prompt
     */
    userMessage?: string;
    /**
     * Conversation history (array of messages)
     */
    messages?: TaskMessage[];
    /**
     * Custom metadata for the request
     * This is for implementation-specific data that doesn't fit in other fields
     */
    metadata?: Record<string, any>;
}
/**
 * Complete A2A Task Request (JSON-RPC 2.0 + A2A params)
 */
export interface A2ATaskRequest {
    /** JSON-RPC version (always "2.0") */
    jsonrpc: '2.0';
    /** Request identifier */
    id: string | number | null;
    /** Method name (maps to AgentTaskMode) */
    method: string;
    /** A2A task request parameters */
    params: TaskRequestParams;
}
//# sourceMappingURL=task-request.types.d.ts.map