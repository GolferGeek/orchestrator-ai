/**
 * Strict Request Builders Index
 * Exports all mode-specific builders and validation utilities
 */

export { planBuilder } from './plan.builder';
export { buildBuilder } from './build.builder';
export { converseBuilder } from './converse.builder';
export { orchestrateBuilder } from './orchestrate.builder';

import { planBuilder } from './plan.builder';
import { buildBuilder } from './build.builder';
import { converseBuilder } from './converse.builder';
import { orchestrateBuilder } from './orchestrate.builder';

/**
 * Unified request builder
 * Provides a single entry point for all request types
 */
export const buildRequest = {
  plan: planBuilder,
  build: buildBuilder,
  converse: converseBuilder,
  orchestrate: orchestrateBuilder,
};

/**
 * Re-export validation utilities and error types
 */
export { StrictRequestValidationError, validateStrictRequest, isStrictRequest } from './validation';
