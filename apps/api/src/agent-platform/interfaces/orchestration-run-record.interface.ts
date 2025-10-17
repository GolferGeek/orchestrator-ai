import type { JsonObject } from '@orchestrator-ai/transport-types';
import type {
  OrchestrationRunMetadata,
  OrchestrationRunParameters,
  OrchestrationRunPlan,
  OrchestrationRunResults,
  OrchestrationRunErrorDetails,
  OrchestrationStepState,
} from '../types/orchestration-run.types';

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
  parameters: OrchestrationRunParameters;
  organization_slug: string | null;
  user_id: string | null;
  status: string;
  current_step_index: number | null;
  current_step_id: string | null;
  completed_steps: string[];
  step_state: OrchestrationStepState;
  human_checkpoint_id: string | null;
  plan: OrchestrationRunPlan;
  results: OrchestrationRunResults;
  error_details: OrchestrationRunErrorDetails;
  metadata: OrchestrationRunMetadata;
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
  parameters?: OrchestrationRunParameters;
  organization_slug: string | null;
  user_id?: string | null;
  current_step_id?: string | null;
  step_state?: OrchestrationStepState;
  plan?: OrchestrationRunPlan;
  results?: OrchestrationRunResults;
  error_details?: OrchestrationRunErrorDetails;
  metadata?: OrchestrationRunMetadata;
  created_by?: string | null;
  started_at?: string | null;
}

export interface OrchestrationRunUpdateInput {
  status?: string;
  current_step_index?: number | null;
  current_step_id?: string | null;
  completed_steps?: string[];
  step_state?: OrchestrationStepState;
  human_checkpoint_id?: string | null;
  metadata?: OrchestrationRunMetadata;
  completed_at?: string | null;
  parameters?: OrchestrationRunParameters;
  plan?: OrchestrationRunPlan;
  results?: OrchestrationRunResults;
  error_details?: OrchestrationRunErrorDetails;
}
