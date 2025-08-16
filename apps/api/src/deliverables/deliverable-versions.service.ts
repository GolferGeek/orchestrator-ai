import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateVersionDto,
} from './dto';
import {
  DeliverableVersion,
} from './entities/deliverable.entity';
import { getTableName } from '../supabase/supabase.config';

@Injectable()
export class DeliverableVersionsService {
  private readonly logger = new Logger(DeliverableVersionsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create a new version of an existing deliverable
   */
  async createVersion(
    deliverableId: string,
    createVersionDto: CreateVersionDto,
    userId: string,
  ): Promise<DeliverableVersion> {
    this.logger.log(
      `Creating new version for deliverable: ${deliverableId} for user: ${userId}`,
    );

    try {
      // Verify deliverable exists and belongs to user
      await this.verifyDeliverableOwnership(deliverableId, userId);

      // Get the next version number
      const nextVersionNumber = await this.getNextVersionNumber(deliverableId);

      // Mark all previous versions as not current
      await this.markPreviousVersionsAsNotCurrent(deliverableId);

      // Create new version
      const { data: newVersionData, error: insertError } = await this.supabaseService
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
        this.logger.error('Failed to create new version:', insertError);
        throw new BadRequestException(`Failed to create version: ${insertError.message}`);
      }

      this.logger.log(`Version created successfully: ${newVersionData.id}`);
      return this.mapToVersion(newVersionData);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Unexpected error creating version:', error);
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
    this.logger.log(
      `Getting version history for deliverable: ${deliverableId} for user: ${userId}`,
    );

    try {
      // Verify the deliverable exists and belongs to the user
      await this.verifyDeliverableOwnership(deliverableId, userId);

      // Get all versions for this deliverable
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverable_versions'))
        .select('*')
        .eq('deliverable_id', deliverableId)
        .order('version_number', { ascending: true });

      if (error) {
        this.logger.error('Failed to get version history:', error);
        throw new BadRequestException(
          `Failed to get version history: ${error.message}`,
        );
      }

      return (data || []).map((item: any) => this.mapToVersion(item));
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Unexpected error getting version history:', error);
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
    this.logger.log(`Getting version: ${versionId} for user: ${userId}`);

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
        this.logger.error('Failed to find version:', error);
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
      this.logger.error('Unexpected error getting version:', error);
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
    this.logger.log(`Getting current version for deliverable: ${deliverableId} for user: ${userId}`);

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
        this.logger.error('Failed to find current version:', error);
        throw new BadRequestException('Failed to find current version');
      }

      if (data) {
        this.logger.log(`Found current version: ${data.id} (v${data.version_number}) for deliverable: ${deliverableId}`);
        return this.mapToVersion(data);
      } else {
        this.logger.warn(`No current version found for deliverable: ${deliverableId} - checking if any versions exist`);
        
        // Check if any versions exist at all
        const { data: allVersions, error: allVersionsError } = await this.supabaseService
          .getServiceClient()
          .from(getTableName('deliverable_versions'))
          .select('id, version_number, is_current_version')
          .eq('deliverable_id', deliverableId);
          
        if (allVersionsError) {
          this.logger.error('Failed to check for any versions:', allVersionsError);
        } else {
          this.logger.warn(`Found ${allVersions?.length || 0} total versions for deliverable ${deliverableId}:`, allVersions);
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
      this.logger.error('Unexpected error getting current version:', error);
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
    this.logger.log(`Setting version as current: ${versionId} for user: ${userId}`);

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
        this.logger.error('Failed to set current version:', error);
        throw new BadRequestException(`Failed to set current version: ${error.message}`);
      }

      this.logger.log(`Version set as current successfully: ${versionId}`);
      return this.mapToVersion(data);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Unexpected error setting current version:', error);
      throw new BadRequestException('Failed to set current version');
    }
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(
    versionId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Deleting version: ${versionId} for user: ${userId}`);

    try {
      // Get the version and verify ownership
      const version = await this.getVersion(versionId, userId);

      // Check if this is the current version
      if (version.isCurrentVersion) {
        // Get all versions for this deliverable
        const allVersions = await this.getVersionHistory(version.deliverableId, userId);
        
        if (allVersions.length === 1) {
          throw new BadRequestException('Cannot delete the only version of a deliverable');
        }

        // Set the previous version as current
        const previousVersion = allVersions
          .filter(v => v.id !== versionId)
          .sort((a, b) => b.versionNumber - a.versionNumber)[0];

        if (previousVersion) {
          await this.setCurrentVersion(previousVersion.id, userId);
        }
      }

      // Delete the version
      const { error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverable_versions'))
        .delete()
        .eq('id', versionId);

      if (error) {
        this.logger.error('Failed to delete version:', error);
        throw new BadRequestException(`Failed to delete version: ${error.message}`);
      }

      this.logger.log(`Version deleted successfully: ${versionId}`);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Unexpected error deleting version:', error);
      throw new BadRequestException('Failed to delete version');
    }
  }

  // Private helper methods

  private async verifyDeliverableOwnership(deliverableId: string, userId: string): Promise<void> {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('deliverables'))
      .select('id')
      .eq('id', deliverableId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Deliverable not found: ${deliverableId}`);
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
      this.logger.error('Failed to get last version number:', error);
      throw new BadRequestException('Failed to determine version number');
    }

    return lastVersion ? lastVersion.version_number + 1 : 1;
  }

  private async markPreviousVersionsAsNotCurrent(deliverableId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('deliverable_versions'))
      .update({ is_current_version: false })
      .eq('deliverable_id', deliverableId);

    if (error) {
      this.logger.error('Failed to update previous versions:', error);
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
}