import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { JsonObject } from '@orchestrator-ai/transport-types';
import { AgentRecord } from '@agent-platform/interfaces/agent.interface';
import { ConversationPlanRecord } from '@agent-platform/interfaces/conversation-plan-record.interface';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentModeRouterService } from './agent-mode-router.service';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { PlanEngineService } from '@agent-platform/services/plan-engine.service';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeExecutionService } from '@agent-platform/services/agent-runtime-execution.service';
import { AgentRuntimeAgentMetadata } from '@agent-platform/interfaces/agent-runtime-agent-metadata.interface';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { AgentRuntimeStreamService } from '@agent-platform/services/agent-runtime-stream.service';
import { HumanApprovalsRepository } from '@agent-platform/repositories/human-approvals.repository';

@Injectable()
export class AgentExecutionGateway {
  private readonly logger = new Logger(AgentExecutionGateway.name);

  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly runtimeDefinitions: AgentRuntimeDefinitionService,
    private readonly runtimeExecution: AgentRuntimeExecutionService,
    private readonly routingPolicy: RoutingPolicyAdapterService,
    private readonly modeRouter: AgentModeRouterService,
    private readonly planEngine: PlanEngineService,
    private readonly streamService: AgentRuntimeStreamService,
    private readonly approvals: HumanApprovalsRepository,
    @Inject(HttpService) private readonly httpService?: HttpService,
  ) {}

  async execute(
    organizationSlug: string | null,
    agentSlug: string,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const agent = await this.agentRegistry.getAgent(
      organizationSlug,
      agentSlug,
    );

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const definition = this.runtimeDefinitions.buildDefinition(agent);
    const agentMetadata = this.runtimeExecution.getAgentMetadataFromDefinition(
      definition,
      organizationSlug,
    );

    // Observability: Agent execution started
    this.emitAgentLifecycleEvent('agent.started', 'Agent execution started', {
      definition,
      request,
      organizationSlug,
    });

    const assessment = await this.routingPolicy.evaluate(request, agent);
    const routingMetadata = {
      ...(assessment.metadata ?? {}),
      agentMetadata,
    };

    if (assessment.showstopper) {
      return TaskResponseDto.human(
        assessment.humanMessage ?? 'Routing policy requires human review.',
        'routing_showstopper',
      );
    }

    // Enforce execution capabilities before routing
    const unsupported = this.checkUnsupportedMode(definition, request.mode!);
    if (unsupported) {
      this.emitAgentLifecycleEvent('agent.failed', 'Unsupported mode', {
        definition,
        request,
        organizationSlug,
      });
      return unsupported;
    }

    try {
      let response: TaskResponseDto;

      switch (request.mode!) {
        case AgentTaskMode.CONVERSE:
          response = await this.modeRouter.execute({
            organizationSlug,
            agentSlug: agent.slug,
            agent,
            definition,
            request,
            routingMetadata,
          });
          break;
        case AgentTaskMode.PLAN:
          // Delegate to mode router (uses new plans table via PlansService)
          response = await this.modeRouter.execute({
            organizationSlug,
            agentSlug: agent.slug,
            agent,
            definition,
            request,
            routingMetadata,
          });
          break;
        case AgentTaskMode.BUILD:
          // Delegate to mode router (uses new deliverables table via DeliverablesService)
          response = await this.modeRouter.execute({
            organizationSlug,
            agentSlug: agent.slug,
            agent,
            definition,
            request,
            routingMetadata,
          });
          break;
        default:
          response = TaskResponseDto.failure(request.mode!, 'Unsupported mode');
      }

      // Emit completion or failure based on response
      if (response.success) {
        this.emitAgentLifecycleEvent('agent.completed', 'Agent execution completed', {
          definition,
          request,
          organizationSlug,
        });
      } else {
        this.emitAgentLifecycleEvent('agent.failed', 'Agent execution failed', {
          definition,
          request,
          organizationSlug,
        });
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitAgentLifecycleEvent('agent.failed', `Agent execution error: ${errorMessage}`, {
        definition,
        request,
        organizationSlug,
      });
      throw error;
    }
  }

  private checkUnsupportedMode(
    definition: AgentRuntimeDefinition,
    mode: AgentTaskMode,
  ): TaskResponseDto | null {
    const exec = definition.execution;
    switch (mode) {
      case AgentTaskMode.CONVERSE:
        return exec.canConverse
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.PLAN:
        return exec.canPlan
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.BUILD:
        return exec.canBuild
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      default:
        return null;
    }
  }

  private async handlePlan(
    organizationSlug: string | null,
    agent: AgentRecord,
    definition: AgentRuntimeDefinition,
    agentMetadata: AgentRuntimeAgentMetadata,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const conversationId = request.conversationId;
    if (!conversationId) {
      throw new BadRequestException(
        'conversationId is required for plan generation',
      );
    }

    const fallbackPlan: JsonObject = {
      summary: request.userMessage ?? 'Plan draft not provided',
    };
    const draftPlan = this.toJsonObject(
      request.payload?.planDraft,
      fallbackPlan,
    );

    const metadata = this.runtimeExecution.collectRequestMetadata(request);
    const createdByValue = metadata.createdBy;
    const createdBy =
      typeof createdByValue === 'string' ? createdByValue : null;

    const summaryValue = request.payload?.summary;
    const summary = typeof summaryValue === 'string' ? summaryValue : null;

    const planRecord = await this.planEngine.generateDraft({
      conversationId,
      organizationSlug,
      agentSlug: agent.slug,
      summary,
      draftPlan,
      createdBy,
      agentMetadata,
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: planRecord,
      metadata: {
        agentId: definition.id,
        agentSlug: definition.slug,
        organizationSlug,
      },
    });
  }

  private async handleBuild(
    organizationSlug: string | null,
    agent: AgentRecord,
    definition: AgentRuntimeDefinition,
    agentMetadata: AgentRuntimeAgentMetadata,
    request: TaskRequestDto,
    routingMetadata?: Record<string, unknown>,
  ): Promise<TaskResponseDto> {
    return this.modeRouter.execute({
      organizationSlug,
      agentSlug: agent.slug,
      agent,
      definition,
      request,
      routingMetadata,
    });
  }

  // REMOVED: startOrchestrationFromRequest method (292 lines)
  // Orchestration logic is no longer needed - agent runner handles delegation

  // REMOVED: validatePromptInputs method (orchestration-specific)

  private async resolvePlanForExecution(
    organizationSlug: string | null,
    agent: AgentRecord,
    request: TaskRequestDto,
  ): Promise<ConversationPlanRecord> {
    const planId = request.planId;
    if (!planId) {
      throw new BadRequestException('planId is required for plan execution');
    }

    const plan = await this.planEngine.getPlan(planId);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const normalizedOrg = organizationSlug ?? null;
    if ((plan.organization_slug ?? null) !== normalizedOrg) {
      throw new BadRequestException('Plan belongs to a different organization');
    }

    if (plan.agent_slug !== agent.slug) {
      throw new BadRequestException('Plan is not associated with this agent');
    }

    if (plan.conversation_id !== request.conversationId) {
      throw new BadRequestException('Plan is tied to a different conversation');
    }

    return plan;
  }

  private attachAgentMetadata(
    draft: Record<string, unknown>,
    definition: AgentRuntimeDefinition,
  ): Record<string, unknown> {
    if (!draft || typeof draft !== 'object') {
      return draft;
    }

    const enriched = { ...draft };
    const draftWithMeta = enriched as Record<string, unknown> & {
      _meta?: Record<string, unknown>;
    };
    const existingMeta = draftWithMeta._meta ?? {};
    draftWithMeta._meta = {
      ...existingMeta,
      agent: {
        id: definition.id,
        slug: definition.slug,
        displayName: definition.displayName,
        agentType: definition.agentType,
        modeProfile: definition.modeProfile,
        organizationSlug: definition.organizationSlug,
      },
    };

    return enriched;
  }

  private collectMetadata(request: TaskRequestDto): Record<string, unknown> {
    return {
      ...(request.payload?.metadata ?? {}),
      ...(request.metadata ?? {}),
    };
  }

  // REMOVED: triggerRunProcessing method (orchestration-specific)

  private maybeStartStream(
    request: TaskRequestDto,
    organizationSlug: string | null,
    agent: AgentRecord,
    mode: AgentTaskMode,
  ) {
    const payloadOptions = request.payload?.options as
      | Record<string, unknown>
      | undefined;
    const metadata = request.metadata;
    const payloadMetadata = request.payload?.metadata as
      | Record<string, unknown>
      | undefined;

    const wantsStream = Boolean(payloadOptions?.stream || metadata?.stream);

    if (!wantsStream) {
      return null;
    }

    const streamIdValue = metadata?.streamId || payloadMetadata?.streamId;
    const providedStreamId =
      typeof streamIdValue === 'string' ? streamIdValue : undefined;

    return this.streamService.start(
      {
        conversationId: request.conversationId,
        sessionId: request.sessionId,
        organizationSlug,
        agentSlug: agent.slug,
        mode,
      },
      providedStreamId,
    );
  }

  private publishStreamChunk(
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
    chunk: { type: 'partial' | 'final'; content: string },
  ) {
    if (!session) {
      return;
    }

    session.publishChunk(chunk);
  }

  private completeStream(
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
  ) {
    if (!session) {
      return;
    }

    session.complete();
  }

  private errorStream(
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
    error: unknown,
  ) {
    if (!session) {
      return;
    }

    session.error(error);
  }

  private attachStreamId(
    metadata: Record<string, unknown>,
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
  ): Record<string, unknown> {
    if (!session) {
      return metadata;
    }

    return {
      ...metadata,
      streamId: session.streamId,
    };
  }

  private notImplemented(mode: AgentTaskMode): TaskResponseDto {
    return TaskResponseDto.failure(
      mode,
      'Orchestration mode not implemented yet',
    );
  }

  // REMOVED: resolveCheckpointAndMaybeResume method (orchestration-specific)

  private toJsonObject(value: unknown, fallback: JsonObject): JsonObject {
    if (this.isJsonObject(value)) {
      return { ...value } as JsonObject;
    }

    return { ...fallback } as JsonObject;
  }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Emit agent lifecycle event for observability.
   * Fire-and-forget to avoid blocking agent execution.
   */
  private emitAgentLifecycleEvent(
    eventType: string,
    message: string,
    context: {
      definition: AgentRuntimeDefinition;
      request: TaskRequestDto;
      organizationSlug: string | null;
    },
  ): void {
    try {
      const userId = this.resolveUserId(context.request);
      const conversationId = context.request.conversationId || null;
      const taskId = (context.request.payload as Record<string, unknown>)?.taskId as string | null;

      // Fire webhook call (non-blocking)
      if (this.httpService) {
        this.httpService.post('http://localhost:7100/webhooks/status', {
          taskId: taskId || conversationId || 'unknown',
          status: eventType,
          timestamp: new Date().toISOString(),
          message,
          userId: userId || undefined,
          conversationId: conversationId || undefined,
          agentSlug: context.definition.slug,
          organizationSlug: context.organizationSlug || 'global',
          mode: context.request.mode || undefined,
        }).toPromise().catch((error: Error) => {
          // Log but don't throw - observability should never break execution
          this.logger.warn(
            `Failed to emit observability event (${eventType}): ${error.message}`,
          );
        });
      }
    } catch (error) {
      // Silently catch - observability is non-critical
      this.logger.debug(
        `Error preparing observability event: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private resolveUserId(request: TaskRequestDto): string | null {
    return (
      ((request.metadata as Record<string, unknown>)?.userId as string) ||
      ((request.payload as Record<string, unknown>)?.userId as string) ||
      null
    );
  }
}
