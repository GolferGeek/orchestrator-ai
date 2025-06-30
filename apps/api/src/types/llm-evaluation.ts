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
  apiBaseUrl?: string;
  authType: AuthType;
  status: ProviderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Model {
  id: string;
  providerId: string;
  name: string;
  modelId: string;
  pricingInputPer1k?: number;
  pricingOutputPer1k?: number;
  supportsThinking: boolean;
  maxTokens?: number;
  contextWindow?: number;
  strengths?: string[];
  weaknesses?: string[];
  useCases?: string[];
  status: ModelStatus;
  createdAt: string;
  updatedAt: string;
  // Joined data when fetching with provider
  provider?: Provider;
}

export interface CIDAFMCommand {
  id: string;
  type: CIDAFMCommandType;
  name: string;
  description?: string;
  defaultActive: boolean;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserCIDAFMCommand {
  id: string;
  userId: string;
  type: CIDAFMCommandType;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserUsageStats {
  id: string;
  userId: string;
  date: string; // Date string in YYYY-MM-DD format
  providerId?: string;
  modelId?: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgResponseTimeMs?: number;
  avgUserRating?: number;
  createdAt: string;
  updatedAt: string;
  // Joined data when fetching with relations
  provider?: Provider;
  model?: Model;
}

// ==================== Enhanced Message Types ====================

export interface MessageEvaluation {
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationTimestamp?: string;
}

export interface CIDAFMOptions {
  activeStateModifiers?: string[];
  responseModifiers?: string[];
  executedCommands?: string[];
  customOptions?: Record<string, any>;
}

export interface EvaluationDetails {
  additionalMetrics?: Record<string, number>;
  tags?: string[];
  feedback?: string;
  userContext?: string;
  modelConfidence?: number;
}

export interface LLMUsageMetrics {
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
  responseTimeMs?: number;
  langsmithRunId?: string;
}

export interface EnhancedMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  timestamp: string;
  order: number;
  metadata?: Record<string, any>;

  // LLM Selection
  providerId?: string;
  modelId?: string;

  // Usage Metrics
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
  responseTimeMs?: number;
  langsmithRunId?: string;

  // Evaluation Data
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationTimestamp?: string;

  // CIDAFM and Additional Data
  cidafmOptions?: CIDAFMOptions;
  evaluationDetails?: EvaluationDetails;

  // Joined data when fetching with relations
  provider?: Provider;
  model?: Model;
}

// ==================== Cost Calculation Types ====================

export interface CostCalculation {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  estimatedCost?: number;
  currency: string;
}

export interface PricingInfo {
  inputPer1k: number;
  outputPer1k: number;
  currency: string;
  lastUpdated: string;
}

export interface CostEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  maxCostWarning?: string;
  currency: string;
}

// ==================== CIDAFM Processing Types ====================

export interface CIDAFMState {
  activeCommands: CIDAFMCommand[];
  userCommands: UserCIDAFMCommand[];
  sessionState: Record<string, any>;
}

export interface CIDAFMProcessingResult {
  modifiedPrompt: string;
  newState: CIDAFMState;
  executedCommands: string[];
  processingNotes?: string[];
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
  userId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  averageUserRating?: number;

  // Breakdown by provider/model
  byProvider: Array<{
    provider: Provider;
    requests: number;
    tokens: number;
    cost: number;
    avgRating?: number;
  }>;

  byModel: Array<{
    model: Model;
    requests: number;
    tokens: number;
    cost: number;
    avgRating?: number;
  }>;

  // Daily breakdown
  dailyStats: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
    avgResponseTime?: number;
  }>;
}

export interface ModelPerformanceMetrics {
  model: Model;
  totalUses: number;
  averageRating: number;
  averageResponseTime: number;
  averageCostPerMessage: number;
  userFeedbackCount: number;
  strengthsMentioned: string[];
  weaknessesMentioned: string[];
  recommendedUseCases: string[];
}

// ==================== Frontend UI Types ====================

export interface LLMSelectionState {
  selectedProvider?: Provider;
  selectedModel?: Model;
  availableProviders: Provider[];
  availableModels: Model[];
  loading: boolean;
  error?: string;
}

export interface CIDAFMControlsState {
  availableCommands: CIDAFMCommand[];
  userCommands: UserCIDAFMCommand[];
  activeStateModifiers: string[];
  selectedResponseModifiers: string[];
  pendingExecutionCommands: string[];
  customCommandInput: string;
  loading: boolean;
  error?: string;
}

export interface EvaluationUIState {
  messageId: string;
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
  providerId: string;
  modelId: string;
  cidafmOptions?: CIDAFMOptions;
}

export interface MessageEvaluationRequest {
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: EvaluationDetails;
}

export interface UsageStatsRequest {
  startDate?: string;
  endDate?: string;
  providerId?: string;
  modelId?: string;
  includeDetails?: boolean;
}

export interface CIDAFMCommandRequest {
  type: CIDAFMCommandType;
  name: string;
  description?: string;
}

// ==================== Utility Types ====================

export interface ModelCapabilities {
  supportsThinking: boolean;
  supportsMultimodal: boolean;
  supportsFunctionCalling: boolean;
  supportsStreaming: boolean;
  maxContextLength: number;
  recommendedFor: string[];
}

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  rateLimits: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
  authenticationMethods: AuthType[];
}
