export interface ProjectRunRecord {
  id: string;
  plan_id: string;
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

export interface ProjectRunStartInput {
  plan_id: string;
  organization_slug: string | null;
  metadata?: Record<string, any>;
}

export interface ProjectRunUpdateInput {
  status?: string;
  current_step_index?: number | null;
  completed_steps?: string[];
  step_state?: Record<string, any>;
  human_checkpoint_id?: string | null;
  metadata?: Record<string, any>;
  completed_at?: string | null;
}
