// LLM Evaluation Types
// TypeScript type definitions for LLM provider/model selection and evaluation features

// ==================== Core Enums and Types ====================

export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'cohere'
  | 'mistral'
  | 'ollama'
  | 'xai'
  | 'together'
  | 'groq';

export type ProviderStatus = 'active' | 'inactive' | 'deprecated';
export type ModelStatus = 'active' | 'inactive' | 'deprecated';
export type AuthType = 'api_key' | 'oauth' | 'none';

export type CIDAFMCommandType = '^' | '&' | '!';
export type CIDAFMTypeName =
  | 'Response Modifier'
  | 'State Modifier'
  | 'Execution Command';

export type UserRatingScale = 1 | 2 | 3 | 4 | 5;

// ==================== Database Entity Interfaces ====================

export interface Provider {
  id: string;
  name: string;
  api_base_url?: string;
  auth_type: AuthType;
  status: ProviderStatus;
  created_at: string;
  updated_at: string;
}

export interface Model {
  id: string;
  provider_id: string;
  name: string;
  model_id: string;
  pricing_input_per_1k?: number;
  pricing_output_per_1k?: number;
  supports_thinking: boolean;
  max_tokens?: number;
  context_window?: number;
  strengths?: string[];
  weaknesses?: string[];
  use_cases?: string[];
  status: ModelStatus;
  created_at: string;
  updated_at: string;
  // Joined data when fetching with provider
  provider?: Provider;
}

export interface CIDAFMCommand {
  id: string;
  type: CIDAFMCommandType;
  name: string;
  description?: string;
  default_active: boolean;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCIDAFMCommand {
  id: string;
  user_id: string;
  type: CIDAFMCommandType;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface UserUsageStats {
  id: string;
  user_id: string;
  date: string; // Date string in YYYY-MM-DD format
  provider_id?: string;
  model_id?: string;
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  avg_response_time_ms?: number;
  avg_user_rating?: number;
  created_at: string;
  updated_at: string;
  // Joined data when fetching with relations
  provider?: Provider;
  model?: Model;
}

// ==================== Enhanced Message Types ====================

export interface MessageEvaluation {
  user_rating?: UserRatingScale;
  speed_rating?: UserRatingScale;
  accuracy_rating?: UserRatingScale;
  user_notes?: string;
  evaluation_timestamp?: string;
}

export interface CIDAFMOptions {
  active_state_modifiers?: string[];
  response_modifiers?: string[];
  executed_commands?: string[];
  custom_options?: Record<string, any>;
}

export interface EvaluationDetails {
  additional_metrics?: Record<string, number>;
  tags?: string[];
  feedback?: string;
  user_context?: string;
  model_confidence?: number;
}

export interface LLMUsageMetrics {
  input_tokens?: number;
  output_tokens?: number;
  total_cost?: number;
  response_time_ms?: number;
  langsmith_run_id?: string;
}

export interface EnhancedMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  timestamp: string;
  order: number;
  metadata?: Record<string, any>;

  // LLM Selection
  provider_id?: string;
  model_id?: string;

  // Usage Metrics
  input_tokens?: number;
  output_tokens?: number;
  total_cost?: number;
  response_time_ms?: number;
  langsmith_run_id?: string;

  // Evaluation Data
  user_rating?: UserRatingScale;
  speed_rating?: UserRatingScale;
  accuracy_rating?: UserRatingScale;
  user_notes?: string;
  evaluation_timestamp?: string;

  // CIDAFM and Additional Data
  cidafm_options?: CIDAFMOptions;
  evaluation_details?: EvaluationDetails;

  // Joined data when fetching with relations
  provider?: Provider;
  model?: Model;
}

// ==================== Cost Calculation Types ====================

export interface CostCalculation {
  input_tokens: number;
  output_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  estimated_cost?: number;
  currency: string;
}

export interface PricingInfo {
  input_per_1k: number;
  output_per_1k: number;
  currency: string;
  last_updated: string;
}

export interface CostEstimate {
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_cost: number;
  max_cost_warning?: string;
  currency: string;
}

// ==================== CIDAFM Processing Types ====================

export interface CIDAFMState {
  active_commands: CIDAFMCommand[];
  user_commands: UserCIDAFMCommand[];
  session_state: Record<string, any>;
}

export interface CIDAFMProcessingResult {
  modified_prompt: string;
  new_state: CIDAFMState;
  executed_commands: string[];
  processing_notes?: string[];
}

export interface CIDAFMCommandExecution {
  command: string;
  type: CIDAFMCommandType;
  result: 'success' | 'error' | 'warning';
  message?: string;
  data?: Record<string, any>;
}

// ==================== Analytics and Reporting Types ====================

export interface UsageAnalytics {
  user_id: string;
  date_range: {
    start_date: string;
    end_date: string;
  };
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  average_response_time: number;
  average_user_rating?: number;

  // Breakdown by provider/model
  by_provider: Array<{
    provider: Provider;
    requests: number;
    tokens: number;
    cost: number;
    avg_rating?: number;
  }>;

  by_model: Array<{
    model: Model;
    requests: number;
    tokens: number;
    cost: number;
    avg_rating?: number;
  }>;

  // Daily breakdown
  daily_stats: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
    avg_response_time?: number;
  }>;
}

export interface ModelPerformanceMetrics {
  model: Model;
  total_uses: number;
  average_rating: number;
  average_response_time: number;
  average_cost_per_message: number;
  user_feedback_count: number;
  strengths_mentioned: string[];
  weaknesses_mentioned: string[];
  recommended_use_cases: string[];
}

// ==================== Frontend UI Types ====================

export interface LLMSelectionState {
  selected_provider?: Provider;
  selected_model?: Model;
  available_providers: Provider[];
  available_models: Model[];
  loading: boolean;
  error?: string;
}

export interface CIDAFMControlsState {
  available_commands: CIDAFMCommand[];
  user_commands: UserCIDAFMCommand[];
  active_state_modifiers: string[];
  selected_response_modifiers: string[];
  pending_execution_commands: string[];
  custom_command_input: string;
  loading: boolean;
  error?: string;
}

export interface EvaluationUIState {
  message_id: string;
  ratings: {
    overall?: UserRatingScale;
    speed?: UserRatingScale;
    accuracy?: UserRatingScale;
  };
  notes: string;
  submitting: boolean;
  submitted: boolean;
  error?: string;
}

// ==================== API Request/Response Types ====================

export interface LLMSelectionRequest {
  provider_id: string;
  model_id: string;
  cidafm_options?: CIDAFMOptions;
}

export interface MessageEvaluationRequest {
  user_rating?: UserRatingScale;
  speed_rating?: UserRatingScale;
  accuracy_rating?: UserRatingScale;
  user_notes?: string;
  evaluation_details?: EvaluationDetails;
}

export interface UsageStatsRequest {
  start_date?: string;
  end_date?: string;
  provider_id?: string;
  model_id?: string;
  include_details?: boolean;
}

export interface CIDAFMCommandRequest {
  type: CIDAFMCommandType;
  name: string;
  description?: string;
}

// ==================== Utility Types ====================

export interface ModelCapabilities {
  supports_thinking: boolean;
  supports_multimodal: boolean;
  supports_function_calling: boolean;
  supports_streaming: boolean;
  max_context_length: number;
  recommended_for: string[];
}

export interface ProviderCapabilities {
  supports_streaming: boolean;
  supports_function_calling: boolean;
  rate_limits: {
    requests_per_minute?: number;
    tokens_per_minute?: number;
  };
  authentication_methods: AuthType[];
}
