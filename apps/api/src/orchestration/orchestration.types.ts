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
  | 'create_project'           // Start new project planning
  | 'update_project_plan'      // Collaborative planning iterations  
  | 'approve_project_plan'     // User approves/rejects plan
  | 'resume_project'           // Continue paused project
  | 'retry_project_step'       // Retry failed step
  | 'abort_project'            // Terminate project
  | 'delegate_task'            // Simple task delegation
  | 'converse';                // Direct conversation

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
  sessionId?: string;            // Session identifier
  delegationContext?: string;    // From delegation.context.md files
  conversationHistory?: ConversationMessage[];
  projectId?: string;            // For project-related operations
  stepId?: string;               // For step-specific operations
  metadata?: Record<string, any>;
}

/**
 * Intent classification output - determines orchestrator action
 * Uses LLM calls to classify user intent, not logic trees
 */
export interface IntentDirective {
  action: 'CREATE_PROJECT' | 'RESUME_PROJECT' | 'DELEGATE' | 'CONVERSE' | 'CONTINUE_DELEGATION';
  agentName?: string;            // For delegation actions
  projectId?: string;            // For project actions
  reasoning: string;             // LLM reasoning for transparency
  confidence: number;            // Classification confidence (0-1)
}

/**
 * Standard orchestrator response - maintains A2A compliance
 * Same structure as other agents, just with orchestration metadata
 */
export interface OrchestratorResponse {
  success: boolean;
  message?: string;
  response?: string;             // Main response content
  action?: string;               // Action taken
  agentName?: string;            // Target agent for delegation
  delegationTaskId?: string;     // If delegated to another agent
  projectId?: string;            // If project created/updated
  planId?: string;               // If plan created/updated
  tasks?: any[];                 // Task results
  conversationId?: string;       // Conversation context
  userId?: string;               // User context
  sessionId?: string;            // Session context
  metadata?: {
    agentType: 'orchestrator';
    agentName: string;
    processedAt: string;
    action?: string;
    [key: string]: any;
  };
}

// ============================================================================
// PROJECT DOMAIN MODELS - Enhanced task workflows
// ============================================================================

/**
 * Project states - mirrors database enum
 */
export type ProjectStatus = 
  | 'planning'           // Interactive planning phase
  | 'pending_approval'   // Plan created, awaiting user approval
  | 'running'            // Steps executing
  | 'paused_for_approval'// Waiting for user input during execution
  | 'paused_on_error'    // Error occurred, recovery needed
  | 'completed'          // All steps finished successfully
  | 'aborted';           // Terminated by user

/**
 * Project step states
 */
export type ProjectStepStatus =
  | 'pending'            // Not yet started
  | 'running'            // Currently executing
  | 'completed'          // Finished successfully
  | 'failed'             // Failed execution
  | 'pending_approval'   // Waiting for human approval
  | 'skipped';           // Skipped due to dependencies

/**
 * Project step types - aligned with LangGraph node types
 */
export type ProjectStepType = 
  | 'agent_step'         // Delegate to agent
  | 'human_approval';    // Wait for user input (interrupt)

/**
 * Plan definition - structured JSON for project execution
 * Used by LangGraph to build dynamic execution graphs
 */
export interface PlanDefinition {
  projectName: string;
  description: string;
  steps: PlanStep[];
  metadata?: Record<string, any>;
}

export interface PlanStep {
  stepId: string;                // Unique within project
  stepName: string;              // Human-readable name
  stepType: ProjectStepType;
  agentName?: string;            // For agent_step type
  prompt: string;                // Instruction for this step
  dependencies: string[];        // stepIds this depends on
  metadata?: Record<string, any>;
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
  errorDetails?: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
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
  result?: Record<string, any>;
  errorDetails?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
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
  metadata?: Record<string, any>;
}

// ============================================================================
// SERVICE INTERFACES - Each service makes LLM calls
// ============================================================================

/**
 * Intent Recognition Service - LLM-based classification
 */
export interface IIntentRecognitionService {
  classifyIntent(input: OrchestratorInput): Promise<IntentDirective>;
}

/**
 * Planning Service - Iterative, collaborative planning with LLM
 */
export interface IPlanningService {
  createPlan(input: OrchestratorInput): Promise<PlanDefinition>;
  refinePlan(planId: string, feedback: string, input: OrchestratorInput): Promise<PlanDefinition>;
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
  delegateToAgent(agentName: string, prompt: string, input: OrchestratorInput): Promise<OrchestratorResponse>;
  analyzeAgentContext(conversationHistory: ConversationMessage[]): Promise<{
    currentAgent?: string;
    shouldContinue: boolean;
    confidence: number;
    reasoning: string;
  }>;
}

/**
 * Orchestrator Facade Service - Main coordinator
 * Routes through single A2A entry point
 */
export interface IOrchestratorFacadeService {
  processRequest(method: OrchestratorA2AMethod, input: OrchestratorInput): Promise<OrchestratorResponse>;
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
  type: 'project.step.started' | 'project.step.completed' | 'project.step.failed';
  projectId: string;
  stepId: string;
  stepName: string;
  status: ProjectStepStatus;
  result?: any;
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
    public context?: Record<string, any>
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
    context?: Record<string, any>
  ) {
    super(message, 'PROJECT_EXECUTION_ERROR', { projectId, stepId, ...context });
    this.name = 'ProjectExecutionError';
  }
}

export class DelegationError extends OrchestratorError {
  constructor(
    message: string,
    public agentName: string,
    context?: Record<string, any>
  ) {
    super(message, 'DELEGATION_ERROR', { agentName, ...context });
    this.name = 'DelegationError';
  }
}