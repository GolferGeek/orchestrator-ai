"use strict";
/**
 * Mode-Specific Types
 * Export all mode-specific payloads and metadata
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlanPayload = isPlanPayload;
exports.isBuildPayload = isBuildPayload;
exports.isConversePayload = isConversePayload;
__exportStar(require("./plan.types"), exports);
__exportStar(require("./build.types"), exports);
__exportStar(require("./converse.types"), exports);
/**
 * Type guard for plan payload
 */
function isPlanPayload(payload) {
    return payload && typeof payload === 'object' && 'action' in payload &&
        ['create', 'read', 'list', 'edit', 'set_current', 'delete_version', 'merge_versions', 'copy_version', 'delete'].includes(payload.action);
}
/**
 * Type guard for build payload
 */
function isBuildPayload(payload) {
    return payload && typeof payload === 'object' && 'action' in payload &&
        ['create', 'read', 'list', 'edit', 'rerun', 'set_current', 'delete_version', 'merge_versions', 'copy_version', 'delete'].includes(payload.action);
}
/**
 * Type guard for converse payload
 */
function isConversePayload(payload) {
    return payload && typeof payload === 'object' && !('action' in payload);
}
