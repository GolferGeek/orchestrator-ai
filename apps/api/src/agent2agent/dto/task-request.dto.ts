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
  ORCHESTRATE_CREATE = 'orchestrate_create',
  ORCHESTRATE_EXECUTE = 'orchestrate_execute',
  ORCHESTRATE_CONTINUE = 'orchestrate_continue',
  ORCHESTRATE_SAVE_RECIPE = 'orchestrate_save_recipe',
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
}
