/**
 * Strict Request Builder
 * Creates fully-typed, validated requests for the A2A protocol
 * Ensures all required fields are set before sending to the backend
 */

import type {
  StrictA2ARequest,
  StrictPlanRequest,
  StrictBuildRequest,
  StrictConverseRequest,
  AgentTaskMode,
  PlanAction,
  BuildAction,
  StrictTaskMessage,
} from '@orchestrator-ai/transport-types';

/**
 * Base metadata for all requests
 */
interface RequestMetadata {
  conversationId: string;
  userMessage?: string;
  messages?: StrictTaskMessage[];
  metadata?: Record<string, unknown>;
}

/**
 * Validation error
 */
export class StrictRequestValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(`Validation failed for field '${field}': ${message}`);
    this.name = 'StrictRequestValidationError';
  }
}

/**
 * Plan request builders
 */
export const buildPlanRequest = {
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

/**
 * Build request builders
 */
export const buildBuildRequest = {
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
  read: (
    metadata: RequestMetadata,
    deliverableId?: string,
  ): StrictBuildRequest => {
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
    rerunData: { versionId: string; config?: Record<string, unknown> },
  ): StrictBuildRequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.userMessage, 'userMessage');
    validateRequired(rerunData.versionId, 'versionId');

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

/**
 * Converse request builder
 */
export const buildConverseRequest = {
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

/**
 * Unified request builder
 * Provides a single entry point for all request types
 */
export const buildRequest = {
  plan: buildPlanRequest,
  build: buildBuildRequest,
  converse: buildConverseRequest,
};

/**
 * Validation helper
 */
function validateRequired(value: unknown, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new StrictRequestValidationError(
      fieldName,
      'This field is required and cannot be empty',
    );
  }
}

/**
 * Type guard to check if a value is a strict request
 */
export function isStrictRequest(value: unknown): value is StrictA2ARequest {
  return (
    value &&
    typeof value === 'object' &&
    value.jsonrpc === '2.0' &&
    value.id !== undefined &&
    value.method !== undefined &&
    value.params !== undefined
  );
}

/**
 * Validate a strict request before sending
 */
export function validateStrictRequest(
  request: StrictA2ARequest,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate JSON-RPC envelope
  if (request.jsonrpc !== '2.0') {
    errors.push('Invalid jsonrpc version');
  }
  if (!request.id) {
    errors.push('Missing request id');
  }
  if (!request.method) {
    errors.push('Missing method');
  }
  if (!request.params) {
    errors.push('Missing params');
  }

  // Validate params
  const params = request.params as Record<string, unknown>;
  if (params) {
    if (!params.mode) {
      errors.push('Missing mode in params');
    }
    if (!params.conversationId) {
      errors.push('Missing conversationId in params');
    }
  }

  return { valid: errors.length === 0, errors };
}
