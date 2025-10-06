export type OrchestratorA2AMethod = 'create_project' | 'update_project_plan' | 'approve_project_plan' | 'resume_project' | 'retry_project_step' | 'abort_project' | 'delegate_task' | 'converse';
export interface OrchestratorInput {
    prompt: string;
    userId: string;
    conversationId: string;
    delegationContext?: string;
    conversationHistory: ConversationMessage[];
    projectId?: string;
    stepId?: string;
    metadata?: Record<string, any>;
}
export interface IntentDirective {
    action: 'CREATE_PROJECT' | 'RESUME_PROJECT' | 'DELEGATE' | 'CONVERSE' | 'CONTINUE_DELEGATION';
    agentName?: string;
    projectId?: string;
    reasoning: string;
    confidence: number;
}
export interface OrchestratorResponse {
    success: boolean;
    message?: string;
    delegationTaskId?: string;
    projectId?: string;
    metadata?: {
        agentType: 'orchestrator';
        agentName: string;
        processedAt: string;
        action?: string;
        [key: string]: any;
    };
}
export type ProjectStatus = 'planning' | 'running' | 'paused_for_human' | 'paused_on_error' | 'completed' | 'aborted';
export type ProjectStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type ProjectStepType = 'agent_step' | 'human_approval';
export interface PlanDefinition {
    projectName: string;
    description: string;
    steps: PlanStep[];
    metadata?: Record<string, any>;
}
export interface PlanStep {
    stepId: string;
    stepName: string;
    stepType: ProjectStepType;
    agentName?: string;
    prompt: string;
    dependencies: string[];
    metadata?: Record<string, any>;
}
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
export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    taskId?: string;
    metadata?: Record<string, any>;
}
export interface IIntentRecognitionService {
    classifyIntent(input: OrchestratorInput): Promise<IntentDirective>;
}
export interface IPlanningService {
    createPlan(input: OrchestratorInput): Promise<PlanDefinition>;
    refinePlan(planId: string, feedback: string, input: OrchestratorInput): Promise<PlanDefinition>;
    formatPlanForHuman(plan: PlanDefinition): Promise<string>;
}
export interface IPlanExecutionService {
    startProject(project: Project): Promise<void>;
    resumeProject(projectId: string): Promise<void>;
    retryStep(projectId: string, stepId: string): Promise<void>;
    abortProject(projectId: string): Promise<void>;
}
export interface IDelegationService {
    delegateToAgent(agentName: string, prompt: string, input: OrchestratorInput): Promise<OrchestratorResponse>;
    analyzeAgentContext(conversationHistory: ConversationMessage[]): Promise<{
        currentAgent?: string;
        shouldContinue: boolean;
        confidence: number;
        reasoning: string;
    }>;
}
export interface IOrchestratorFacadeService {
    processRequest(method: OrchestratorA2AMethod, input: OrchestratorInput): Promise<OrchestratorResponse>;
}
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
export type ProjectWebSocketMessage = ProjectStatusMessage | ProjectStepMessage | ProjectPlanMessage;
export declare class OrchestratorError extends Error {
    code: string;
    context?: Record<string, any> | undefined;
    constructor(message: string, code: string, context?: Record<string, any> | undefined);
}
export declare class ProjectExecutionError extends OrchestratorError {
    projectId: string;
    stepId?: string | undefined;
    constructor(message: string, projectId: string, stepId?: string | undefined, context?: Record<string, any>);
}
export declare class DelegationError extends OrchestratorError {
    agentName: string;
    constructor(message: string, agentName: string, context?: Record<string, any>);
}
