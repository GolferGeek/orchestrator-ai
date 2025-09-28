import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum AgentTaskMode {
  CONVERSE = 'converse',
  PLAN = 'plan',
  BUILD = 'build',
  HUMAN_RESPONSE = 'human_response',
}

export class TaskRequestDto {
  @IsEnum(AgentTaskMode)
  mode!: AgentTaskMode;

  @IsUUID()
  conversationId!: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsUUID()
  orchestrationId?: string;

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
}
