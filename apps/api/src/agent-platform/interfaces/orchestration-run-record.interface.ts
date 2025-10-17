export interface OrchestrationRunRecord {
  id: string;
  plan_id: string | null;
  orchestration_definition_id: string | null;
  orchestration_name: string | null;
  conversation_id: string | null;
  parent_orchestration_run_id: string | null;
  origin_type: string;
  origin_id: string | null;
  orchestration_slug: string | null;
  parameters: Record<string, any>;
  organization_slug: string | null;
  user_id: string | null;
  status: string;
  current_step_index: number | null;
  current_step_id: string | null;
  completed_steps: string[];
  step_state: Record<string, any>;
  human_checkpoint_id: string | null;
  plan: Record<string, any>;
  results: Record<string, any>;
  error_details: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
}

export interface OrchestrationRunStartInput {
  plan_id?: string | null;
  orchestration_definition_id?: string | null;
  orchestration_name?: string | null;
  conversation_id?: string | null;
  parent_orchestration_run_id?: string | null;
  origin_type?: string;
  origin_id?: string | null;
  orchestration_slug?: string | null;
  parameters?: Record<string, any>;
  organization_slug: string | null;
  user_id?: string | null;
  current_step_id?: string | null;
  plan?: Record<string, any>;
  results?: Record<string, any>;
  error_details?: Record<string, any>;
  metadata?: Record<string, any>;
  created_by?: string | null;
  started_at?: string | null;
}

export interface OrchestrationRunUpdateInput {
  status?: string;
  current_step_index?: number | null;
  current_step_id?: string | null;
  completed_steps?: string[];
  step_state?: Record<string, any>;
  human_checkpoint_id?: string | null;
  metadata?: Record<string, any>;
  completed_at?: string | null;
  parameters?: Record<string, any>;
  plan?: Record<string, any>;
  results?: Record<string, any>;
  error_details?: Record<string, any>;
}
