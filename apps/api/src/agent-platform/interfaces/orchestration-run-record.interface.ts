export interface OrchestrationRunRecord {
  id: string;
  plan_id: string | null;
  origin_type: 'plan' | 'saved_orchestration' | 'ad_hoc' | string;
  origin_id: string | null;
  orchestration_slug: string | null;
  prompt_inputs: Record<string, any>;
  organization_slug: string | null;
  status: string;
  current_step_index: number | null;
  completed_steps: string[];
  step_state: Record<string, any>;
  human_checkpoint_id: string | null;
  metadata: Record<string, any>;
  started_at: string;
  completed_at: string | null;
}

export interface OrchestrationRunStartInput {
  plan_id?: string | null;
  origin_type?: string;
  origin_id?: string | null;
  orchestration_slug?: string | null;
  prompt_inputs?: Record<string, any>;
  organization_slug: string | null;
  metadata?: Record<string, any>;
}

export interface OrchestrationRunUpdateInput {
  status?: string;
  current_step_index?: number | null;
  completed_steps?: string[];
  step_state?: Record<string, any>;
  human_checkpoint_id?: string | null;
  metadata?: Record<string, any>;
  completed_at?: string | null;
  prompt_inputs?: Record<string, any>;
}
