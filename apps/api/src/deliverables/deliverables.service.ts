import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { 
  CreateDeliverableDto, 
  UpdateDeliverableDto, 
  CreateVersionDto, 
  DeliverableFiltersDto 
} from './dto';
import { Deliverable, DeliverableVersion, DeliverableSearchResult } from './entities/deliverable.entity';

@Injectable()
export class DeliverablesService {
  private readonly logger = new Logger(DeliverablesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create a new deliverable
   */
  async create(createDto: CreateDeliverableDto, userId: string): Promise<Deliverable> {
    this.logger.log(`Creating deliverable: ${createDto.title} for user: ${userId}`);

    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from('deliverables')
        .insert([
          {
            user_id: userId,
            title: createDto.title,
            content: createDto.content,
            deliverable_type: createDto.deliverable_type,
            format: createDto.format,
            conversation_id: createDto.conversation_id || null,
            message_id: createDto.message_id || null,
            created_by_agent: createDto.created_by_agent || null,
            metadata: createDto.metadata || {},
            tags: createDto.tags || [],
          },
        ])
        .select('*')
        .single();

      if (error) {
        this.logger.error('Failed to create deliverable:', error);
        throw new BadRequestException(`Failed to create deliverable: ${error.message}`);
      }

      this.logger.log(`Deliverable created successfully: ${data.id}`);
      return this.mapToDeliverable(data);
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
  async findAll(userId: string, filters: DeliverableFiltersDto): Promise<{ items: DeliverableSearchResult[], total: number, limit: number, offset: number, has_more: boolean }> {
    this.logger.log(`Finding deliverables for user: ${userId} with filters: ${JSON.stringify(filters)}`);

    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .rpc('search_deliverables', {
          search_term: filters.search || null,
          filter_type: filters.type || null,
          filter_format: filters.format || null,
          limit_count: filters.limit || 50,
          offset_count: filters.offset || 0,
        });

      if (error) {
        this.logger.error('Failed to search deliverables:', error);
        throw new BadRequestException(`Failed to search deliverables: ${error.message}`);
      }

      let results = data || [];

      // Apply latest_only filter if specified
      if (filters.latest_only) {
        results = results.filter((item: any) => item.is_latest_version);
      }

      const items = results.map((item: any) => this.mapToSearchResult(item));
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      
      return {
        items,
        total: items.length, // TODO: Get actual total count from DB
        limit,
        offset,
        has_more: items.length === limit // Simple heuristic - if we got exactly limit items, there might be more
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
   * Find a specific deliverable by ID
   */
  async findOne(id: string, userId: string): Promise<Deliverable> {
    this.logger.log(`Finding deliverable: ${id} for user: ${userId}`);

    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from('deliverables')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundException(`Deliverable not found: ${id}`);
        }
        this.logger.error('Failed to find deliverable:', error);
        throw new BadRequestException(`Failed to find deliverable: ${error.message}`);
      }

      return this.mapToDeliverable(data);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
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
        .from('deliverables')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Failed to find deliverables by conversation:', error);
        throw new BadRequestException(`Failed to find deliverables by conversation: ${error.message}`);
      }

      return (data || []).map(item => this.mapToDeliverable(item));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error finding deliverables by conversation:', error);
      throw new BadRequestException('Failed to find deliverables by conversation');
    }
  }

  /**
   * Update a deliverable
   */
  async update(id: string, updateDto: UpdateDeliverableDto, userId: string): Promise<Deliverable> {
    this.logger.log(`Updating deliverable: ${id} for user: ${userId}`);

    try {
      // First verify the deliverable exists and belongs to the user
      await this.findOne(id, userId);

      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from('deliverables')
        .update({
          title: updateDto.title,
          content: updateDto.content,
          deliverable_type: updateDto.deliverable_type,
          format: updateDto.format,
          created_by_agent: updateDto.created_by_agent,
          metadata: updateDto.metadata,
          tags: updateDto.tags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) {
        this.logger.error('Failed to update deliverable:', error);
        throw new BadRequestException(`Failed to update deliverable: ${error.message}`);
      }

      this.logger.log(`Deliverable updated successfully: ${id}`);
      return this.mapToDeliverable(data);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error updating deliverable:', error);
      throw new BadRequestException('Failed to update deliverable');
    }
  }

  /**
   * Create a new version of an existing deliverable
   */
  async createVersion(parentId: string, createVersionDto: CreateVersionDto, userId: string): Promise<Deliverable> {
    this.logger.log(`Creating version of deliverable: ${parentId} for user: ${userId}`);

    try {
      // Verify parent exists and belongs to user
      await this.findOne(parentId, userId);

      const { data, error } = await this.supabaseService
        .getServiceClient()
        .rpc('create_deliverable_version', {
          parent_id: parentId,
          new_title: createVersionDto.title,
          new_content: createVersionDto.content,
          new_metadata: createVersionDto.metadata || {},
          created_by_agent_name: createVersionDto.created_by_agent || null,
        });

      if (error) {
        this.logger.error('Failed to create deliverable version:', error);
        throw new BadRequestException(`Failed to create version: ${error.message}`);
      }

      // Fetch the newly created version
      const newDeliverable = await this.findOne(data, userId);
      this.logger.log(`Deliverable version created successfully: ${data}`);
      return newDeliverable;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error creating deliverable version:', error);
      throw new BadRequestException('Failed to create version');
    }
  }

  /**
   * Get version history for a deliverable
   */
  async getVersionHistory(deliverableId: string, userId: string): Promise<DeliverableVersion[]> {
    this.logger.log(`Getting version history for deliverable: ${deliverableId} for user: ${userId}`);

    try {
      // Verify the deliverable exists and belongs to the user
      await this.findOne(deliverableId, userId);

      const { data, error } = await this.supabaseService
        .getServiceClient()
        .rpc('get_deliverable_versions', {
          deliverable_id: deliverableId,
        });

      if (error) {
        this.logger.error('Failed to get version history:', error);
        throw new BadRequestException(`Failed to get version history: ${error.message}`);
      }

      return (data || []).map((item: any) => this.mapToVersion(item));
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error getting version history:', error);
      throw new BadRequestException('Failed to get version history');
    }
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
        .from('deliverables')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Failed to delete deliverable:', error);
        throw new BadRequestException(`Failed to delete deliverable: ${error.message}`);
      }

      this.logger.log(`Deliverable deleted successfully: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
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

    return deliverableMarkers.some(marker => content.includes(marker));
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
    const deliverableMatch = content.match(/\*\*📋\s*(.*?):\*\*\n\n([\s\S]*?)(?=\n\n---|\n\n\*\*|$)/);
    
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
      user_id: data.user_id,
      conversation_id: data.conversation_id,
      message_id: data.message_id,
      title: data.title,
      content: data.content,
      deliverable_type: data.deliverable_type,
      format: data.format,
      version: data.version,
      parent_deliverable_id: data.parent_deliverable_id,
      is_latest_version: data.is_latest_version,
      metadata: data.metadata || {},
      tags: data.tags || [],
      created_by_agent: data.created_by_agent,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  private mapToVersion(data: any): DeliverableVersion {
    return {
      id: data.id,
      title: data.title,
      version: data.version,
      is_latest_version: data.is_latest_version,
      created_at: new Date(data.created_at),
      created_by_agent: data.created_by_agent,
      content_preview: data.content_preview,
    };
  }

  private mapToSearchResult(data: any): DeliverableSearchResult {
    return {
      id: data.id,
      title: data.title,
      deliverable_type: data.deliverable_type,
      format: data.format,
      version: data.version,
      is_latest_version: data.is_latest_version,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      created_by_agent: data.created_by_agent,
      content_preview: data.content_preview,
      tags: data.tags || [],
    };
  }
}