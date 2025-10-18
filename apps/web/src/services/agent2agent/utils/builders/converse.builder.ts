/**
 * Converse Request Builder
 * Creates fully-typed, validated converse requests
 */

import type {
  StrictConverseRequest,
  AgentTaskMode,
  StrictTaskMessage,
} from '@orchestrator-ai/transport-types';

interface RequestMetadata {
  conversationId: string;
  userMessage?: string;
  messages?: StrictTaskMessage[];
  metadata?: Record<string, unknown>;
}

/**
 * Validation helper
 */
function validateRequired(value: unknown, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} is required and cannot be empty`);
  }
}

/**
 * Converse request builder
 * Single action: send message
 */
export const converseBuilder = {
  /**
   * Send a conversation message
   */
  send: (
    metadata: RequestMetadata & { userMessage: string },
  ): StrictConverseRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.userMessage, 'userMessage');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'converse',
      params: {
        mode: 'converse' as AgentTaskMode,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage,
        messages: metadata.messages || [],
        metadata: metadata.metadata,
      },
    };
  },
};
