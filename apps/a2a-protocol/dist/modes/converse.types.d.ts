/**
 * Converse Mode Types
 * Defines mode-specific payloads and metadata for conversational interactions
 */
/**
 * Converse Mode Payload
 * Converse mode typically doesn't have actions, just conversational interaction
 */
export interface ConverseModePayload {
    /** Optional parameters for conversation behavior */
    temperature?: number;
    /** Max tokens for response */
    maxTokens?: number;
    /** Stop sequences */
    stop?: string[];
    /** Custom conversation settings */
    [key: string]: any;
}
/**
 * Converse Request Metadata
 */
export interface ConverseRequestMetadata {
    /** Source of the request (e.g., 'web-ui', 'api', 'cli') */
    source?: string;
    /** User ID making the request */
    userId?: string;
    /** Conversation context */
    context?: string;
    /** Custom application data */
    [key: string]: any;
}
/**
 * Converse Response Metadata
 */
export interface ConverseResponseMetadata {
    /** LLM provider used */
    provider?: string;
    /** LLM model used */
    model?: string;
    /** Token usage statistics */
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        cost?: number;
    };
    /** Routing decision information */
    routingDecision?: Record<string, any>;
    /** Stream ID if streaming was used */
    streamId?: string;
}
/**
 * Converse Response Content
 */
export interface ConverseResponseContent {
    /** The assistant's message */
    message: string;
}
//# sourceMappingURL=converse.types.d.ts.map