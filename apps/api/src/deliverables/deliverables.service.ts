import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateDeliverableDto,
  UpdateDeliverableDto,
  DeliverableFiltersDto,
  CreateEditingConversationDto,
} from './dto';
import {
  Deliverable,
  DeliverableVersion,
  DeliverableSearchResult,
} from './entities/deliverable.entity';
import { getTableName } from '../supabase/supabase.config';
import { DeliverableVersionsService } from './deliverable-versions.service';
import { AgentConversationsService } from '../agent-conversations/agent-conversations.service';
import { CreateAgentConversationDto } from '../common/types/agent-conversations.types';

@Injectable()
export class DeliverablesService {
  private readonly logger = new Logger(DeliverablesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly versionsService: DeliverableVersionsService,
    private readonly agentConversationsService: AgentConversationsService,
  ) {}

  /**
   * Handle task completion events to create deliverables
   */
  @OnEvent('task.completed')
  async handleTaskCompletion(payload: { taskId: string; userId: string }) {
    try {
      // Get the completed task data
      const { data: taskData, error } = await this.supabaseService
        .getAnonClient()
        .from('tasks')
        .select('*')
        .eq('id', payload.taskId)
        .eq('user_id', payload.userId)
        .single();

      if (error || !taskData) {
        this.logger.warn(`Could not fetch task data for deliverable creation: ${payload.taskId}`);
        return;
      }

      // Enforce build-only deliverable creation if configured
      const requireBuild = (process.env.DELIVERABLES_REQUIRE_BUILD ?? 'true') !== 'false';
      if (requireBuild) {
        // Attempt to determine mode from task params or response metadata
        let mode: string | undefined;
        try {
          mode = taskData.params?.mode || taskData.metadata?.mode;
        } catch {}
        if (!mode) {
          // Try to parse response JSON to extract metadata.mode
          try {
            const result = typeof taskData.response === 'string' ? JSON.parse(taskData.response) : taskData.response;
            mode = result?.metadata?.mode || result?.mode;
          } catch {}
        }
        if (mode !== 'build') {
          // Skip deliverable creation for non-build modes
          this.logger.debug(`Skipping deliverable creation for task ${payload.taskId} in mode: ${mode || 'unknown'}`);
          return;
        }
      }

      // Create deliverable from task completion
      const deliverableId = await this.createOrUpdateFromTaskCompletion(
        payload.taskId,
        payload.userId,
        taskData.response,
        taskData,
      );

      if (deliverableId) {
        this.logger.log(`📄 Deliverable ${deliverableId} created from task completion: ${payload.taskId}`);
        
        // Update the task response to include deliverable ID
        const enhancedResponse = this.addDeliverableIdToResponse(taskData.response, deliverableId);
        
        // Update the database with enhanced response
        await this.supabaseService
          .getAnonClient()
          .from('tasks')
          .update({
            response: enhancedResponse,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payload.taskId)
          .eq('user_id', payload.userId);
      }
    } catch (error) {
      this.logger.error(`Failed to handle task completion for deliverable creation: ${payload.taskId}`, error);
    }
  }

  /**
   * Create a new deliverable with optional initial version
   */
  async create(
    createDto: CreateDeliverableDto,
    userId: string,
  ): Promise<Deliverable> {

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
        .select(`
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
        `)
        .eq('user_id', userId);

      // Add search filter if provided
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
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
        .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);

      const { data, error } = await query;

      if (error) {

        throw new BadRequestException(
          `Failed to find deliverables: ${error.message}`,
        );
      }

      const deliverables = data || [];
      const items = deliverables.map((deliverable: any) => {
        // Get the current version or the first version if no current version is marked
        const currentVersion = deliverable.deliverable_versions?.find((v: any) => v.is_current_version) ||
                              deliverable.deliverable_versions?.[0];

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
  async findByConversationId(conversationId: string, userId: string): Promise<Deliverable[]> {
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

      const deliverables = data?.map(item => this.mapToDeliverable(item)) || [];
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

        } else {

        }
      } catch (error) {

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
  async findByConversation(conversationId: string, userId: string): Promise<Deliverable[]> {

    try {
      const { data, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('deliverables'))
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {

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

      throw new BadRequestException('Failed to find deliverables by conversation');
    }
  }

  /**
   * Create or update deliverable from task completion
   * Implements single-deliverable-per-conversation model
   */
  async createOrUpdateFromTaskCompletion(
    taskId: string,
    userId: string,
    response: any,
    taskData: any,
  ): Promise<string | null> {
    this.logger.debug(`[DeliverablesService] Handling task completion for taskId: ${taskId}`);
    
    // Debugging logs to inspect the incoming taskData object
    this.logger.debug(`🔍 DeliverablesService - taskData.metadata?.llmUsed:`, taskData.metadata?.llmUsed);
    this.logger.debug(`🔍 DeliverablesService - taskData.llm_metadata:`, taskData.llm_metadata);

    try {
      // Use helper to safely extract content
      const content = this.extractContentFromResponse(response);
      if (!content || !this.shouldCreateDeliverable(content)) {
        return null;
      }

      const conversationId = taskData.conversation_id;
      if (!conversationId) {

        return null;
      }

      // Check if conversation already has a deliverable
      const existingDeliverables = await this.findByConversation(conversationId, userId);
      
      if (existingDeliverables.length > 0) {
        // UPDATE existing deliverable (create new version)
        const existingDeliverable = existingDeliverables[0];
        if (!existingDeliverable) {

          return null;
        }
        
        // Check if a version for this task already exists to prevent duplicates
        const existingVersions = await this.versionsService.getVersionHistory(existingDeliverable.id, userId);
        const taskVersionExists = existingVersions.some(version => 
          version.taskId === taskId && version.createdByType === 'ai_response'
        );
        
        
        if (taskVersionExists) {
          this.logger.log(`📄 Deliverable version for task ${taskId} already exists, skipping duplicate creation`);
          return existingDeliverable.id;
        }
        
        
        
        await this.versionsService.createVersion(
          existingDeliverable.id,
          {
            content: content,
            format: 'markdown' as any,
            createdByType: 'ai_response' as any,
            taskId: taskId,
            metadata: {
              createdAt: new Date().toISOString(),
              source: 'task_completion',
              // Include LLM metadata from task in consistent format (matching rerun format)
              ...(taskData.llm_metadata?.originalLLMSelection ? {
                llmMetadata: {
                  provider: taskData.llm_metadata.originalLLMSelection.providerName,
                  model: taskData.llm_metadata.originalLLMSelection.modelName,
                  temperature: taskData.llm_metadata.originalLLMSelection.temperature,
                  maxTokens: taskData.llm_metadata.originalLLMSelection.maxTokens,
                  originalLLMSelection: taskData.llm_metadata.originalLLMSelection,
                  createdAt: taskData.llm_metadata.createdAt,
                }
              } : {}),
              ...(taskData.metadata?.llmUsed && {
                llmMetadata: taskData.metadata.llmUsed,
              }),
              ...(taskData.metadata?.usage && {
                usage: taskData.metadata.usage,
              }),
              ...(taskData.metadata?.costCalculation && {
                costCalculation: taskData.metadata.costCalculation,
              }),
            },
          },
          userId
        );

        return existingDeliverable.id;
      } else {
        // CREATE new deliverable (first time for this conversation)
        // But first check if a deliverable for this task already exists in another conversation
        // This can happen if the same task completion event fires multiple times
        const { data: existingTaskDeliverables, error: taskDeliverableError } = await this.supabaseService
          .getServiceClient()
          .from(getTableName('deliverable_versions'))
          .select('deliverable_id')
          .eq('task_id', taskId)
          .eq('created_by_type', 'ai_response');
        
        console.log(`🔍 DeliverablesService - Checking for existing task deliverables for task ${taskId}:`, existingTaskDeliverables?.length || 0);
        
        if (!taskDeliverableError && existingTaskDeliverables && existingTaskDeliverables.length > 0) {
          this.logger.log(`📄 Deliverable for task ${taskId} already exists in another conversation, skipping duplicate creation`);
          return existingTaskDeliverables[0]!.deliverable_id;
        }
        
        console.log(`🔍 DeliverablesService - Creating NEW DELIVERABLE for task ${taskId} in conversation ${conversationId}`);
        
        
        const newDeliverable = await this.create({
          title: this.extractTitleFromContent(content),
          type: 'document' as any,
          conversationId,
          initialContent: content,
          initialFormat: 'markdown' as any,
          initialCreationType: 'ai_response' as any,
          initialTaskId: taskId, // ✅ Add the taskId as initialTaskId
          initialMetadata: {
            taskId,
            createdAt: new Date().toISOString(),
            source: 'task_completion',
            // Include LLM metadata from task in consistent format (matching rerun format)
            ...(taskData.llm_metadata?.originalLLMSelection ? {
              llmMetadata: {
                provider: taskData.llm_metadata.originalLLMSelection.providerName,
                model: taskData.llm_metadata.originalLLMSelection.modelName,
                temperature: taskData.llm_metadata.originalLLMSelection.temperature,
                maxTokens: taskData.llm_metadata.originalLLMSelection.maxTokens,
                originalLLMSelection: taskData.llm_metadata.originalLLMSelection,
                createdAt: taskData.llm_metadata.createdAt,
              }
            } : {}),
            ...(taskData.metadata?.llmUsed && {
              llmMetadata: taskData.metadata.llmUsed,
            }),
            ...(taskData.metadata?.usage && {
              usage: taskData.metadata.usage,
            }),
            ...(taskData.metadata?.costCalculation && {
              costCalculation: taskData.metadata.costCalculation,
            }),
          },
        }, userId);

        return newDeliverable.id;
      }
    } catch (error) {

      return null;
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
    return content.includes('#') || content.includes('\n\n') || content.length > 500;
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
      if (updateDto.projectStepId !== undefined) updateData.project_step_id = updateDto.projectStepId;
      if (updateDto.agentName !== undefined) updateData.agent_name = updateDto.agentName;

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
      const agentName = dto.agentName || deliverable.agentName || 'write_blog_post';
      
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

      const conversation = await this.agentConversationsService.createConversation(
        userId,
        conversationDto,
      );

      // Link the deliverable to the new conversation
      await this.linkToConversation(deliverableId, conversation.id, userId);

      // Generate an appropriate initial message based on the action
      const initialMessage = dto.initialMessage || this.generateInitialMessage(
        action,
        deliverable.title,
      );

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

      throw new BadRequestException('Failed to link deliverable to conversation');
    }
  }

  /**
   * Generate an appropriate initial message for the editing conversation
   */
  private generateInitialMessage(action: string, deliverableTitle: string): string {
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

      throw new BadRequestException(`Failed to create initial version: ${error.message}`);
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

  /**
   * Add deliverable ID to task response
   */
  private addDeliverableIdToResponse(response: any, deliverableId: string): string {
    try {
      let result = response;
      if (typeof response === 'string') {
        try {
          result = JSON.parse(response);
        } catch {
          result = { response };
        }
      }

      const enhancedResult = {
        ...result,
        deliverableId,
      };

      return JSON.stringify(enhancedResult);
    } catch (error) {
      this.logger.error('Failed to add deliverable ID to response:', error);
      return response;
    }
  }
}
