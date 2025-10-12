export interface OrchestrationStepRecord {
  id: string;
  orchestration_run_id: string;
  step_index: number;
  step_id: string | null;
  status: string;
  agent_slug: string | null;
  mode: string;
  conversation_id: string | null;
  plan_id: string | null;
  deliverable_id: string | null;
  depends_on: string[];
  attempt_number: number;
  checkpoint_decision: Record<string, any> | null;
  checkpoint_decided_by: string | null;
  checkpoint_decided_at: string | null;
  invalidated_at: string | null;
  invalidated_reason: string | null;
  input: Record<string, any>;
  output: Record<string, any> | null;
  metadata: Record<string, any>;
  error_details: Record<string, any> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrchestrationStepInsertInput {
  orchestration_run_id: string;
  step_index: number;
  step_id?: string | null;
  status?: string;
  agent_slug?: string | null;
  mode?: string;
  conversation_id?: string | null;
  plan_id?: string | null;
  deliverable_id?: string | null;
  depends_on?: string[];
  attempt_number?: number;
  checkpoint_decision?: Record<string, any> | null;
  checkpoint_decided_by?: string | null;
  checkpoint_decided_at?: string | null;
  invalidated_at?: string | null;
  invalidated_reason?: string | null;
  input?: Record<string, any>;
  output?: Record<string, any> | null;
  metadata?: Record<string, any>;
  error_details?: Record<string, any> | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface OrchestrationStepUpdateInput {
  status?: string;
  agent_slug?: string | null;
  mode?: string;
  conversation_id?: string | null;
  plan_id?: string | null;
  deliverable_id?: string | null;
  depends_on?: string[];
  attempt_number?: number;
  checkpoint_decision?: Record<string, any> | null;
  checkpoint_decided_by?: string | null;
  checkpoint_decided_at?: string | null;
  invalidated_at?: string | null;
  invalidated_reason?: string | null;
  input?: Record<string, any>;
  output?: Record<string, any> | null;
  metadata?: Record<string, any>;
  error_details?: Record<string, any> | null;
  started_at?: string | null;
  completed_at?: string | null;
}
