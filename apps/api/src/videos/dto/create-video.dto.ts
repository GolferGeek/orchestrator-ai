import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsIn,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVideoDto {
  @ApiProperty({
    description: 'Unique identifier for the video',
    example: 'agent-default-overview',
  })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({
    description: 'Video title',
    example: 'Working with Orchestrator AI Agents',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Video description',
    example: 'Learn essential workflows for engaging with agents',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    description: 'Video URL (Loom embed or TBD_RECORDING_NEEDED)',
    example: 'https://www.loom.com/embed/example123',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiProperty({
    description: 'Video duration in MM:SS format',
    example: '6:00',
  })
  @IsString()
  @IsNotEmpty()
  duration!: string;

  @ApiProperty({
    description: 'Video creation date in YYYY-MM-DD format',
    example: '2025-01-24',
  })
  @IsDateString()
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Whether this video is featured',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  featured?: boolean = false;

  @ApiProperty({
    description: 'Display order within category',
    example: 1,
  })
  @IsNumber()
  order!: number;

  @ApiProperty({
    description: 'Category key where video should be placed',
    example: 'agents',
    enum: [
      'introduction',
      'agent-architecture',
      'privacy-security',
      'how-we-work',
      'evaluations',
      'what-were-working-on-next',
      'demos',
      'agents',
    ],
  })
  @IsString()
  @IsIn([
    'introduction',
    'agent-architecture',
    'privacy-security',
    'how-we-work',
    'evaluations',
    'what-were-working-on-next',
    'demos',
    'agents',
  ])
  categoryKey!: string;

  @ApiPropertyOptional({
    description: 'Recording status for tracking video production',
    example: 'ready_for_recording',
    enum: ['ready_for_recording', 'in_production', 'completed'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['ready_for_recording', 'in_production', 'completed'])
  recordingStatus?: string;

  @ApiPropertyOptional({
    description: 'Transcript ID if transcript is available',
    example: 'agent-default-overview',
  })
  @IsOptional()
  @IsString()
  transcriptId?: string;

  @ApiPropertyOptional({
    description: 'Tags for video categorization',
    example: ['agents', 'overview', 'workflow'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Agent default mappings to update',
    example: ['finance/metrics', 'marketing/marketing_swarm'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  agentDefaults?: string[];
}
