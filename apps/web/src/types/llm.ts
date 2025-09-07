// LLM Evaluation Types for Frontend
export type AuthType = 'api_key' | 'oauth' | 'none';
export type ProviderStatus = 'active' | 'inactive' | 'maintenance';
export type CIDAFMCommandType = '^' | '&' | '!';
export interface Provider {
  name: string;
  description?: string;
  websiteUrl?: string;
  apiBaseUrl?: string;
  authType: AuthType;
  status: ProviderStatus;
  createdAt: string;
  updatedAt: string;
}
export interface Model {
  providerName: string;
  name: string;
  description?: string;
  modelName: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
  supportsFunctionCalling?: boolean;
  pricingInputPer1k?: number;
  pricingOutputPer1k?: number;
  strengths?: string[];
  limitations?: string[];
  useCases?: string[];
  createdAt: string;
  updatedAt: string;
  // Populated when fetching with provider info
  provider?: Provider;
}
export interface CIDAFMCommand {
  id: string;
  type: CIDAFMCommandType;
  name: string;
  description: string;
  isBuiltin: boolean;
  defaultActive: boolean;
  example?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}
export interface CIDAFMOptions {
  activeStateModifiers?: string[];
  responseModifiers?: string[];
  executedCommands?: string[];
  customOptions?: Record<string, any>;
}
export interface LLMSelection {
  providerName?: string;
  modelName?: string;
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
  providerName?: string;
  modelName?: string;
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
export type SendMessageResponse = EnhancedMessage;
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