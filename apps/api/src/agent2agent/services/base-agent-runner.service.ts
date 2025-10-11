import { Logger } from '@nestjs/common';
import { IAgentRunner } from '../interfaces/agent-runner.interface';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';

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

  constructor() {
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

        case AgentTaskMode.HUMAN_RESPONSE:
          // Human response mode is handled by gateway/router, not runners
          return TaskResponseDto.human('Manual confirmation required');

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
  protected abstract handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto>;

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
  protected abstract handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto>;

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
  protected abstract handleBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto>;

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
