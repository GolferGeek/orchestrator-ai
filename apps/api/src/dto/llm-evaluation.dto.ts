// LLM Evaluation DTOs
// Data Transfer Objects for LLM evaluation API endpoints

import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsUUID,
  IsDateString,
  Min,
  Max,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  LLMProvider,
  ProviderStatus,
  ModelStatus,
  AuthType,
  CIDAFMCommandType,
  UserRatingScale,
} from '../types/llm-evaluation';

// ==================== Provider DTOs ====================

export class CreateProviderDto {
  @ApiProperty({ description: 'Provider name', example: 'OpenAI' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'API base URL',
    example: 'https://api.openai.com/v1',
  })
  @IsString()
  @IsOptional()
  api_base_url?: string;

  @ApiProperty({
    enum: ['api_key', 'oauth', 'none'],
    description: 'Authentication type',
  })
  @IsEnum(['api_key', 'oauth', 'none'])
  auth_type: AuthType;

  @ApiPropertyOptional({
    enum: ['active', 'inactive', 'deprecated'],
    default: 'active',
  })
  @IsEnum(['active', 'inactive', 'deprecated'])
  @IsOptional()
  status?: ProviderStatus;
}

export class UpdateProviderDto {
  @ApiPropertyOptional({ description: 'Provider name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'API base URL' })
  @IsString()
  @IsOptional()
  api_base_url?: string;

  @ApiPropertyOptional({ enum: ['api_key', 'oauth', 'none'] })
  @IsEnum(['api_key', 'oauth', 'none'])
  @IsOptional()
  auth_type?: AuthType;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'deprecated'] })
  @IsEnum(['active', 'inactive', 'deprecated'])
  @IsOptional()
  status?: ProviderStatus;
}

export class ProviderResponseDto {
  @ApiProperty({ description: 'Provider UUID' })
  id: string;

  @ApiProperty({ description: 'Provider name' })
  name: string;

  @ApiPropertyOptional({ description: 'API base URL' })
  api_base_url?: string;

  @ApiProperty({ enum: ['api_key', 'oauth', 'none'] })
  auth_type: AuthType;

  @ApiProperty({ enum: ['active', 'inactive', 'deprecated'] })
  status: ProviderStatus;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Last update timestamp' })
  updated_at: string;
}

// ==================== Model DTOs ====================

export class CreateModelDto {
  @ApiProperty({ description: 'Provider UUID' })
  @IsUUID()
  provider_id: string;

  @ApiProperty({ description: 'Human-readable model name', example: 'GPT-4o' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Model ID for API calls', example: 'gpt-4o' })
  @IsString()
  @IsNotEmpty()
  model_id: string;

  @ApiPropertyOptional({
    description: 'Input pricing per 1K tokens (USD)',
    example: 0.0025,
  })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @IsOptional()
  pricing_input_per_1k?: number;

  @ApiPropertyOptional({
    description: 'Output pricing per 1K tokens (USD)',
    example: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @IsOptional()
  pricing_output_per_1k?: number;

  @ApiPropertyOptional({
    description: 'Supports thinking mode',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  supports_thinking?: boolean;

  @ApiPropertyOptional({ description: 'Maximum output tokens', example: 4096 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  max_tokens?: number;

  @ApiPropertyOptional({ description: 'Context window size', example: 128000 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  context_window?: number;

  @ApiPropertyOptional({ description: 'Model strengths', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  strengths?: string[];

  @ApiPropertyOptional({ description: 'Model weaknesses', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  weaknesses?: string[];

  @ApiPropertyOptional({ description: 'Recommended use cases', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  use_cases?: string[];

  @ApiPropertyOptional({
    enum: ['active', 'inactive', 'deprecated'],
    default: 'active',
  })
  @IsEnum(['active', 'inactive', 'deprecated'])
  @IsOptional()
  status?: ModelStatus;
}

export class UpdateModelDto {
  @ApiPropertyOptional({ description: 'Human-readable model name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Model ID for API calls' })
  @IsString()
  @IsOptional()
  model_id?: string;

  @ApiPropertyOptional({ description: 'Input pricing per 1K tokens (USD)' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @IsOptional()
  pricing_input_per_1k?: number;

  @ApiPropertyOptional({ description: 'Output pricing per 1K tokens (USD)' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @IsOptional()
  pricing_output_per_1k?: number;

  @ApiPropertyOptional({ description: 'Supports thinking mode' })
  @IsBoolean()
  @IsOptional()
  supports_thinking?: boolean;

  @ApiPropertyOptional({ description: 'Maximum output tokens' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  max_tokens?: number;

  @ApiPropertyOptional({ description: 'Context window size' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  context_window?: number;

  @ApiPropertyOptional({ description: 'Model strengths', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  strengths?: string[];

  @ApiPropertyOptional({ description: 'Model weaknesses', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  weaknesses?: string[];

  @ApiPropertyOptional({ description: 'Recommended use cases', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  use_cases?: string[];

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'deprecated'] })
  @IsEnum(['active', 'inactive', 'deprecated'])
  @IsOptional()
  status?: ModelStatus;
}

export class ModelResponseDto {
  @ApiProperty({ description: 'Model UUID' })
  id: string;

  @ApiProperty({ description: 'Provider UUID' })
  provider_id: string;

  @ApiProperty({ description: 'Human-readable model name' })
  name: string;

  @ApiProperty({ description: 'Model ID for API calls' })
  model_id: string;

  @ApiPropertyOptional({ description: 'Input pricing per 1K tokens (USD)' })
  pricing_input_per_1k?: number;

  @ApiPropertyOptional({ description: 'Output pricing per 1K tokens (USD)' })
  pricing_output_per_1k?: number;

  @ApiProperty({ description: 'Supports thinking mode' })
  supports_thinking: boolean;

  @ApiPropertyOptional({ description: 'Maximum output tokens' })
  max_tokens?: number;

  @ApiPropertyOptional({ description: 'Context window size' })
  context_window?: number;

  @ApiPropertyOptional({ description: 'Model strengths', type: [String] })
  strengths?: string[];

  @ApiPropertyOptional({ description: 'Model weaknesses', type: [String] })
  weaknesses?: string[];

  @ApiPropertyOptional({ description: 'Recommended use cases', type: [String] })
  use_cases?: string[];

  @ApiProperty({ enum: ['active', 'inactive', 'deprecated'] })
  status: ModelStatus;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Last update timestamp' })
  updated_at: string;

  @ApiPropertyOptional({ description: 'Provider details (when joined)' })
  provider?: ProviderResponseDto;
}

// ==================== CIDAFM Command DTOs ====================

export class CreateCIDAFMCommandDto {
  @ApiProperty({
    enum: ['^', '&', '!'],
    description: 'Command type: ^ (response), & (state), ! (execution)',
  })
  @IsEnum(['^', '&', '!'])
  type: CIDAFMCommandType;

  @ApiProperty({
    description: 'Command name (without type prefix)',
    example: 'concise',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Command description' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CIDAFMCommandResponseDto {
  @ApiProperty({ description: 'Command UUID' })
  id: string;

  @ApiProperty({ enum: ['^', '&', '!'] })
  type: CIDAFMCommandType;

  @ApiProperty({ description: 'Command name' })
  name: string;

  @ApiPropertyOptional({ description: 'Command description' })
  description?: string;

  @ApiProperty({ description: 'Whether command is active by default' })
  default_active: boolean;

  @ApiProperty({ description: 'Whether this is a built-in command' })
  is_builtin: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Last update timestamp' })
  updated_at: string;
}

// ==================== Message Enhancement DTOs ====================

export class LLMSelectionDto {
  @ApiProperty({ description: 'Provider UUID' })
  @IsUUID()
  provider_id: string;

  @ApiProperty({ description: 'Model UUID' })
  @IsUUID()
  model_id: string;

  @ApiPropertyOptional({ description: 'CIDAFM options', type: Object })
  @IsObject()
  @IsOptional()
  cidafm_options?: {
    active_state_modifiers?: string[];
    response_modifiers?: string[];
    executed_commands?: string[];
    custom_options?: Record<string, any>;
  };
}

export class MessageEvaluationDto {
  @ApiPropertyOptional({
    description: 'Overall rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  user_rating?: UserRatingScale;

  @ApiPropertyOptional({
    description: 'Speed rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  speed_rating?: UserRatingScale;

  @ApiPropertyOptional({
    description: 'Accuracy rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  accuracy_rating?: UserRatingScale;

  @ApiPropertyOptional({ description: 'User notes and feedback' })
  @IsString()
  @IsOptional()
  user_notes?: string;

  @ApiPropertyOptional({
    description: 'Additional evaluation details',
    type: Object,
  })
  @IsObject()
  @IsOptional()
  evaluation_details?: {
    additional_metrics?: Record<string, number>;
    tags?: string[];
    feedback?: string;
    user_context?: string;
    model_confidence?: number;
  };
}

export class EnhancedMessageCreateDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'LLM selection for this message' })
  @ValidateNested()
  @Type(() => LLMSelectionDto)
  @IsOptional()
  llm_selection?: LLMSelectionDto;
}

export class EnhancedMessageResponseDto {
  @ApiProperty({ description: 'Message UUID' })
  id: string;

  @ApiProperty({ description: 'Session UUID' })
  session_id: string;

  @ApiProperty({ description: 'User UUID' })
  user_id: string;

  @ApiProperty({ enum: ['user', 'assistant', 'system', 'tool'] })
  role: 'user' | 'assistant' | 'system' | 'tool';

  @ApiPropertyOptional({ description: 'Message content' })
  content?: string;

  @ApiProperty({ description: 'Message timestamp' })
  timestamp: string;

  @ApiProperty({ description: 'Message order in session' })
  order: number;

  @ApiPropertyOptional({ description: 'Message metadata' })
  metadata?: Record<string, any>;

  // LLM fields
  @ApiPropertyOptional({ description: 'Provider UUID' })
  provider_id?: string;

  @ApiPropertyOptional({ description: 'Model UUID' })
  model_id?: string;

  @ApiPropertyOptional({ description: 'Input tokens consumed' })
  input_tokens?: number;

  @ApiPropertyOptional({ description: 'Output tokens generated' })
  output_tokens?: number;

  @ApiPropertyOptional({ description: 'Total cost in USD' })
  total_cost?: number;

  @ApiPropertyOptional({ description: 'Response time in milliseconds' })
  response_time_ms?: number;

  @ApiPropertyOptional({ description: 'LangSmith run ID' })
  langsmith_run_id?: string;

  // Evaluation fields
  @ApiPropertyOptional({ description: 'Overall rating (1-5)' })
  user_rating?: UserRatingScale;

  @ApiPropertyOptional({ description: 'Speed rating (1-5)' })
  speed_rating?: UserRatingScale;

  @ApiPropertyOptional({ description: 'Accuracy rating (1-5)' })
  accuracy_rating?: UserRatingScale;

  @ApiPropertyOptional({ description: 'User notes' })
  user_notes?: string;

  @ApiPropertyOptional({ description: 'Evaluation timestamp' })
  evaluation_timestamp?: string;

  @ApiPropertyOptional({ description: 'CIDAFM options used' })
  cidafm_options?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Additional evaluation details' })
  evaluation_details?: Record<string, any>;

  // Joined data
  @ApiPropertyOptional({ description: 'Provider details (when joined)' })
  provider?: ProviderResponseDto;

  @ApiPropertyOptional({ description: 'Model details (when joined)' })
  model?: ModelResponseDto;
}

// ==================== Usage Stats DTOs ====================

export class UsageStatsQueryDto {
  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  start_date?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  end_date?: string;

  @ApiPropertyOptional({ description: 'Filter by provider UUID' })
  @IsUUID()
  @IsOptional()
  provider_id?: string;

  @ApiPropertyOptional({ description: 'Filter by model UUID' })
  @IsUUID()
  @IsOptional()
  model_id?: string;

  @ApiPropertyOptional({
    description: 'Include detailed breakdown',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  include_details?: boolean;
}

export class UsageStatsResponseDto {
  @ApiProperty({ description: 'User UUID' })
  user_id: string;

  @ApiProperty({ description: 'Date range queried' })
  date_range: {
    start_date: string;
    end_date: string;
  };

  @ApiProperty({ description: 'Total requests made' })
  total_requests: number;

  @ApiProperty({ description: 'Total tokens consumed' })
  total_tokens: number;

  @ApiProperty({ description: 'Total cost in USD' })
  total_cost: number;

  @ApiProperty({ description: 'Average response time in ms' })
  average_response_time: number;

  @ApiPropertyOptional({ description: 'Average user rating' })
  average_user_rating?: number;

  @ApiPropertyOptional({ description: 'Breakdown by provider', type: Array })
  by_provider?: Array<{
    provider: ProviderResponseDto;
    requests: number;
    tokens: number;
    cost: number;
    avg_rating?: number;
  }>;

  @ApiPropertyOptional({ description: 'Breakdown by model', type: Array })
  by_model?: Array<{
    model: ModelResponseDto;
    requests: number;
    tokens: number;
    cost: number;
    avg_rating?: number;
  }>;

  @ApiPropertyOptional({ description: 'Daily statistics', type: Array })
  daily_stats?: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
    avg_response_time?: number;
  }>;
}

// ==================== Cost Calculation DTOs ====================

export class CostEstimateDto {
  @ApiProperty({ description: 'Message content to estimate' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'Model UUID for pricing' })
  @IsUUID()
  model_id: string;

  @ApiPropertyOptional({
    description: 'Estimated response length factor',
    default: 1.0,
  })
  @IsNumber()
  @Min(0.1)
  @Max(10.0)
  @IsOptional()
  response_length_factor?: number;
}

export class CostEstimateResponseDto {
  @ApiProperty({ description: 'Estimated input tokens' })
  estimated_input_tokens: number;

  @ApiProperty({ description: 'Estimated output tokens' })
  estimated_output_tokens: number;

  @ApiProperty({ description: 'Estimated total cost in USD' })
  estimated_cost: number;

  @ApiPropertyOptional({ description: 'Cost warning if expensive' })
  max_cost_warning?: string;

  @ApiProperty({ description: 'Currency (USD)' })
  currency: string;

  @ApiProperty({ description: 'Model used for estimation' })
  model: ModelResponseDto;
}
