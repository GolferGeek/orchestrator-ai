/**
 * Orchestrate Mode Types
 * Defines mode-specific payloads and metadata for orchestration operations
 */

/**
 * Orchestrate Actions
 */
export type OrchestrateAction =
  // Core orchestration operations
  | 'create'
  | 'execute'
  | 'continue'
  | 'save_recipe'
  // Plan management
  | 'plan_create'
  | 'plan_update'
  | 'plan_review'
  | 'plan_approve'
  | 'plan_reject'
  | 'plan_archive'
  // Run management
  | 'run_start'
  | 'run_continue'
  | 'run_pause'
  | 'run_resume'
  | 'run_cancel'
  | 'run_evaluate'
  | 'run_human_response'
  | 'run_rollback_step'
  // Recipe management
  | 'recipe_save'
  | 'recipe_update'
  | 'recipe_validate'
  | 'recipe_delete'
  | 'recipe_load'
  | 'recipe_list';

/**
 * Orchestrate Create Action Payload
 * Creates a new orchestration from definition or parameters
 */
export interface OrchestrateCreatePayload {
  action: 'create';
  /** Orchestration definition ID to use (optional) */
  orchestrationDefinitionId?: string;
  /** Orchestration name (optional - for named definitions) */
  orchestrationName?: string;
  /** Orchestration version (optional - defaults to latest) */
  orchestrationVersion?: string;
  /** Parameters to pass to the orchestration (optional) */
  parameters?: Record<string, any>;
}

/**
 * Orchestrate Execute Action Payload
 * Executes an orchestration run
 */
export interface OrchestrateExecutePayload {
  action: 'execute';
  /** Orchestration run ID to execute (REQUIRED) */
  orchestrationRunId: string;
  /** Parameters to pass to execution (optional) */
  parameters?: Record<string, any>;
}

/**
 * Orchestrate Continue Action Payload
 * Continues an existing orchestration run
 */
export interface OrchestrateContinuePayload {
  action: 'continue';
  /** Orchestration run ID to continue (REQUIRED) */
  orchestrationRunId: string;
  /** Additional context or parameters (optional) */
  context?: Record<string, any>;
}

/**
 * Orchestrate Save Recipe Action Payload
 * Saves an orchestration as a reusable recipe
 */
export interface OrchestrateSaveRecipePayload {
  action: 'save_recipe';
  /** Orchestration run ID to save as recipe (REQUIRED) */
  orchestrationRunId: string;
  /** Recipe name (REQUIRED) */
  recipeName: string;
  /** Recipe description (optional) */
  description?: string;
  /** Recipe metadata (optional) */
  metadata?: Record<string, any>;
}

/**
 * Orchestrate Plan Create Action Payload
 * Creates a plan for an orchestration
 */
export interface OrchestratePlanCreatePayload {
  action: 'plan_create';
  /** Orchestration run ID (optional - creates new if not provided) */
  orchestrationRunId?: string;
  /** Initial plan content (optional) */
  planContent?: string;
  /** Plan parameters (optional) */
  parameters?: Record<string, any>;
}

/**
 * Orchestrate Plan Update Action Payload
 * Updates an existing orchestration plan
 */
export interface OrchestratePlanUpdatePayload {
  action: 'plan_update';
  /** Plan ID to update (REQUIRED) */
  planId: string;
  /** Updated plan content (REQUIRED) */
  updatedContent: string;
  /** Update comment (optional) */
  comment?: string;
}

/**
 * Orchestrate Plan Review Action Payload
 * Reviews an orchestration plan
 */
export interface OrchestratePlanReviewPayload {
  action: 'plan_review';
  /** Plan ID to review (REQUIRED) */
  planId: string;
  /** Review notes (optional) */
  notes?: string;
}

/**
 * Orchestrate Plan Approve Action Payload
 * Approves an orchestration plan
 */
export interface OrchestratePlanApprovePayload {
  action: 'plan_approve';
  /** Plan ID to approve (REQUIRED) */
  planId: string;
  /** Approval notes (optional) */
  notes?: string;
  /** Approved by user ID (optional) */
  approvedBy?: string;
}

/**
 * Orchestrate Plan Reject Action Payload
 * Rejects an orchestration plan
 */
export interface OrchestratePlanRejectPayload {
  action: 'plan_reject';
  /** Plan ID to reject (REQUIRED) */
  planId: string;
  /** Rejection reason (REQUIRED) */
  reason: string;
  /** Rejected by user ID (optional) */
  rejectedBy?: string;
}

/**
 * Orchestrate Plan Archive Action Payload
 * Archives an orchestration plan
 */
export interface OrchestratePlanArchivePayload {
  action: 'plan_archive';
  /** Plan ID to archive (REQUIRED) */
  planId: string;
  /** Archive reason (optional) */
  reason?: string;
}

/**
 * Orchestrate Run Start Action Payload
 * Starts an orchestration run
 */
export interface OrchestrateRunStartPayload {
  action: 'run_start';
  /** Orchestration definition or recipe to run (REQUIRED) */
  orchestrationId: string;
  /** Run parameters (optional) */
  parameters?: Record<string, any>;
}

/**
 * Orchestrate Run Continue Action Payload
 * Continues a paused orchestration run
 */
export interface OrchestrateRunContinuePayload {
  action: 'run_continue';
  /** Run ID to continue (REQUIRED) */
  runId: string;
  /** Continuation context (optional) */
  context?: Record<string, any>;
}

/**
 * Orchestrate Run Pause Action Payload
 * Pauses an orchestration run
 */
export interface OrchestrateRunPausePayload {
  action: 'run_pause';
  /** Run ID to pause (REQUIRED) */
  runId: string;
  /** Pause reason (optional) */
  reason?: string;
}

/**
 * Orchestrate Run Resume Action Payload
 * Resumes a paused orchestration run (after approval)
 */
export interface OrchestrateRunResumePayload {
  action: 'run_resume';
  /** Run ID to resume (REQUIRED) */
  runId: string;
  /** Approval ID (for checkpoint approvals) */
  approvalId?: string;
  /** Resume decision (optional) */
  decision?: 'approved' | 'rejected' | 'modified';
  /** Resume notes (optional) */
  notes?: string;
  /** Modifications to apply (optional) */
  modifications?: Record<string, any>;
}

/**
 * Orchestrate Run Cancel Action Payload
 * Cancels an orchestration run
 */
export interface OrchestrateRunCancelPayload {
  action: 'run_cancel';
  /** Run ID to cancel (REQUIRED) */
  runId: string;
  /** Cancellation reason (optional) */
  reason?: string;
}

/**
 * Orchestrate Run Evaluate Action Payload
 * Evaluates an orchestration run
 */
export interface OrchestrateRunEvaluatePayload {
  action: 'run_evaluate';
  /** Run ID to evaluate (REQUIRED) */
  runId: string;
  /** Evaluation criteria (optional) */
  criteria?: Record<string, any>;
}

/**
 * Orchestrate Run Human Response Action Payload
 * Provides human response during orchestration run
 */
export interface OrchestrateRunHumanResponsePayload {
  action: 'run_human_response';
  /** Approval ID (REQUIRED) */
  approvalId: string;
  /** Decision (REQUIRED) */
  decision: 'continue' | 'retry' | 'abort';
  /** Notes from the human (optional) */
  notes?: string;
  /** Modifications to apply (optional) */
  modifications?: Record<string, any>;
}

/**
 * Orchestrate Run Rollback Step Action Payload
 * Rolls back a step in an orchestration run
 */
export interface OrchestrateRunRollbackStepPayload {
  action: 'run_rollback_step';
  /** Run ID (REQUIRED) */
  runId: string;
  /** Step ID to rollback to (REQUIRED) */
  stepId: string;
  /** Rollback reason (optional) */
  reason?: string;
}

/**
 * Orchestrate Recipe Save Action Payload
 * Saves a recipe
 */
export interface OrchestrateRecipeSavePayload {
  action: 'recipe_save';
  /** Recipe name (REQUIRED) */
  recipeName: string;
  /** Recipe definition (REQUIRED) */
  definition: Record<string, any>;
  /** Recipe description (optional) */
  description?: string;
  /** Recipe metadata (optional) */
  metadata?: Record<string, any>;
}

/**
 * Orchestrate Recipe Update Action Payload
 * Updates an existing recipe
 */
export interface OrchestrateRecipeUpdatePayload {
  action: 'recipe_update';
  /** Recipe ID to update (REQUIRED) */
  recipeId: string;
  /** Updated definition (optional) */
  definition?: Record<string, any>;
  /** Updated description (optional) */
  description?: string;
  /** Updated metadata (optional) */
  metadata?: Record<string, any>;
}

/**
 * Orchestrate Recipe Validate Action Payload
 * Validates a recipe definition
 */
export interface OrchestrateRecipeValidatePayload {
  action: 'recipe_validate';
  /** Recipe definition to validate (REQUIRED) */
  definition: Record<string, any>;
}

/**
 * Orchestrate Recipe Delete Action Payload
 * Deletes a recipe
 */
export interface OrchestrateRecipeDeletePayload {
  action: 'recipe_delete';
  /** Recipe ID to delete (REQUIRED) */
  recipeId: string;
}

/**
 * Orchestrate Recipe Load Action Payload
 * Loads a recipe
 */
export interface OrchestrateRecipeLoadPayload {
  action: 'recipe_load';
  /** Recipe ID to load (REQUIRED) */
  recipeId: string;
}

/**
 * Orchestrate Recipe List Action Payload
 * Lists available recipes
 */
export interface OrchestrateRecipeListPayload {
  action: 'recipe_list';
  /** Filter criteria (optional) */
  filter?: {
    tags?: string[];
    category?: string;
    search?: string;
  };
  /** Pagination (optional) */
  pagination?: {
    limit?: number;
    offset?: number;
  };
}

/**
 * Union type of all orchestrate payloads
 */
export type OrchestrateModePayload =
  | OrchestrateCreatePayload
  | OrchestrateExecutePayload
  | OrchestrateContinuePayload
  | OrchestrateSaveRecipePayload
  | OrchestratePlanCreatePayload
  | OrchestratePlanUpdatePayload
  | OrchestratePlanReviewPayload
  | OrchestratePlanApprovePayload
  | OrchestratePlanRejectPayload
  | OrchestratePlanArchivePayload
  | OrchestrateRunStartPayload
  | OrchestrateRunContinuePayload
  | OrchestrateRunPausePayload
  | OrchestrateRunResumePayload
  | OrchestrateRunCancelPayload
  | OrchestrateRunEvaluatePayload
  | OrchestrateRunHumanResponsePayload
  | OrchestrateRunRollbackStepPayload
  | OrchestrateRecipeSavePayload
  | OrchestrateRecipeUpdatePayload
  | OrchestrateRecipeValidatePayload
  | OrchestrateRecipeDeletePayload
  | OrchestrateRecipeLoadPayload
  | OrchestrateRecipeListPayload;

/**
 * Orchestrate Request Metadata
 */
export interface OrchestrateRequestMetadata {
  /** Source of the request (e.g., 'web-ui', 'api', 'cli') */
  source: string;
  /** User ID making the request (REQUIRED) */
  userId: string;
  /** Conversation ID for context (optional) */
  conversationId?: string;
}

/**
 * Orchestrate Response Metadata
 */
export interface OrchestrateResponseMetadata {
  /** LLM provider used (REQUIRED - empty string for non-LLM actions) */
  provider: string;
  /** LLM model used (REQUIRED - empty string for non-LLM actions) */
  model: string;
  /** Token usage statistics (REQUIRED - use zeros for non-LLM actions) */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
  /** Orchestration run ID (optional) */
  orchestrationRunId?: string;
  /** Routing decision information (optional) */
  routingDecision?: Record<string, any>;
}

/**
 * Orchestrate Create Response Content
 */
export interface OrchestrateCreateResponseContent {
  orchestration: {
    id: string;
    definitionId?: string;
    definitionName?: string;
    version?: string;
    status: 'created' | 'planning' | 'ready';
    createdAt: string;
  };
  run?: {
    id: string;
    orchestrationId: string;
    status: 'pending' | 'running';
    createdAt: string;
  };
}

/**
 * Orchestrate Execute Response Content
 */
export interface OrchestrateExecuteResponseContent {
  run: {
    id: string;
    orchestrationId: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    currentStep?: string;
    progress?: {
      completed: number;
      total: number;
      percentage: number;
    };
    startedAt: string;
    completedAt?: string;
  };
  result?: Record<string, any>;
}

/**
 * Orchestrate Plan Create Response Content
 */
export interface OrchestratePlanCreateResponseContent {
  plan: {
    id: string;
    orchestrationId: string;
    content: string;
    format: 'markdown' | 'json';
    status: 'draft' | 'pending_approval' | 'approved';
    createdAt: string;
  };
  steps?: Array<{
    id: string;
    name: string;
    agent?: string;
    mode?: string;
    dependsOn?: string[];
  }>;
}

/**
 * Orchestrate Run Start Response Content
 */
export interface OrchestrateRunStartResponseContent {
  run: {
    id: string;
    orchestrationId: string;
    status: 'running' | 'pending';
    startedAt: string;
  };
  initialStep?: {
    id: string;
    name: string;
    status: 'running' | 'pending';
  };
}

/**
 * Orchestrate Recipe List Response Content
 */
export interface OrchestrateRecipeListResponseContent {
  recipes: Array<{
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    category?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Orchestrate Generic Success Response Content
 * Used for actions that don't return specific data
 */
export interface OrchestrateGenericResponseContent {
  success: boolean;
  message?: string;
  details?: Record<string, any>;
}
