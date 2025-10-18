import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { AgentTaskMode, TaskRequestDto } from '../../dto/task-request.dto';
import { TaskResponseDto } from '../../dto/task-response.dto';
import type {
  OrchestrateModePayload,
  OrchestrateResponseMetadata,
} from '@orchestrator-ai/transport-types/modes/orchestrate.types';

/**
 * Orchestrate Handler Dependencies
 * Services required by orchestrate action handlers
 */
export interface OrchestrateHandlerDependencies {
  /**
   * Placeholder property to satisfy lint rules until orchestrator-specific
   * dependencies are wired through.
   */
  readonly placeholder?: undefined;
}

/**
 * Runner Context Interface
 * Defines methods available on the runner instance
 */
export interface RunnerContext {
  handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto>;
  executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto>;
  checkpointService?: {
    resolveCheckpoint(params: {
      approvalId: string;
      decision: string;
      actorId: string | null;
      notes: string | null;
      modifications: Record<string, unknown> | null;
    }): Promise<{ run: { id: string; status: string } }>;
  };
}

const EMPTY_USAGE = {
  inputTokens: 0 as number,
  outputTokens: 0 as number,
  totalTokens: 0 as number,
  cost: 0 as number,
};

const EMPTY_ORCHESTRATE_METADATA: OrchestrateResponseMetadata = {
  provider: '',
  model: '',
  usage: EMPTY_USAGE,
};

/**
 * Main orchestrate action router
 * Routes orchestrate requests based on action field in payload
 */
export async function handleOrchestrateAction(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  _services: OrchestrateHandlerDependencies,
  // Pass runner instance for access to existing methods
  runnerContext: RunnerContext,
): Promise<TaskResponseDto> {
  const payload = (request.payload ?? {}) as unknown as OrchestrateModePayload;
  const action = payload.action;

  if (!action) {
    return TaskResponseDto.failure(
      AgentTaskMode.ORCHESTRATE,
      'Action field is required in orchestrate payload',
    );
  }

  try {
    switch (action) {
      // Core operations
      case 'create':
        return await handleOrchestrateCreate(
          definition,
          request,
          organizationSlug,
          runnerContext,
        );
      case 'execute':
        return await handleOrchestrateExecute(
          definition,
          request,
          organizationSlug,
          runnerContext,
        );
      case 'continue':
        return await handleOrchestrateContinue(
          definition,
          request,
          organizationSlug,
          runnerContext,
        );
      case 'save_recipe':
        return handleOrchestrateSaveRecipe(
          definition,
          request,
          organizationSlug,
          runnerContext,
        );

      // Plan management actions
      case 'plan_create':
      case 'plan_update':
        return await handleOrchestratePlanManagement(
          definition,
          request,
          organizationSlug,
          runnerContext,
          action,
        );
      case 'plan_review':
      case 'plan_approve':
      case 'plan_reject':
      case 'plan_archive':
        return TaskResponseDto.failure(
          AgentTaskMode.ORCHESTRATE,
          `Action '${action}' not yet implemented`,
        );

      // Run management actions
      case 'run_start':
        return await handleOrchestrateRunStart(
          definition,
          request,
          organizationSlug,
          runnerContext,
        );
      case 'run_continue':
      case 'run_pause':
      case 'run_resume':
      case 'run_cancel':
      case 'run_evaluate':
      case 'run_rollback_step':
        return TaskResponseDto.failure(
          AgentTaskMode.ORCHESTRATE,
          `Action '${action}' not yet implemented`,
        );
      case 'run_human_response':
        return await handleRunHumanResponse(
          definition,
          request,
          organizationSlug,
          runnerContext,
        );

      // Recipe management actions
      case 'recipe_save':
      case 'recipe_update':
      case 'recipe_validate':
      case 'recipe_delete':
      case 'recipe_load':
      case 'recipe_list':
        return TaskResponseDto.failure(
          AgentTaskMode.ORCHESTRATE,
          `Action '${action}' not yet implemented`,
        );

      default:
        return TaskResponseDto.failure(
          AgentTaskMode.ORCHESTRATE,
          `Unknown action: ${String(action)}`,
        );
    }
  } catch (error) {
    return TaskResponseDto.failure(
      AgentTaskMode.ORCHESTRATE,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

/**
 * Handle orchestrate 'create' action
 * Maps to existing handlePlan() logic
 */
function handleOrchestrateCreate(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  runnerContext: RunnerContext,
): Promise<TaskResponseDto> {
  // Delegate to existing handlePlan() method
  return runnerContext.handlePlan(definition, request, organizationSlug);
}

/**
 * Handle orchestrate 'execute' action
 * Maps to existing executeBuild() logic
 */
function handleOrchestrateExecute(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  runnerContext: RunnerContext,
): Promise<TaskResponseDto> {
  // Delegate to existing executeBuild() method
  return runnerContext.executeBuild(definition, request, organizationSlug);
}

/**
 * Handle orchestrate 'continue' action
 * Continues an existing orchestration run
 */
function handleOrchestrateContinue(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  runnerContext: RunnerContext,
): Promise<TaskResponseDto> {
  // For now, delegate to executeBuild which handles continuation
  return runnerContext.executeBuild(definition, request, organizationSlug);
}

/**
 * Handle orchestrate 'save_recipe' action
 * Saves an orchestration as a reusable recipe
 */
function handleOrchestrateSaveRecipe(
  _definition: AgentRuntimeDefinition,
  _request: TaskRequestDto,
  _organizationSlug: string | null,
  _runnerContext: RunnerContext,
): TaskResponseDto {
  return TaskResponseDto.failure(
    AgentTaskMode.ORCHESTRATE,
    'save_recipe action not yet implemented',
  );
}

/**
 * Handle orchestrate plan management actions
 */
function handleOrchestratePlanManagement(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  runnerContext: RunnerContext,
  _action: string,
): Promise<TaskResponseDto> {
  // Delegate to handlePlan for plan creation/update
  return runnerContext.handlePlan(definition, request, organizationSlug);
}

/**
 * Handle orchestrate 'run_start' action
 * Starts an orchestration run
 */
function handleOrchestrateRunStart(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  runnerContext: RunnerContext,
): Promise<TaskResponseDto> {
  // Delegate to executeBuild which handles run execution
  return runnerContext.executeBuild(definition, request, organizationSlug);
}

/**
 * Handle orchestrate 'run_human_response' action
 * Responds to a human checkpoint in an orchestration run
 */
async function handleRunHumanResponse(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  runnerContext: RunnerContext,
): Promise<TaskResponseDto> {
  const payload = (request.payload ?? {}) as unknown as OrchestrateModePayload;
  const { approvalId, decision, notes, modifications } =
    payload as unknown as Record<string, unknown>;

  if (!approvalId) {
    return TaskResponseDto.failure(
      AgentTaskMode.ORCHESTRATE,
      'approvalId is required for run_human_response action',
    );
  }

  if (
    !decision ||
    !['continue', 'retry', 'abort'].includes(decision as string)
  ) {
    return TaskResponseDto.failure(
      AgentTaskMode.ORCHESTRATE,
      'decision must be one of: continue, retry, abort',
    );
  }

  // Get the checkpoint service from runner context
  const checkpointService = runnerContext.checkpointService;
  if (!checkpointService) {
    return TaskResponseDto.failure(
      AgentTaskMode.ORCHESTRATE,
      'Checkpoint service not available',
    );
  }

  try {
    // Resolve the checkpoint
    const result = await checkpointService.resolveCheckpoint({
      approvalId: approvalId as string,
      decision: decision as string,
      actorId: (request.metadata as Record<string, unknown> | undefined)?.userId as string | null ?? null,
      notes: (notes as string | null) ?? null,
      modifications: (modifications as Record<string, unknown> | null) ?? null,
    });

    // If decision is 'continue' or 'retry', resume the orchestration run
    if (decision === 'continue' || decision === 'retry') {
      // Continue execution by delegating to executeBuild
      const continueRequest = {
        ...request,
        payload: {
          action: 'continue',
          runId: result.run.id,
        },
      };
      return runnerContext.executeBuild(
        definition,
        continueRequest,
        organizationSlug,
      );
    }

    // For 'abort', return success response with run status
    return TaskResponseDto.success(AgentTaskMode.ORCHESTRATE, {
      content: {
        action: 'run_human_response',
        decision,
        runId: result.run.id,
        status: result.run.status,
        message: 'Orchestration checkpoint resolved',
      },
      metadata: EMPTY_ORCHESTRATE_METADATA,
    });
  } catch (error) {
    return TaskResponseDto.failure(
      AgentTaskMode.ORCHESTRATE,
      error instanceof Error ? error.message : 'Failed to resolve checkpoint',
    );
  }
}
