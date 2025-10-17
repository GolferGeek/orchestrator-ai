import type { JsonObject } from '@orchestrator-ai/transport-types';
import type {
  OrchestrationRunErrorDetails,
  OrchestrationRunMetadata,
  OrchestrationRunParameters,
  OrchestrationRunPlan,
  OrchestrationRunResults,
  OrchestrationStepStateEntry,
} from './orchestration-run.types';

export type OrchestrationEventType =
  | 'orchestration.run.created'
  | 'orchestration.run.updated'
  | 'orchestration.run.completed'
  | 'orchestration.run.failed'
  | 'orchestration.step.queued'
  | 'orchestration.step.running'
  | 'orchestration.step.completed'
  | 'orchestration.step.failed';

export interface OrchestrationTaskLink {
  id: string | null;
  userId: string | null;
}

export interface OrchestrationAgentInfo {
  id: string | null;
  slug: string;
  type: string | null;
  displayName: string | null;
}

export interface OrchestrationRunStats {
  totalSteps?: number;
  completedSteps: number;
  progressPercentage?: number;
}

export interface OrchestrationRunSnapshot {
  id: string;
  status: string;
  definitionId: string | null;
  name: string | null;
  planId: string | null;
  conversationId: string | null;
  parentRunId: string | null;
  organizationSlug: string | null;
  currentStepId: string | null;
  currentStepIndex: number | null;
  completedSteps: string[];
  humanCheckpointId: string | null;
  plan: OrchestrationRunPlan;
  results: OrchestrationRunResults;
  parameters: OrchestrationRunParameters;
  errorDetails: OrchestrationRunErrorDetails;
  metadata: OrchestrationRunMetadata;
  stats: OrchestrationRunStats;
  timings: {
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  agent: OrchestrationAgentInfo;
  task?: OrchestrationTaskLink;
}

export interface OrchestrationStepSnapshot {
  id: string | null;
  runId: string;
  index: number;
  status: string;
  agentSlug: string | null;
  mode: string;
  attemptNumber: number;
  dependsOn: string[];
  conversationId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  metadata: OrchestrationStepStateEntry;
  outputSummary: string[];
  errorDetails: JsonObject | null;
}

export interface OrchestrationRunEventPayload {
  type: OrchestrationEventType;
  timestamp: string;
  run: OrchestrationRunSnapshot;
  data?: JsonObject;
}
