import type { JsonObject, JsonValue } from '@orchestrator-ai/transport-types';
import type { AgentLLMRecommendation } from './evaluation';
import type { SovereignPolicy } from '@/stores/privacyStore';

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
  customOptions?: JsonObject;
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
  metadata?: JsonObject | null;
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
  evaluation_details?: JsonObject;
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
  // Agent recommendations state
  agentRecommendations: Record<string, AgentLLMRecommendation[]>;
  agentRecommendationsLoading: boolean;
  agentRecommendationsError: string | null;
  // Sovereign mode state
  sovereignMode: boolean;
  sovereignPolicy: SovereignPolicy | null;
  sovereignLoading: boolean;
  sovereignError: string | null;
  // Sanitization stats state
  sanitizationStats: {
    activePatterns: number;
    pseudonyms: number;
    protectedToday: number;
    totalSanitizations: number;
    cacheHitRate: number;
    averageProcessingTime: number;
  };
  sanitizationStatsLoading: boolean;
  sanitizationStatsError: string | null;
  sanitizationStatsLastUpdated: string | null;
  // Unified response handling
  lastUnifiedResponse: UnifiedLLMResponse | null;
  lastStandardizedError: StandardizedLLMError | null;
  responseProcessing: boolean;
  // Cached system model selection from backend model-config
  _systemModelSelection?: LLMSelection | null;
  _systemModelLoaded?: boolean;
}

// Unified LLM response types (inline to avoid circular imports)
export interface UnifiedLLMResponse {
  content: string;
  metadata: {
    provider: string;
    model: string;
    requestId: string;
    timestamp: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost?: number;
    };
    timing: {
      startTime: number;
      endTime: number;
      duration: number;
    };
    status: 'started' | 'completed' | 'error';
    [key: string]: JsonValue | undefined;
  };
  piiMetadata?: JsonObject;
}

export interface StandardizedLLMError {
  error: true;
  message: string;
  userMessage: string;
  technical: {
    type: string;
    code: string;
    provider: string;
    model?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'client' | 'server' | 'network' | 'configuration' | 'validation' | 'security' | 'resource';
    retryable: boolean;
    retryAfterMs?: number;
    timestamp: string;
    requestId?: string;
    [key: string]: JsonValue | undefined;
  };
}

/**
 * System-level model selection configuration
 * Loaded from server's model-config endpoint
 */
export interface SystemModelSelection {
  providerName: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
}
