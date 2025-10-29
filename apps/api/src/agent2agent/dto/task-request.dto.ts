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
import {
  AgentTaskMode,
  TaskMessage,
  TaskRequestParams,
} from '@orchestrator-ai/transport-types';

// Re-export shared types
export { AgentTaskMode, TaskMessage, TaskRequestParams };

// Extended mode enum for internal orchestration modes
export enum InternalAgentTaskMode {
  HUMAN_RESPONSE = 'human_response',
  ORCHESTRATE_CREATE = 'orchestrate_create',
  ORCHESTRATE_EXECUTE = 'orchestrate_execute',
  ORCHESTRATE_CONTINUE = 'orchestrate_continue',
  ORCHESTRATE_SAVE_RECIPE = 'orchestrate_save_recipe',
  ORCHESTRATOR_PLAN_CREATE = 'orchestrator_plan_create',
  ORCHESTRATOR_PLAN_UPDATE = 'orchestrator_plan_update',
  ORCHESTRATOR_PLAN_REVIEW = 'orchestrator_plan_review',
  ORCHESTRATOR_PLAN_APPROVE = 'orchestrator_plan_approve',
  ORCHESTRATOR_PLAN_REJECT = 'orchestrator_plan_reject',
  ORCHESTRATOR_PLAN_ARCHIVE = 'orchestrator_plan_archive',
  ORCHESTRATOR_RUN_START = 'orchestrator_run_start',
  ORCHESTRATOR_RUN_CONTINUE = 'orchestrator_run_continue',
  ORCHESTRATOR_RUN_PAUSE = 'orchestrator_run_pause',
  ORCHESTRATOR_RUN_RESUME = 'orchestrator_run_resume',
  ORCHESTRATOR_RUN_HUMAN_RESPONSE = 'orchestrator_run_human_response',
  ORCHESTRATOR_RUN_ROLLBACK_STEP = 'orchestrator_run_rollback_step',
  ORCHESTRATOR_RUN_CANCEL = 'orchestrator_run_cancel',
  ORCHESTRATOR_RUN_EVALUATE = 'orchestrator_run_evaluate',
  ORCHESTRATOR_RECIPE_SAVE = 'orchestrator_recipe_save',
  ORCHESTRATOR_RECIPE_UPDATE = 'orchestrator_recipe_update',
  ORCHESTRATOR_RECIPE_VALIDATE = 'orchestrator_recipe_validate',
  ORCHESTRATOR_RECIPE_DELETE = 'orchestrator_recipe_delete',
  ORCHESTRATOR_RECIPE_LOAD = 'orchestrator_recipe_load',
  ORCHESTRATOR_RECIPE_LIST = 'orchestrator_recipe_list',
}

// Combined mode type for internal use
export type CombinedAgentTaskMode = AgentTaskMode | InternalAgentTaskMode;

export class TaskMessageDto {
  @IsString()
  role!: string;

  @IsOptional()
  content?: unknown;
}

export class TaskRequestDto {
  /**
   * Agent task mode - Optional in raw requests but guaranteed to be set after normalization
   * The controller ensures this is always set (defaults to CONVERSE if not provided)
   */
  @IsOptional()
  @IsEnum(AgentTaskMode)
  mode?: AgentTaskMode;

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
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  promptParameters?: Record<string, unknown>;

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
  metadata?: Record<string, unknown>;
}

/**
 * Task request after normalization (mode is guaranteed to be set)
 */
export type NormalizedTaskRequestDto = TaskRequestDto & { mode: AgentTaskMode };
