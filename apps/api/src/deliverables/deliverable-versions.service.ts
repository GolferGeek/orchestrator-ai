import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateVersionDto,
  DeliverableVersionCreationType,
  DeliverableFormat,
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

        throw new BadRequestException(`Failed to create version: ${insertError.message}`);
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
        const { data: allVersions, error: allVersionsError } = await this.supabaseService
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

        throw new BadRequestException(`Failed to set current version: ${error.message}`);
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
        const message = 'Cannot delete the current version. Please set a different version as current first.';

        return { success: false, message };
      }

      // Delete the version
      const { error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverable_versions'))
        .delete()
        .eq('id', versionId);

      if (error) {

        throw new BadRequestException(`Failed to delete version: ${error.message}`);
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
        throw new BadRequestException('At least 2 versions are required for merging');
      }

      // Get all versions to merge and verify they exist and belong to the deliverable
      const versions = await Promise.all(
        versionIds.map(async (versionId) => {
          const version = await this.getVersion(versionId, userId);
          if (version.deliverableId !== deliverableId) {
            throw new BadRequestException(`Version ${versionId} does not belong to deliverable ${deliverableId}`);
          }
          return version;
        })
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

      const newVersion = await this.createVersion(deliverableId, createVersionDto, userId);

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
        throw new BadRequestException('No base version found for task-based modification');
      }

      // TODO: Integrate with LLM service for task-based content modification
      // For now, append the task prompt as a comment
      const modifiedContent = await this.performTaskBasedModification(baseVersion.content || '', taskPrompt);

      // Create new version with modified content
      const createVersionDto: CreateVersionDto = {
        content: modifiedContent,
        format: baseVersion.format || this.detectFormatFromContent(modifiedContent),
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

  // Private helper methods

  private async verifyDeliverableOwnership(deliverableId: string, userId: string): Promise<void> {

    try {
      // First, check if the deliverable exists at all (without user_id filter for debugging)
      const { data: deliverableCheck, error: checkError } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .select('id, user_id')
        .eq('id', deliverableId)
        .single();

      if (checkError) {

        // If it's a schema or connection error, we'll see it here
        throw new NotFoundException(`Database error checking deliverable: ${checkError.message || checkError.code || 'unknown error'}`);
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
      throw new NotFoundException(`Failed to verify deliverable ownership: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  private async markPreviousVersionsAsNotCurrent(deliverableId: string): Promise<void> {
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
    const versionContents = versions.map((v, i) => 
      `=== VERSION ${v.versionNumber} ===\n${v.content || ''}`
    ).join('\n\n');

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
    if ((trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) ||
        (trimmedContent.startsWith('[') && trimmedContent.endsWith(']'))) {
      try {
        JSON.parse(trimmedContent);
        return DeliverableFormat.JSON;
      } catch {
        // Not valid JSON, continue checking
      }
    }
    
    // Check for HTML
    if (trimmedContent.includes('<html') || 
        trimmedContent.includes('<!DOCTYPE') ||
        (trimmedContent.includes('<') && trimmedContent.includes('>'))) {
      return DeliverableFormat.HTML;
    }
    
    // Check for Markdown
    if (content.includes('```') || 
        content.includes('#') || 
        content.includes('**') || 
        content.includes('__') ||
        content.includes('[') && content.includes('](')) {
      return DeliverableFormat.MARKDOWN;
    }
    
    // Default to plain text
    return DeliverableFormat.TEXT;
  }

  /**
   * Get the most common format from a list of versions
   */
  private getMostCommonFormat(versions: DeliverableVersion[]): DeliverableFormat {
    if (versions.length === 0) return DeliverableFormat.TEXT;
    
    const formatCounts = versions.reduce((acc, v) => {
      if (v.format) {
        acc[v.format] = (acc[v.format] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const mostCommon = Object.entries(formatCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
      
    return (mostCommon as DeliverableFormat) || DeliverableFormat.TEXT;
  }
}