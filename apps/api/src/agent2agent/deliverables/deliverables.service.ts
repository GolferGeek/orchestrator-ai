import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  CreateDeliverableDto,
  UpdateDeliverableDto,
  DeliverableFiltersDto,
  CreateEditingConversationDto,
  DeliverableVersionCreationType,
} from './dto';
import {
  Deliverable,
  DeliverableVersion,
  DeliverableSearchResult,
} from './entities/deliverable.entity';
import { getTableName } from '@/supabase/supabase.config';
import { DeliverableVersionsService } from './deliverable-versions.service';
import { AgentConversationsService } from '@/agent2agent/conversations/agent-conversations.service';
import { CreateAgentConversationDto } from '@/agent2agent/types/agent-conversations.types';
import {
  IActionHandler,
  ActionExecutionContext,
  ActionResult,
} from '../common/interfaces/action-handler.interface';

@Injectable()
export class DeliverablesService implements IActionHandler {
  private readonly logger = new Logger(DeliverablesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly versionsService: DeliverableVersionsService,
    private readonly agentConversationsService: AgentConversationsService,
  ) {}

  // ============================================================================
  // MAIN ENTRY POINT - Mode × Action Architecture
  // ============================================================================

  /**
   * Main entry point for all deliverable operations
   * Implements IActionHandler interface for mode × action routing
   *
   * Supported actions:
   * 1. create - Create or enhance a deliverable
   * 2. read - Get current deliverable
   * 3. list - Get version history
   * 4. edit - Save manual edit as new version
   * 5. rerun - Rerun with different LLM
   * 6. set_current - Set a specific version as current
   * 7. delete_version - Delete a specific version
   * 8. merge_versions - LLM-based merge of multiple versions
   * 9. copy_version - Duplicate a version
   * 10. delete - Delete entire deliverable
   */
  async executeAction<T = any>(
    action: string,
    params: any,
    context: ActionExecutionContext,
  ): Promise<ActionResult<T>> {
    try {
      this.logger.debug(
        `Executing deliverable action: ${action}`,
        JSON.stringify({ action, context }),
      );

      let result: any;

      switch (action) {
        case 'create':
          result = await this.createOrEnhance(params, context);
          break;

        case 'read':
          result = await this.getCurrentDeliverable(context);
          break;

        case 'list':
          result = await this.getVersionHistory(context);
          break;

        case 'edit':
          result = await this.saveManualEdit(params, context);
          break;

        case 'rerun':
          result = await this.rerunWithLLM(params, context);
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
          result = await this.deleteDeliverable(context);
          break;

        default:
          throw new BadRequestException(
            `Unknown deliverable action: ${action}`,
          );
      }

      return {
        success: true,
        data: result as T,
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute deliverable action ${action}:`,
        error,
      );
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
  // ACTION HANDLERS (Private methods)
  // ============================================================================

  /**
   * Action: create
   * Create new deliverable or enhance existing (creates new version)
   */
  private async createOrEnhance(
    params: {
      title: string;
      content: string;
      format?: string;
      type?: string;
      agentName?: string;
      taskId?: string;
      metadata?: Record<string, any>;
    },
    context: ActionExecutionContext,
  ) {
    // Check if deliverable already exists for this conversation
    const existingDeliverables = await this.findByConversationId(
      context.conversationId,
      context.userId,
    );

    const existingDeliverable = existingDeliverables[0];
    if (existingDeliverable) {
      // Enhance existing deliverable - create new version
      const newVersion = await this.versionsService.createVersion(
        existingDeliverable.id,
        {
          content: params.content,
          format: (params.format as any) || 'markdown',
          createdByType: DeliverableVersionCreationType.AI_RESPONSE,
          taskId: params.taskId || context.taskId,
          metadata: params.metadata || {},
        },
        context.userId,
      );

      return {
        deliverable: await this.findOne(existingDeliverable.id, context.userId),
        version: newVersion,
        isNew: false,
      };
    } else {
      // Create new deliverable
      const createDto: CreateDeliverableDto = {
        conversationId: context.conversationId,
        title: params.title,
        type: params.type as any,
        agentName: params.agentName || context.agentSlug,
        initialContent: params.content,
        initialFormat: (params.format as any) || 'markdown',
        initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
        initialTaskId: params.taskId || context.taskId,
        initialMetadata: params.metadata || {},
      };

      const deliverable = await this.create(createDto, context.userId);

      return {
        deliverable,
        version: deliverable.currentVersion,
        isNew: true,
      };
    }
  }

  /**
   * Action: read
   * Get current deliverable with current version
   */
  private async getCurrentDeliverable(context: ActionExecutionContext) {
    const deliverables = await this.findByConversationId(
      context.conversationId,
      context.userId,
    );

    const deliverable = deliverables[0];
    if (!deliverable) {
      throw new NotFoundException(
        `No deliverable found for conversation ${context.conversationId}`,
      );
    }

    return this.findOne(deliverable.id, context.userId);
  }

  /**
   * Action: list
   * Get version history for deliverable
   */
  private async getVersionHistory(context: ActionExecutionContext) {
    const deliverables = await this.findByConversationId(
      context.conversationId,
      context.userId,
    );

    const deliverable = deliverables[0];
    if (!deliverable) {
      throw new NotFoundException(
        `No deliverable found for conversation ${context.conversationId}`,
      );
    }

    const versions = await this.versionsService.getVersionHistory(
      deliverable.id,
      context.userId,
    );

    return { deliverable, versions };
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
    const deliverables = await this.findByConversationId(
      context.conversationId,
      context.userId,
    );

    const deliverable = deliverables[0];
    if (!deliverable) {
      throw new NotFoundException(
        `No deliverable found for conversation ${context.conversationId}`,
      );
    }

    const currentVersion = await this.versionsService.getCurrentVersion(
      deliverable.id,
      context.userId,
    );

    if (!currentVersion) {
      throw new NotFoundException(`No current version found for deliverable`);
    }

    const newVersion = await this.versionsService.createVersion(
      deliverable.id,
      {
        content: params.content,
        format: currentVersion.format,
        createdByType: DeliverableVersionCreationType.MANUAL_EDIT,
        metadata: {
          ...params.metadata,
          editedFromVersionId: currentVersion.id,
          editedAt: new Date().toISOString(),
        },
      },
      context.userId,
    );

    return {
      deliverable: await this.findOne(deliverable.id, context.userId),
      version: newVersion,
    };
  }

  /**
   * Action: rerun
   * Rerun deliverable with different LLM
   */
  private async rerunWithLLM(
    params: {
      versionId: string;
      provider: string;
      model: string;
      temperature?: number;
      maxTokens?: number;
    },
    context: ActionExecutionContext,
  ) {
    return this.versionsService.rerunWithDifferentLLM(
      params.versionId,
      {
        provider: params.provider,
        model: params.model,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
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

    const deliverable = await this.findOne(
      version.deliverableId,
      context.userId,
    );

    return { deliverable, version };
  }

  /**
   * Action: delete_version
   * Delete a specific version
   */
  private async deleteVersion(
    params: { versionId: string },
    context: ActionExecutionContext,
  ) {
    return this.versionsService.deleteVersion(params.versionId, context.userId);
  }

  /**
   * Action: merge_versions
   * Merge multiple versions using LLM
   */
  private async mergeVersions(
    params: {
      versionIds: string[];
      mergePrompt: string;
    },
    context: ActionExecutionContext,
  ) {
    const deliverables = await this.findByConversationId(
      context.conversationId,
      context.userId,
    );

    const deliverable = deliverables[0];
    if (!deliverable) {
      throw new NotFoundException(
        `No deliverable found for conversation ${context.conversationId}`,
      );
    }

    const result = await this.versionsService.mergeVersions(
      deliverable.id,
      params.versionIds,
      params.mergePrompt,
      context.userId,
    );

    return {
      deliverable: await this.findOne(deliverable.id, context.userId),
      newVersion: result.newVersion,
      conflictSummary: result.conflictSummary,
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
    const newVersion = await this.versionsService.copyVersion(
      params.versionId,
      context.userId,
    );

    const deliverable = await this.findOne(
      newVersion.deliverableId,
      context.userId,
    );

    return { deliverable, version: newVersion };
  }

  /**
   * Action: delete
   * Delete entire deliverable and all versions
   */
  private async deleteDeliverable(context: ActionExecutionContext) {
    const deliverables = await this.findByConversationId(
      context.conversationId,
      context.userId,
    );

    const deliverable = deliverables[0];
    if (!deliverable) {
      throw new NotFoundException(
        `No deliverable found for conversation ${context.conversationId}`,
      );
    }

    await this.remove(deliverable.id, context.userId);

    return {
      success: true,
      message: `Deliverable ${deliverable.id} deleted successfully`,
    };
  }

  // ============================================================================
  // EXISTING PUBLIC METHODS (Keep for backward compatibility)
  // ============================================================================

  /**
   * Create a new deliverable with optional initial version
   */
  async create(
    createDto: CreateDeliverableDto,
    userId: string,
  ): Promise<Deliverable> {
    try {
      // First, create the deliverable record
      const { data: deliverableData, error: deliverableError } =
        await this.supabaseService
          .getServiceClient()
          .from(getTableName('deliverables'))
          .insert([
            {
              user_id: userId,
              conversation_id: createDto.conversationId,
              project_step_id: createDto.projectStepId || null,
              agent_name: createDto.agentName || null,
              title: createDto.title,
              type: createDto.type || null,
            },
          ])
          .select('*')
          .single();

      if (deliverableError) {
        throw new BadRequestException(
          `Failed to create deliverable: ${deliverableError.message}`,
        );
      }

      // Always create an initial version
      // Log what content we're working with for debugging

      if (createDto.initialContent) {
      } else {
      }

      const initialVersion = await this.createInitialVersion(
        deliverableData.id,
        createDto,
        userId,
      );

      return await this.findOne(deliverableData.id, userId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to create deliverable');
    }
  }

  /**
   * Find all deliverables for a user with optional filtering
   */
  async findAll(
    userId: string,
    filters: DeliverableFiltersDto,
  ): Promise<{
    items: DeliverableSearchResult[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    try {
      // Build query with deliverable and version data
      let query = this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .select(
          `
          *,
          deliverable_versions!deliverable_versions_deliverable_id_fkey(
            id,
            version_number,
            content,
            format,
            metadata,
            created_at,
            is_current_version
          )
        `,
        )
        .eq('user_id', userId);

      // Add search filter if provided
      if (filters.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
        );
      }

      // Add type filter if provided
      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      // Add standalone filter if provided
      if (filters.standalone === true) {
        query = query.is('conversation_id', null);
      } else if (filters.standalone === false) {
        query = query.not('conversation_id', 'is', null);
      }

      // Add ordering, limit, and offset
      query = query
        .order('created_at', { ascending: false })
        .range(
          filters.offset || 0,
          (filters.offset || 0) + (filters.limit || 50) - 1,
        );

      const { data, error } = await query;

      if (error) {
        throw new BadRequestException(
          `Failed to find deliverables: ${error.message}`,
        );
      }

      const deliverables = data || [];
      const items = deliverables.map((deliverable: any) => {
        // Get the current version or the first version if no current version is marked
        const currentVersion =
          deliverable.deliverable_versions?.find(
            (v: any) => v.is_current_version,
          ) || deliverable.deliverable_versions?.[0];

        return {
          id: deliverable.id,
          userId: deliverable.user_id,
          conversationId: deliverable.conversation_id,
          title: deliverable.title,
          type: deliverable.type,
          createdAt: new Date(deliverable.created_at),
          updatedAt: new Date(deliverable.updated_at),
          format: currentVersion?.format || null,
          content: currentVersion?.content || null,
          metadata: currentVersion?.metadata || deliverable.metadata || {},
          versionNumber: currentVersion?.version_number || null,
          isCurrentVersion: currentVersion?.is_current_version || false,
          versionId: currentVersion?.id || null,
        } as DeliverableSearchResult;
      });

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      return {
        items,
        total: items.length, // Simple count of returned items
        limit,
        offset,
        hasMore: items.length === limit, // Simple heuristic - if we got exactly limit items, there might be more
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to find deliverables');
    }
  }

  /**
   * Find deliverables by conversation ID
   */
  async findByConversationId(
    conversationId: string,
    userId: string,
  ): Promise<Deliverable[]> {
    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) {
        throw new BadRequestException(
          `Failed to find deliverables by conversation: ${error.message}`,
        );
      }

      const deliverables =
        data?.map((item) => this.mapToDeliverable(item)) || [];
      return deliverables;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find a specific deliverable by ID with current version data
   */
  async findOne(id: string, userId: string): Promise<Deliverable> {
    try {
      // Get the deliverable record
      const { data: deliverableData, error: deliverableError } =
        await this.supabaseService
          .getServiceClient()
          .from(getTableName('deliverables'))
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single();

      if (deliverableError) {
        if (deliverableError.code === 'PGRST116') {
          throw new NotFoundException(`Deliverable not found: ${id}`);
        }

        throw new BadRequestException(
          `Failed to find deliverable: ${deliverableError.message}`,
        );
      }

      const deliverable = this.mapToDeliverable(deliverableData);

      // Get current version using the versions service
      try {
        const currentVersion = await this.versionsService.getCurrentVersion(
          id,
          userId,
        );
        if (currentVersion) {
          deliverable.currentVersion = currentVersion;
        } else {
        }
      } catch (_error) {
        // Don't throw here, just return deliverable without current version
      }

      return deliverable;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to find deliverable');
    }
  }

  /**
   * Find deliverables by conversation ID
   */
  async findByConversation(
    conversationId: string,
    userId: string,
  ): Promise<Deliverable[]> {
    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new BadRequestException(
          `Failed to find deliverables by conversation: ${error.message}`,
        );
      }

      // Get current versions for each deliverable
      const deliverables = data || [];
      const deliverableResults = await Promise.all(
        deliverables.map(async (deliverableData) => {
          const deliverable = this.mapToDeliverable(deliverableData);

          // Get current version using the versions service
          try {
            const currentVersion = await this.versionsService.getCurrentVersion(
              deliverableData.id,
              userId,
            );
            if (currentVersion) {
              deliverable.currentVersion = currentVersion;
            }
          } catch (_error) {
            // Continue without current version
          }

          return deliverable;
        }),
      );

      return deliverableResults;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Failed to find deliverables by conversation',
      );
    }
  }

  /**
   * Extract content from task response
   */
  private extractContentFromResponse(response: any): string | null {
    let result = response;
    if (typeof response === 'string') {
      try {
        result = JSON.parse(response);
      } catch {
        return response.length > 100 ? response : null;
      }
    }

    return result?.response || result?.message || result?.content || null;
  }

  /**
   * Check if content should create a deliverable
   */
  private shouldCreateDeliverable(content: string): boolean {
    if (!content || content.length < 100) {
      return false;
    }

    // Check for document-like structure
    return (
      content.includes('#') || content.includes('\n\n') || content.length > 500
    );
  }

  /**
   * Extract title from content
   */
  private extractTitleFromContent(content: string): string {
    // Look for markdown H1 header
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      return h1Match[1].trim();
    }

    // Look for first line as title
    const firstLine = content.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100) {
      return firstLine.replace(/^#+\s*/, ''); // Remove markdown headers
    }

    // Default title
    return 'Task Result';
  }

  /**
   * Update deliverable metadata (title, description, type)
   */
  async update(
    id: string,
    updateDto: UpdateDeliverableDto,
    userId: string,
  ): Promise<Deliverable> {
    try {
      // First verify the deliverable exists and belongs to the user
      await this.findOne(id, userId);

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Only update fields that are provided
      if (updateDto.title !== undefined) updateData.title = updateDto.title;
      if (updateDto.type !== undefined) updateData.type = updateDto.type;
      if (updateDto.projectStepId !== undefined)
        updateData.project_step_id = updateDto.projectStepId;
      if (updateDto.agentName !== undefined)
        updateData.agent_name = updateDto.agentName;

      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) {
        throw new BadRequestException(
          `Failed to update deliverable: ${error.message}`,
        );
      }

      return await this.findOne(id, userId); // Return with current version data
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to update deliverable');
    }
  }

  /**
   * Create an editing conversation for a standalone deliverable
   */
  async createEditingConversation(
    deliverableId: string,
    dto: CreateEditingConversationDto,
    userId: string,
  ): Promise<{ conversationId: string; message: string }> {
    try {
      // First, verify the deliverable exists and belongs to the user
      const deliverable = await this.findOne(deliverableId, userId);
      if (!deliverable) {
        throw new NotFoundException('Deliverable not found');
      }

      // Determine which agent to use (from DTO or from deliverable)
      const agentName =
        dto.agentName || deliverable.agentName || 'write_blog_post';

      // Note: We default to 'write_blog_post' agent for editing deliverables when no agent is specified
      // This provides a sensible fallback for document editing tasks

      // Determine the action type for context
      const action = dto.action || 'edit';

      // Create context metadata for the conversation
      const conversationMetadata = {
        deliverableId,
        deliverableTitle: deliverable.title,
        deliverableType: deliverable.type,
        editingAction: action,
        context: 'deliverable_editing',
      };

      // Create the conversation
      const conversationDto: CreateAgentConversationDto = {
        agentName,
        agentType: 'marketing', // Use marketing for blog_post agent
        metadata: conversationMetadata,
        workProduct: {
          type: 'deliverable',
          id: deliverableId,
        },
      };

      const conversation =
        await this.agentConversationsService.createConversation(
          userId,
          conversationDto,
        );

      // Link the deliverable to the new conversation
      await this.linkToConversation(deliverableId, conversation.id, userId);

      // Generate an appropriate initial message based on the action
      const initialMessage =
        dto.initialMessage ||
        this.generateInitialMessage(action, deliverable.title);

      return {
        conversationId: conversation.id,
        message: initialMessage,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to create editing conversation');
    }
  }

  /**
   * Link a deliverable to a conversation
   */
  async linkToConversation(
    deliverableId: string,
    conversationId: string,
    userId: string,
  ): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .update({ conversation_id: conversationId })
        .eq('id', deliverableId)
        .eq('user_id', userId);

      if (error) {
        throw new BadRequestException(
          `Failed to link deliverable to conversation: ${error.message}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Failed to link deliverable to conversation',
      );
    }
  }

  /**
   * Generate an appropriate initial message for the editing conversation
   */
  private generateInitialMessage(
    action: string,
    deliverableTitle: string,
  ): string {
    switch (action) {
      case 'edit':
        return `I'd like to edit the deliverable "${deliverableTitle}". Please help me make improvements to the content.`;
      case 'enhance':
        return `I want to enhance the deliverable "${deliverableTitle}" with additional details, examples, or improvements.`;
      case 'revise':
        return `I need to revise the deliverable "${deliverableTitle}". Please help me refine and improve the existing content.`;
      case 'discuss':
        return `I'd like to discuss the deliverable "${deliverableTitle}". I may have questions or want to explore ways to improve it.`;
      case 'new-version':
        return `I want to create a new version of the deliverable "${deliverableTitle}" based on new requirements or insights.`;
      default:
        return `I'd like to edit the deliverable "${deliverableTitle}". Please help me make improvements to the content.`;
    }
  }

  /**
   * Create initial version for a new deliverable
   */
  private async createInitialVersion(
    deliverableId: string,
    createDto: CreateDeliverableDto,
    userId: string,
  ): Promise<DeliverableVersion> {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('deliverable_versions'))
      .insert([
        {
          deliverable_id: deliverableId,
          version_number: 1,
          content: createDto.initialContent || '', // Default to empty string if no content
          format: createDto.initialFormat || 'text', // Default to text format
          is_current_version: true,
          created_by_type: createDto.initialCreationType || 'user_request', // Default creation type
          task_id: createDto.initialTaskId || null,
          metadata: createDto.initialMetadata || {},
          file_attachments: {},
        },
      ])
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to create initial version: ${error.message}`,
      );
    }

    return this.mapToVersion(data);
  }

  /**
   * Delete a deliverable (soft delete by marking as deleted)
   */
  async remove(id: string, userId: string): Promise<void> {
    try {
      // Verify the deliverable exists and belongs to the user
      await this.findOne(id, userId);

      const { error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw new BadRequestException(
          `Failed to delete deliverable: ${error.message}`,
        );
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to delete deliverable');
    }
  }

  /**
   * Check if content contains deliverable markers (for auto-detection)
   */
  isDeliverableContent(content: string): boolean {
    const deliverableMarkers = [
      '**📋',
      'Requirements Document:',
      'Analysis Report:',
      'Technical Document:',
      '# Executive Summary',
      '## Deliverable:',
    ];

    return deliverableMarkers.some((marker) => content.includes(marker));
  }

  /**
   * Extract deliverable from content (for auto-persistence)
   */
  extractDeliverableFromContent(content: string): {
    title: string;
    extractedContent: string;
    type: string;
  } | null {
    // Look for deliverable markers and extract structured content
    const deliverableMatch = content.match(
      /\*\*📋\s*(.*?):\*\*\n\n([\s\S]*?)(?=\n\n---|\n\n\*\*|$)/,
    );

    if (deliverableMatch && deliverableMatch[1] && deliverableMatch[2]) {
      const title = deliverableMatch[1].trim();
      const extractedContent = deliverableMatch[2].trim();

      // Determine type based on title
      let type = 'document';
      if (title.toLowerCase().includes('requirement')) type = 'requirements';
      else if (title.toLowerCase().includes('analysis')) type = 'analysis';
      else if (title.toLowerCase().includes('report')) type = 'report';
      else if (title.toLowerCase().includes('plan')) type = 'plan';

      return { title, extractedContent, type };
    }

    return null;
  }

  // Helper methods for mapping database results to entities
  private mapToDeliverable(data: any): Deliverable {
    return {
      id: data.id,
      userId: data.user_id,
      conversationId: data.conversation_id,
      projectStepId: data.project_step_id,
      agentName: data.agent_name,
      title: data.title,
      type: data.type,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
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

  private mapToSearchResult(data: any): DeliverableSearchResult {
    return {
      id: data.id,
      userId: data.user_id,
      conversationId: data.conversation_id,
      title: data.title,
      type: data.type,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      format: data.format,
      content: data.content,
      metadata: data.version_metadata || data.metadata || {},
      versionNumber: data.version_number,
      isCurrentVersion: data.is_current_version,
      versionId: data.version_id,
    };
  }
}
