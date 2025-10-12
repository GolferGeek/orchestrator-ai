import {
  OrchestrationAgentInfo,
  OrchestrationRunSnapshot,
  OrchestrationRunStats,
  OrchestrationStepSnapshot,
} from './orchestration-events.types';

export interface OrchestrationRunSummary {
  id: string;
  status: string;
  name: string | null;
  definitionId: string | null;
  planId: string | null;
  parentRunId: string | null;
  organizationSlug: string | null;
  orchestrationSlug: string | null;
  originType: string | null;
  originId: string | null;
  agent: OrchestrationAgentInfo;
  stats: OrchestrationRunStats;
  timings: OrchestrationRunSnapshot['timings'];
  currentStepId: string | null;
  currentStepIndex: number | null;
  pendingApprovals: number;
  latestCheckpoint?: {
    approvalId: string | null;
    checkpointId?: string | null;
    requestedAt?: string | null;
    stepLabel?: string | null;
  } | null;
}

export interface OrchestrationDashboardListResult {
  items: OrchestrationRunSummary[];
  total: number | null;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface OrchestrationApprovalView {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  mode: string;
  runId: string | null;
  stepId: string | null;
  organizationSlug: string | null;
  agentSlug: string;
  conversationId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  decisionAt: string | null;
  decisionBy: string | null;
  metadata: Record<string, any> | null;
}

export interface OrchestrationApprovalListItem {
  approval: OrchestrationApprovalView;
  run: OrchestrationRunSummary | null;
}

export interface OrchestrationApprovalListResult {
  items: OrchestrationApprovalListItem[];
  total: number | null;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface OrchestrationRunDetail {
  run: OrchestrationRunSnapshot;
  steps: OrchestrationStepSnapshot[];
  currentStep: OrchestrationStepSnapshot | null;
  summary: {
    totalSteps: number;
    completedSteps: number;
    progressPercentage: number | null;
    pendingApprovals: number;
  };
  pendingApprovals: Array<{
    id: string;
    status: string;
    mode: string;
    stepId: string | null;
    createdAt: string | null;
    metadata: Record<string, any> | null;
    conversationId: string | null;
    organizationSlug: string | null;
  }>;
  approvals: {
    items: OrchestrationApprovalView[];
    total: number | null;
  };
  relatedRuns: {
    parent: OrchestrationRunSummary | null;
    children: OrchestrationRunSummary[];
  };
  metadata: {
    latestCheckpoint?: OrchestrationRunSummary['latestCheckpoint'];
  };
}

export interface OrchestrationReplayContext {
  runId: string;
  organizationSlug: string | null;
  conversationId: string | null;
  definition: {
    id: string | null;
    name: string | null;
    displayName: string | null;
    version: string | null;
    ownerAgentSlug: string | null;
  };
  agent: {
    id: string | null;
    slug: string | null;
    displayName: string | null;
    type: string | null;
  };
  parameters: Record<string, any>;
  plan: Record<string, any>;
  results: Record<string, any>;
  metadata: Record<string, any>;
  origin: {
    type: string | null;
    id: string | null;
    slug: string | null;
  };
  timestamps: {
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
}
