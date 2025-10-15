/**
 * Orchestrate Request Builder
 * Creates fully-typed, validated orchestrate requests
 */

import type {
  StrictOrchestrateRequest,
  AgentTaskMode,
  OrchestrateAction,
  StrictTaskMessage,
} from '@orchestrator-ai/transport-types';

interface RequestMetadata {
  conversationId: string;
  userMessage?: string;
  messages?: StrictTaskMessage[];
  metadata?: Record<string, any>;
}

/**
 * Validation helper
 */
function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} is required and cannot be empty`);
  }
}

/**
 * Orchestrate request builders
 * Core actions following the Plan/Build pattern
 */
export const orchestrateBuilder = {
  /**
   * Create a new orchestration
   */
  create: (
    metadata: RequestMetadata,
    payload: Record<string, any>,
  ): StrictOrchestrateRequest => {
    validateRequired(metadata.conversationId, 'conversationId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'orchestrate',
      params: {
        mode: 'orchestrate' as AgentTaskMode,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata || {},
        payload: { ...payload, action: 'create' },
      },
    };
  },

  /**
   * Execute an orchestration
   */
  execute: (
    metadata: RequestMetadata,
    payload: Record<string, any>,
  ): StrictOrchestrateRequest => {
    validateRequired(metadata.conversationId, 'conversationId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'orchestrate',
      params: {
        mode: 'orchestrate' as AgentTaskMode,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata || {},
        payload: { ...payload, action: 'execute' },
      },
    };
  },

  /**
   * Continue an orchestration
   */
  continue: (
    metadata: RequestMetadata,
    payload: Record<string, any>,
  ): StrictOrchestrateRequest => {
    validateRequired(metadata.conversationId, 'conversationId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'orchestrate',
      params: {
        mode: 'orchestrate' as AgentTaskMode,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata || {},
        payload: { ...payload, action: 'continue' },
      },
    };
  },

  /**
   * Save orchestration as recipe
   */
  saveRecipe: (
    metadata: RequestMetadata,
    payload: Record<string, any>,
  ): StrictOrchestrateRequest => {
    validateRequired(metadata.conversationId, 'conversationId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'orchestrate',
      params: {
        mode: 'orchestrate' as AgentTaskMode,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata || {},
        payload: { ...payload, action: 'save_recipe' },
      },
    };
  },
};
