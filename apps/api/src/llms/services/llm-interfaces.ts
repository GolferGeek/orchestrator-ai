/**
 * LLM Service Interfaces
 * 
 * This file contains all standardized interfaces for LLM service implementations.
 * These interfaces ensure consistent behavior and metadata handling across all
 * provider-specific services.
 */

import { PIIProcessingMetadata } from '../../common/types/pii-metadata.types';
import { LLMUsageMetrics } from '../../types/llm-evaluation';

/**
 * Configuration interface for LLM services
 */
export interface LLMServiceConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Standardized parameters for LLM response generation
 */
export interface GenerateResponseParams {
  systemPrompt: string;
  userMessage: string;
  config: LLMServiceConfig;
  conversationId?: string;
  sessionId?: string;
  userId?: string;
  headers?: Record<string, any>;
  options?: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    // Additional options from existing LLMService
    preferLocal?: boolean;
    maxComplexity?: 'simple' | 'medium' | 'complex' | 'reasoning';
    authToken?: string;
    currentUser?: any;
    callerType?: string; // 'agent', 'api', 'user', 'system', 'service'
    callerName?: string; // 'metrics-agent', 'user-chat', 'api-endpoint', etc.
    dataClassification?: string; // 'public', 'internal', 'confidential', 'restricted'
    [key: string]: any;
  };
}

/**
 * Response metadata structure
 */
export interface ResponseMetadata {
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
  // Additional fields from existing implementations
  tier?: 'local' | 'centralized' | 'external';
  status: 'started' | 'completed' | 'error';
  errorMessage?: string;
  enhancedMetrics?: LLMUsageMetrics;
  langsmithRunId?: string;
  // Provider-specific fields (e.g., from LocalLLMResponse)
  providerSpecific?: {
    // Ollama/Local specific
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
    // OpenAI specific
    finish_reason?: string;
    system_fingerprint?: string;
    // Anthropic specific
    stop_reason?: string;
    stop_sequence?: string;
    // Generic provider data
    [key: string]: any;
  };
}

/**
 * Standardized response format for all LLM providers
 */
export interface LLMResponse {
  content: string;
  metadata: ResponseMetadata;
  piiMetadata?: PIIProcessingMetadata;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Options for PII processing
 */
export interface PiiOptions {
  enablePseudonymization?: boolean;
  useDictionaryPseudonymizer?: boolean;
  preserveOriginalNames?: boolean;
  customPseudonyms?: Record<string, string>;
}

/**
 * Provider-specific extension interface
 * Providers can extend this to add their own specific metadata
 */
export interface ProviderSpecificMetadata {
  [key: string]: any;
}

/**
 * Extended response metadata for providers that need additional fields
 */
export interface ExtendedResponseMetadata extends ResponseMetadata {
  providerSpecific: ProviderSpecificMetadata;
}

/**
 * Message interface for chat-based interactions
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

/**
 * Tool call interface for function calling
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Extended parameters for chat-based LLM interactions
 */
export interface ChatGenerateResponseParams extends Omit<GenerateResponseParams, 'systemPrompt' | 'userMessage'> {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

/**
 * Tool definition interface for function calling
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Streaming response interface
 */
export interface StreamingLLMResponse {
  content: AsyncIterable<string>;
  metadata: Promise<ResponseMetadata>;
  piiMetadata?: PIIProcessingMetadata;
}

/**
 * Batch processing interface
 */
export interface BatchGenerateResponseParams {
  requests: GenerateResponseParams[];
  batchId?: string;
  maxConcurrency?: number;
}

/**
 * Batch response interface
 */
export interface BatchLLMResponse {
  responses: LLMResponse[];
  batchMetadata: {
    batchId: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalDuration: number;
    averageDuration: number;
  };
}

/**
 * Health check interface for provider services
 */
export interface ProviderHealthStatus {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  lastChecked: string;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Provider capabilities interface
 */
export interface ProviderCapabilities {
  provider: string;
  supportedModels: string[];
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsSystemMessages: boolean;
  maxTokens: number;
  maxContextLength: number;
  supportedFeatures: string[];
}

/**
 * Cost calculation interface
 */
export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  pricingModel: 'per-token' | 'per-request' | 'per-minute';
  breakdown?: {
    inputTokens: number;
    outputTokens: number;
    inputRate: number;
    outputRate: number;
  };
}

/**
 * Usage tracking interface
 */
export interface UsageMetrics {
  provider: string;
  model: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  errorRate: number;
  timeWindow: {
    start: string;
    end: string;
  };
}

/**
 * Routing decision interface (from existing CentralizedRoutingService)
 */
export interface RoutingDecision {
  provider: string;
  model: string;
  tier: 'local' | 'centralized' | 'external';
  reason: string;
  confidence: number;
  alternatives?: Array<{
    provider: string;
    model: string;
    score: number;
  }>;
}

/**
 * Legacy compatibility interface for existing LLMService
 */
export interface LegacyLLMResponse {
  content: string;
  runMetadata: {
    runId: string;
    provider: string;
    model: string;
    tier: 'local' | 'centralized' | 'external';
    cost: number;
    duration: number;
    timestamp: string;
    inputTokens?: number;
    outputTokens?: number;
    status: 'started' | 'completed' | 'error';
    errorMessage?: string;
    enhancedMetrics?: LLMUsageMetrics;
  };
  routingDecision: RoutingDecision;
  piiMetadata?: PIIProcessingMetadata;
}

/**
 * Source blinding configuration interface
 */
export interface SourceBlindingConfig {
  policyProfile?: string;
  dataClass?: string;
  sovereignMode?: string;
  noTrain?: boolean;
  noRetain?: boolean;
}

/**
 * Blinded LLM configuration interface
 */
export interface BlindedLLMConfig {
  provider: 'openai' | 'anthropic' | 'google';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  sourceBlindingOptions?: SourceBlindingConfig;
}

/**
 * Local LLM request interface (for Ollama)
 */
export interface LocalLLMRequest {
  model: string;
  prompt: string;
  system?: string;
  options?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    top_k?: number;
  };
}

/**
 * Local LLM response interface (from Ollama)
 */
export interface LocalLLMResponse {
  response: string;
  model: string;
  created_at: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}
