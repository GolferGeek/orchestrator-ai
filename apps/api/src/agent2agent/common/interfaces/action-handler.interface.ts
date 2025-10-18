/**
 * Interface for services that handle mode-specific actions
 * All domain services (PlansService, DeliverablesService, etc.) implement this
 */

import type { JsonObject, JsonValue } from '@orchestrator-ai/transport-types';

/**
 * Context passed to action handlers containing request metadata
 */
export interface ActionExecutionContext extends JsonObject {
  conversationId: string;
  userId: string;
  agentSlug?: string | null;
  taskId?: string | null;
  metadata?: JsonObject | null;
}

/**
 * Result returned by action handlers
 * @template TData - The specific result type for this action
 */
export interface ActionResult<
  TData = JsonValue,
  TMetadata extends JsonObject | undefined = JsonObject | undefined,
> {
  success: boolean;
  data?: TData;
  error?: {
    code: string;
    message: string;
    details?: JsonObject;
  };
  metadata?: TMetadata;
}

/**
 * Interface that all domain services must implement
 * Provides a unified entry point for executing mode-specific actions
 */
export interface IActionHandler<DefaultParams = JsonObject | undefined> {
  /**
   * Execute a specific action with the given parameters
   * @param action - The action to execute (e.g., 'create', 'read', 'merge_versions')
   * @param params - Action-specific parameters
   * @param context - Execution context (user, conversation, etc.)
   * @returns ActionResult with typed data
   */
  executeAction<TResult = JsonValue, TParams = DefaultParams>(
    action: string,
    params: TParams,
    context: ActionExecutionContext,
  ): Promise<ActionResult<TResult>>;
}
