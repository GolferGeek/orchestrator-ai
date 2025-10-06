/**
 * Strict A2A Protocol - Base Types
 * Shared base types used across all modes
 */
/**
 * Base message structure
 */
export interface StrictTaskMessage {
    role: string;
    content: any;
}
/**
 * Base metadata that all requests can have
 */
export interface StrictRequestMetadata {
    source?: string;
    userId?: string;
    [key: string]: any;
}
/**
 * Base metadata that all responses can have
 */
export interface StrictResponseMetadata {
    provider?: string;
    model?: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        cost?: number;
    };
    [key: string]: any;
}
//# sourceMappingURL=base.types.d.ts.map