/**
 * Plan Response Handler
 * Validates and processes plan-specific responses
 */

import type {
  StrictPlanResponse,
  PlanData,
  PlanVersionData,
} from '@transport-types';
import {
  isStrictPlanResponse,
  validateSuccessResponse,
  extractSuccessPayload,
  StrictResponseValidationError,
} from './response-validation';

/**
 * Plan response types for different actions
 */
export interface PlanCreateResult {
  plan: PlanData;
  version: PlanVersionData;
}

export interface PlanReadResult {
  plan: PlanData;
  version: PlanVersionData;
}

export interface PlanListResult {
  plans: PlanData[];
}

export interface PlanEditResult {
  plan: PlanData;
  version: PlanVersionData;
}

export interface PlanDeleteResult {
  deleted: boolean;
  planId: string;
}

/**
 * Shared validator/extractor helper
 * Pure function that validates response and extracts typed content
 *
 * @throws StrictResponseValidationError if response is invalid
 */
function validateAndExtract<T>(response: any, action: string): T {
  // Validate it's a plan response
  if (!isStrictPlanResponse(response)) {
    throw new StrictResponseValidationError(
      `Response is not a valid plan response for action: ${action}`,
      response,
    );
  }

  // Validate success response structure
  const validation = validateSuccessResponse(response, 'plan');
  if (!validation.valid) {
    throw new StrictResponseValidationError(
      `Invalid plan response for ${action}: ${validation.errors.join(', ')}`,
      response,
    );
  }

  // Extract payload
  const { content } = extractSuccessPayload<T>(response);

  // Ensure content exists
  if (!content) {
    throw new StrictResponseValidationError(
      `No content in plan response for action: ${action}`,
      response,
    );
  }

  return content;
}

/**
 * Plan response handler
 * All methods are pure validators/transformers with no side effects
 * Caller (typically a store action) is responsible for state mutations
 */
export const planResponseHandler = {
  /**
   * Handle create plan response
   * Pure function: validates and returns typed data
   */
  handleCreate(response: any): PlanCreateResult {
    return validateAndExtract<PlanCreateResult>(response, 'create');
  },

  /**
   * Handle read plan response
   * Pure function: validates and returns typed data
   */
  handleRead(response: any): PlanReadResult {
    return validateAndExtract<PlanReadResult>(response, 'read');
  },

  /**
   * Handle list plans response
   * Pure function: validates and returns typed data
   */
  handleList(response: any): PlanListResult {
    return validateAndExtract<PlanListResult>(response, 'list');
  },

  /**
   * Handle edit plan response
   * Pure function: validates and returns typed data
   */
  handleEdit(response: any): PlanEditResult {
    return validateAndExtract<PlanEditResult>(response, 'edit');
  },

  /**
   * Handle delete plan response
   * Pure function: validates and returns typed data
   */
  handleDelete(response: any): PlanDeleteResult {
    return validateAndExtract<PlanDeleteResult>(response, 'delete');
  },

  /**
   * Generic handler that auto-detects action
   * Pure function: validates and returns typed data
   */
  handle(response: any): any {
    return validateAndExtract(response, 'unknown');
  },
};
