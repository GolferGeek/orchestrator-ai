/**
 * Base types for the mode × action architecture
 * Used across all agent-to-agent task operations
 */

/**
 * Task modes define the high-level operation category
 */
export enum TaskMode {
  PLAN = 'plan',
  BUILD = 'build',
  CONVERSE = 'converse',
  TOOL = 'tool',
  ORCHESTRATE = 'orchestrate',
}

/**
 * Task actions define specific operations within a mode
 * Actions are mode-specific (e.g., 'rerun' only exists for 'build' mode)
 */
export type TaskAction = string;

/**
 * Task execution status
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Base request structure for all task operations
 * All specific task requests extend this interface
 */
export interface BaseTaskRequest {
  mode: TaskMode;
  action: TaskAction;
  conversationId: string;
  userId: string;
  agentSlug?: string;
}

/**
 * Standardized response structure for all task operations
 * @template TResult - The specific result type for this task
 */
export interface TaskResponse<TResult = any> {
  success: boolean;
  mode: TaskMode;
  action: TaskAction;
  result?: TResult;
  error?: TaskError;
  metadata?: {
    taskId?: string;
    executionTime?: number;
    timestamp?: string;
    [key: string]: any;
  };
}

/**
 * Standardized error structure for task failures
 */
export interface TaskError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}
