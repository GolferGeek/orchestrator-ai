import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AgentTaskMode {
  CONVERSE = 'converse',
  PLAN = 'plan',
  BUILD = 'build',
  HUMAN_RESPONSE = 'human_response',
  ORCHESTRATE_CREATE = 'orchestrate_create',
  ORCHESTRATE_EXECUTE = 'orchestrate_execute',
  ORCHESTRATE_CONTINUE = 'orchestrate_continue',
  ORCHESTRATE_SAVE_RECIPE = 'orchestrate_save_recipe',
}

export class TaskMessageDto {
  @IsString()
  role!: string;

  @IsOptional()
  content?: any;
}

export class TaskRequestDto {
  @IsEnum(AgentTaskMode)
  mode!: AgentTaskMode;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsUUID()
  orchestrationId?: string;

  @IsOptional()
  @IsUUID()
  orchestrationRunId?: string;

  @IsOptional()
  @IsString()
  orchestrationSlug?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @IsOptional()
  @IsObject()
  promptParameters?: Record<string, any>;

  @IsOptional()
  @IsString()
  userMessage?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskMessageDto)
  messages?: TaskMessageDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
