/**
 * Build Request Builder
 * Creates fully-typed, validated build/deliverable requests
 */

import type {
  StrictBuildRequest,
  AgentTaskMode,
  BuildAction,
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
 * Build request builders
 * All 10 build actions from the strict type system
 */
export const buildBuilder = {
  /**
   * Execute build (create deliverable)
   */
  execute: (
    metadata: RequestMetadata & { userMessage: string },
    buildData?: { planId?: string; [key: string]: unknown },
  ): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.userMessage, 'userMessage');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'build.execute',
      params: {
        mode: 'build' as AgentTaskMode,
        action: 'execute' as BuildAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage,
        messages: metadata.messages || [],
        planId: buildData?.planId,
        metadata: metadata.metadata,
        payload: buildData || {},
      },
    };
  },

  /**
   * Read current deliverable
   */
  read: (metadata: RequestMetadata, deliverableId?: string): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'build.read',
      params: {
        mode: 'build' as AgentTaskMode,
        action: 'read' as BuildAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: deliverableId ? { deliverableId } : {},
      },
    };
  },

  /**
   * List all deliverables in conversation
   */
  list: (metadata: RequestMetadata): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'build.list',
      params: {
        mode: 'build' as AgentTaskMode,
        action: 'list' as BuildAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: {},
      },
    };
  },

  /**
   * Rerun a build
   */
  rerun: (
    metadata: RequestMetadata & { userMessage: string },
    rerunData: { versionId: string; config: Record<string, unknown> },
  ): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.userMessage, 'userMessage');
    validateRequired(rerunData.versionId, 'versionId');
    validateRequired(rerunData.config, 'config');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'build.rerun',
      params: {
        mode: 'build' as AgentTaskMode,
        action: 'rerun' as BuildAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage,
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: rerunData,
      },
    };
  },

  /**
   * Edit deliverable
   */
  edit: (
    metadata: RequestMetadata & { userMessage: string },
    editData: { versionId?: string; content?: string },
  ): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.userMessage, 'userMessage');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'build.edit',
      params: {
        mode: 'build' as AgentTaskMode,
        action: 'edit' as BuildAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage,
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: editData,
      },
    };
  },

  /**
   * Set current deliverable version
   */
  setCurrent: (metadata: RequestMetadata, versionId: string): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(versionId, 'versionId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'build.set_current',
      params: {
        mode: 'build' as AgentTaskMode,
        action: 'set_current' as BuildAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: { versionId },
      },
    };
  },

  /**
   * Delete deliverable version
   */
  deleteVersion: (metadata: RequestMetadata, versionId: string): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(versionId, 'versionId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'build.delete_version',
      params: {
        mode: 'build' as AgentTaskMode,
        action: 'delete_version' as BuildAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: { versionId },
      },
    };
  },

  /**
   * Merge deliverable versions
   */
  mergeVersions: (
    metadata: RequestMetadata & { userMessage: string },
    mergeData: { versionIds: string[]; mergePrompt: string },
  ): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.userMessage, 'userMessage');
    validateRequired(mergeData.versionIds, 'versionIds');
    validateRequired(mergeData.mergePrompt, 'mergePrompt');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'build.merge_versions',
      params: {
        mode: 'build' as AgentTaskMode,
        action: 'merge_versions' as BuildAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage,
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: mergeData,
      },
    };
  },

  /**
   * Copy deliverable version
   */
  copyVersion: (metadata: RequestMetadata, versionId: string): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(versionId, 'versionId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'build.copy_version',
      params: {
        mode: 'build' as AgentTaskMode,
        action: 'copy_version' as BuildAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: { versionId },
      },
    };
  },

  /**
   * Delete deliverable
   */
  delete: (metadata: RequestMetadata, deliverableId: string): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(deliverableId, 'deliverableId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'build.delete',
      params: {
        mode: 'build' as AgentTaskMode,
        action: 'delete' as BuildAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: { deliverableId },
      },
    };
  },
};
