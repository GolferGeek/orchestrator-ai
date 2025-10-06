/**
 * Build Response Handler
 * Validates and processes build/deliverable-specific responses
 */

import type {
  StrictBuildResponse,
  DeliverableData,
  DeliverableVersionData,
} from '@orchestrator-ai/a2a-protocol';
import {
  isStrictBuildResponse,
  validateSuccessResponse,
  extractSuccessPayload,
  StrictResponseValidationError,
} from './response-validation';

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
 * All methods are pure validators/transformers with no side effects
 * Caller (typically a store action) is responsible for state mutations
 */
export const buildResponseHandler = {
  /**
   * Handle execute build response
   * Pure function: validates and returns typed data
   */
  handleExecute(response: any): BuildExecuteResult {
    return validateAndExtract<BuildExecuteResult>(response, 'execute');
  },

  /**
   * Handle read deliverable response
   * Pure function: validates and returns typed data
   */
  handleRead(response: any): BuildReadResult {
    return validateAndExtract<BuildReadResult>(response, 'read');
  },

  /**
   * Handle list deliverables response
   * Pure function: validates and returns typed data
   */
  handleList(response: any): BuildListResult {
    return validateAndExtract<BuildListResult>(response, 'list');
  },

  /**
   * Handle rerun build response
   * Pure function: validates and returns typed data
   */
  handleRerun(response: any): BuildRerunResult {
    return validateAndExtract<BuildRerunResult>(response, 'rerun');
  },

  /**
   * Handle edit deliverable response
   * Pure function: validates and returns typed data
   */
  handleEdit(response: any): BuildEditResult {
    return validateAndExtract<BuildEditResult>(response, 'edit');
  },

  /**
   * Handle delete deliverable response
   * Pure function: validates and returns typed data
   */
  handleDelete(response: any): BuildDeleteResult {
    return validateAndExtract<BuildDeleteResult>(response, 'delete');
  },

  /**
   * Generic handler that auto-detects action
   * Pure function: validates and returns typed data
   */
  handle(response: any): any {
    return validateAndExtract(response, 'unknown');
  },
};
