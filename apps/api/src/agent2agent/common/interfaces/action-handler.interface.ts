/**
 * Interface for services that handle mode-specific actions
 * All domain services (PlansService, DeliverablesService, etc.) implement this
 */

/**
 * Context passed to action handlers containing request metadata
 */
export interface ActionExecutionContext {
  conversationId: string;
  userId: string;
  agentSlug?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

/**
 * Result returned by action handlers
 * @template T - The specific result type for this action
 */
export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

/**
 * Interface that all domain services must implement
 * Provides a unified entry point for executing mode-specific actions
 */
export interface IActionHandler {
  /**
   * Execute a specific action with the given parameters
   * @param action - The action to execute (e.g., 'create', 'read', 'merge_versions')
   * @param params - Action-specific parameters
   * @param context - Execution context (user, conversation, etc.)
   * @returns ActionResult with typed data
   */
  executeAction<T = any>(
    action: string,
    params: any,
    context: ActionExecutionContext,
  ): Promise<ActionResult<T>>;
}
