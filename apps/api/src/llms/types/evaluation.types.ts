import type { UserRatingScale } from '@/llms/types/llm-evaluation';

export interface EvaluationFilters {
  minRating?: number;
  hasNotes?: boolean;
}

export interface EvaluationStatsFilters {
  startDate?: string;
  endDate?: string;
  providerId?: string;
  modelId?: string;
}

export interface ModelComparisonFilters {
  startDate?: string;
  endDate?: string;
}

export interface FeedbackExportOptions {
  format: 'json' | 'csv';
  startDate?: string;
  endDate?: string;
  includeContent?: boolean;
}

export interface AllUserEvaluationsFilters {
  page: number;
  limit: number;
  minRating?: number;
  hasNotes?: boolean;
  agentName?: string;
}

export interface EvaluationRow {
  id: string;
  user_id: string;
  session_id: string | null;
  user_rating: UserRatingScale | null;
  speed_rating: UserRatingScale | null;
  accuracy_rating: UserRatingScale | null;
  user_notes: string | null;
  evaluation_details: Record<string, unknown> | null;
  evaluation_timestamp: string | null;
  provider?: {
    id: string;
    provider_name: string;
  } | null;
  model?: {
    id: string;
    model_name: string;
  } | null;
}

export interface EvaluationAggregationRow {
  provider_name: string | null;
  model_name: string | null;
  total_reviews: number;
  average_rating: number;
  average_speed_rating: number | null;
  average_accuracy_rating: number | null;
}

export interface EvaluationStatsRow {
  user_rating: number | null;
  speed_rating: number | null;
  accuracy_rating: number | null;
  provider_id: string | null;
  model_id: string | null;
  model?: {
    id?: string;
    name?: string;
    model_name?: string;
    modelId?: string;
    modelName?: string;
  } | null;
  timestamp?: string | null;
}

export interface ModelComparisonMessageRow {
  user_rating: number | null;
  speed_rating: number | null;
  accuracy_rating: number | null;
  response_time_ms: number | null;
  total_cost: number | null;
  model?: {
    id?: string;
    name?: string;
    model_name?: string;
    modelId?: string;
    modelName?: string;
  } | null;
  timestamp?: string | null;
}
