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
export declare function isPlanPayload(payload: any): payload is PlanModePayload;
/**
 * Type guard for build payload
 */
export declare function isBuildPayload(payload: any): payload is BuildModePayload;
/**
 * Type guard for converse payload
 */
export declare function isConversePayload(payload: any): payload is ConverseModePayload;
//# sourceMappingURL=index.d.ts.map