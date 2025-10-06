/**
 * Strict Type Validator Utility
 * Runtime validation using strict A2A protocol type guards
 */

import {
  isStrictPlanResponse,
  isStrictBuildResponse,
  isStrictErrorResponse,
  isStrictSuccessResponse,
} from '@orchestrator-ai/a2a-protocol';

import { TaskResponseDto } from '../dto/task-response.dto';

/**
 * Validate if a response conforms to strict protocol
 */
export function validateStrictResponse(
  response: any,
  expectedMode?: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if it's a valid strict response
  if (!isStrictSuccessResponse(response) && !isStrictErrorResponse(response)) {
    errors.push('Response does not conform to strict A2A protocol format');
    return { valid: false, errors };
  }

  // If error response, validate error structure
  if (isStrictErrorResponse(response)) {
    if (!response.error?.code) {
      errors.push('Error response missing error code');
    }
    if (!response.error?.message) {
      errors.push('Error response missing error message');
    }
    return { valid: errors.length === 0, errors };
  }

  // Validate success response structure
  if (isStrictSuccessResponse(response)) {
    if (!response.result?.success) {
      errors.push('Success response missing success flag');
    }
    if (!response.result?.mode) {
      errors.push('Success response missing mode');
    }
    if (expectedMode && response.result?.mode !== expectedMode) {
      errors.push(`Mode mismatch: expected ${expectedMode}, got ${response.result?.mode}`);
    }

    // Validate mode-specific structure
    const mode = response.result?.mode;
    switch (mode) {
      case 'plan':
        if (!isStrictPlanResponse(response)) {
          errors.push('Response does not conform to strict plan response format');
        }
        break;
      case 'build':
        if (!isStrictBuildResponse(response)) {
          errors.push('Response does not conform to strict build response format');
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate TaskResponseDto before converting to strict type
 */
export function validateTaskResponseDto(dto: TaskResponseDto): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (dto.success === undefined) {
    errors.push('TaskResponseDto missing success flag');
  }

  if (!dto.mode) {
    errors.push('TaskResponseDto missing mode');
  }

  if (dto.success && !dto.payload) {
    errors.push('Successful TaskResponseDto should have payload');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Log validation errors
 */
export function logValidationErrors(
  errors: string[],
  context: string,
  logger?: any,
): void {
  if (errors.length === 0) return;

  const errorMessage = `[${context}] Validation errors: ${errors.join('; ')}`;

  if (logger) {
    logger.warn(errorMessage);
  } else {
    console.warn(errorMessage);
  }
}
