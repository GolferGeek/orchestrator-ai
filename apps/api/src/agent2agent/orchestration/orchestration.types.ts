/**
 * Orchestration Types - Service Contracts & DTOs
 *
 * Following the conversation + tasks paradigm:
 * - All project operations flow through A2A tasks
 * - Projects enhance conversations with multi-step workflows
 * - Each service makes LLM calls rather than using logic trees
 */

// ============================================================================
// A2A METHOD TYPES - Project operations wrapped as A2A tasks
// ============================================================================

export type OrchestratorA2AMethod =
  | 'explicit_create_project' // UI-driven project creation (new architectural approach)
  | 'update_project_plan' // Collaborative planning iterations
  | 'approve_project_plan' // User approves/rejects plan
  | 'resume_project' // Continue paused project
  | 'retry_project_step' // Retry failed step
  | 'abort_project' // Terminate project
  | 'delegate_task' // Simple task delegation
  | 'converse'; // Direct conversation

// ============================================================================
// CORE DTOs - Following conversation + tasks patterns
// ============================================================================

/**
 * Primary input DTO - adapts A2A requests into orchestrator operations
 * Follows the same pattern as other agents but with project context
 */
export interface OrchestratorInput {
  prompt: string;
  userId: string;
  conversationId: string;
  sessionId?: string; // Session identifier
  delegationContext?: string; // From delegation.context.md files
  conversationHistory?: ConversationMessage[];
  projectId?: string; // For project-related operations
  stepId?: string; // For step-specific operations
  metadata?: Record<string, unknown>;
}

/**
 * Intent classification output - determines orchestrator action
 * Uses LLM calls to classify user intent, not logic trees
 */
export interface IntentDirective {
  action:
    | 'CREATE_PROJECT'
    | 'RESUME_PROJECT'
    | 'DELEGATE'
    | 'CONVERSE'
    | 'CONTINUE_DELEGATION'
    | 'CLARIFY'
    | 'BUILD_AGENT' // Create new permanent agent for capability gap
    | 'IMPROVE_AGENT' // Enhance existing agent performance
    | 'CREATE_SUBPROJECT'; // Create child project managed by different orchestrator
  agentName?: string; // For delegation actions
  projectId?: string; // For project actions
  reasoning: string; // LLM reasoning for transparency
  confidence: number; // Classification confidence (0-1)
  // For CLARIFY actions - present user with choices
  suggestedAgent?: string; // Recommended agent for delegation option
  projectOutline?: string; // Brief description of project approach
  // For enterprise workforce development
  capabilityGap?: {
    description: string; // What capability is missing
    department: string; // Which department needs this capability
    agentType: 'context_driven' | 'function_based'; // Type of agent to build
    priority: 'low' | 'medium' | 'high'; // Business priority
  };
  subprojectScope?: {
    department: string; // Which department should handle this
    orchestrator: string; // Which orchestrator to assign
    estimatedDuration: string; // Timeline estimate (days/weeks)
  };
}

/**
 * Standard orchestrator response - maintains A2A compliance
 * Same structure as other agents, just with orchestration metadata
 */
export interface OrchestratorResponse {
  success: boolean;
  message?: string;
  response?: string; // Main response content
  action?: string; // Action taken
  agentName?: string; // Target agent for delegation
  delegationTaskId?: string; // If delegated to another agent
  projectId?: string; // If project created/updated
  planId?: string; // If plan created/updated
  tasks?: unknown[]; // Task results
  conversationId?: string; // Conversation context
  userId?: string; // User context
  sessionId?: string; // Session context
  // For clarification responses
  requiresUserChoice?: boolean; // If true, user must make a choice
  options?: {
    // Available options for user
    delegate?: {
      agentName: string;
      description: string;
    };
    project?: {
      outline: string;
      description: string;
    };
  };
  metadata?: {
    agentType: 'orchestrator';
    agentName: string;
    processedAt: string;
    action?: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// PROJECT DOMAIN MODELS - Enhanced task workflows
// ============================================================================

/**
 * Project states - mirrors database enum
 */
export type ProjectStatus =
  | 'planning' // Interactive planning phase
  | 'pending_approval' // Plan created, awaiting user approval
  | 'running' // Steps executing
  | 'paused_for_approval' // Waiting for user input during execution
  | 'paused_on_error' // Error occurred, recovery needed
  | 'completed' // All steps finished successfully
  | 'aborted'; // Terminated by user

/**
 * Project step states
 */
export type ProjectStepStatus =
  | 'pending' // Not yet started
  | 'running' // Currently executing
  | 'completed' // Finished successfully
  | 'failed' // Failed execution
  | 'pending_approval' // Waiting for human approval
  | 'skipped'; // Skipped due to dependencies

/**
 * Project step types - aligned with LangGraph node types
 */
export type ProjectStepType =
  | 'agent_step' // Delegate to agent
  | 'human_approval'; // Wait for user input (interrupt)

/**
 * Plan definition - structured JSON for project execution
 * Used by LangGraph to build dynamic execution graphs
 */
export interface PlanDefinition {
  projectName: string;
  description: string;
  steps: PlanStep[];
  metadata?: Record<string, unknown>;
}

export interface PlanStep {
  stepId: string; // Unique within project
  stepName: string; // Human-readable name
  stepType: ProjectStepType;
  agentName?: string; // For agent_step type
  prompt: string; // Instruction for this step
  dependencies: string[]; // stepIds this depends on
  metadata?: Record<string, unknown>;
}

/**
 * Project entity - database model
 */
export interface Project {
  id: string;
  conversationId: string;
  name?: string;
  description?: string;
  planJson?: PlanDefinition;
  status: ProjectStatus;
  currentStepId?: string;
  errorDetails?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  // Hierarchical project support
  parentProjectId?: string;
  hierarchyLevel?: number;
  subprojectCount?: number;
}

/**
 * Project step entity - database model
 */
export interface ProjectStep {
  id: string;
  projectId: string;
  stepId: string;
  stepIndex: number;
  stepType: ProjectStepType;
  stepName: string;
  agentName?: string;
  prompt: string;
  dependencies: string[];
  status: ProjectStepStatus;
  result?: Record<string, unknown>;
  errorDetails?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CONVERSATION TYPES - Reusing existing patterns
// ============================================================================

/**
 * Conversation message - reuses existing conversation + tasks pattern
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SERVICE INTERFACES - Each service makes LLM calls
// ============================================================================

/**
 * Intent Recognition Service - LLM-based classification
 */
export interface IIntentRecognitionService {
  classifyIntent(
    input: OrchestratorInput,
    delegationContext?: string,
  ): Promise<IntentDirective>;
}

/**
 * Planning Service - Iterative, collaborative planning with LLM
 */
export interface IPlanningService {
  createPlan(input: OrchestratorInput): Promise<PlanDefinition>;
  refinePlan(
    planId: string,
    feedback: string,
    input: OrchestratorInput,
  ): Promise<PlanDefinition>;
  formatPlanForHuman(plan: PlanDefinition): Promise<string>;
}

/**
 * Plan Execution Service - LangGraph-based execution
 */
export interface IPlanExecutionService {
  startProject(project: Project): Promise<void>;
  resumeProject(projectId: string): Promise<void>;
  retryStep(projectId: string, stepId: string): Promise<void>;
  abortProject(projectId: string): Promise<void>;
}

/**
 * Delegation Service - Enhanced agent delegation
 */
export interface IDelegationService {
  delegateToAgent(
    agentName: string,
    prompt: string,
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse>;
  analyzeAgentContext(
    conversationHistory: ConversationMessage[],
    currentPrompt?: string,
  ): Promise<{
    currentAgent?: string;
    shouldContinue: boolean;
    confidence: number;
    reasoning: string;
  }>;
}

/**
 * Subproject Management Service - Hierarchical coordination
 */
export interface ISubprojectManagementService {
  analyzeForSubprojects(
    projectDescription: string,
    input: OrchestratorInput,
  ): Promise<{
    requiresDecomposition: boolean;
    suggestedSubprojects: unknown[];
    reasoning: string;
    complexity: 'low' | 'medium' | 'high';
  }>;
  createSubprojects(
    parentProjectId: string,
    parentPlan: PlanDefinition,
    subprojectScopes: unknown[],
    input: OrchestratorInput,
  ): Promise<unknown[]>;
  delegateSubproject(
    subproject: unknown,
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse>;
  aggregateSubprojectProgress(
    parentProjectId: string,
    subprojects: unknown[],
  ): Promise<{
    overallProgress: number;
    completedSubprojects: number;
    blockedSubprojects: unknown[];
    upcomingMilestones: unknown[];
    riskAssessment: {
      level: 'low' | 'medium' | 'high';
      risks: string[];
      mitigationActions: string[];
    };
  }>;
}

/**
 * LangGraph State Management Service - 3-tier state architecture
 */
export interface ILangGraphStateManagementService {
  initializeProjectState(
    projectDefinition: PlanDefinition,
    input: OrchestratorInput,
  ): Promise<unknown>; // LangGraphState
  updateStepState(
    projectId: string,
    stepId: string,
    update: unknown,
    trigger?: string,
  ): Promise<unknown>; // StepResultsState
  getState(projectId: string): Promise<unknown>; // LangGraphState
  executeWorkflowStep(
    projectId: string,
    stepId: string,
    input: OrchestratorInput,
  ): Promise<OrchestratorResponse>;
  handleWorkflowInterrupt(
    projectId: string,
    stepId: string,
    interruptType: 'approval_required' | 'user_input_needed' | 'error_recovery',
    context: Record<string, unknown>,
  ): Promise<void>;
  resumeWorkflow(
    projectId: string,
    stepId: string,
    resolution: 'approved' | 'rejected' | 'modified',
    resolutionData?: Record<string, unknown>,
  ): Promise<void>;
  rollbackState(
    projectId: string,
    targetVersion: number,
    reason: string,
  ): Promise<unknown>; // LangGraphState
  getWorkflowAnalytics(projectId: string): Promise<{
    overallProgress: number;
    stepProgress: unknown[];
    performance: {
      avgStepDuration: number;
      totalDuration: number;
      errorRate: number;
      throughput: number;
    };
    bottlenecks: unknown[];
    recommendations: string[];
  }>;
}

/**
 * Orchestrator Facade Service - Main coordinator
 * Routes through single A2A entry point
 */
export interface IOrchestratorFacadeService {
  processRequest(
    method: OrchestratorA2AMethod,
    input: OrchestratorInput,
    delegationContext?: string,
  ): Promise<OrchestratorResponse>;
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES - Project-specific events
// ============================================================================

export interface ProjectStatusMessage {
  type: 'project.status.changed';
  projectId: string;
  status: ProjectStatus;
  message?: string;
  timestamp: string;
}

export interface ProjectStepMessage {
  type:
    | 'project.step.started'
    | 'project.step.completed'
    | 'project.step.failed';
  projectId: string;
  stepId: string;
  stepName: string;
  status: ProjectStepStatus;
  result?: unknown;
  error?: string;
  timestamp: string;
}

export interface ProjectPlanMessage {
  type: 'project.plan.created' | 'project.plan.approved';
  projectId: string;
  plan?: PlanDefinition;
  timestamp: string;
}

export type ProjectWebSocketMessage =
  | ProjectStatusMessage
  | ProjectStepMessage
  | ProjectPlanMessage;

// ============================================================================
// ERROR TYPES - Transparent error handling
// ============================================================================

export class OrchestratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

export class ProjectExecutionError extends OrchestratorError {
  constructor(
    message: string,
    public projectId: string,
    public stepId?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'PROJECT_EXECUTION_ERROR', {
      projectId,
      stepId,
      ...context,
    });
    this.name = 'ProjectExecutionError';
  }
}

export class DelegationError extends OrchestratorError {
  constructor(
    message: string,
    public agentName: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'DELEGATION_ERROR', { agentName, ...context });
    this.name = 'DelegationError';
  }
}
