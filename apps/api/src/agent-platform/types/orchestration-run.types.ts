import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from '@orchestrator-ai/transport-types';

export type OrchestrationCheckpointDecision = 'continue' | 'retry' | 'abort';

export interface OrchestrationCheckpointOptionState {
  action: OrchestrationCheckpointDecision;
  label: string;
  allowsModification?: boolean;
  description?: string;
}

export interface OrchestrationCheckpointMetadata extends JsonObject {
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
  modifications?: JsonObject | null;
  metadata?: JsonObject;
}

export interface OrchestrationLastCheckpointMetadata extends JsonObject {
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
}

export interface OrchestrationApprovalDecisionMetadata extends JsonObject {
  action: OrchestrationCheckpointDecision;
  decidedAt: string;
  decidedBy: string | null;
  notes?: string | null;
  modifications?: JsonObject | null;
}

export interface OrchestrationApprovalMetadata extends JsonObject {
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
  metadata?: JsonObject;
}

export interface OrchestrationManualRecoveryMetadata extends JsonObject {
  lastAction?: 'retry' | 'skip' | 'rollback' | string;
  requestedAt?: string;
  requestedBy?: string | null;
  stepId?: string | null;
  delaySeconds?: number;
  note?: string | null;
}

export interface OrchestrationAgentMetadata extends JsonObject {
  id?: string | null;
  slug?: string;
  type?: string | null;
  displayName?: string | null;
}

export interface OrchestrationRunMetricsMetadata extends JsonObject {
  totalSteps?: number;
  completedSteps?: number;
  progressPercentage?: number;
  [key: string]: JsonValue;
}

export interface OrchestrationRunMetadata extends JsonObject {
  agent?: OrchestrationAgentMetadata;
  lastCheckpoint?: OrchestrationLastCheckpointMetadata;
  manualRecovery?: OrchestrationManualRecoveryMetadata;
  stats?: OrchestrationRunMetricsMetadata;
  [key: string]: JsonValue;
}

export interface OrchestrationStepRuntimeRetryState extends JsonObject {
  attempt?: number;
  history?: JsonArray;
  nextRetryAt?: string | null;
  maxAttempts?: number | null;
  manual?: boolean;
  requestedAt?: string;
  requestedBy?: string | null;
  lastError?: JsonObject;
}

export interface OrchestrationStepRuntimeState extends JsonObject {
  retry?: OrchestrationStepRuntimeRetryState;
  [key: string]: JsonValue;
}

export interface OrchestrationStepBehaviorConfig extends JsonObject {
  retry?: {
    maxAttempts?: number | null;
    allowSkip?: boolean;
    delaySeconds?: number | null;
    exponentialBackoff?: boolean;
  };
  rollback?: JsonObject;
  [key: string]: JsonValue;
}

export interface OrchestrationStepStateEntry extends JsonObject {
  status?: string;
  attemptNumber?: number;
  checkpoint?: OrchestrationCheckpointMetadata;
  metadata?: JsonObject;
  runtime?: OrchestrationStepRuntimeState;
  behavior?: OrchestrationStepBehaviorConfig;
  outputSummary?: string[];
}

export type OrchestrationStepState = Record<string, OrchestrationStepStateEntry>;

export type OrchestrationRunParameters = JsonObject;
export type OrchestrationRunPlan = JsonObject;
export type OrchestrationRunResults = JsonObject;
export type OrchestrationRunErrorDetails = JsonObject;
