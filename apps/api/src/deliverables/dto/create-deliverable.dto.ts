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
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
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
  CONVERSATION_TASK = 'conversation_task',
  CONVERSATION_MERGE = 'conversation_merge',
}

// Custom validator to ensure at least one of conversationId or projectStepId is provided
function AtLeastOneContext(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'atLeastOneContext',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as CreateDeliverableDto;
          return !!(obj.conversationId || obj.projectStepId);
        },
        defaultMessage(args: ValidationArguments) {
          return 'Either conversationId or projectStepId must be provided';
        },
      },
    });
  };
}

export class CreateDeliverableDto {
  @ApiProperty({ description: 'Title of the deliverable', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ enum: DeliverableType, description: 'Type of deliverable' })
  @IsOptional()
  @IsEnum(DeliverableType)
  type?: DeliverableType;

  @ApiPropertyOptional({
    description: 'Conversation ID this deliverable belongs to (optional - use when deliverable is part of a conversation)',
  })
  @IsOptional()
  @IsUUID()
  @AtLeastOneContext({ message: 'Either conversationId or projectStepId must be provided' })
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Project step ID this deliverable belongs to',
  })
  @IsOptional()
  @IsUUID()
  projectStepId?: string;

  @ApiPropertyOptional({
    description: 'Agent that should handle editing this deliverable (inherited from creating conversation)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  agentName?: string;

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
