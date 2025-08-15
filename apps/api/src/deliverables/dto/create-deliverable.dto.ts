import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsObject,
  IsUUID,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DeliverableType {
  DOCUMENT = 'document',
  ANALYSIS = 'analysis',
  REPORT = 'report',
  PLAN = 'plan',
  REQUIREMENTS = 'requirements',
}

export enum DeliverableFormat {
  MARKDOWN = 'markdown',
  TEXT = 'text',
  JSON = 'json',
  HTML = 'html',
}

export class CreateDeliverableDto {
  @ApiProperty({ description: 'Title of the deliverable', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Content of the deliverable' })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiProperty({ enum: DeliverableType, description: 'Type of deliverable' })
  @IsEnum(DeliverableType)
  deliverable_type!: DeliverableType;

  @ApiProperty({
    enum: DeliverableFormat,
    description: 'Format of the content',
  })
  @IsEnum(DeliverableFormat)
  format!: DeliverableFormat;

  @ApiPropertyOptional({
    description: 'Optional description of the deliverable',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Conversation ID this deliverable belongs to',
  })
  @IsOptional()
  @IsUUID()
  conversation_id?: string;

  @ApiPropertyOptional({
    description: 'Task ID that created this deliverable',
  })
  @IsOptional()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({
    description: 'Name of the agent that created this deliverable',
  })
  @IsOptional()
  @IsString()
  created_by_agent?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Tags for organization and searching',
    type: [String],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  tags?: string[];
}
