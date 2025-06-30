// LLM Evaluation Types for Frontend

export type AuthType = 'api_key' | 'oauth' | 'none';
export type ProviderStatus = 'active' | 'inactive' | 'maintenance';
export type CIDAFMCommandType = '^' | '&' | '!';

export interface Provider {
  id: string;
  name: string;
  description?: string;
  website_url?: string;
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
  description?: string;
  model_id: string;
  max_tokens?: number;
  supports_streaming?: boolean;
  supports_function_calling?: boolean;
  pricing_input_per_1k?: number;
  pricing_output_per_1k?: number;
  strengths?: string[];
  limitations?: string[];
  use_cases?: string[];
  created_at: string;
  updated_at: string;
  // Populated when fetching with provider info
  provider?: Provider;
}

export interface CIDAFMCommand {
  id: string;
  type: CIDAFMCommandType;
  name: string;
  description: string;
  is_builtin: boolean;
  default_active: boolean;
  example?: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface CIDAFMOptions {
  selected_commands?: string[];
  custom_modifiers?: string[];
  temperature_override?: number;
  max_tokens_override?: number;
}

export interface LLMSelection {
  providerId?: string;
  modelId?: string;
  cidafmOptions?: CIDAFMOptions;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMUsageMetrics {
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
  response_time_ms: number;
  langsmith_run_id?: string;
}

export interface CostCalculation {
  input_tokens: number;
  output_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  currency: string;
}

export interface MessageEvaluation {
  user_rating?: number;
  speed_rating?: number;
  accuracy_rating?: number;
  user_notes?: string;
  evaluation_timestamp?: string;
}

export interface EnhancedMessage {
  id: string;
  session_id: string;
  user_id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  timestamp: string;
  order: number;
  metadata?: any;
  
  // LLM fields
  provider_id?: string;
  model_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_cost?: number;
  response_time_ms?: number;
  langsmith_run_id?: string;
  
  // Evaluation fields
  user_rating?: number;
  speed_rating?: number;
  accuracy_rating?: number;
  user_notes?: string;
  evaluation_timestamp?: string;
  
  // CIDAFM and additional data
  cidafm_options?: CIDAFMOptions;
  evaluation_details?: any;
  
  // Populated data
  provider?: Provider;
  model?: Model;
}

// API Request/Response types
export interface SendMessageRequest {
  content: string;
  llmSelection?: LLMSelection;
}

export interface SendMessageResponse extends EnhancedMessage {}

export interface UsageStats {
  user_id: string;
  total_messages: number;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_response_time_ms: number;
  most_used_provider?: string;
  most_used_model?: string;
  date_range_start: string;
  date_range_end: string;
  created_at: string;
  updated_at: string;
}

// UI State types
export interface LLMPreferencesState {
  selectedProvider?: Provider;
  selectedModel?: Model;
  selectedCIDAFMCommands: string[];
  customModifiers: string[];
  temperature: number;
  maxTokens?: number;
  
  // Available options
  providers: Provider[];
  models: Model[];
  cidafmCommands: CIDAFMCommand[];
  
  // Loading states
  loadingProviders: boolean;
  loadingModels: boolean;
  loadingCommands: boolean;
  
  // Error states
  providerError?: string;
  modelError?: string;
  commandError?: string;
}