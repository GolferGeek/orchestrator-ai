import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { getTableName } from '../../supabase/supabase.config';

@Injectable()
export class Agent2AgentDeliverablesService {
  private readonly logger = new Logger(Agent2AgentDeliverablesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create deliverable from Agent2Agent task result
   */
  async createFromTaskResult(
    result: any,
    userId: string,
    taskId: string,
    agentSlug: string,
    conversationId: string,
    mode: string,
  ): Promise<string | null> {
    try {
      // Only create deliverables for build mode
      if (mode !== 'build') {
        return null;
      }

      // Check if result has deliverable content
      if (result?.payload?.content?.status !== 'build_completed') {
        return null;
      }

      const content = result.payload.content.output;
      if (
        !content ||
        typeof content !== 'string' ||
        content.trim().length === 0
      ) {
        return null;
      }

      // Extract title from content (simple heuristic)
      const title =
        this.extractTitleFromContent(content) ||
        `${agentSlug} Output - ${new Date().toLocaleDateString()}`;

      // Create the deliverable record directly
      const deliverableId = await this.createDeliverable({
        title,
        type: 'document',
        conversationId,
        agentName: agentSlug,
        userId,
      });

      // Create the first version with the content
      await this.createDeliverableVersion({
        deliverableId,
        content,
        format: 'markdown',
        createdByType: 'conversation_task',
        taskId, // Associate with the task for LLM rerun functionality
        userId,
        metadata: {
          agentName: agentSlug,
          agentType: 'context',
          mode,
          taskId,
          source: 'agent2agent',
          createdAt: new Date().toISOString(),
        },
      });

      this.logger.log(
        `📄 Created deliverable ${deliverableId} with first version from Agent2Agent task ${taskId}`,
      );
      return deliverableId;
    } catch (error) {
      this.logger.error(
        `Failed to create deliverable from task result:`,
        error,
      );
      return null;
    }
  }

  /**
   * Extract title from content using simple heuristics
   */
  private extractTitleFromContent(content: string): string | null {
    // Look for markdown title (# Title)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }

    // Look for "Title:" pattern
    const titleColonMatch = content.match(/^Title:\s*(.+)$/m);
    if (titleColonMatch && titleColonMatch[1]) {
      return titleColonMatch[1].trim();
    }

    // Use first line if it looks like a title (short and not starting with lowercase)
    const lines = content.split('\n').filter((line) => line.trim());
    if (lines.length > 0 && lines[0]) {
      const firstLine = lines[0].trim();
      if (firstLine.length < 100 && !firstLine.match(/^[a-z]/)) {
        return firstLine;
      }
    }

    return null;
  }

  /**
   * Create deliverable record directly in database
   */
  private async createDeliverable(params: {
    title: string;
    type: string;
    conversationId: string;
    agentName: string;
    userId: string;
  }): Promise<string> {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('deliverables'))
      .insert([
        {
          user_id: params.userId,
          conversation_id: params.conversationId,
          agent_name: params.agentName,
          title: params.title,
          type: params.type,
        },
      ])
      .select('id')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to create deliverable: ${error.message}`,
      );
    }

    return data.id;
  }

  /**
   * Create deliverable version directly in database
   */
  private async createDeliverableVersion(params: {
    deliverableId: string;
    content: string;
    format: string;
    createdByType: string;
    taskId?: string;
    userId: string;
    metadata: Record<string, any>;
  }): Promise<string> {
    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from(getTableName('deliverable_versions'))
      .insert([
        {
          deliverable_id: params.deliverableId,
          content: params.content,
          format: params.format,
          created_by_type: params.createdByType,
          task_id: params.taskId || null, // Associate with task for LLM rerun
          metadata: params.metadata,
          version_number: 1, // First version
          is_current_version: true, // Mark as current version
        },
      ])
      .select('id')
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to create deliverable version: ${error.message}`,
      );
    }

    return data.id;
  }
}
