export interface WorkflowState {
  launchPlanId: string;
  currentPhase: string;
  phaseIndex: number;
  totalPhases: number;
  completedPhases: string[];
  failedPhases: string[];
  overallProgress: number; // 0-100
  status: WorkflowStatus;
  startTime: Date;
  endTime?: Date;
  estimatedCompletion?: Date;
  checkpoints: WorkflowCheckpoint[];
  errors: WorkflowError[];
  humanInputs: PendingHumanInput[];
  agentStates: AgentState[];
  metadata: WorkflowMetadata;
}

export enum WorkflowStatus {
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  WAITING_FOR_HUMAN = 'waiting_for_human',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface WorkflowCheckpoint {
  id: string;
  timestamp: Date;
  phase: string;
  progress: number;
  state: any;
  message: string;
  canResumeFrom: boolean;
}

export interface WorkflowError {
  id: string;
  timestamp: Date;
  phase: string;
  agentName?: string;
  error: string;
  stack?: string;
  severity: 'warning' | 'error' | 'critical';
  resolved: boolean;
  resolution?: string;
  resolvedAt?: Date;
}

export interface PendingHumanInput {
  id: string;
  phaseId: string;
  type: 'confirmation' | 'choice' | 'input' | 'approval';
  prompt: string;
  options?: string[];
  timeout: number;
  createdAt: Date;
  expiresAt: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  stakeholder?: string;
  metadata?: any;
}

export interface AgentState {
  agentType: string;
  agentName: string;
  phase: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  progress: number;
  currentTask?: string;
  output?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
  metadata?: any;
}

export interface WorkflowMetadata {
  userId: string;
  sessionId: string;
  workflowVersion: string;
  configurationSnapshot: any;
  totalAgentsInvolved: number;
  totalHumanInputsRequired: number;
  totalDeliverables: number;
  estimatedDuration: number;
  actualDuration?: number;
  resourceUtilization?: ResourceUtilization;
  performanceMetrics?: PerformanceMetrics;
}

export interface ResourceUtilization {
  agentHours: number;
  humanHours: number;
  computeTime: number;
  storageUsed: number;
  networkRequests: number;
  cost: number;
}

export interface PerformanceMetrics {
  averageAgentResponseTime: number;
  averageHumanResponseTime: number;
  parallelismEfficiency: number;
  errorRate: number;
  humanInputAccuracy: number;
  deliverableQuality: number;
}

// Workflow phase definitions
export interface PhaseDefinition {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number;
  dependencies: string[];
  agents: RequiredAgent[];
  humanInputs: RequiredHumanInput[];
  deliverables: RequiredDeliverable[];
  parallelizable: boolean;
  criticalPath: boolean;
  skipConditions?: SkipCondition[];
}

export interface RequiredAgent {
  type: string;
  name: string;
  role: string;
  required: boolean;
  timeout: number;
  retryPolicy: RetryPolicy;
  inputMapping: InputMapping;
  outputMapping: OutputMapping;
}

export interface RequiredHumanInput {
  id: string;
  type: 'confirmation' | 'choice' | 'input' | 'approval';
  prompt: string;
  options?: string[];
  required: boolean;
  timeout: number;
  stakeholder?: string;
  fallbackAction?: string;
  validationRules?: ValidationRule[];
}

export interface RequiredDeliverable {
  id: string;
  name: string;
  type: string;
  format: string;
  required: boolean;
  generatedBy: string;
  template?: string;
  validationRules?: ValidationRule[];
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential';
  baseDelay: number;
  maxDelay: number;
  retryOnErrors: string[];
}

export interface InputMapping {
  [key: string]: string | MappingFunction;
}

export interface OutputMapping {
  [key: string]: string | MappingFunction;
}

export interface MappingFunction {
  type: 'transform' | 'filter' | 'aggregate';
  function: string;
  parameters?: any;
}

export interface SkipCondition {
  condition: string;
  reason: string;
  affectedDeliverables: string[];
}

export interface ValidationRule {
  type: 'required' | 'format' | 'range' | 'custom';
  parameters?: any;
  errorMessage: string;
}

// Workflow execution context
export interface ExecutionContext {
  workflowState: WorkflowState;
  phaseDefinitions: PhaseDefinition[];
  currentPhase: PhaseDefinition;
  availableAgents: string[];
  userPreferences: UserPreferences;
  systemConfiguration: SystemConfiguration;
  temporaryData: { [key: string]: any };
}

export interface UserPreferences {
  notifications: boolean;
  approvalTimeout: number;
  autoApprove: string[];
  requireConfirmation: string[];
  delegateApprovals: { [key: string]: string };
}

export interface SystemConfiguration {
  maxParallelAgents: number;
  defaultTimeout: number;
  maxRetries: number;
  checkpointInterval: number;
  enableAutoRecovery: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
