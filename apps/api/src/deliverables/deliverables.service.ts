import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateDeliverableDto,
  UpdateDeliverableDto,
  CreateVersionDto,
  DeliverableFiltersDto,
} from './dto';
import {
  Deliverable,
  DeliverableVersion,
  DeliverableSearchResult,
} from './entities/deliverable.entity';
import { getTableName } from '../supabase/supabase.config';
import { DeliverableVersionsService } from './deliverable-versions.service';

@Injectable()
export class DeliverablesService {
  private readonly logger = new Logger(DeliverablesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly versionsService: DeliverableVersionsService,
  ) {}

  /**
   * Create a new deliverable with optional initial version
   */
  async create(
    createDto: CreateDeliverableDto,
    userId: string,
  ): Promise<Deliverable> {
    this.logger.log(
      `Creating deliverable: ${createDto.title} for user: ${userId}`,
    );

    try {
      // First, create the deliverable record
      const { data: deliverableData, error: deliverableError } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .insert([
          {
            user_id: userId,
            conversation_id: createDto.conversationId,
            project_step_id: createDto.projectStepId || null,
            title: createDto.title,
            type: createDto.type || null,
          },
        ])
        .select('*')
        .single();

      if (deliverableError) {
        this.logger.error('Failed to create deliverable:', deliverableError);
        throw new BadRequestException(
          `Failed to create deliverable: ${deliverableError.message}`,
        );
      }

      this.logger.log(`Deliverable created successfully: ${deliverableData.id}`);

      // Always create an initial version
      // Log what content we're working with for debugging
      this.logger.log(`Creating initial version for deliverable ${deliverableData.id} with content length: ${(createDto.initialContent || '').length}`);
      if (createDto.initialContent) {
        this.logger.log(`Initial content preview: ${createDto.initialContent.substring(0, 100)}...`);
      } else {
        this.logger.warn(`No initial content provided for deliverable ${deliverableData.id} - this might indicate a content extraction issue`);
      }
      
      const initialVersion = await this.createInitialVersion(
        deliverableData.id,
        createDto,
        userId,
      );
      this.logger.log(`Initial version created: ${initialVersion.id} for deliverable: ${deliverableData.id}`);

      return await this.findOne(deliverableData.id, userId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error creating deliverable:', error);
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
    this.logger.log(
      `Finding deliverables for user: ${userId} with filters: ${JSON.stringify(filters)}`,
    );

    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .rpc('search_deliverables_with_versions', {
          search_user_id: userId,
          search_term: filters.search || null,
          filter_type: filters.type || null,
          filter_format: filters.format || null,
          latest_only: filters.latestOnly !== false,
          limit_count: filters.limit || 50,
          offset_count: filters.offset || 0,
        });

      if (error) {
        this.logger.error('Failed to search deliverables:', error);
        throw new BadRequestException(
          `Failed to search deliverables: ${error.message}`,
        );
      }

      const results = data || [];
      const items = results.map((item: any) => this.mapToSearchResult(item));
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      return {
        items,
        total: items.length, // TODO: Get actual total count from DB
        limit,
        offset,
        hasMore: items.length === limit, // Simple heuristic - if we got exactly limit items, there might be more
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error searching deliverables:', error);
      throw new BadRequestException('Failed to search deliverables');
    }
  }

  /**
   * Find a specific deliverable by ID with current version data
   */
  async findOne(id: string, userId: string): Promise<Deliverable> {
    this.logger.log(`Finding deliverable: ${id} for user: ${userId}`);

    try {
      // Get the deliverable record
      const { data: deliverableData, error: deliverableError } = await this.supabaseService
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
        this.logger.error('Failed to find deliverable:', deliverableError);
        throw new BadRequestException(
          `Failed to find deliverable: ${deliverableError.message}`,
        );
      }

      const deliverable = this.mapToDeliverable(deliverableData);
      
      // Get current version using the versions service
      try {
        const currentVersion = await this.versionsService.getCurrentVersion(id, userId);
        if (currentVersion) {
          deliverable.currentVersion = currentVersion;
          this.logger.debug(`Current version loaded: ${currentVersion.id} for deliverable: ${id}`);
        } else {
          this.logger.warn(`No current version found for deliverable: ${id}`);
        }
      } catch (error) {
        this.logger.error(`Failed to get current version for deliverable ${id}:`, error);
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
      this.logger.error('Unexpected error finding deliverable:', error);
      throw new BadRequestException('Failed to find deliverable');
    }
  }

  /**
   * Find deliverables by conversation ID
   */
  async findByConversation(conversationId: string, userId: string): Promise<Deliverable[]> {
    this.logger.log(`Finding deliverables for conversation: ${conversationId} for user: ${userId}`);

    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Failed to find deliverables by conversation:', error);
        throw new BadRequestException(`Failed to find deliverables by conversation: ${error.message}`);
      }

      // Get current versions for each deliverable
      const deliverables = data || [];
      const deliverableResults = await Promise.all(
        deliverables.map(async (deliverableData) => {
          const deliverable = this.mapToDeliverable(deliverableData);
          
          // Get current version using the versions service
          try {
            const currentVersion = await this.versionsService.getCurrentVersion(deliverableData.id, userId);
            if (currentVersion) {
              deliverable.currentVersion = currentVersion;
            }
          } catch (error) {
            this.logger.error(`Failed to get current version for deliverable ${deliverableData.id}:`, error);
            // Continue without current version
          }

          return deliverable;
        })
      );

      return deliverableResults;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error finding deliverables by conversation:', error);
      throw new BadRequestException('Failed to find deliverables by conversation');
    }
  }

  /**
   * Update deliverable metadata (title, description, type)
   */
  async update(
    id: string,
    updateDto: UpdateDeliverableDto,
    userId: string,
  ): Promise<Deliverable> {
    this.logger.log(`Updating deliverable metadata: ${id} for user: ${userId}`);

    try {
      // First verify the deliverable exists and belongs to the user
      await this.findOne(id, userId);

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Only update fields that are provided
      if (updateDto.title !== undefined) updateData.title = updateDto.title;
      if (updateDto.type !== undefined) updateData.type = updateDto.type;
      if (updateDto.projectStepId !== undefined) updateData.project_step_id = updateDto.projectStepId;

      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) {
        this.logger.error('Failed to update deliverable:', error);
        throw new BadRequestException(
          `Failed to update deliverable: ${error.message}`,
        );
      }

      this.logger.log(`Deliverable updated successfully: ${id}`);
      return await this.findOne(id, userId); // Return with current version data
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Unexpected error updating deliverable:', error);
      throw new BadRequestException('Failed to update deliverable');
    }
  }

  /**
   * Create a new version of an existing deliverable
   * Delegates to the versions service
   */
  async createVersion(
    deliverableId: string,
    createVersionDto: CreateVersionDto,
    userId: string,
  ): Promise<DeliverableVersion> {
    return this.versionsService.createVersion(deliverableId, createVersionDto, userId);
  }

  /**
   * Get version history for a deliverable
   * Delegates to the versions service
   */
  async getVersionHistory(
    deliverableId: string,
    userId: string,
  ): Promise<DeliverableVersion[]> {
    return this.versionsService.getVersionHistory(deliverableId, userId);
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
      this.logger.error('Failed to create initial version:', error);
      throw new BadRequestException(`Failed to create initial version: ${error.message}`);
    }

    this.logger.log(`Initial version created successfully: ${data.id} (v1) with content length: ${(createDto.initialContent || '').length}`);
    return this.mapToVersion(data);
  }

  /**
   * Delete a deliverable (soft delete by marking as deleted)
   */
  async remove(id: string, userId: string): Promise<void> {
    this.logger.log(`Deleting deliverable: ${id} for user: ${userId}`);

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
        this.logger.error('Failed to delete deliverable:', error);
        throw new BadRequestException(
          `Failed to delete deliverable: ${error.message}`,
        );
      }

      this.logger.log(`Deliverable deleted successfully: ${id}`);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Unexpected error deleting deliverable:', error);
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
      metadata: data.metadata || {},
      versionNumber: data.version_number,
      isCurrentVersion: data.is_current_version,
      versionId: data.version_id,
    };
  }
}
