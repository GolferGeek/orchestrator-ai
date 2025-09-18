// Types for message evaluation system
export type UserRatingScale = 1 | 2 | 3 | 4 | 5;
export interface MessageEvaluation {
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: {
    additionalMetrics?: Record<string, number>;
    tags?: string[];
    feedback?: string;
    userContext?: string;
    modelConfidence?: number;
  };
}
export interface EvaluationRequest {
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: {
    additionalMetrics?: Record<string, number>;
    tags?: string[];
    feedback?: string;
    userContext?: string;
    modelConfidence?: number;
  };
}
export interface EvaluationResponse {
  id: string;
  messageId: string;
  userId: string;
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: any;
  createdAt: string;
  updatedAt: string;
}
export interface AllEvaluationsFilters {
  page?: number;
  limit?: number;
  minRating?: UserRatingScale;
  hasNotes?: boolean;
  agentName?: string;
}
export interface EvaluationWithMessage {
  id: string;
  content: string;
  role: string;
  sessionId: string;
  userId: string;
  timestamp: string;
  order: number;
  // Evaluation fields (direct, not nested)
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationTimestamp?: string;
  evaluationDetails?: any;
  // Metadata for task evaluations
  metadata?: {
    agentName?: string;
    taskType?: string;
    status?: string;
    taskPrompt?: string;
    taskResponse?: string;
    responseMetadata?: any;
    llmMetadata?: any;
    taskMetadata?: any;
    deliverableType?: string;
    deliverableMetadata?: any;
    progressMessage?: string;
    workflowStepsCompleted?: string[];
    userEmail?: string;
  };
  // Optional fields
  providerName?: string;
  modelName?: string;
  responseTimeMs?: number;
  cost?: number;
  provider?: {
    id: string;
    name: string;
    description?: string;
  };
  model?: {
    id: string;
    name: string;
    description?: string;
    providerName: string;
  };
}
export interface AllEvaluationsResponse {
  evaluations: EvaluationWithMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AgentLLMRecommendation {
  providerId?: string;
  providerName: string;
  modelId?: string;
  modelName: string;
  averageRating: number;
  evaluationCount: number;
  lastEvaluatedAt?: string;
}
