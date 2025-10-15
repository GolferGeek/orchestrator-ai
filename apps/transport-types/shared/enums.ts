/**
 * Agent Task Modes
 * Defines the operational mode of the agent
 */
export enum AgentTaskMode {
  /** Conversational interaction */
  CONVERSE = 'converse',

  /** Planning phase */
  PLAN = 'plan',

  /** Building/execution phase */
  BUILD = 'build',

  /** Orchestration mode (action-based routing) */
  ORCHESTRATE = 'orchestrate',

  /** Human response required */
  HUMAN_RESPONSE = 'human_response',

  /** Orchestration creation */
  ORCHESTRATE_CREATE = 'orchestrate_create',

  /** Orchestration execution */
  ORCHESTRATE_EXECUTE = 'orchestrate_execute',

  /** Orchestration continuation */
  ORCHESTRATE_CONTINUE = 'orchestrate_continue',

  /** Save orchestration recipe */
  ORCHESTRATE_SAVE_RECIPE = 'orchestrate_save_recipe',

  /** Orchestrator plan creation */
  ORCHESTRATOR_PLAN_CREATE = 'orchestrator_plan_create',

  /** Orchestrator plan update */
  ORCHESTRATOR_PLAN_UPDATE = 'orchestrator_plan_update',

  /** Orchestrator plan review */
  ORCHESTRATOR_PLAN_REVIEW = 'orchestrator_plan_review',

  /** Orchestrator plan approval */
  ORCHESTRATOR_PLAN_APPROVE = 'orchestrator_plan_approve',

  /** Orchestrator plan rejection */
  ORCHESTRATOR_PLAN_REJECT = 'orchestrator_plan_reject',

  /** Orchestrator plan archival */
  ORCHESTRATOR_PLAN_ARCHIVE = 'orchestrator_plan_archive',

  /** Orchestrator run start */
  ORCHESTRATOR_RUN_START = 'orchestrator_run_start',

  /** Orchestrator run continuation */
  ORCHESTRATOR_RUN_CONTINUE = 'orchestrator_run_continue',

  /** Orchestrator run pause */
  ORCHESTRATOR_RUN_PAUSE = 'orchestrator_run_pause',

  /** Orchestrator run resume */
  ORCHESTRATOR_RUN_RESUME = 'orchestrator_run_resume',

  /** Orchestrator human response */
  ORCHESTRATOR_RUN_HUMAN_RESPONSE = 'orchestrator_run_human_response',

  /** Orchestrator step rollback */
  ORCHESTRATOR_RUN_ROLLBACK_STEP = 'orchestrator_run_rollback_step',

  /** Orchestrator run cancellation */
  ORCHESTRATOR_RUN_CANCEL = 'orchestrator_run_cancel',

  /** Orchestrator run evaluation */
  ORCHESTRATOR_RUN_EVALUATE = 'orchestrator_run_evaluate',

  /** Orchestrator recipe save */
  ORCHESTRATOR_RECIPE_SAVE = 'orchestrator_recipe_save',

  /** Orchestrator recipe update */
  ORCHESTRATOR_RECIPE_UPDATE = 'orchestrator_recipe_update',

  /** Orchestrator recipe validation */
  ORCHESTRATOR_RECIPE_VALIDATE = 'orchestrator_recipe_validate',

  /** Orchestrator recipe deletion */
  ORCHESTRATOR_RECIPE_DELETE = 'orchestrator_recipe_delete',

  /** Orchestrator recipe load */
  ORCHESTRATOR_RECIPE_LOAD = 'orchestrator_recipe_load',

  /** Orchestrator recipe list */
  ORCHESTRATOR_RECIPE_LIST = 'orchestrator_recipe_list',
}

/**
 * JSON-RPC Method Names
 * Maps to AgentTaskMode internally
 */
export type JsonRpcMethod =
  | 'converse'
  | 'agent.converse'
  | 'tasks.converse'
  | 'plan'
  | 'agent.plan'
  | 'tasks.plan'
  | 'build'
  | 'agent.build'
  | 'tasks.build'
  | 'orchestrate'
  | 'agent.orchestrate'
  | 'tasks.orchestrate'
  | 'orchestrate.create'
  | 'orchestrate.execute'
  | 'orchestrate.continue'
  | string; // Allow extension

/**
 * Standard JSON-RPC 2.0 Error Codes
 */
export enum JsonRpcErrorCode {
  /** Invalid JSON was received by the server */
  PARSE_ERROR = -32700,

  /** The JSON sent is not a valid Request object */
  INVALID_REQUEST = -32600,

  /** The method does not exist / is not available */
  METHOD_NOT_FOUND = -32601,

  /** Invalid method parameter(s) */
  INVALID_PARAMS = -32602,

  /** Internal JSON-RPC error */
  INTERNAL_ERROR = -32603,

  /** Reserved for implementation-defined server-errors (-32000 to -32099) */
  SERVER_ERROR_START = -32099,
  SERVER_ERROR_END = -32000,
}

/**
 * Custom A2A Error Codes (extend JSON-RPC reserved range)
 */
export enum A2AErrorCode {
  /** Unauthorized access */
  UNAUTHORIZED = -32001,

  /** Forbidden access */
  FORBIDDEN = -32003,

  /** Resource not found */
  NOT_FOUND = -32004,

  /** Resource conflict */
  CONFLICT = -32009,

  /** Rate limit exceeded */
  RATE_LIMITED = -32042,
}
