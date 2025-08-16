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

export enum DeliverableVersionCreationType {
  AI_RESPONSE = 'ai_response',
  MANUAL_EDIT = 'manual_edit',
  AI_ENHANCEMENT = 'ai_enhancement',
  USER_REQUEST = 'user_request',
}

export class CreateDeliverableDto {
  @ApiProperty({ description: 'Title of the deliverable', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    description: 'Optional description of the deliverable',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: DeliverableType, description: 'Type of deliverable' })
  @IsOptional()
  @IsEnum(DeliverableType)
  type?: DeliverableType;

  @ApiProperty({
    description: 'Conversation ID this deliverable belongs to (required)',
  })
  @IsUUID()
  conversationId!: string;

  @ApiPropertyOptional({
    description: 'Project step ID this deliverable belongs to',
  })
  @IsOptional()
  @IsUUID()
  projectStepId?: string;

  // Initial version data (optional - can be added later)
  @ApiPropertyOptional({ description: 'Initial content for the first version' })
  @IsOptional()
  @IsString()
  initialContent?: string;

  @ApiPropertyOptional({
    enum: DeliverableFormat,
    description: 'Format of the initial content',
  })
  @IsOptional()
  @IsEnum(DeliverableFormat)
  initialFormat?: DeliverableFormat;

  @ApiPropertyOptional({
    enum: DeliverableVersionCreationType,
    description: 'How the initial version was created',
  })
  @IsOptional()
  @IsEnum(DeliverableVersionCreationType)
  initialCreationType?: DeliverableVersionCreationType;

  @ApiPropertyOptional({
    description: 'Task ID that created the initial version',
  })
  @IsOptional()
  @IsUUID()
  initialTaskId?: string;

  @ApiPropertyOptional({
    description: 'Initial version metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  initialMetadata?: Record<string, any>;
}
