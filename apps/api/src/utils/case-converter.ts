// Database to API case conversion utilities
// Maps between snake_case (database) and camelCase (API layer)

import {
  Provider,
  Model,
  CIDAFMCommand,
  EnhancedMessage,
  UserUsageStats,
} from '../types/llm-evaluation';

// Generic function to convert snake_case to camelCase
export function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }

  const camelObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );
      camelObj[camelKey] = snakeToCamel(obj[key]);
    }
  }
  return camelObj;
}

// Generic function to convert camelCase to snake_case
export function camelToSnake(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(camelToSnake);
  }

  const snakeObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = key.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      );
      snakeObj[snakeKey] = camelToSnake(obj[key]);
    }
  }
  return snakeObj;
}

// Specific converters for LLM evaluation entities

export function mapProviderFromDb(dbProvider: any): Provider {
  return {
    id: dbProvider.id,
    name: dbProvider.name,
    apiBaseUrl: dbProvider.api_base_url,
    authType: dbProvider.auth_type,
    status: dbProvider.status,
    createdAt: dbProvider.created_at,
    updatedAt: dbProvider.updated_at,
  };
}

export function mapProviderToDb(provider: Partial<Provider>): any {
  return {
    id: provider.id,
    name: provider.name,
    api_base_url: provider.apiBaseUrl,
    auth_type: provider.authType,
    status: provider.status,
    created_at: provider.createdAt,
    updated_at: provider.updatedAt,
  };
}

export function mapModelFromDb(dbModel: any): Model {
  return {
    id: dbModel.id,
    providerId: dbModel.provider_id,
    name: dbModel.name,
    modelId: dbModel.model_id,
    pricingInputPer1k: dbModel.pricing_input_per_1k,
    pricingOutputPer1k: dbModel.pricing_output_per_1k,
    supportsThinking: dbModel.supports_thinking,
    maxTokens: dbModel.max_tokens,
    contextWindow: dbModel.context_window,
    strengths: dbModel.strengths,
    weaknesses: dbModel.weaknesses,
    useCases: dbModel.use_cases,
    status: dbModel.status,
    createdAt: dbModel.created_at,
    updatedAt: dbModel.updated_at,
    provider: dbModel.provider
      ? mapProviderFromDb(dbModel.provider)
      : undefined,
  };
}

export function mapModelToDb(model: Partial<Model>): any {
  return {
    id: model.id,
    provider_id: model.providerId,
    name: model.name,
    model_id: model.modelId,
    pricing_input_per_1k: model.pricingInputPer1k,
    pricing_output_per_1k: model.pricingOutputPer1k,
    supports_thinking: model.supportsThinking,
    max_tokens: model.maxTokens,
    context_window: model.contextWindow,
    strengths: model.strengths,
    weaknesses: model.weaknesses,
    use_cases: model.useCases,
    status: model.status,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
  };
}

export function mapCIDAFMCommandFromDb(dbCommand: any): CIDAFMCommand {
  return {
    id: dbCommand.id,
    type: dbCommand.type,
    name: dbCommand.name,
    description: dbCommand.description,
    defaultActive: dbCommand.default_active,
    isBuiltin: dbCommand.is_builtin,
    createdAt: dbCommand.created_at,
    updatedAt: dbCommand.updated_at,
  };
}

export function mapCIDAFMCommandToDb(command: Partial<CIDAFMCommand>): any {
  return {
    id: command.id,
    type: command.type,
    name: command.name,
    description: command.description,
    default_active: command.defaultActive,
    is_builtin: command.isBuiltin,
    created_at: command.createdAt,
    updated_at: command.updatedAt,
  };
}

export function mapEnhancedMessageFromDb(dbMessage: any): EnhancedMessage {
  return {
    id: dbMessage.id,
    sessionId: dbMessage.session_id,
    userId: dbMessage.user_id,
    role: dbMessage.role,
    content: dbMessage.content,
    timestamp: dbMessage.timestamp,
    order: dbMessage.order,
    metadata: dbMessage.metadata,
    providerId: dbMessage.provider_id,
    modelId: dbMessage.model_id,
    inputTokens: dbMessage.input_tokens,
    outputTokens: dbMessage.output_tokens,
    totalCost: dbMessage.total_cost,
    responseTimeMs: dbMessage.response_time_ms,
    langsmithRunId: dbMessage.langsmith_run_id,
    userRating: dbMessage.user_rating,
    speedRating: dbMessage.speed_rating,
    accuracyRating: dbMessage.accuracy_rating,
    userNotes: dbMessage.user_notes,
    evaluationTimestamp: dbMessage.evaluation_timestamp,
    cidafmOptions: dbMessage.cidafm_options,
    evaluationDetails: dbMessage.evaluation_details,
    provider: dbMessage.provider
      ? mapProviderFromDb(dbMessage.provider)
      : undefined,
    model: dbMessage.model ? mapModelFromDb(dbMessage.model) : undefined,
  };
}

export function mapEnhancedMessageToDb(message: Partial<EnhancedMessage>): any {
  return {
    id: message.id,
    sessionId: message.sessionId,
    user_id: message.userId,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    order: message.order,
    metadata: message.metadata,
    provider_id: message.providerId,
    model_id: message.modelId,
    inputTokens: message.inputTokens,
    outputTokens: message.outputTokens,
    totalCost: message.totalCost,
    responseTimeMs: message.responseTimeMs,
    langsmith_run_id: message.langsmithRunId,
    userRating: message.userRating,
    speedRating: message.speedRating,
    accuracyRating: message.accuracyRating,
    userNotes: message.userNotes,
    evaluationTimestamp: message.evaluationTimestamp,
    cidafmOptions: message.cidafmOptions,
    evaluationDetails: message.evaluationDetails,
  };
}

export function mapUserUsageStatsFromDb(dbStats: any): UserUsageStats {
  return {
    id: dbStats.id,
    userId: dbStats.user_id,
    date: dbStats.date,
    providerId: dbStats.provider_id,
    modelId: dbStats.model_id,
    totalRequests: dbStats.total_requests,
    totalTokens: dbStats.total_tokens,
    totalCost: dbStats.total_cost,
    avgResponseTimeMs: dbStats.avg_response_time_ms,
    avgUserRating: dbStats.avg_user_rating,
    createdAt: dbStats.created_at,
    updatedAt: dbStats.updated_at,
    provider: dbStats.provider
      ? mapProviderFromDb(dbStats.provider)
      : undefined,
    model: dbStats.model ? mapModelFromDb(dbStats.model) : undefined,
  };
}

export function mapUserUsageStatsToDb(stats: Partial<UserUsageStats>): any {
  return {
    id: stats.id,
    user_id: stats.userId,
    date: stats.date,
    provider_id: stats.providerId,
    model_id: stats.modelId,
    totalRequests: stats.totalRequests,
    totalTokens: stats.totalTokens,
    totalCost: stats.totalCost,
    avg_responseTimeMs: stats.avgResponseTimeMs,
    avg_userRating: stats.avgUserRating,
    created_at: stats.createdAt,
    updated_at: stats.updatedAt,
  };
}
