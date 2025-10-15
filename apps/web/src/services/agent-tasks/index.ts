/**
 * Agent Task Services
 *
 * Main entry point for agent task services.
 * Components should import from this file for clean imports.
 *
 * Usage:
 * ```typescript
 * import { agentTaskService } from '@/services/agent-tasks';
 *
 * // Send a task
 * await agentTaskService.sendTask({
 *   agentSlug: 'my-agent',
 *   mode: 'converse',
 *   userMessage: 'Hello',
 *   conversationId: 'conv-123',
 * });
 * ```
 */

// Main facade service (recommended for components)
export { agentTaskService, AgentTaskService } from './agentTaskService';
export type { SendTaskParams } from './agentTaskService';

// Individual services (for direct access if needed)
export { conversationService, ConversationService } from './conversationService';
export type { SendConverseParams } from './conversationService';

export { planService, PlanService } from './planService';
export type {
  PlanCreateParams,
  PlanReadParams,
  PlanListParams,
} from './planService';

export { deliverableService, DeliverableService } from './deliverableService';
export type {
  DeliverableCreateParams,
  DeliverableReadParams,
  DeliverableListParams,
} from './deliverableService';

// Response handler
export { responseHandler, ResponseHandler } from './responseHandler';

// Common types and utilities
export type {
  ServiceConfig,
  ServiceError,
  ServiceResponse,
  SendTaskParams as CommonSendTaskParams,
  StreamParams,
} from './types';

export {
  createServiceError,
  createSuccessResponse,
  createErrorResponse,
  validateRequired,
  buildRequestMetadata,
  debugLog,
  isErrorResponse,
  extractErrorMessage,
  extractErrorCode,
} from './types';
