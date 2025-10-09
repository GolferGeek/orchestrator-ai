/**
 * Build Response Handler
 * Validates and processes build/deliverable-specific responses
 * Updates the store directly after extracting data
 */

import type {
  StrictBuildResponse,
  DeliverableData,
  DeliverableVersionData,
} from '@orchestrator-ai/transport-types';
import {
  isStrictBuildResponse,
  validateSuccessResponse,
  extractSuccessPayload,
  StrictResponseValidationError,
} from './response-validation';
import { useDeliverableStore } from '@/stores/deliverableStore';

/**
 * Build response types for different actions
 */
export interface BuildExecuteResult {
  deliverable: DeliverableData;
  version: DeliverableVersionData;
}

export interface BuildReadResult {
  deliverable: DeliverableData;
  version: DeliverableVersionData;
}

export interface BuildListResult {
  deliverables: DeliverableData[];
}

export interface BuildRerunResult {
  deliverable: DeliverableData;
  version: DeliverableVersionData;
}

export interface BuildEditResult {
  deliverable: DeliverableData;
  version: DeliverableVersionData;
}

export interface BuildDeleteResult {
  deleted: boolean;
  deliverableId: string;
}

export interface BuildSetCurrentResult {
  deliverable: DeliverableData;
  version: DeliverableVersionData;
}

export interface BuildDeleteVersionResult {
  deleted: boolean;
  deliverableId: string;
  versionId: string;
}

export interface BuildMergeVersionsResult {
  deliverable: DeliverableData;
  version: DeliverableVersionData;
}

export interface BuildCopyVersionResult {
  deliverable: DeliverableData;
  version: DeliverableVersionData;
}

/**
 * Shared validator/extractor helper
 * Pure function that validates response and extracts typed content
 *
 * @throws StrictResponseValidationError if response is invalid
 */
function validateAndExtract<T>(response: any, action: string): T {
  // Validate it's a build response
  if (!isStrictBuildResponse(response)) {
    throw new StrictResponseValidationError(
      `Response is not a valid build response for action: ${action}`,
      response,
    );
  }

  // Validate success response structure
  const validation = validateSuccessResponse(response, 'build');
  if (!validation.valid) {
    throw new StrictResponseValidationError(
      `Invalid build response for ${action}: ${validation.errors.join(', ')}`,
      response,
    );
  }

  // Extract payload
  const { content } = extractSuccessPayload<T>(response);

  // Ensure content exists
  if (!content) {
    throw new StrictResponseValidationError(
      `No content in build response for action: ${action}`,
      response,
    );
  }

  return content;
}

/**
 * Build response handler
 * Validates responses and updates the store directly
 */
export const buildResponseHandler = {
  /**
   * Handle execute build response (create action in build mode)
   * Validates, extracts data, and updates store
   */
  handleExecute(response: any, planId?: string): BuildExecuteResult {
    const result = validateAndExtract<BuildExecuteResult>(response, 'create');
    const store = useDeliverableStore();

    // Update store
    store.addDeliverable(result.deliverable, result.version);
    if (planId) {
      store.associateDeliverableWithPlan(result.deliverable.id, planId);
    }
    if (result.version) {
      store.setCurrentVersion(result.deliverable.id, result.version.id);
    }

    return result;
  },

  /**
   * Handle read deliverable response
   * Validates, extracts data, and updates store
   */
  handleRead(response: any): BuildReadResult {
    const result = validateAndExtract<BuildReadResult>(response, 'read');
    const store = useDeliverableStore();

    // Update store
    store.addDeliverable(result.deliverable, result.version);
    if (result.version) {
      store.setCurrentVersion(result.deliverable.id, result.version.id);
    }

    return result;
  },

  /**
   * Handle list deliverables response
   * Validates, extracts data, and updates store
   */
  handleList(response: any, planId?: string): BuildListResult {
    const result = validateAndExtract<BuildListResult>(response, 'list');
    const store = useDeliverableStore();

    // Update store with all deliverables
    result.deliverables.forEach(deliverable => {
      store.addDeliverable(deliverable);
      if (planId) {
        store.associateDeliverableWithPlan(deliverable.id, planId);
      }
    });

    return result;
  },

  /**
   * Handle rerun build response
   * Validates, extracts data, and updates store
   */
  handleRerun(response: any): BuildRerunResult {
    const result = validateAndExtract<BuildRerunResult>(response, 'rerun');
    const store = useDeliverableStore();

    // Update store with new version
    store.addDeliverable(result.deliverable, result.version);
    if (result.version) {
      store.setCurrentVersion(result.deliverable.id, result.version.id);
    }

    return result;
  },

  /**
   * Handle edit deliverable response
   * Validates, extracts data, and updates store
   */
  handleEdit(response: any): BuildEditResult {
    const result = validateAndExtract<BuildEditResult>(response, 'edit');
    const store = useDeliverableStore();

    // Update store
    store.addDeliverable(result.deliverable, result.version);
    if (result.version) {
      store.setCurrentVersion(result.deliverable.id, result.version.id);
    }

    return result;
  },

  /**
   * Handle set current version response
   * Validates, extracts data, and updates store
   */
  handleSetCurrent(response: any): BuildSetCurrentResult {
    const result = validateAndExtract<BuildSetCurrentResult>(response, 'set_current');
    const store = useDeliverableStore();

    // Update store
    store.setCurrentVersion(result.deliverable.id, result.version.id);

    return result;
  },

  /**
   * Handle delete version response
   * Validates, extracts data, and updates store
   */
  handleDeleteVersion(response: any): BuildDeleteVersionResult {
    const result = validateAndExtract<BuildDeleteVersionResult>(response, 'delete_version');
    const store = useDeliverableStore();

    // Update store
    if (result.deleted) {
      store.deleteVersion(result.deliverableId, result.versionId);
    }

    return result;
  },

  /**
   * Handle merge versions response
   * Validates, extracts data, and updates store
   */
  handleMergeVersions(response: any): BuildMergeVersionsResult {
    const result = validateAndExtract<BuildMergeVersionsResult>(response, 'merge_versions');
    const store = useDeliverableStore();

    // Update store with merged version
    store.addDeliverable(result.deliverable, result.version);
    if (result.version) {
      store.setCurrentVersion(result.deliverable.id, result.version.id);
    }

    return result;
  },

  /**
   * Handle copy version response
   * Validates, extracts data, and updates store
   */
  handleCopyVersion(response: any): BuildCopyVersionResult {
    const result = validateAndExtract<BuildCopyVersionResult>(response, 'copy_version');
    const store = useDeliverableStore();

    // Update store with copied version
    store.addVersion(result.deliverable.id, result.version);

    return result;
  },

  /**
   * Handle delete deliverable response
   * Validates, extracts data, and updates store
   */
  handleDelete(response: any): BuildDeleteResult {
    const result = validateAndExtract<BuildDeleteResult>(response, 'delete');
    const store = useDeliverableStore();

    // Update store
    if (result.deleted) {
      store.deleteDeliverable(result.deliverableId);
    }

    return result;
  },

  /**
   * Generic handler that auto-detects action
   * Validates and returns typed data
   */
  handle(response: any): any {
    return validateAndExtract(response, 'unknown');
  },
};
