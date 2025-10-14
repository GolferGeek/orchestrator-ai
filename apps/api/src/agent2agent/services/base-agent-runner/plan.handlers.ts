import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { LLMService } from '@llm/llm.service';
import { Agent2AgentConversationsService } from '../agent-conversations.service';
import { PlansService } from '../../plans/services/plans.service';
import { TaskRequestDto } from '../../dto/task-request.dto';
import { TaskResponseDto } from '../../dto/task-response.dto';

export interface PlanHandlerDependencies {
  llmService: LLMService;
  plansService: PlansService;
  conversationsService: Agent2AgentConversationsService;
}

/**
 * Handles PLAN create action by generating a new plan.
 * @param definition - Agent definition driving plan generation
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response containing plan data
 */
export async function handlePlanCreate(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('handlePlanCreate not implemented');
}

/**
 * Handles PLAN read action by returning a specific plan.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response containing the requested plan
 */
export async function handlePlanRead(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('handlePlanRead not implemented');
}

/**
 * Handles PLAN list action by returning plan history.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response containing plan list data
 */
export async function handlePlanList(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('handlePlanList not implemented');
}

/**
 * Handles PLAN edit action by creating a new plan version.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response describing the updated plan
 */
export async function handlePlanEdit(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('handlePlanEdit not implemented');
}

/**
 * Handles PLAN rerun action by regenerating a plan.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response containing regenerated plan data
 */
export async function handlePlanRerun(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('handlePlanRerun not implemented');
}

/**
 * Handles PLAN set_current action by updating the active plan version.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response confirming the update
 */
export async function handlePlanSetCurrent(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('handlePlanSetCurrent not implemented');
}

/**
 * Handles PLAN delete_version action by removing a specific plan version.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response confirming version deletion
 */
export async function handlePlanDeleteVersion(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('handlePlanDeleteVersion not implemented');
}

/**
 * Handles PLAN merge_versions action by combining multiple plan versions.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response describing the merged plan
 */
export async function handlePlanMergeVersions(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('handlePlanMergeVersions not implemented');
}

/**
 * Handles PLAN copy_version action by duplicating a plan version.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response containing copied plan data
 */
export async function handlePlanCopyVersion(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('handlePlanCopyVersion not implemented');
}

/**
 * Handles PLAN delete action by removing an entire plan.
 * @param definition - Agent definition context
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Supporting service dependencies
 * @returns A task response confirming plan deletion
 */
export async function handlePlanDelete(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('handlePlanDelete not implemented');
}

/**
 * Builds the prompt template used for PLAN mode LLM calls.
 * @param definition - Agent definition containing plan templates
 * @param context - Contextual data available for planning
 * @returns A formatted prompt string for planning
 */
export function buildPlanningPrompt(
  definition: AgentRuntimeDefinition,
  context: unknown,
): string {
  void definition;
  void context;
  throw new Error('buildPlanningPrompt not implemented');
}

/**
 * Validates plan output structure against the agent definition.
 * @param planContent - Generated plan payload
 * @param planStructure - Expected structure definition
 */
export function validatePlanStructure(
  planContent: unknown,
  planStructure: unknown,
): void {
  void planContent;
  void planStructure;
  throw new Error('validatePlanStructure not implemented');
}

/**
 * Extracts metadata from a plan payload for downstream consumers.
 * @param planContent - Generated plan payload
 * @returns Metadata describing the plan
 */
export function extractPlanMetadata(planContent: unknown): Record<string, unknown> {
  void planContent;
  throw new Error('extractPlanMetadata not implemented');
}
