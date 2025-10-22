/**
 * Plan Request Builder
 * Creates fully-typed, validated plan requests
 */

import type {
  StrictPlanRequest,
  AgentTaskMode,
  PlanAction,
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
 * Plan request builders
 * All 9 plan actions from the strict type system
 */
export const planBuilder = {
  /**
   * Create a new plan
   */
  create: (
    metadata: RequestMetadata & { userMessage: string },
    planData?: Record<string, unknown>,
  ): StrictPlanRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.userMessage, 'userMessage');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'plan.create',
      params: {
        mode: 'plan' as AgentTaskMode,
        action: 'create' as PlanAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage,
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: planData || {},
      },
    };
  },

  /**
   * Read current plan
   */
  read: (metadata: RequestMetadata, planId?: string): StrictPlanRequest => {
    validateRequired(metadata.conversationId, 'conversationId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'plan.read',
      params: {
        mode: 'plan' as AgentTaskMode,
        action: 'read' as PlanAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: planId ? { planId } : {},
      },
    };
  },

  /**
   * Edit plan
   */
  edit: (
    metadata: RequestMetadata & { userMessage: string },
    editData: { versionId?: string; content?: string },
  ): StrictPlanRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.userMessage, 'userMessage');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'plan.edit',
      params: {
        mode: 'plan' as AgentTaskMode,
        action: 'edit' as PlanAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage,
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: editData,
      },
    };
  },

  /**
   * List all plans in conversation
   */
  list: (metadata: RequestMetadata): StrictPlanRequest => {
    validateRequired(metadata.conversationId, 'conversationId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'plan.list',
      params: {
        mode: 'plan' as AgentTaskMode,
        action: 'list' as PlanAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: {},
      },
    };
  },

  /**
   * Rerun a plan
   */
  rerun: (
    metadata: RequestMetadata & { userMessage: string },
    rerunData: { versionId: string; config: Record<string, unknown> },
  ): StrictPlanRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.userMessage, 'userMessage');
    validateRequired(rerunData.versionId, 'versionId');
    validateRequired(rerunData.config, 'config');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'plan.rerun',
      params: {
        mode: 'plan' as AgentTaskMode,
        action: 'rerun' as PlanAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage,
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: rerunData,
      },
    };
  },

  /**
   * Delete plan
   */
  delete: (metadata: RequestMetadata, planId: string): StrictPlanRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(planId, 'planId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'plan.delete',
      params: {
        mode: 'plan' as AgentTaskMode,
        action: 'delete' as PlanAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: { planId },
      },
    };
  },

  /**
   * Set current plan version
   */
  setCurrent: (metadata: RequestMetadata, versionId: string): StrictPlanRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(versionId, 'versionId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'plan.set_current',
      params: {
        mode: 'plan' as AgentTaskMode,
        action: 'set_current' as PlanAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: { versionId },
      },
    };
  },

  /**
   * Delete plan version
   */
  deleteVersion: (metadata: RequestMetadata, versionId: string): StrictPlanRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(versionId, 'versionId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'plan.delete_version',
      params: {
        mode: 'plan' as AgentTaskMode,
        action: 'delete_version' as PlanAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: { versionId },
      },
    };
  },

  /**
   * Merge plan versions
   */
  mergeVersions: (
    metadata: RequestMetadata & { userMessage: string },
    mergeData: { versionIds: string[]; mergePrompt: string },
  ): StrictPlanRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.userMessage, 'userMessage');
    validateRequired(mergeData.versionIds, 'versionIds');
    validateRequired(mergeData.mergePrompt, 'mergePrompt');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'plan.merge_versions',
      params: {
        mode: 'plan' as AgentTaskMode,
        action: 'merge_versions' as PlanAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage,
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: mergeData,
      },
    };
  },

  /**
   * Copy plan version
   */
  copyVersion: (metadata: RequestMetadata, versionId: string): StrictPlanRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(versionId, 'versionId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'plan.copy_version',
      params: {
        mode: 'plan' as AgentTaskMode,
        action: 'copy_version' as PlanAction,
        conversationId: metadata.conversationId,
        userMessage: metadata.userMessage || '',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: { versionId },
      },
    };
  },
};
