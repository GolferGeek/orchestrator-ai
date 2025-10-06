/**
 * Strict A2A Protocol - Converse Mode
 * Complete request and response types for all converse mode actions
 */
import { AgentTaskMode } from '../shared/enums';
import { StrictRequestMetadata, StrictResponseMetadata, StrictTaskMessage } from './base.types';
/**
 * Converse Mode: MESSAGE action
 */
export interface ConverseMessageRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'converse';
    params: {
        mode: AgentTaskMode.CONVERSE;
        conversationId: string;
        userMessage: string;
        messages?: StrictTaskMessage[];
        payload?: {
            action?: 'message';
            temperature?: number;
            maxTokens?: number;
            stream?: boolean;
        };
        metadata?: StrictRequestMetadata;
    };
}
/**
 * Union of all Converse mode requests (just one for now)
 */
export type StrictConverseRequest = ConverseMessageRequest;
/**
 * Converse message data structure
 */
export interface ConverseMessageData {
    message: string;
    conversationId: string;
    messageId: string;
    timestamp: string;
}
/**
 * Converse Mode: MESSAGE response
 */
export interface ConverseMessageResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'converse';
        payload: {
            content: ConverseMessageData;
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Union of all Converse mode responses
 */
export type StrictConverseResponse = ConverseMessageResponse;
//# sourceMappingURL=converse.strict.d.ts.map