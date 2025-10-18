/**
 * Strict Request Validation Utilities
 */

import type { StrictA2ARequest } from '@orchestrator-ai/transport-types';

/**
 * Validation error class
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
