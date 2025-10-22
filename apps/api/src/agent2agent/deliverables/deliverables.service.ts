import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  CreateDeliverableDto,
  UpdateDeliverableDto,
  DeliverableFiltersDto,
  CreateEditingConversationDto,
  DeliverableVersionCreationType,
  DeliverableType,
  DeliverableFormat,
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

/**
 * Database record type for deliverables table
 */
interface DeliverableDbRecord {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  type: string;
  format: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * Union type for all possible action parameters
 */
type DeliverableActionParams =
  | {
      // create action
      title: string;
      content: string;
      format?: string;
      type?: string;
      agentName?: string;
      taskId?: string;
      metadata?: Record<string, unknown>;
      deliverableId?: string;
    }
  | {
      // edit action
      content: string;
      metadata?: Record<string, unknown>;
    }
  | {
      // rerun action
      versionId: string;
      config: {
        provider: string;
        model: string;
        temperature?: number;
        maxTokens?: number;
      };
    }
  | {
      // set_current, delete_version, copy_version actions
      versionId: string;
    }
  | {
      // merge_versions action
      versionIds: string[];
      mergePrompt: string;
      providerName?: string;
      modelName?: string;
    }
  | Record<string, never>; // For actions like read, list, delete that don't need params

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
  async executeAction<T = unknown, TParams = DeliverableActionParams>(
    action: string,
    params: TParams,
    context: ActionExecutionContext,
  ): Promise<ActionResult<T>> {
    try {
      this.logger.debug(
        `Executing deliverable action: ${action}`,
        JSON.stringify({ action, context }),
      );

      let result: unknown;

      switch (action) {
        case 'create':
          result = await this.createOrEnhance(
            params as {
              title: string;
              content: string;
              format?: string;
              type?: string;
              agentName?: string;
              taskId?: string;
              metadata?: Record<string, unknown>;
              deliverableId?: string;
            },
            context,
          );
          break;

        case 'read':
          result = await this.getCurrentDeliverable(context);
          break;

        case 'list':
          result = await this.getVersionHistory(context);
          break;

        case 'edit':
          result = await this.saveManualEdit(
            params as {
              content: string;
              metadata?: Record<string, unknown>;
            },
            context,
          );
          break;

        case 'rerun':
          result = await this.rerunWithLLM(
            params as {
              versionId: string;
              config: {
                provider: string;
                model: string;
                temperature?: number;
                maxTokens?: number;
              };
            },
            context,
          );
          break;

        case 'set_current':
          result = await this.setCurrentVersion(
            params as { versionId: string },
            context,
          );
          break;

        case 'delete_version':
          result = await this.deleteVersion(
            params as { versionId: string },
            context,
          );
          break;

        case 'merge_versions':
          result = await this.mergeVersions(
            params as {
              versionIds: string[];
              mergePrompt: string;
              providerName?: string;
              modelName?: string;
            },
            context,
          );
          break;

        case 'copy_version':
          result = await this.copyVersion(
            params as { versionId: string },
            context,
          );
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
      metadata?: Record<string, unknown>;
      deliverableId?: string;
    },
    context: ActionExecutionContext,
  ) {
    const explicitDeliverableId = this.normalizeDeliverableId(
      params.deliverableId ??
        context.metadata?.deliverableId ??
        context.metadata?.deliverable_id ??
        params.metadata?.deliverableId ??
        params.metadata?.deliverable_id,
    );

    let existingDeliverable: Deliverable | null = null;

    if (explicitDeliverableId) {
      try {
        existingDeliverable = await this.findOne(
          explicitDeliverableId,
          context.userId,
        );
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new NotFoundException(
            `Deliverable ${explicitDeliverableId} not found for enhancement`,
          );
        }
        throw error;
      }
    } else {
      const deliverables = await this.findByConversationId(
        context.conversationId,
        context.userId,
      );
      existingDeliverable = deliverables[0] ?? null;
    }

    if (existingDeliverable) {
      // Enhance existing deliverable - create new version
      const newVersion = await this.versionsService.createVersion(
        existingDeliverable.id,
        {
          content: params.content,
          format:
            (params.format as DeliverableFormat) || DeliverableFormat.MARKDOWN,
          createdByType: DeliverableVersionCreationType.AI_RESPONSE,
          taskId: params.taskId ?? context.taskId ?? undefined,
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
        type: params.type as DeliverableType,
        agentName: params.agentName ?? context.agentSlug ?? undefined,
        initialContent: params.content,
        initialFormat:
          (params.format as DeliverableFormat) || DeliverableFormat.MARKDOWN,
        initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
        initialTaskId: params.taskId ?? context.taskId ?? undefined,
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

  private normalizeDeliverableId(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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

    const deliverableWithVersion = await this.findOne(
      deliverable.id,
      context.userId,
    );

    // Return in strict A2A protocol format: { deliverable, version }
    const currentVersion = deliverableWithVersion.currentVersion;
    return {
      deliverable: {
        id: deliverableWithVersion.id,
        conversationId: deliverableWithVersion.conversationId,
        currentVersionId: currentVersion?.id || null,
        createdAt: deliverableWithVersion.createdAt.toISOString(),
        updatedAt: deliverableWithVersion.updatedAt.toISOString(),
      },
      version: currentVersion || null,
    };
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
      metadata?: Record<string, unknown>;
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
   * Rerun deliverable with different LLM - matches BuildRerunPayload
   */
  private async rerunWithLLM(
    params: {
      versionId: string;
      config: {
        provider: string; // Required
        model: string; // Required
        temperature?: number;
        maxTokens?: number;
      };
    },
    context: ActionExecutionContext,
  ) {
    const { provider, model, temperature, maxTokens } = params.config;

    this.logger.debug(
      `🔄 [RERUN] versionId=${params.versionId}, provider=${provider}, model=${model}`,
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
    // Get version before deletion to get deliverable ID
    const version = await this.versionsService.getVersion(
      params.versionId,
      context.userId,
    );

    await this.versionsService.deleteVersion(params.versionId, context.userId);

    const deliverable = await this.findOne(
      version.deliverableId,
      context.userId,
    );
    const remainingVersions = await this.versionsService.getVersionHistory(
      version.deliverableId,
      context.userId,
    );

    // Return in strict A2A protocol format for BuildDeleteVersionResponse
    return {
      deletedVersionId: params.versionId,
      deliverable,
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
      providerName?: string;
      modelName?: string;
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
      params.providerName,
      params.modelName,
    );

    // Get source versions
    const sourceVersions = await Promise.all(
      params.versionIds.map((id) =>
        this.versionsService.getVersion(id, context.userId),
      ),
    );

    // Return in strict A2A protocol format for BuildMergeVersionsResponse
    return {
      deliverable: await this.findOne(deliverable.id, context.userId),
      mergedVersion: result.newVersion,
      sourceVersions,
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
    const sourceVersion = await this.versionsService.getVersion(
      params.versionId,
      context.userId,
    );

    const copiedVersion = await this.versionsService.copyVersion(
      params.versionId,
      context.userId,
    );

    const deliverable = await this.findOne(
      copiedVersion.deliverableId,
      context.userId,
    );

    // Return in strict A2A protocol format for BuildCopyVersionResponse
    return {
      sourceDeliverable: deliverable,
      sourceVersion,
      targetDeliverable: deliverable, // Same deliverable for copy
      copiedVersion,
    };
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

    // Get version count before deletion
    const versions = await this.versionsService.getVersionHistory(
      deliverable.id,
      context.userId,
    );
    const versionCount = versions.length;

    await this.remove(deliverable.id, context.userId);

    // Return in strict A2A protocol format for BuildDeleteResponse
    return {
      deletedDeliverableId: deliverable.id,
      deletedVersionCount: versionCount,
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
      const response: { data: unknown; error: unknown } =
        await this.supabaseService
          .getServiceClient()
          .from(getTableName('deliverables'))
          .insert([
            {
              user_id: userId,
              conversation_id: createDto.conversationId,
              agent_name: createDto.agentName || null,
              title: createDto.title,
              type: createDto.type || null,
            },
          ])
          .select('*')
          .single();

      const result: unknown = response.data;
      const deliverableError: unknown = response.error;
      const deliverableData = result as Pick<DeliverableDbRecord, 'id'> | null;

      if (deliverableError || !deliverableData) {
        throw new BadRequestException(
          `Failed to create deliverable: ${(deliverableError as { message?: string })?.message || 'No data returned'}`,
        );
      }

      // Always create an initial version
      await this.createInitialVersion(deliverableData.id, createDto);

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

      const { data: result, error } = await query;

      if (error) {
        throw new BadRequestException(
          `Failed to find deliverables: ${error.message}`,
        );
      }

      const deliverables = (result as DeliverableDbRecord[] | null) || [];
      const items = deliverables.map(
        (deliverable: {
          id: string;
          user_id: string;
          conversation_id?: string;
          title: string;
          type?: string;
          created_at: string | Date;
          updated_at: string | Date;
          metadata?: Record<string, unknown>;
          deliverable_versions?: Array<{
            id: string;
            is_current_version: boolean;
            format?: string;
            content?: string;
            metadata?: Record<string, unknown>;
            version_number?: number;
          }>;
        }) => {
          // Get the current version or the first version if no current version is marked
          const currentVersion =
            deliverable.deliverable_versions?.find(
              (v) => v.is_current_version,
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
        },
      );

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
    const { data: result, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('deliverables'))
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    const data = result as DeliverableDbRecord[] | null;

    if (error) {
      throw new BadRequestException(
        `Failed to find deliverables by conversation: ${error.message}`,
      );
    }

    return (
      data?.map(
        (item: {
          id: string;
          user_id: string;
          conversation_id?: string;
          agent_name?: string;
          title: string;
          type?: string;
          created_at: string | Date;
          updated_at: string | Date;
        }) => this.mapToDeliverable(item),
      ) || []
    );
  }

  /**
   * Find a specific deliverable by ID with current version data
   */
  async findOne(id: string, userId: string): Promise<Deliverable> {
    try {
      // Get the deliverable record
      const response: { data: unknown; error: unknown } =
        await this.supabaseService
          .getServiceClient()
          .from(getTableName('deliverables'))
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single();

      const result: unknown = response.data;
      const deliverableError: unknown = response.error;
      const deliverableData = result as DeliverableDbRecord | null;

      if (deliverableError || !deliverableData) {
        if ((deliverableError as { code?: string })?.code === 'PGRST116') {
          throw new NotFoundException(`Deliverable not found: ${id}`);
        }

        throw new BadRequestException(
          `Failed to find deliverable: ${(deliverableError as { message?: string })?.message || 'No data returned'}`,
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
        }
      } catch (error) {
        // Don't throw here, just return deliverable without current version
        this.logger.warn(
          `Failed to load current version for deliverable ${id}`,
          error instanceof Error ? error : { message: String(error) },
        );
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
      const { data: result, error } = await this.supabaseService
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
      const deliverables = (result as DeliverableDbRecord[] | null) || [];
      const deliverableResults = await Promise.all(
        deliverables.map(async (deliverableData: unknown) => {
          const typedData = deliverableData as {
            id: string;
            user_id: string;
            conversation_id?: string;
            agent_name?: string;
            title: string;
            type?: string;
            created_at: string | Date;
            updated_at: string | Date;
          };
          const deliverable = this.mapToDeliverable(typedData);

          // Get current version using the versions service
          try {
            const currentVersion = await this.versionsService.getCurrentVersion(
              typedData.id,
              userId,
            );
            if (currentVersion) {
              deliverable.currentVersion = currentVersion;
            }
          } catch (error) {
            // Continue without current version
            this.logger.warn(
              `Failed to load current version for deliverable ${typedData.id}`,
              error instanceof Error ? error : { message: String(error) },
            );
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
  private extractContentFromResponse(response: unknown): string | null {
    let result: unknown = response;
    if (typeof response === 'string') {
      try {
        result = JSON.parse(response) as unknown;
      } catch {
        return response.length > 100 ? response : null;
      }
    }

    const obj = result as Record<string, unknown> | null | undefined;
    return (
      (obj?.response as string) ||
      (obj?.message as string) ||
      (obj?.content as string) ||
      null
    );
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

      const updateData: {
        updated_at: string;
        title?: string;
        type?: string;
        agent_name?: string;
      } = {
        updated_at: new Date().toISOString(),
      };

      // Only update fields that are provided
      if (updateDto.title !== undefined) updateData.title = updateDto.title;
      if (updateDto.type !== undefined) updateData.type = updateDto.type;
      if (updateDto.agentName !== undefined)
        updateData.agent_name = updateDto.agentName;

      const { error } = await this.supabaseService
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
  ): Promise<DeliverableVersion> {
    const response: { data: unknown; error: unknown } =
      await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverable_versions'))
        .insert([
          {
            deliverable_id: deliverableId,
            version_number: 1,
            content:
              typeof createDto.initialContent === 'string'
                ? createDto.initialContent
                : '',
            format: createDto.initialFormat || 'text',
            is_current_version: true,
            created_by_type: createDto.initialCreationType || 'user_request', // Default creation type
            task_id: createDto.initialTaskId || null,
            metadata: createDto.initialMetadata || {},
            file_attachments: createDto.initialFileAttachments || {},
          },
        ])
        .select('*')
        .single();

    const result: unknown = response.data;
    const error: unknown = response.error;
    const data = result as Record<string, unknown> | null;

    if (error) {
      throw new BadRequestException(
        `Failed to create initial version: ${(error as { message?: string })?.message || 'Unknown error'}`,
      );
    }

    if (!data) {
      throw new BadRequestException(
        'Failed to create initial version: No data returned',
      );
    }
    return this.mapToVersion(
      data as unknown as Parameters<typeof this.mapToVersion>[0],
    );
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
  private mapToDeliverable(data: {
    id: string;
    user_id: string;
    conversation_id?: string;
    agent_name?: string;
    title: string;
    type?: string;
    created_at: string | Date;
    updated_at: string | Date;
  }): Deliverable {
    return {
      id: data.id,
      userId: data.user_id,
      conversationId: data.conversation_id,
      agentName: data.agent_name,
      title: data.title,
      type: data.type as DeliverableType | undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapToVersion(data: {
    id: string;
    deliverable_id: string;
    version_number: number;
    content?: string;
    format?: string;
    is_current_version: boolean;
    created_by_type: string;
    task_id?: string;
    metadata?: Record<string, unknown>;
    file_attachments?: Record<string, unknown>;
    created_at: string | Date;
    updated_at: string | Date;
  }): DeliverableVersion {
    return {
      id: data.id,
      deliverableId: data.deliverable_id,
      versionNumber: data.version_number,
      content: data.content,
      format: data.format as DeliverableFormat | undefined,
      isCurrentVersion: data.is_current_version,
      createdByType: data.created_by_type as DeliverableVersionCreationType,
      taskId: data.task_id,
      metadata: data.metadata || {},
      fileAttachments: data.file_attachments || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapToSearchResult(data: {
    id: string;
    user_id: string;
    conversation_id?: string;
    title: string;
    type?: string;
    created_at: string | Date;
    updated_at: string | Date;
    format?: string;
    content?: string;
    version_metadata?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    version_number?: number;
    is_current_version?: boolean;
    version_id?: string;
  }): DeliverableSearchResult {
    return {
      id: data.id,
      userId: data.user_id,
      conversationId: data.conversation_id,
      title: data.title,
      type: data.type as DeliverableType | undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      format: data.format as DeliverableFormat | undefined,
      content: data.content,
      metadata: data.version_metadata || data.metadata || {},
      versionNumber: data.version_number,
      isCurrentVersion: data.is_current_version,
      versionId: data.version_id,
    };
  }
}
