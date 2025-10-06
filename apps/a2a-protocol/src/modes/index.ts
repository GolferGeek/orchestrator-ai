/**
 * Mode-Specific Types
 * Export all mode-specific payloads and metadata
 */

export * from './plan.types';
export * from './build.types';
export * from './converse.types';

/**
 * Type Helpers for Mode Detection
 */

import { PlanModePayload } from './plan.types';
import { BuildModePayload } from './build.types';
import { ConverseModePayload } from './converse.types';

/**
 * All Mode Payloads
 */
export type ModePayload = PlanModePayload | BuildModePayload | ConverseModePayload;

/**
 * Type guard for plan payload
 */
export function isPlanPayload(payload: any): payload is PlanModePayload {
  return payload && typeof payload === 'object' && 'action' in payload &&
    ['create', 'read', 'list', 'edit', 'set_current', 'delete_version', 'merge_versions', 'copy_version', 'delete'].includes(payload.action);
}

/**
 * Type guard for build payload
 */
export function isBuildPayload(payload: any): payload is BuildModePayload {
  return payload && typeof payload === 'object' && 'action' in payload &&
    ['create', 'read', 'list', 'edit', 'rerun', 'set_current', 'delete_version', 'merge_versions', 'copy_version', 'delete'].includes(payload.action);
}

/**
 * Type guard for converse payload
 */
export function isConversePayload(payload: any): payload is ConverseModePayload {
  return payload && typeof payload === 'object' && !('action' in payload);
}
