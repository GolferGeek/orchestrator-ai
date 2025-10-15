import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PlansRepository } from '../repositories/plans.repository';
import { PlanVersionsService } from './plan-versions.service';
import {
  IActionHandler,
  ActionExecutionContext,
  ActionResult,
} from '../../common/interfaces/action-handler.interface';

export interface Plan {
  id: string;
  conversationId: string;
  userId: string;
  agentName: string;
  namespace: string;
  title: string;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  currentVersion?: any;
}

/**
 * PlansService - Implements the mode × action architecture for plan operations
 *
 * Handles all 9 plan actions:
 * 1. create - Create or refine a plan
 * 2. read - Get current plan
 * 3. list - Get version history
 * 4. edit - Save manual edit as new version
 * 5. set_current - Switch current version
 * 6. delete_version - Delete a specific version
 * 7. merge_versions - LLM-based merge of multiple versions
 * 8. copy_version - Duplicate a version
 * 9. delete - Delete entire plan
 */
@Injectable()
export class PlansService implements IActionHandler {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly plansRepo: PlansRepository,
    private readonly versionsService: PlanVersionsService,
  ) {}

  /**
   * Main entry point for all plan operations
   * Implements IActionHandler interface for mode × action routing
   */
  async executeAction<T = any>(
    action: string,
    params: any,
    context: ActionExecutionContext,
  ): Promise<ActionResult<T>> {
    try {
      this.logger.debug(
        `Executing plan action: ${action}`,
        JSON.stringify({ action, context }),
      );

      let result: any;

      switch (action) {
        case 'create':
          result = await this.createOrRefine(params, context);
          break;

        case 'read':
          result = await this.getCurrentPlan(context);
          break;

        case 'list':
          result = await this.getVersionHistory(context);
          break;

        case 'edit':
          result = await this.saveManualEdit(params, context);
          break;

        case 'rerun':
          result = await this.rerunWithDifferentLLM(params, context);
          break;

        case 'set_current':
          result = await this.setCurrentVersion(params, context);
          break;

        case 'delete_version':
          result = await this.deleteVersion(params, context);
          break;

        case 'merge_versions':
          result = await this.mergeVersions(params, context);
          break;

        case 'copy_version':
          result = await this.copyVersion(params, context);
          break;

        case 'delete':
          result = await this.deletePlan(context);
          break;

        default:
          throw new BadRequestException(`Unknown plan action: ${action}`);
      }

      return {
        success: true,
        data: result as T,
      };
    } catch (error) {
      this.logger.error(`Failed to execute plan action ${action}:`, error);
      return {
        success: false,
        error: {
          code:
            error instanceof BadRequestException
              ? 'BAD_REQUEST'
              : error instanceof NotFoundException
                ? 'NOT_FOUND'
                : 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { action, context },
        },
      };
    }
  }

  // ============================================================================
  // ACTION HANDLERS (Private methods - only executeAction is public)
  // ============================================================================

  /**
   * Action: create
   * Create a new plan or refine existing plan (creates new version)
   */
  private async createOrRefine(
    params: {
      title: string;
      content: string;
      format?: 'markdown' | 'json' | 'text';
      agentName?: string;
      namespace?: string;
      taskId?: string;
      metadata?: Record<string, any>;
    },
    context: ActionExecutionContext,
  ) {
    // Check if plan already exists for this conversation
    const existingPlan = await this.plansRepo.findByConversationId(
      context.conversationId,
      context.userId,
    );

    if (existingPlan) {
      // Refine existing plan - create new version
      const newVersion = await this.versionsService.createVersion(
        existingPlan.id,
        context.userId,
        {
          content: params.content,
          format: params.format || 'markdown',
          createdByType: 'agent',
          taskId: params.taskId || context.taskId,
          metadata: params.metadata || {},
        },
      );

      const plan = await this.findOne(existingPlan.id, context.userId);
      return { plan, version: newVersion, isNew: false };
    } else {
      // Create new plan
      const planData = await this.plansRepo.create({
        conversation_id: context.conversationId,
        user_id: context.userId,
        agent_name: params.agentName || context.agentSlug || 'unknown',
        namespace: params.namespace || 'default',
        title: params.title,
      });

      // Create initial version
      const initialVersion = await this.versionsService.createVersion(
        planData.id,
        context.userId,
        {
          content: params.content,
          format: params.format || 'markdown',
          createdByType: 'agent',
          taskId: params.taskId || context.taskId,
          metadata: params.metadata || {},
        },
      );

      const plan = await this.findOne(planData.id, context.userId);
      return { plan, version: initialVersion, isNew: true };
    }
  }

  /**
   * Action: read
   * Get current plan with current version
   */
  private async getCurrentPlan(context: ActionExecutionContext) {
    const plan = await this.plansRepo.findByConversationId(
      context.conversationId,
      context.userId,
    );

    if (!plan) {
      throw new NotFoundException(
        `No plan found for conversation ${context.conversationId}`,
      );
    }

    const planWithVersion = await this.findOne(plan.id, context.userId);

    // Return in strict A2A protocol format: { plan, version }
    return {
      plan: {
        id: planWithVersion.id,
        conversationId: planWithVersion.conversationId,
        currentVersionId: planWithVersion.currentVersionId,
        createdAt: planWithVersion.createdAt.toISOString(),
        updatedAt: planWithVersion.updatedAt.toISOString(),
      },
      version: planWithVersion.currentVersion || null,
    };
  }

  /**
   * Action: list
   * Get version history for plan
   */
  private async getVersionHistory(context: ActionExecutionContext) {
    const plan = await this.plansRepo.findByConversationId(
      context.conversationId,
      context.userId,
    );

    if (!plan) {
      throw new NotFoundException(
        `No plan found for conversation ${context.conversationId}`,
      );
    }

    const versions = await this.versionsService.getVersionHistory(
      plan.id,
      context.userId,
    );

    return { plan: this.mapToPlan(plan), versions };
  }

  /**
   * Action: edit
   * Save manual edit as new version
   */
  private async saveManualEdit(
    params: {
      content: string;
      metadata?: Record<string, any>;
    },
    context: ActionExecutionContext,
  ) {
    const plan = await this.plansRepo.findByConversationId(
      context.conversationId,
      context.userId,
    );

    if (!plan) {
      throw new NotFoundException(
        `No plan found for conversation ${context.conversationId}`,
      );
    }

    const currentVersion = await this.versionsService.getCurrentVersion(
      plan.id,
      context.userId,
    );

    if (!currentVersion) {
      throw new NotFoundException(`No current version found for plan`);
    }

    const newVersion = await this.versionsService.createVersion(
      plan.id,
      context.userId,
      {
        content: params.content,
        format: currentVersion.format,
        createdByType: 'user',
        metadata: {
          ...params.metadata,
          editedFromVersionId: currentVersion.id,
          editedAt: new Date().toISOString(),
        },
      },
    );

    return { plan: this.mapToPlan(plan), version: newVersion };
  }

  /**
   * Action: rerun
   * Rerun plan generation with different LLM settings
   */
  private async rerunWithDifferentLLM(
    params: {
      versionId: string;
      rerunConfig: {
        provider: string;
        model: string;
        temperature?: number;
        maxTokens?: number;
      };
    },
    context: ActionExecutionContext,
  ) {
    const { provider, model, temperature, maxTokens } = params.rerunConfig;

    this.logger.debug(
      `🔄 [PLAN RERUN] versionId=${params.versionId}, provider=${provider}, model=${model}`,
    );

    return this.versionsService.rerunWithDifferentLLM(
      params.versionId,
      {
        provider,
        model,
        temperature,
        maxTokens,
      },
      context.userId,
    );
  }

  /**
   * Action: set_current
   * Set a specific version as current
   */
  private async setCurrentVersion(
    params: { versionId: string },
    context: ActionExecutionContext,
  ) {
    const version = await this.versionsService.setCurrentVersion(
      params.versionId,
      context.userId,
    );

    const plan = await this.findOne(version.planId, context.userId);

    return { plan, version };
  }

  /**
   * Action: delete_version
   * Delete a specific version
   */
  private async deleteVersion(
    params: { versionId: string },
    context: ActionExecutionContext,
  ) {
    // Get version before deletion to get plan ID
    const version = await this.versionsService.findOne(
      params.versionId,
      context.userId,
    );

    const result = await this.versionsService.deleteVersion(
      params.versionId,
      context.userId,
    );

    const planData = await this.plansRepo.findById(
      version.planId,
      context.userId,
    );
    const remainingVersions = await this.versionsService.getVersionHistory(
      version.planId,
      context.userId,
    );

    // Return in strict A2A protocol format for PlanDeleteVersionResponse
    return {
      deletedVersionId: params.versionId,
      plan: this.mapToPlan(planData),
      remainingVersions,
    };
  }

  /**
   * Action: merge_versions
   * Merge multiple versions using LLM
   */
  private async mergeVersions(
    params: {
      versionIds: string[];
      mergePrompt: string;
      planStructure?: unknown;
      llmConfig?: Record<string, unknown> | null;
      preferredFormat?: 'markdown' | 'json' | 'text';
    },
    context: ActionExecutionContext,
  ) {
    const plan = await this.plansRepo.findByConversationId(
      context.conversationId,
      context.userId,
    );

    if (!plan) {
      throw new NotFoundException(
        `No plan found for conversation ${context.conversationId}`,
      );
    }

    const result = await this.versionsService.mergeVersions(
      plan.id,
      context.userId,
      params.versionIds,
      params.mergePrompt,
      {
        planStructure: params.planStructure,
        llmConfig: params.llmConfig,
        preferredFormat: params.preferredFormat,
      },
    );

    // Get source versions
    const sourceVersions = await Promise.all(
      params.versionIds.map((id) =>
        this.versionsService.findOne(id, context.userId),
      ),
    );

    // Return in strict A2A protocol format for PlanMergeVersionsResponse
    return {
      plan: this.mapToPlan(plan),
      mergedVersion: result.newVersion,
      sourceVersions,
      llmMetadata: result.llmMetadata ?? undefined,
    };
  }

  /**
   * Action: copy_version
   * Duplicate a version as a new version
   */
  private async copyVersion(
    params: { versionId: string },
    context: ActionExecutionContext,
  ) {
    const sourceVersion = await this.versionsService.findOne(
      params.versionId,
      context.userId,
    );

    const copiedVersion = await this.versionsService.copyVersion(
      params.versionId,
      context.userId,
    );

    const planData = await this.plansRepo.findById(
      copiedVersion.planId,
      context.userId,
    );

    // Return in strict A2A protocol format for PlanCopyVersionResponse
    return {
      sourcePlan: this.mapToPlan(planData),
      sourceVersion,
      targetPlan: this.mapToPlan(planData), // Same plan for copy
      copiedVersion,
    };
  }

  /**
   * Action: delete
   * Delete entire plan and all versions
   */
  private async deletePlan(context: ActionExecutionContext) {
    const plan = await this.plansRepo.findByConversationId(
      context.conversationId,
      context.userId,
    );

    if (!plan) {
      throw new NotFoundException(
        `No plan found for conversation ${context.conversationId}`,
      );
    }

    // Get version count before deletion
    const versions = await this.versionsService.getVersionHistory(
      plan.id,
      context.userId,
    );
    const versionCount = versions.length;

    await this.plansRepo.delete(plan.id, context.userId);

    // Return in strict A2A protocol format for PlanDeleteResponse
    return {
      deletedPlanId: plan.id,
      deletedVersionCount: versionCount,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Find a plan by ID with current version
   */
  async findOne(planId: string, userId: string): Promise<Plan> {
    const planData = await this.plansRepo.findById(planId, userId);
    if (!planData) {
      throw new NotFoundException(`Plan not found: ${planId}`);
    }

    const plan = this.mapToPlan(planData);

    // Get current version
    try {
      const currentVersion = await this.versionsService.getCurrentVersion(
        planId,
        userId,
      );
      if (currentVersion) {
        plan.currentVersion = currentVersion;
      }
    } catch (error) {
      // Continue without current version
      this.logger.warn(`No current version found for plan ${planId}`);
    }

    return plan;
  }

  /**
   * Find plan by conversation ID
   */
  async findByConversationId(
    conversationId: string,
    userId: string,
  ): Promise<Plan | null> {
    const planData = await this.plansRepo.findByConversationId(
      conversationId,
      userId,
    );

    if (!planData) {
      return null;
    }

    return this.findOne(planData.id, userId);
  }

  /**
   * Map database record to Plan entity
   */
  private mapToPlan(data: any): Plan {
    return {
      id: data.id,
      conversationId: data.conversation_id,
      userId: data.user_id,
      agentName: data.agent_name,
      namespace: data.namespace,
      title: data.title,
      currentVersionId: data.current_version_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
