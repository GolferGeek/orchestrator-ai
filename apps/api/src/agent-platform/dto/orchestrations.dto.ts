import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrchestrationCheckpointDecision } from '../services/orchestration-checkpoint.service';

export class ListOrchestrationsQueryDto {
  @ApiPropertyOptional({
    enum: ['active', 'completed', 'all'],
    description:
      'Lifecycle filter: active (default), completed, or all orchestrations.',
  })
  @IsOptional()
  @IsIn(['active', 'completed', 'all'])
  lifecycle?: 'active' | 'completed' | 'all';

  @ApiPropertyOptional({
    description: 'Filter runs by orchestration definition identifier.',
  })
  @IsOptional()
  @IsString()
  definitionId?: string;

  @ApiPropertyOptional({
    description: 'Filter runs by their parent orchestration run identifier.',
  })
  @IsOptional()
  @IsString()
  parentRunId?: string;

  @ApiPropertyOptional({
    description: 'Restrict runs to a specific organization slug.',
  })
  @IsOptional()
  @IsString()
  organizationSlug?: string;

  @ApiPropertyOptional({
    description: 'Free text search across run id, name, and slug.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 25,
    description: 'Maximum number of runs to return.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Number of runs to skip from the beginning of the result set.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Return runs that started at or after the provided ISO-8601 timestamp.',
  })
  @IsOptional()
  @IsISO8601()
  startedAfter?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Return runs that started at or before the provided ISO-8601 timestamp.',
  })
  @IsOptional()
  @IsISO8601()
  startedBefore?: string;
}

export class ListOrchestrationApprovalsQueryDto {
  @ApiPropertyOptional({
    enum: ['pending', 'approved', 'rejected'],
    description: 'Filter approvals by status.',
  })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';

  @ApiPropertyOptional({
    description: 'Restrict approvals to a specific organization slug.',
  })
  @IsOptional()
  @IsString()
  organizationSlug?: string;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
    description: 'Sort approvals by creation timestamp.',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 200,
    default: 50,
    description: 'Maximum number of approvals to return.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Number of approvals to skip from the beginning of the result.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ResolveOrchestrationApprovalDto {
  @ApiProperty({
    enum: ['continue', 'retry', 'abort'],
    description: 'Checkpoint decision to apply to the orchestration run.',
  })
  @IsIn(['continue', 'retry', 'abort'])
  decision!: OrchestrationCheckpointDecision;

  @ApiPropertyOptional({
    description: 'Optional notes to record alongside the decision.',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Optional modifications payload supplied during resolution.',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  modifications?: Record<string, any>;
}
