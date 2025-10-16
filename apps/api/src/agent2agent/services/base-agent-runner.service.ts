import { Logger } from '@nestjs/common';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { LLMService } from '@llm/llm.service';
import { IAgentRunner } from '../interfaces/agent-runner.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { PlansService } from '../plans/services/plans.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';
import { DeliverablesService } from '../deliverables/deliverables.service';
import * as ConverseHandlers from './base-agent-runner/converse.handlers';
import * as PlanHandlers from './base-agent-runner/plan.handlers';
import * as BuildHandlers from './base-agent-runner/build.handlers';
import { handleError as sharedHandleError } from './base-agent-runner/shared.helpers';

/**
 * Base abstract class for all agent runners.
 *
 * This class provides common functionality for all agent types:
 * - Mode routing (CONVERSE, PLAN, BUILD)
 * - Capability validation
 * - Utility methods for request handling
 *
 * All concrete agent runners (Context, Tool, API, External, Function, Orchestrator)
 * should extend this class and implement the abstract mode handlers.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class ContextAgentRunnerService extends BaseAgentRunner {
 *   constructor(
 *     private readonly contextOptimization: ContextOptimizationService,
 *     private readonly llmService: LLMService
 *   ) {
 *     super();
 *   }
 *
 *   protected async handleConverse(...) {
 *     // Implementation
 *   }
 *
 *   protected async handlePlan(...) {
 *     // Implementation
 *   }
 *
 *   protected async handleBuild(...) {
 *     // Implementation
 *   }
 * }
 * ```
 */
export abstract class BaseAgentRunner implements IAgentRunner {
  protected readonly logger: Logger;

  constructor(
    protected readonly llmService: LLMService,
    protected readonly contextOptimization: ContextOptimizationService,
    protected readonly plansService: PlansService,
    protected readonly conversationsService: Agent2AgentConversationsService,
    protected readonly deliverablesService: DeliverablesService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Main execution method - routes to appropriate mode handler.
   *
   * This method:
   * 1. Validates the agent supports the requested mode
   * 2. Routes to handleConverse(), handlePlan(), or handleBuild()
   * 3. Handles errors gracefully
   *
   * @param definition - Agent runtime definition
   * @param request - Task request
   * @param organizationSlug - Organization context
   * @returns Task response
   */
  async execute(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    const mode = request.mode;

    // Validate mode is specified
    if (!mode) {
      this.logger.error('Task mode not specified in request');
      return TaskResponseDto.failure(
        AgentTaskMode.CONVERSE, // Default for error reporting
        'Task mode not specified',
      );
    }

    // Validate agent supports the requested mode
    if (!this.canExecuteMode(definition, mode)) {
      this.logger.warn(
        `Agent ${definition.slug} does not support ${mode} mode`,
      );
      return TaskResponseDto.failure(
        mode,
        `Agent does not support ${mode} mode`,
      );
    }

    // Route to appropriate mode handler
    try {
      switch (mode) {
        case AgentTaskMode.CONVERSE:
          return await this.handleConverse(
            definition,
            request,
            organizationSlug,
          );

        case AgentTaskMode.PLAN:
          return await this.handlePlan(definition, request, organizationSlug);

        case AgentTaskMode.BUILD:
          return await this.handleBuild(definition, request, organizationSlug);

        case AgentTaskMode.ORCHESTRATE:
          return await this.handleOrchestrate(definition, request, organizationSlug);

        default:
          this.logger.warn(`Unsupported mode: ${mode}`);
          return TaskResponseDto.failure(mode, 'Unsupported mode');
      }
    } catch (error) {
      this.logger.error(
        `Error executing agent ${definition.slug} in ${mode} mode: ${error instanceof Error ? error.message : String(error)}`,
      );
      return TaskResponseDto.failure(
        mode,
        `Agent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle CONVERSE mode - conversational interaction.
   *
   * Implementations should:
   * - Process user message
   * - Return conversational response
   * - Save to conversation history (if applicable)
   *
   * @param definition - Agent runtime definition
   * @param request - Task request with user message
   * @param organizationSlug - Organization context
   * @returns Task response with conversational content
   */
  protected async handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    try {
      return await ConverseHandlers.executeConverse(
        definition,
        request,
        organizationSlug,
        this.getConverseDependencies(),
      );
    } catch (error) {
      this.logger.error(
        `Failed to execute CONVERSE mode for agent ${definition.slug}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return sharedHandleError(AgentTaskMode.CONVERSE, error);
    }
  }

  /**
   * Handle PLAN mode - structured planning.
   *
   * Implementations should:
   * - Generate or manipulate plan based on action ('create', 'read', 'edit', etc.)
   * - Save plan via PlansService (for 'create' action)
   * - Return plan structure
   *
   * @param definition - Agent runtime definition
   * @param request - Task request with planning context
   * @param organizationSlug - Organization context
   * @returns Task response with plan data
   */
  protected async handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    const payload = (request.payload ?? {}) as { action?: string };
    const action = typeof payload.action === 'string' ? payload.action : 'create';

    try {
      switch (action) {
        case 'create':
          return await this.handlePlanCreate(
            definition,
            request,
            organizationSlug,
          );
        case 'read':
          return await this.handlePlanRead(
            definition,
            request,
            organizationSlug,
          );
        case 'list':
          return await this.handlePlanList(
            definition,
            request,
            organizationSlug,
          );
        case 'edit':
          return await this.handlePlanEdit(
            definition,
            request,
            organizationSlug,
          );
        case 'rerun':
          return await this.handlePlanRerun(
            definition,
            request,
            organizationSlug,
          );
        case 'set_current':
          return await this.handlePlanSetCurrent(
            definition,
            request,
            organizationSlug,
          );
        case 'delete_version':
          return await this.handlePlanDeleteVersion(
            definition,
            request,
            organizationSlug,
          );
        case 'merge_versions':
          return await this.handlePlanMergeVersions(
            definition,
            request,
            organizationSlug,
          );
        case 'copy_version':
          return await this.handlePlanCopyVersion(
            definition,
            request,
            organizationSlug,
          );
        case 'delete':
          return await this.handlePlanDelete(
            definition,
            request,
            organizationSlug,
          );
        default:
          this.logger.warn(
            `Unsupported PLAN action "${action}" for agent ${definition.slug}`,
          );
          return TaskResponseDto.failure(
            AgentTaskMode.PLAN,
            `Unsupported plan action: ${action}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Failed to execute PLAN action "${action}" for agent ${definition.slug}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Handle BUILD mode - deliverable creation.
   *
   * Implementations should:
   * - Generate or manipulate deliverable based on action ('create', 'read', 'edit', etc.)
   * - Save deliverable via DeliverablesService (for 'create' action)
   * - Return deliverable structure
   *
   * @param definition - Agent runtime definition
   * @param request - Task request with build context
   * @param organizationSlug - Organization context
   * @returns Task response with deliverable data
   */
  protected async handleBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    const payload = (request.payload ?? {}) as { action?: string };
    const action = typeof payload.action === 'string' ? payload.action : 'create';

    try {
      switch (action) {
        case 'create':
          return await this.executeBuild(definition, request, organizationSlug);
        case 'read':
          return await this.handleBuildRead(
            definition,
            request,
            organizationSlug,
          );
        case 'list':
          return await this.handleBuildList(
            definition,
            request,
            organizationSlug,
          );
        case 'edit':
          return await this.handleBuildEdit(
            definition,
            request,
            organizationSlug,
          );
        case 'rerun':
          return await this.handleBuildRerun(
            definition,
            request,
            organizationSlug,
          );
        case 'set_current':
          return await this.handleBuildSetCurrent(
            definition,
            request,
            organizationSlug,
          );
        case 'delete_version':
          return await this.handleBuildDeleteVersion(
            definition,
            request,
            organizationSlug,
          );
        case 'merge_versions':
          return await this.handleBuildMergeVersions(
            definition,
            request,
            organizationSlug,
          );
        case 'copy_version':
          return await this.handleBuildCopyVersion(
            definition,
            request,
            organizationSlug,
          );
        case 'delete':
          return await this.handleBuildDelete(
            definition,
            request,
            organizationSlug,
          );
        default:
          this.logger.warn(
            `Unsupported BUILD action "${action}" for agent ${definition.slug}`,
          );
          return TaskResponseDto.failure(
            AgentTaskMode.BUILD,
            `Unsupported build action: ${action}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Failed to execute BUILD action "${action}" for agent ${definition.slug}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Execute build - Abstract, each runner implements specific build logic.
   */
  protected abstract executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto>;

  /**
   * Handle orchestrate - Abstract, each runner implements specific orchestrate logic.
   * For most runners, this will return "not supported". Only orchestrator agent runner implements this.
   */
  protected async handleOrchestrate(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return TaskResponseDto.failure(
      AgentTaskMode.ORCHESTRATE,
      'Orchestrate mode not supported by this agent type',
    );
  }

  /**
   * Handles PLAN create action.
   */
  protected async handlePlanCreate(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return PlanHandlers.handlePlanCreate(
      definition,
      request,
      organizationSlug,
      this.getPlanHandlerDependencies(),
    );
  }

  /**
   * Handles PLAN read action.
   */
  protected async handlePlanRead(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return PlanHandlers.handlePlanRead(
      definition,
      request,
      organizationSlug,
      this.getPlanHandlerDependencies(),
    );
  }

  /**
   * Handles PLAN list action.
   */
  protected async handlePlanList(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return PlanHandlers.handlePlanList(
      definition,
      request,
      organizationSlug,
      this.getPlanHandlerDependencies(),
    );
  }

  /**
   * Handles PLAN edit action.
   */
  protected async handlePlanEdit(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return PlanHandlers.handlePlanEdit(
      definition,
      request,
      organizationSlug,
      this.getPlanHandlerDependencies(),
    );
  }

  /**
   * Handles PLAN rerun action.
   */
  protected async handlePlanRerun(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return PlanHandlers.handlePlanRerun(
      definition,
      request,
      organizationSlug,
      this.getPlanHandlerDependencies(),
    );
  }

  /**
   * Handles PLAN set_current action.
   */
  protected async handlePlanSetCurrent(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return PlanHandlers.handlePlanSetCurrent(
      definition,
      request,
      organizationSlug,
      this.getPlanHandlerDependencies(),
    );
  }

  /**
   * Handles PLAN delete_version action.
   */
  protected async handlePlanDeleteVersion(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return PlanHandlers.handlePlanDeleteVersion(
      definition,
      request,
      organizationSlug,
      this.getPlanHandlerDependencies(),
    );
  }

  /**
   * Handles PLAN merge_versions action.
   */
  protected async handlePlanMergeVersions(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return PlanHandlers.handlePlanMergeVersions(
      definition,
      request,
      organizationSlug,
      this.getPlanHandlerDependencies(),
    );
  }

  /**
   * Handles PLAN copy_version action.
   */
  protected async handlePlanCopyVersion(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return PlanHandlers.handlePlanCopyVersion(
      definition,
      request,
      organizationSlug,
      this.getPlanHandlerDependencies(),
    );
  }

  /**
   * Handles PLAN delete action.
   */
  protected async handlePlanDelete(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return PlanHandlers.handlePlanDelete(
      definition,
      request,
      organizationSlug,
      this.getPlanHandlerDependencies(),
    );
  }

  /**
   * Handles BUILD read action.
   */
  protected async handleBuildRead(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return BuildHandlers.handleBuildRead(
      definition,
      request,
      organizationSlug,
      this.getBuildHandlerDependencies(),
    );
  }

  /**
   * Handles BUILD list action.
   */
  protected async handleBuildList(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return BuildHandlers.handleBuildList(
      definition,
      request,
      organizationSlug,
      this.getBuildHandlerDependencies(),
    );
  }

  /**
   * Handles BUILD edit action.
   */
  protected async handleBuildEdit(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return BuildHandlers.handleBuildEdit(
      definition,
      request,
      organizationSlug,
      this.getBuildHandlerDependencies(),
    );
  }

  /**
   * Handles BUILD rerun action.
   */
  protected async handleBuildRerun(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return BuildHandlers.handleBuildRerun(
      definition,
      request,
      organizationSlug,
      this.getBuildHandlerDependencies(),
      this.executeBuild.bind(this),
    );
  }

  /**
   * Handles BUILD set_current action.
   */
  protected async handleBuildSetCurrent(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return BuildHandlers.handleBuildSetCurrent(
      definition,
      request,
      organizationSlug,
      this.getBuildHandlerDependencies(),
    );
  }

  /**
   * Handles BUILD delete_version action.
   */
  protected async handleBuildDeleteVersion(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return BuildHandlers.handleBuildDeleteVersion(
      definition,
      request,
      organizationSlug,
      this.getBuildHandlerDependencies(),
    );
  }

  /**
   * Handles BUILD merge_versions action.
   */
  protected async handleBuildMergeVersions(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return BuildHandlers.handleBuildMergeVersions(
      definition,
      request,
      organizationSlug,
      this.getBuildHandlerDependencies(),
      this.executeBuild.bind(this),
    );
  }

  /**
   * Handles BUILD copy_version action.
   */
  protected async handleBuildCopyVersion(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return BuildHandlers.handleBuildCopyVersion(
      definition,
      request,
      organizationSlug,
      this.getBuildHandlerDependencies(),
    );
  }

  /**
   * Handles BUILD delete action.
   */
  protected async handleBuildDelete(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    return BuildHandlers.handleBuildDelete(
      definition,
      request,
      organizationSlug,
      this.getBuildHandlerDependencies(),
    );
  }

  /**
   * Check if agent supports the given mode.
   *
   * @param definition - Agent runtime definition
   * @param mode - Task mode to check
   * @returns True if agent supports the mode
   */
  protected canExecuteMode(
    definition: AgentRuntimeDefinition,
    mode: AgentTaskMode,
  ): boolean {
    const exec = definition.execution;

    switch (mode) {
      case AgentTaskMode.CONVERSE:
        return exec.canConverse;
      case AgentTaskMode.PLAN:
        return exec.canPlan;
      case AgentTaskMode.BUILD:
        return exec.canBuild;
      case AgentTaskMode.HUMAN_RESPONSE:
        // Human response is always allowed (gateway handles it)
        return true;
      default:
        return false;
    }
  }

  private getConverseDependencies(): ConverseHandlers.ConverseHandlerDependencies {
    return {
      llmService: this.llmService,
      conversationsService: this.conversationsService,
    };
  }

  private getPlanHandlerDependencies(): PlanHandlers.PlanHandlerDependencies {
    return {
      llmService: this.llmService,
      plansService: this.plansService,
      conversationsService: this.conversationsService,
    };
  }

  private getBuildHandlerDependencies(): BuildHandlers.BuildHandlerDependencies {
    return {
      deliverablesService: this.deliverablesService,
      plansService: this.plansService,
      llmService: this.llmService,
      conversationsService: this.conversationsService,
    };
  }

  /**
   * Extract userId from request (checks multiple locations).
   *
   * @param request - Task request
   * @returns userId if found, null otherwise
   */
  protected resolveUserId(request: TaskRequestDto): string | null {
    // Check top-level metadata
    const fromMetadata =
      request.metadata?.userId || request.metadata?.createdBy;
    if (fromMetadata) {
      return String(fromMetadata);
    }

    // Check payload metadata
    const fromPayload =
      request.payload?.metadata?.userId || request.payload?.metadata?.createdBy;
    if (fromPayload) {
      return String(fromPayload);
    }

    return null;
  }

  /**
   * Build metadata object from request.
   *
   * Merges metadata from multiple sources in priority order:
   * 1. Additional metadata (highest priority)
   * 2. Request metadata
   * 3. Payload metadata (lowest priority)
   *
   * @param request - Task request
   * @param additional - Additional metadata to merge
   * @returns Merged metadata object
   */
  protected buildMetadata(
    request: TaskRequestDto,
    additional?: Record<string, any>,
  ): Record<string, any> {
    return {
      ...(request.payload?.metadata ?? {}),
      ...(request.metadata ?? {}),
      ...(additional ?? {}),
    };
  }

  /**
   * Resolve conversationId from request.
   *
   * @param request - Task request
   * @returns conversationId if found, null otherwise
   */
  protected resolveConversationId(request: TaskRequestDto): string | null {
    return request.conversationId || null;
  }

  /**
   * Resolve taskId from request (checks metadata and payload).
   *
   * @param request - Task request
   * @returns taskId if found, null otherwise
   */
  protected resolveTaskId(request: TaskRequestDto): string | null {
    return request.metadata?.taskId || (request.payload as any)?.taskId || null;
  }

  /**
   * Resolve deliverableId from request payload or metadata.
   *
   * @param request - Task request
   * @returns deliverableId if supplied, null otherwise
   */
  protected resolveDeliverableIdFromRequest(
    request: TaskRequestDto,
  ): string | null {
    const payload = (request.payload ?? {}) as Record<string, any>;

    const candidates: Array<unknown> = [
      payload?.deliverableId,
      payload?.deliverable_id,
      payload?.deliverable?.id,
      payload?.metadata?.deliverableId,
      payload?.metadata?.deliverable_id,
      request.metadata?.deliverableId,
      request.metadata?.deliverable_id,
    ];

    const match = candidates.find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );

    return match ? match.trim() : null;
  }

  /**
   * Check if request wants streaming response.
   *
   * @param request - Task request
   * @returns True if streaming is requested
   */
  protected shouldStream(request: TaskRequestDto): boolean {
    return Boolean(
      request.payload?.options?.stream || request.metadata?.stream,
    );
  }

  /**
   * Handle orchestration - call sub-agents.
   *
   * This is a basic implementation that allows any agent to orchestrate
   * calls to other agents. More sophisticated orchestration (with pause/
   * resume, human checkpoints, etc.) will be implemented in future phases.
   *
   * @param subAgents - Array of sub-agent configurations to call
   * @param request - Parent request context
   * @param organizationSlug - Organization context
   * @returns Array of sub-agent responses
   *
   * @example
   * ```typescript
   * const subAgents = [
   *   { slug: 'context-agent-1', mode: AgentTaskMode.BUILD, userMessage: 'Analyze data' },
   *   { slug: 'tool-agent-1', mode: AgentTaskMode.BUILD, userMessage: 'Execute tools' }
   * ];
   * const results = await this.handleOrchestration(subAgents, request, organizationSlug);
   * ```
   */
  protected async handleOrchestration(
    subAgents: Array<{
      slug: string;
      mode: AgentTaskMode;
      userMessage: string;
      payload?: any;
    }>,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto[]> {
    const results: TaskResponseDto[] = [];

    this.logger.log(
      `Orchestrating ${subAgents.length} sub-agent(s) for conversation ${request.conversationId}`,
    );

    for (const subAgent of subAgents) {
      try {
        // Build sub-agent request
        const subRequest: TaskRequestDto = {
          mode: subAgent.mode,
          conversationId: request.conversationId,
          sessionId: request.sessionId,
          userMessage: subAgent.userMessage,
          payload: subAgent.payload || {},
          metadata: {
            ...request.metadata,
            parentRequest: true,
            orchestratedBy: request.payload?.agentSlug || 'unknown',
          },
        };

        // NOTE: In a full implementation, this would call the AgentExecutionGateway
        // or AgentModeRouterService to execute the sub-agent. For now, this is
        // a placeholder that returns a success response.
        // TODO: Implement actual sub-agent calling via dependency injection

        this.logger.log(
          `Calling sub-agent ${subAgent.slug} in ${subAgent.mode} mode`,
        );

        // Placeholder response - will be replaced with actual sub-agent call
        const response = TaskResponseDto.success(subAgent.mode, {
          content: {
            message: `Placeholder: Sub-agent ${subAgent.slug} would be called here`,
          },
          metadata: {
            subAgentSlug: subAgent.slug,
            orchestrated: true,
          },
        });

        results.push(response);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to orchestrate sub-agent ${subAgent.slug}: ${errorMessage}`,
        );

        results.push(
          TaskResponseDto.failure(
            subAgent.mode,
            `Sub-agent execution failed: ${errorMessage}`,
          ),
        );
      }
    }

    return results;
  }
}
