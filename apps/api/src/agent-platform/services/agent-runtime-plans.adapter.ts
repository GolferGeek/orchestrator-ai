import { Injectable, Logger } from '@nestjs/common';
import { PlansService } from '@/agent2agent/plans/services/plans.service';
import { PlanVersionsService } from '@/agent2agent/plans/services/plan-versions.service';
import {
  AgentTaskMode,
  TaskRequestDto,
} from '@agent2agent/dto/task-request.dto';

export interface CreatePlanInput {
  organizationSlug: string | null;
  agentSlug: string;
  mode: AgentTaskMode;
  conversationId?: string;
  userId?: string | null;
  title?: string | null;
  content?: string | null;
  namespace?: string | null;
}

/**
 * AgentRuntimePlansAdapter
 *
 * Translates between AgentRuntime execution results and PlansService operations.
 * Determines when to create/update plans based on mode and context.
 */
@Injectable()
export class AgentRuntimePlansAdapter {
  private readonly logger = new Logger(AgentRuntimePlansAdapter.name);

  constructor(
    private readonly plansService: PlansService,
    private readonly versionsService: PlanVersionsService,
  ) {}

  /**
   * Create plan from agent task execution if mode is 'plan'
   */
  async maybeCreateFromPlanTask(
    ctx: CreatePlanInput,
    request: TaskRequestDto,
  ): Promise<any | null> {
    try {
      // Only create plans for PLAN mode
      if (ctx.mode !== AgentTaskMode.PLAN) {
        return null;
      }

      const userId = this.resolveUserId(request);
      const conversationId = ctx.conversationId;

      if (!userId || !conversationId) {
        this.logger.warn(
          'Cannot create plan: missing userId or conversationId',
        );
        return null;
      }

      const title = ctx.title || `Plan from ${ctx.agentSlug}`;
      const content = ctx.content || (request.payload as any)?.output || '';
      const namespace = ctx.namespace || ctx.organizationSlug || 'default';

      // Use PlansService.executeAction to create/refine plan
      const result = await this.plansService.executeAction(
        'create',
        {
          title,
          content,
          format: 'markdown',
          agentName: ctx.agentSlug,
          namespace,
          taskId: (request as any).taskId,
          metadata: {
            organizationSlug: ctx.organizationSlug,
            agentSlug: ctx.agentSlug,
            mode: ctx.mode,
          },
        },
        {
          conversationId,
          userId,
          agentSlug: ctx.agentSlug,
          taskId: (request as any).taskId,
        },
      );

      if (!result.success) {
        this.logger.error('Failed to create plan:', result.error);
        return null;
      }

      return {
        kind: result.data.isNew ? 'plan' : 'plan_version',
        plan: result.data.plan,
        version: result.data.version,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to auto-create plan: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Create a new version from manual edit
   */
  async createVersionFromManualEdit(
    conversationId: string,
    userId: string,
    editedContent: string,
    metadata?: Record<string, any>,
  ): Promise<any> {
    const result = await this.plansService.executeAction(
      'edit',
      {
        content: editedContent,
        metadata,
      },
      {
        conversationId,
        userId,
      },
    );

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to save manual edit');
    }

    return result.data;
  }

  /**
   * Merge multiple versions using LLM
   */
  async mergeVersions(
    conversationId: string,
    userId: string,
    versionIds: string[],
    mergePrompt: string,
  ): Promise<any> {
    const result = await this.plansService.executeAction(
      'merge_versions',
      {
        versionIds,
        mergePrompt,
      },
      {
        conversationId,
        userId,
      },
    );

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to merge versions');
    }

    return result.data;
  }

  /**
   * Copy a version to create a new version
   */
  async copyVersion(
    conversationId: string,
    userId: string,
    versionId: string,
  ): Promise<any> {
    const result = await this.plansService.executeAction(
      'copy_version',
      { versionId },
      {
        conversationId,
        userId,
      },
    );

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to copy version');
    }

    return result.data;
  }

  // Helper methods

  private resolveUserId(request: TaskRequestDto): string | null {
    // Prefer top-level metadata, then payload.metadata
    const fromTop = request.metadata?.userId || request.metadata?.createdBy;
    const fromPayload =
      request.payload?.metadata?.userId || request.payload?.metadata?.createdBy;
    return (fromTop as string) || (fromPayload as string) || null;
  }
}
