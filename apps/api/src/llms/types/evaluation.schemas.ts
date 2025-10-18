import { z } from 'zod';
import type { EnhancedMessageResponseDto } from '@/llms/dto/llm-evaluation.dto';
import type {
  EvaluationAggregationRow,
  EvaluationStatsRow,
  ModelComparisonMessageRow,
} from '@/llms/types/evaluation.types';

const baseEnhancedMessageSchema = z
  .object({
    id: z.string().optional(),
  })
  .passthrough();

export const enhancedMessageResponseSchema =
  baseEnhancedMessageSchema as unknown as z.ZodType<EnhancedMessageResponseDto>;

export const enhancedMessageResponseArraySchema = z.array(
  enhancedMessageResponseSchema,
);

const aggregationBaseSchema = z
  .object({
    provider_name: z.string().nullable().optional(),
    model_name: z.string().nullable().optional(),
    total_reviews: z.number().optional(),
    average_rating: z.number().optional(),
    average_speed_rating: z.number().nullable().optional(),
    average_accuracy_rating: z.number().nullable().optional(),
  })
  .passthrough();

export const evaluationAggregationRowSchema =
  aggregationBaseSchema as unknown as z.ZodType<EvaluationAggregationRow>;

export const evaluationAggregationRowsSchema = z.array(
  evaluationAggregationRowSchema,
);

const evaluationStatsRowBaseSchema = z
  .object({
    user_rating: z.number().nullable().optional(),
    speed_rating: z.number().nullable().optional(),
    accuracy_rating: z.number().nullable().optional(),
    provider_id: z.string().nullable().optional(),
    model_id: z.string().nullable().optional(),
    model: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        model_name: z.string().optional(),
        modelId: z.string().optional(),
        modelName: z.string().optional(),
      })
      .nullable()
      .optional(),
    timestamp: z.string().nullable().optional(),
  })
  .passthrough();

export const evaluationStatsRowSchema =
  evaluationStatsRowBaseSchema as unknown as z.ZodType<EvaluationStatsRow>;

export const evaluationStatsRowsSchema = z.array(evaluationStatsRowSchema);

const modelComparisonRowBaseSchema = z
  .object({
    user_rating: z.number().nullable().optional(),
    speed_rating: z.number().nullable().optional(),
    accuracy_rating: z.number().nullable().optional(),
    response_time_ms: z.number().nullable().optional(),
    total_cost: z.number().nullable().optional(),
    model: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        model_name: z.string().optional(),
        modelId: z.string().optional(),
        modelName: z.string().optional(),
      })
      .nullable()
      .optional(),
    timestamp: z.string().nullable().optional(),
  })
  .passthrough();

export const modelComparisonRowSchema =
  modelComparisonRowBaseSchema as unknown as z.ZodType<ModelComparisonMessageRow>;

export const modelComparisonRowsSchema = z.array(modelComparisonRowSchema);
