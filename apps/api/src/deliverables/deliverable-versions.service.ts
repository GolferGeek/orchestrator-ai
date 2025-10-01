import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateVersionDto,
  DeliverableVersionCreationType,
  DeliverableFormat,
  RerunWithLLMDto,
} from './dto';
import { DeliverableVersion } from './entities/deliverable.entity';
import { getTableName } from '../supabase/supabase.config';
import { LLMService } from '../llms/llm.service';
import { Task } from '../common/types/agent-conversations.types';
import { snakeToCamel } from '../utils/case-converter';

@Injectable()
export class DeliverableVersionsService {
  private readonly logger = new Logger(DeliverableVersionsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => LLMService))
    private readonly llmService: LLMService,
  ) {}

  /**
   * Create a new version of an existing deliverable
   */
  async createVersion(
    deliverableId: string,
    createVersionDto: CreateVersionDto,
    userId: string,
  ): Promise<DeliverableVersion> {
    try {
      // Verify deliverable exists and belongs to user
      await this.verifyDeliverableOwnership(deliverableId, userId);

      // Get the next version number
      const nextVersionNumber = await this.getNextVersionNumber(deliverableId);

      this.logger.debug(
        `Creating deliverable version: deliverableId=${deliverableId}, nextVersion=${nextVersionNumber}, createdBy=${createVersionDto.createdByType}, taskId=${createVersionDto.taskId}`,
      );

      // Mark all previous versions as not current
      await this.markPreviousVersionsAsNotCurrent(deliverableId);

      // Create new version
      const { data: newVersionData, error: insertError } =
        await this.supabaseService
          .getServiceClient()
          .from(getTableName('deliverable_versions'))
          .insert([
            {
              deliverable_id: deliverableId,
              version_number: nextVersionNumber,
              content: createVersionDto.content,
              format: createVersionDto.format,
              is_current_version: true,
              created_by_type: createVersionDto.createdByType,
              task_id: createVersionDto.taskId || null,
              metadata: createVersionDto.metadata || {},
              file_attachments: createVersionDto.fileAttachments || {},
            },
          ])
          .select('*')
          .single();

      if (insertError) {
        throw new BadRequestException(
          `Failed to create version: ${insertError.message}`,
        );
      }

      return this.mapToVersion(newVersionData);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to create version');
    }
  }

  /**
   * Get version history for a deliverable
   */
  async getVersionHistory(
    deliverableId: string,
    userId: string,
  ): Promise<DeliverableVersion[]> {
    try {
      // Verify deliverable ownership
      await this.verifyDeliverableOwnership(deliverableId, userId);

      // Get all versions for this deliverable
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverable_versions'))
        .select('*')
        .eq('deliverable_id', deliverableId)
        .order('version_number', { ascending: true });

      if (error) {
        throw new BadRequestException(
          `Failed to get version history: ${error.message}`,
        );
      }

      const versions = (data || []).map((item: any) => this.mapToVersion(item));

      return versions;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to get version history');
    }
  }

  /**
   * Get a specific version by ID
   */
  async getVersion(
    versionId: string,
    userId: string,
  ): Promise<DeliverableVersion> {
    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverable_versions'))
        .select('*')
        .eq('id', versionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundException(`Version not found: ${versionId}`);
        }

        throw new BadRequestException(
          `Failed to find version: ${error.message}`,
        );
      }

      // Verify the deliverable belongs to the user
      await this.verifyDeliverableOwnership(data.deliverable_id, userId);

      return this.mapToVersion(data);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to get version');
    }
  }

  /**
   * Get the current version of a deliverable
   */
  async getCurrentVersion(
    deliverableId: string,
    userId: string,
  ): Promise<DeliverableVersion | null> {
    try {
      // Verify deliverable ownership
      await this.verifyDeliverableOwnership(deliverableId, userId);

      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverable_versions'))
        .select('*')
        .eq('deliverable_id', deliverableId)
        .eq('is_current_version', true)
        .maybeSingle();

      if (error) {
        throw new BadRequestException('Failed to find current version');
      }

      if (data) {
        return this.mapToVersion(data);
      } else {
        // Check if any versions exist at all
        const { data: allVersions, error: allVersionsError } =
          await this.supabaseService
            .getServiceClient()
            .from(getTableName('deliverable_versions'))
            .select('id, version_number, is_current_version')
            .eq('deliverable_id', deliverableId);

        if (allVersionsError) {
        } else {
        }

        return null;
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to get current version');
    }
  }

  /**
   * Set a specific version as the current version
   */
  async setCurrentVersion(
    versionId: string,
    userId: string,
  ): Promise<DeliverableVersion> {
    try {
      // Get the version and verify ownership
      const version = await this.getVersion(versionId, userId);

      // Mark all versions for this deliverable as not current
      await this.markPreviousVersionsAsNotCurrent(version.deliverableId);

      // Set this version as current
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverable_versions'))
        .update({ is_current_version: true })
        .eq('id', versionId)
        .select('*')
        .single();

      if (error) {
        throw new BadRequestException(
          `Failed to set current version: ${error.message}`,
        );
      }

      return this.mapToVersion(data);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to set current version');
    }
  }

  /**
   * Delete a specific version (cannot delete current version)
   */
  async deleteVersion(
    versionId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get the version and verify ownership
      const version = await this.getVersion(versionId, userId);

      // Prevent deletion of current version (as per PRD requirement)
      if (version.isCurrentVersion) {
        const message =
          'Cannot delete the current version. Please set a different version as current first.';

        return { success: false, message };
      }

      // Delete the version
      const { error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverable_versions'))
        .delete()
        .eq('id', versionId);

      if (error) {
        throw new BadRequestException(
          `Failed to delete version: ${error.message}`,
        );
      }

      const successMessage = `Version ${version.versionNumber} deleted successfully`;

      return { success: true, message: successMessage };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to delete version');
    }
  }

  /**
   * Copy an existing version to a new version (same content/format/metadata)
   */
  async copyVersion(versionId: string, userId: string): Promise<DeliverableVersion> {
    const source = await this.getVersion(versionId, userId);
    const createVersionDto: CreateVersionDto = {
      content: source.content,
      format: source.format,
      createdByType: DeliverableVersionCreationType.MANUAL_EDIT,
      metadata: {
        ...(source.metadata || {}),
        copiedFromVersionId: versionId,
        copiedAt: new Date().toISOString(),
      },
    };
    return this.createVersion(source.deliverableId, createVersionDto, userId);
  }

  /**
   * Enhance an existing version using LLM and create a new version
   */
  async enhanceVersion(
    versionId: string,
    dto: { instruction: string; providerName?: string; modelName?: string; temperature?: number; maxTokens?: number },
    userId: string,
  ): Promise<DeliverableVersion> {
    const source = await this.getVersion(versionId, userId);

    // Build prompts
    const systemPrompt = 'You are a concise, high-quality editor. Improve the given content according to the user instruction without changing factual meaning. Maintain original format.';
    const userMessage = `Instruction:\n${dto.instruction}\n\n---\n\nOriginal Content (${source.format}):\n\n${source.content}`;

    // Choose provider/model or fall back to defaults (let LLMService route if not provided)
    const provider = dto.providerName || 'openai';
    const model = dto.modelName || 'gpt-4o-mini';

    const response = await this.llmService.generateUnifiedResponse({
      provider,
      model,
      systemPrompt,
      userMessage,
      options: {
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        includeMetadata: true,
        callerType: 'service',
        callerName: 'deliverable-versions',
      },
    });

    const content = typeof response === 'string' ? response : response.content;
    const metadata = typeof response === 'string' ? undefined : (response as any).metadata;
    const piiMetadata = typeof response === 'string' ? undefined : (response as any).piiMetadata;

    const createVersionDto: CreateVersionDto = {
      content,
      format: source.format,
      createdByType: DeliverableVersionCreationType.AI_ENHANCEMENT,
      taskId: source.taskId,
      metadata: {
        ...(source.metadata || {}),
        enhancedFromVersionId: versionId,
        enhancementAt: new Date().toISOString(),
        enhancementInstruction: dto.instruction,
        llmMetadata: metadata
          ? {
              provider: metadata.provider,
              model: metadata.model,
              inputTokens: metadata.usage?.inputTokens,
              outputTokens: metadata.usage?.outputTokens,
              cost: metadata.usage?.cost,
              duration: metadata.timing?.duration,
            }
          : undefined,
        piiMetadata,
      },
    };

    return this.createVersion(source.deliverableId, createVersionDto, userId);
  }

  /**
   * Merge multiple versions into a new version using LLM
   */
  async mergeVersions(
    deliverableId: string,
    versionIds: string[],
    mergePrompt: string,
    userId: string,
  ): Promise<{ newVersion: DeliverableVersion; conflictSummary?: string }> {
    try {
      // Verify deliverable ownership
      await this.verifyDeliverableOwnership(deliverableId, userId);

      // Validate that we have at least 2 versions to merge
      if (versionIds.length < 2) {
        throw new BadRequestException(
          'At least 2 versions are required for merging',
        );
      }

      // Get all versions to merge and verify they exist and belong to the deliverable
      const versions = await Promise.all(
        versionIds.map(async (versionId) => {
          const version = await this.getVersion(versionId, userId);
          if (version.deliverableId !== deliverableId) {
            throw new BadRequestException(
              `Version ${versionId} does not belong to deliverable ${deliverableId}`,
            );
          }
          return version;
        }),
      );

      // TODO: Integrate with LLM service for intelligent merging
      // For now, implement a simple concatenation with conflict detection
      const mergedContent = await this.performLLMMerge(versions, mergePrompt);

      // Create new version with merged content
      const createVersionDto: CreateVersionDto = {
        content: mergedContent.content,
        format: versions[0]?.format || this.getMostCommonFormat(versions), // Use format from first version or most common
        createdByType: DeliverableVersionCreationType.CONVERSATION_MERGE,
        metadata: {
          mergedFromVersions: versionIds,
          mergePrompt: mergePrompt,
          mergedAt: new Date().toISOString(),
        },
      };

      const newVersion = await this.createVersion(
        deliverableId,
        createVersionDto,
        userId,
      );

      return {
        newVersion,
        conflictSummary: mergedContent.conflictSummary,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to merge versions');
    }
  }

  /**
   * Create a new version from a task-based prompt
   */
  async createVersionFromTask(
    deliverableId: string,
    taskPrompt: string,
    userId: string,
    baseVersionId?: string,
  ): Promise<DeliverableVersion> {
    try {
      // Verify deliverable ownership
      await this.verifyDeliverableOwnership(deliverableId, userId);

      // Get base version (current version if not specified)
      const baseVersion = baseVersionId
        ? await this.getVersion(baseVersionId, userId)
        : await this.getCurrentVersion(deliverableId, userId);

      if (!baseVersion) {
        throw new BadRequestException(
          'No base version found for task-based modification',
        );
      }

      // TODO: Integrate with LLM service for task-based content modification
      // For now, append the task prompt as a comment
      const modifiedContent = await this.performTaskBasedModification(
        baseVersion.content || '',
        taskPrompt,
      );

      // Create new version with modified content
      const createVersionDto: CreateVersionDto = {
        content: modifiedContent,
        format:
          baseVersion.format || this.detectFormatFromContent(modifiedContent),
        createdByType: DeliverableVersionCreationType.CONVERSATION_TASK,
        metadata: {
          baseVersionId: baseVersion.id,
          taskPrompt: taskPrompt,
          modifiedAt: new Date().toISOString(),
        },
      };

      return await this.createVersion(deliverableId, createVersionDto, userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to create version from task');
    }
  }

  /**
   * Get task by ID (internal method to avoid circular dependency)
   */
  private async getTaskById(
    taskId: string,
    userId: string,
  ): Promise<Task | null> {
    try {
      const { data, error } = await this.supabaseService
        .getAnonClient()
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (error) {
        this.logger.error(`Error fetching task ${taskId}:`, error);
        return null;
      }

      if (!data) {
        return null;
      }

      // Convert snake_case to camelCase
      return snakeToCamel(data) as Task;
    } catch (error) {
      this.logger.error(`Failed to fetch task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Re-run a deliverable version with a different LLM
   */
  async rerunWithDifferentLLM(
    versionId: string,
    rerunDto: RerunWithLLMDto,
    userId: string,
  ): Promise<DeliverableVersion> {
    try {
      // Get the source version
      const sourceVersion = await this.getVersion(versionId, userId);
      if (!sourceVersion) {
        throw new NotFoundException('Source version not found');
      }

      // Verify deliverable ownership
      await this.verifyDeliverableOwnership(
        sourceVersion.deliverableId,
        userId,
      );

      // Get the original task to retrieve the prompt
      if (!sourceVersion.taskId) {
        throw new BadRequestException(
          'Cannot rerun: source version has no associated task',
        );
      }

      const originalTask = await this.getTaskById(sourceVersion.taskId, userId);
      if (!originalTask) {
        throw new BadRequestException('Cannot rerun: original task not found');
      }

      if (!originalTask.prompt) {
        throw new BadRequestException(
          'Cannot rerun: original task has no prompt',
        );
      }

      // Extract agent information from source version metadata
      const agentName = sourceVersion.metadata?.agentName || 'unknown';
      const agentType = sourceVersion.metadata?.agentType || 'context';

      // Create system prompt based on agent type and original context
      const systemPrompt = this.buildSystemPromptForRerun(
        agentName,
        agentType,
        sourceVersion,
      );

      // Call LLM service with new model
      const llmResponse = await this.llmService.generateUnifiedResponse({
        provider: rerunDto.provider,
        model: rerunDto.model,
        systemPrompt: systemPrompt,
        userMessage: originalTask.prompt,
        options: {
          temperature: rerunDto.temperature,
          maxTokens: rerunDto.maxTokens,
          userId: userId,
          callerType: 'deliverable_rerun',
          callerName: `${agentName}_rerun`,
          conversationId: sourceVersion.metadata?.conversationId,
          includeMetadata: true, // We need the full response object
        },
      });

      // Handle string | LLMResponse union type
      const responseContent =
        typeof llmResponse === 'string' ? llmResponse : llmResponse.content;
      const responseMetadata =
        typeof llmResponse === 'object' ? llmResponse.metadata : undefined;
      const responsePiiMetadata =
        typeof llmResponse === 'object' ? llmResponse.piiMetadata : undefined;

      // Create new version with LLM response
      const createVersionDto: CreateVersionDto = {
        content: responseContent,
        format: sourceVersion.format || DeliverableFormat.MARKDOWN,
        createdByType: DeliverableVersionCreationType.LLM_RERUN,
        taskId: sourceVersion.taskId,
        metadata: {
          ...sourceVersion.metadata,
          sourceVersionId: versionId,
          rerunAt: new Date().toISOString(),
          llmRerunInfo: {
            provider: rerunDto.provider,
            model: rerunDto.model,
            temperature: rerunDto.temperature,
            maxTokens: rerunDto.maxTokens,
          },
          llmMetadata: responseMetadata
            ? {
                runId: responseMetadata.requestId, // requestId is the correct property name
                provider: responseMetadata.provider,
                model: responseMetadata.model,
                inputTokens: responseMetadata.usage?.inputTokens,
                outputTokens: responseMetadata.usage?.outputTokens,
                cost: responseMetadata.usage?.cost,
                duration: responseMetadata.timing?.duration,
              }
            : undefined,
          // Note: routingDecision not available in new unified response interface
          piiMetadata: responsePiiMetadata,
        },
      };

      const newVersion = await this.createVersion(
        sourceVersion.deliverableId,
        createVersionDto,
        userId,
      );

      this.logger.log(
        `🔄 Deliverable rerun completed: Version ${newVersion.versionNumber} created with ${rerunDto.provider}/${rerunDto.model} for deliverable ${sourceVersion.deliverableId}`,
      );

      return newVersion;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        'Failed to rerun deliverable with different LLM:',
        error,
      );
      this.logger.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
      });

      // Include the actual error message in the BadRequestException
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new BadRequestException(
        `Failed to rerun deliverable with different LLM: ${errorMessage}`,
      );
    }
  }

  // Private helper methods

  private async verifyDeliverableOwnership(
    deliverableId: string,
    userId: string,
  ): Promise<void> {
    try {
      // First, check if the deliverable exists at all (without user_id filter for debugging)
      const { data: deliverableCheck, error: checkError } =
        await this.supabaseService
          .getServiceClient()
          .from(getTableName('deliverables'))
          .select('id, user_id')
          .eq('id', deliverableId)
          .single();

      if (checkError) {
        // If it's a schema or connection error, we'll see it here
        throw new NotFoundException(
          `Database error checking deliverable: ${checkError.message || checkError.code || 'unknown error'}`,
        );
      }

      if (!deliverableCheck) {
        throw new NotFoundException(`Deliverable not found: ${deliverableId}`);
      }

      if (deliverableCheck.user_id !== userId) {
        throw new NotFoundException(`Deliverable not found: ${deliverableId}`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(
        `Failed to verify deliverable ownership: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async getNextVersionNumber(deliverableId: string): Promise<number> {
    const { data: lastVersion, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('deliverable_versions'))
      .select('version_number')
      .eq('deliverable_id', deliverableId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BadRequestException('Failed to determine version number');
    }

    return lastVersion ? lastVersion.version_number + 1 : 1;
  }

  private async markPreviousVersionsAsNotCurrent(
    deliverableId: string,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('deliverable_versions'))
      .update({ is_current_version: false })
      .eq('deliverable_id', deliverableId);

    if (error) {
      throw new BadRequestException('Failed to update previous versions');
    }
  }

  private mapToVersion(data: any): DeliverableVersion {
    return {
      id: data.id,
      deliverableId: data.deliverable_id,
      versionNumber: data.version_number,
      content: data.content,
      format: data.format,
      isCurrentVersion: data.is_current_version,
      createdByType: data.created_by_type,
      taskId: data.task_id,
      metadata: data.metadata || {},
      fileAttachments: data.file_attachments || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Perform LLM-based merge of multiple version contents
   * TODO: Integrate with actual LLM service
   */
  private async performLLMMerge(
    versions: DeliverableVersion[],
    mergePrompt: string,
  ): Promise<{ content: string; conflictSummary?: string }> {
    // Placeholder implementation - will be replaced with actual LLM integration
    const versionContents = versions
      .map((v, i) => `=== VERSION ${v.versionNumber} ===\n${v.content || ''}`)
      .join('\n\n');

    const mergedContent = `${versionContents}\n\n=== MERGE INSTRUCTIONS ===\n${mergePrompt}\n\n[TODO: This will be replaced with LLM-generated merged content]`;

    return {
      content: mergedContent,
      conflictSummary: `Merged ${versions.length} versions with prompt: "${mergePrompt}". LLM integration pending.`,
    };
  }

  /**
   * Perform task-based content modification using LLM
   * TODO: Integrate with actual LLM service
   */
  private async performTaskBasedModification(
    baseContent: string,
    taskPrompt: string,
  ): Promise<string> {
    // Placeholder implementation - will be replaced with actual LLM integration
    return `${baseContent}\n\n=== TASK MODIFICATION ===\n${taskPrompt}\n\n[TODO: This will be replaced with LLM-modified content]`;
  }

  /**
   * Detect format from content using simple heuristics
   */
  private detectFormatFromContent(content: string): DeliverableFormat {
    if (!content) return DeliverableFormat.TEXT;

    const trimmedContent = content.trim();

    // Check for JSON
    if (
      (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) ||
      (trimmedContent.startsWith('[') && trimmedContent.endsWith(']'))
    ) {
      try {
        JSON.parse(trimmedContent);
        return DeliverableFormat.JSON;
      } catch {
        // Not valid JSON, continue checking
      }
    }

    // Check for HTML
    if (
      trimmedContent.includes('<html') ||
      trimmedContent.includes('<!DOCTYPE') ||
      (trimmedContent.includes('<') && trimmedContent.includes('>'))
    ) {
      return DeliverableFormat.HTML;
    }

    // Check for Markdown
    if (
      content.includes('```') ||
      content.includes('#') ||
      content.includes('**') ||
      content.includes('__') ||
      (content.includes('[') && content.includes(']('))
    ) {
      return DeliverableFormat.MARKDOWN;
    }

    // Default to plain text
    return DeliverableFormat.TEXT;
  }

  /**
   * Get the most common format from a list of versions
   */
  private getMostCommonFormat(
    versions: DeliverableVersion[],
  ): DeliverableFormat {
    if (versions.length === 0) return DeliverableFormat.TEXT;

    const formatCounts = versions.reduce(
      (acc, v) => {
        if (v.format) {
          acc[v.format] = (acc[v.format] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const mostCommon = Object.entries(formatCounts).sort(
      ([, a], [, b]) => b - a,
    )[0]?.[0];

    return (mostCommon as DeliverableFormat) || DeliverableFormat.TEXT;
  }

  /**
   * Build system prompt for LLM rerun based on agent type and context
   */
  private buildSystemPromptForRerun(
    agentName: string,
    agentType: string,
    sourceVersion: DeliverableVersion,
  ): string {
    const basePrompt = `You are ${agentName}, a ${agentType} agent. You are re-running a previous task with a different LLM model.`;

    // Add context from the original version if available
    let contextPrompt = '';
    if (sourceVersion.metadata?.conversationId) {
      contextPrompt += ' This is part of an ongoing conversation.';
    }

    if (sourceVersion.metadata?.projectStepId) {
      contextPrompt += ' This is part of a project workflow.';
    }

    // Add format guidance
    const formatGuidance =
      sourceVersion.format === DeliverableFormat.MARKDOWN
        ? ' Please format your response in Markdown.'
        : sourceVersion.format === DeliverableFormat.JSON
          ? ' Please format your response as valid JSON.'
          : sourceVersion.format === DeliverableFormat.HTML
            ? ' Please format your response as HTML.'
            : ' Please format your response as plain text.';

    return `${basePrompt}${contextPrompt}${formatGuidance}

Please provide a fresh response to the user's request. Do not reference this being a "rerun" or mention previous versions.`;
  }
}
