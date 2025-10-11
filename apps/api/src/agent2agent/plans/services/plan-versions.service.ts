import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PlanVersionsRepository } from '../repositories/plan-versions.repository';
import { PlansRepository } from '../repositories/plans.repository';
import { LLMService } from '@/llms/llm.service';
import { TasksService } from '@/agent2agent/tasks/tasks.service';

export interface PlanVersion {
  id: string;
  planId: string;
  versionNumber: number;
  content: string;
  format: 'markdown' | 'json' | 'text';
  createdByType: 'agent' | 'user';
  createdById?: string;
  taskId?: string;
  metadata?: Record<string, any>;
  isCurrentVersion: boolean;
  createdAt: Date;
}

export interface CreatePlanVersionDto {
  content: string;
  format: 'markdown' | 'json' | 'text';
  createdByType: 'agent' | 'user';
  createdById?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PlanVersionsService {
  private readonly logger = new Logger(PlanVersionsService.name);

  constructor(
    private readonly versionsRepo: PlanVersionsRepository,
    private readonly plansRepo: PlansRepository,
    @Inject(forwardRef(() => LLMService))
    private readonly llmService: LLMService,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
  ) {}

  /**
   * Create a new version of a plan
   */
  async createVersion(
    planId: string,
    userId: string,
    dto: CreatePlanVersionDto,
  ): Promise<PlanVersion> {
    // Verify plan exists and belongs to user
    const plan = await this.plansRepo.findById(planId, userId);
    if (!plan) {
      throw new NotFoundException(`Plan not found: ${planId}`);
    }

    // Get next version number
    const nextVersion = await this.versionsRepo.getNextVersionNumber(planId);

    // Mark all previous versions as not current
    await this.versionsRepo.markAllAsNotCurrent(planId);

    // Create new version
    const versionData = await this.versionsRepo.create({
      plan_id: planId,
      version_number: nextVersion,
      content: dto.content,
      format: dto.format,
      created_by_type: dto.createdByType,
      created_by_id: dto.createdById,
      task_id: dto.taskId,
      metadata: dto.metadata || {},
      is_current_version: true,
    });

    // Update plan's current_version_id
    await this.plansRepo.setCurrentVersion(planId, userId, versionData.id);

    return this.mapToVersion(versionData);
  }

  /**
   * Get current version of a plan
   */
  async getCurrentVersion(
    planId: string,
    userId: string,
  ): Promise<PlanVersion | null> {
    // Verify plan exists and belongs to user
    const plan = await this.plansRepo.findById(planId, userId);
    if (!plan) {
      throw new NotFoundException(`Plan not found: ${planId}`);
    }

    const versionData = await this.versionsRepo.getCurrentVersion(planId);
    return versionData ? this.mapToVersion(versionData) : null;
  }

  /**
   * Get version history for a plan
   */
  async getVersionHistory(
    planId: string,
    userId: string,
  ): Promise<PlanVersion[]> {
    // Verify plan exists and belongs to user
    const plan = await this.plansRepo.findById(planId, userId);
    if (!plan) {
      throw new NotFoundException(`Plan not found: ${planId}`);
    }

    const versions = await this.versionsRepo.findByPlanId(planId);
    return versions.map((v) => this.mapToVersion(v));
  }

  /**
   * Get specific version by ID
   */
  async findOne(versionId: string, userId: string): Promise<PlanVersion> {
    const versionData = await this.versionsRepo.findById(versionId);
    if (!versionData) {
      throw new NotFoundException(`Plan version not found: ${versionId}`);
    }

    // Verify plan belongs to user
    const plan = await this.plansRepo.findById(versionData.plan_id, userId);
    if (!plan) {
      throw new NotFoundException(`Plan not found`);
    }

    return this.mapToVersion(versionData);
  }

  /**
   * Update a version (for manual edits)
   * Creates a new version instead of updating in place (immutable versioning)
   */
  async update(
    versionId: string,
    userId: string,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<PlanVersion> {
    // Get the source version
    const sourceVersion = await this.findOne(versionId, userId);

    // Create a new version with updated content
    return this.createVersion(sourceVersion.planId, userId, {
      content,
      format: sourceVersion.format,
      createdByType: 'user',
      metadata: {
        ...sourceVersion.metadata,
        ...metadata,
        editedFromVersionId: versionId,
        editedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Set a version as the current version
   */
  async setCurrentVersion(
    versionId: string,
    userId: string,
  ): Promise<PlanVersion> {
    // Verify version exists and user owns the plan
    const version = await this.findOne(versionId, userId);

    // Mark all versions as not current
    await this.versionsRepo.markAllAsNotCurrent(version.planId);

    // Mark this version as current
    const versionData = await this.versionsRepo.markAsCurrent(versionId);

    // Update plan's current_version_id
    await this.plansRepo.setCurrentVersion(version.planId, userId, versionId);

    return this.mapToVersion(versionData);
  }

  /**
   * Copy a version to create a new version
   */
  async copyVersion(versionId: string, userId: string): Promise<PlanVersion> {
    const sourceVersion = await this.findOne(versionId, userId);

    return this.createVersion(sourceVersion.planId, userId, {
      content: sourceVersion.content,
      format: sourceVersion.format,
      createdByType: 'user',
      metadata: {
        ...sourceVersion.metadata,
        copiedFromVersionId: versionId,
        copiedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Delete a specific version (cannot delete current version)
   */
  async deleteVersion(
    versionId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const version = await this.findOne(versionId, userId);

    // Prevent deletion of current version
    if (version.isCurrentVersion) {
      return {
        success: false,
        message:
          'Cannot delete the current version. Please set a different version as current first.',
      };
    }

    await this.versionsRepo.deleteVersion(versionId);

    return {
      success: true,
      message: `Version ${version.versionNumber} deleted successfully`,
    };
  }

  /**
   * Merge multiple versions into a new version
   * TODO: Integrate with LLM service for intelligent merging
   */
  async mergeVersions(
    planId: string,
    userId: string,
    versionIds: string[],
    mergePrompt: string,
  ): Promise<{ newVersion: PlanVersion; conflictSummary?: string }> {
    // Verify plan exists
    const plan = await this.plansRepo.findById(planId, userId);
    if (!plan) {
      throw new NotFoundException(`Plan not found: ${planId}`);
    }

    // Validate that we have at least 2 versions to merge
    if (versionIds.length < 2) {
      throw new BadRequestException(
        'At least 2 versions are required for merging',
      );
    }

    // Get all versions to merge
    const versions = await Promise.all(
      versionIds.map((id) => this.findOne(id, userId)),
    );

    // Verify all versions belong to the same plan
    for (const version of versions) {
      if (version.planId !== planId) {
        throw new BadRequestException(
          `Version ${version.id} does not belong to plan ${planId}`,
        );
      }
    }

    // TODO: Integrate with LLM service for intelligent merging
    // For now, concatenate with markers
    const mergedContent = versions
      .map((v, i) => `=== VERSION ${v.versionNumber} ===\n${v.content}`)
      .join('\n\n');

    const finalContent = `${mergedContent}\n\n=== MERGE INSTRUCTIONS ===\n${mergePrompt}\n\n[TODO: This will be replaced with LLM-generated merged content]`;

    // Create new version with merged content
    const newVersion = await this.createVersion(planId, userId, {
      content: finalContent,
      format: versions[0]?.format || 'markdown',
      createdByType: 'agent',
      metadata: {
        mergedFromVersionIds: versionIds,
        mergePrompt,
        mergedAt: new Date().toISOString(),
      },
    });

    return {
      newVersion,
      conflictSummary: `Merged ${versions.length} versions. LLM integration pending.`,
    };
  }

  // Helper methods
  private mapToVersion(data: any): PlanVersion {
    return {
      id: data.id,
      planId: data.plan_id,
      versionNumber: data.version_number,
      content: data.content,
      format: data.format,
      createdByType: data.created_by_type,
      createdById: data.created_by_id,
      taskId: data.task_id,
      metadata: data.metadata || {},
      isCurrentVersion: data.is_current_version,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Rerun plan with different LLM
   */
  async rerunWithDifferentLLM(
    versionId: string,
    rerunConfig: {
      provider: string;
      model: string;
      temperature?: number;
      maxTokens?: number;
    },
    userId: string,
  ): Promise<{ plan: any; version: PlanVersion }> {
    try {
      // 1. Get the source version
      const sourceVersion = await this.findOne(versionId, userId);
      if (!sourceVersion) {
        throw new NotFoundException('Source version not found');
      }

      // 2. Verify plan ownership
      const plan = await this.plansRepo.findById(sourceVersion.planId, userId);
      if (!plan) {
        throw new NotFoundException('Plan not found');
      }

      // 3. Get the original task to retrieve the prompt
      if (!sourceVersion.taskId) {
        throw new BadRequestException(
          'Cannot rerun: source version has no associated task',
        );
      }

      const originalTask = await this.tasksService.getTaskById(
        sourceVersion.taskId,
        userId,
      );
      if (!originalTask || !originalTask.prompt) {
        throw new BadRequestException(
          'Cannot rerun: original task not found or has no prompt',
        );
      }

      // 4. Build system prompt for plan generation
      const systemPrompt = `You are an expert planning assistant. Create a comprehensive, well-structured plan based on the user's request. Format the plan in markdown.`;

      this.logger.debug(
        `🔄 [PLAN RERUN] Calling LLM with provider=${rerunConfig.provider}, model=${rerunConfig.model}`,
      );

      // 5. Call LLM service with new model
      const llmResponse = await this.llmService.generateUnifiedResponse({
        provider: rerunConfig.provider,
        model: rerunConfig.model,
        systemPrompt: systemPrompt,
        userMessage: originalTask.prompt,
        options: {
          temperature: rerunConfig.temperature,
          maxTokens: rerunConfig.maxTokens,
          userId: userId,
          callerType: 'plan_rerun',
          callerName: `plan_rerun`,
          conversationId: plan.conversation_id,
          includeMetadata: true,
        },
      });

      this.logger.debug(`🔄 [PLAN RERUN] LLM response received successfully`);

      // 6. Handle string | LLMResponse union type
      const responseContent =
        typeof llmResponse === 'string' ? llmResponse : llmResponse.content;
      const responseMetadata =
        typeof llmResponse === 'object' ? llmResponse.metadata : undefined;

      // 7. Create new version with LLM response
      const newVersion = await this.createVersion(plan.id, userId, {
        content: responseContent,
        format: sourceVersion.format || 'markdown',
        createdByType: 'agent',
        taskId: sourceVersion.taskId,
        metadata: {
          ...sourceVersion.metadata,
          sourceVersionId: versionId,
          rerunAt: new Date().toISOString(),
          llmRerunInfo: {
            provider: rerunConfig.provider,
            model: rerunConfig.model,
            temperature: rerunConfig.temperature,
            maxTokens: rerunConfig.maxTokens,
          },
          llmMetadata: responseMetadata
            ? {
                runId: responseMetadata.requestId,
                provider: responseMetadata.provider,
                model: responseMetadata.model,
                inputTokens: responseMetadata.usage?.inputTokens,
                outputTokens: responseMetadata.usage?.outputTokens,
                cost: responseMetadata.usage?.cost,
                duration: responseMetadata.timing?.duration,
              }
            : undefined,
        },
      });

      this.logger.log(
        `🔄 Plan rerun completed: Version ${newVersion.versionNumber} created with ${rerunConfig.provider}/${rerunConfig.model} for plan ${plan.id}`,
      );

      return {
        plan: this.mapPlanFromDb(plan),
        version: newVersion,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error('Failed to rerun plan with different LLM:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new BadRequestException(
        `Failed to rerun plan with different LLM: ${errorMessage}`,
      );
    }
  }

  private mapPlanFromDb(data: any): any {
    return {
      id: data.id,
      conversationId: data.conversation_id,
      userId: data.user_id,
      agentName: data.agent_name,
      namespace: data.namespace,
      title: data.title,
      currentVersionId: data.current_version_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
