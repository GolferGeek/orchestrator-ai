export type OrchestrationCheckpointDecision = 'continue' | 'retry' | 'abort';

type JsonMap = Record<string, unknown>;
export interface OrchestrationCheckpointOptionState {
  action: OrchestrationCheckpointDecision;
  label: string;
  allowsModification?: boolean;
  description?: string;
  [key: string]: unknown;
}

export interface OrchestrationCheckpointMetadata {
  approvalId?: string | null;
  checkpointId?: string | null;
  question?: string | null;
  options?: OrchestrationCheckpointOptionState[];
  status?: string;
  stepDefinitionId?: string | null;
  stepRecordId?: string | null;
  requestedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string | null;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decision?: OrchestrationCheckpointDecision;
  notes?: string | null;
  modifications?: JsonMap | null;
  metadata?: JsonMap;
  [key: string]: unknown;
}

export interface OrchestrationLastCheckpointMetadata {
  approvalId?: string;
  checkpointId?: string;
  step?: {
    recordId?: string | null;
    definitionId?: string | null;
    label?: string | null;
    index?: number | null;
  };
  requestedAt?: string;
  decidedAt?: string;
  decidedBy?: string | null;
  decision?: OrchestrationCheckpointDecision;
  notes?: string | null;
  [key: string]: unknown;
}

export interface OrchestrationApprovalDecisionMetadata {
  action: OrchestrationCheckpointDecision;
  decidedAt: string;
  decidedBy: string | null;
  notes?: string | null;
  modifications?: JsonMap | null;
  [key: string]: unknown;
}

export interface OrchestrationApprovalMetadata {
  runId: string;
  checkpointId: string;
  step?: {
    recordId?: string | null;
    definitionId?: string | null;
    label?: string | null;
    index?: number | null;
  };
  question?: string;
  options?: OrchestrationCheckpointOptionState[];
  requestedAt?: string;
  status?: string;
  decision?: OrchestrationApprovalDecisionMetadata;
  metadata?: JsonMap;
  [key: string]: unknown;
}

export interface OrchestrationManualRecoveryMetadata {
  lastAction?: 'retry' | 'skip' | 'rollback' | string;
  requestedAt?: string;
  requestedBy?: string | null;
  stepId?: string | null;
  delaySeconds?: number;
  note?: string | null;
  [key: string]: unknown;
}

export interface OrchestrationAgentMetadata {
  id?: string | null;
  slug?: string;
  type?: string | null;
  displayName?: string | null;
  organizationSlug?: string | null;
  [key: string]: unknown;
}

export interface OrchestrationRunMetricsMetadata {
  totalSteps?: number;
  completedSteps?: number;
  progressPercentage?: number;
  [key: string]: unknown;
}

export interface OrchestrationTaskMetadata {
  id?: string | null;
  taskId?: string | null;
  userId?: string | null;
  ownerId?: string | null;
  [key: string]: unknown;
}

export interface OrchestrationRunMetadata {
  agent?: OrchestrationAgentMetadata;
  lastCheckpoint?: OrchestrationLastCheckpointMetadata;
  manualRecovery?: OrchestrationManualRecoveryMetadata;
  stats?: OrchestrationRunMetricsMetadata;
  task?: OrchestrationTaskMetadata;
  requestMetadata?: OrchestrationTaskMetadata;
  [key: string]: unknown;
}

export interface OrchestrationStepRuntimeRetryState {
  attempt?: number;
  history?: unknown[];
  nextRetryAt?: string | null;
  maxAttempts?: number | null;
  manual?: boolean;
  requestedAt?: string;
  requestedBy?: string | null;
  lastError?: JsonMap;
  [key: string]: unknown;
}

export interface OrchestrationStepRuntimeState {
  retry?: OrchestrationStepRuntimeRetryState;
  [key: string]: unknown;
}

export interface OrchestrationStepBehaviorConfig {
  retry?: {
    maxAttempts?: number | null;
    allowSkip?: boolean;
    delaySeconds?: number | null;
    exponentialBackoff?: boolean;
  };
  rollback?: JsonMap;
  [key: string]: unknown;
}

export interface OrchestrationStepStateEntry {
  status?: string;
  attemptNumber?: number;
  checkpoint?: OrchestrationCheckpointMetadata;
  metadata?: JsonMap;
  runtime?: OrchestrationStepRuntimeState;
  behavior?: OrchestrationStepBehaviorConfig;
  outputSummary?: string[];
  [key: string]: unknown;
}

export type OrchestrationStepState = Record<string, OrchestrationStepStateEntry>;

export type OrchestrationRunParameters = JsonMap;
export type OrchestrationRunPlan = JsonMap;
export type OrchestrationRunResults = JsonMap;
export type OrchestrationRunErrorDetails = JsonMap;
