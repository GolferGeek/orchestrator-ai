/**
 * Converse Response Handler
 * Validates and processes converse-specific responses
 */

import type { StrictConverseResponse } from '@orchestrator-ai/a2a-protocol';
import {
  isStrictConverseResponse,
  validateSuccessResponse,
  extractSuccessPayload,
  StrictResponseValidationError,
} from './response-validation';

/**
 * Converse response types
 */
export interface ConverseResult {
  message: string;
  metadata?: {
    timestamp?: string;
    model?: string;
    [key: string]: any;
  };
}

/**
 * Shared validator/extractor helper
 * Pure function that validates response and extracts typed content
 *
 * @throws StrictResponseValidationError if response is invalid
 */
function validateAndExtract(response: any, action: string): ConverseResult {
  // Validate it's a converse response
  if (!isStrictConverseResponse(response)) {
    throw new StrictResponseValidationError(
      `Response is not a valid converse response for action: ${action}`,
      response,
    );
  }

  // Validate success response structure
  const validation = validateSuccessResponse(response, 'converse');
  if (!validation.valid) {
    throw new StrictResponseValidationError(
      `Invalid converse response for ${action}: ${validation.errors.join(', ')}`,
      response,
    );
  }

  // Extract payload
  const { content, metadata } = extractSuccessPayload<ConverseResult>(response);

  // Ensure content exists
  if (!content) {
    throw new StrictResponseValidationError(
      `No content in converse response for action: ${action}`,
      response,
    );
  }

  return { ...content, metadata };
}

/**
 * Converse response handler
 * All methods are pure validators/transformers with no side effects
 * Caller (typically a store action) is responsible for state mutations
 */
export const converseResponseHandler = {
  /**
   * Handle converse send response
   * Pure function: validates and returns typed data
   */
  handleSend(response: any): ConverseResult {
    return validateAndExtract(response, 'send');
  },

  /**
   * Generic handler
   * Pure function: validates and returns typed data
   */
  handle(response: any): ConverseResult {
    return validateAndExtract(response, 'unknown');
  },
};
