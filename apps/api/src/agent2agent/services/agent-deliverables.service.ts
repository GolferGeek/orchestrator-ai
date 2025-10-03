import { Injectable, Logger } from '@nestjs/common';
import { DeliverablesService } from '../../deliverables/deliverables.service';

@Injectable()
export class AgentDeliverablesService {
  private readonly logger = new Logger(AgentDeliverablesService.name);

  constructor(
    private readonly deliverablesService: DeliverablesService,
  ) {}

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
      if (!result?.payload?.content?.status === 'build_completed') {
        return null;
      }

      const content = result.payload.content.output;
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return null;
      }

      // Extract title from content (simple heuristic)
      const title = this.extractTitleFromContent(content) || `${agentSlug} Output - ${new Date().toLocaleDateString()}`;

      // Create the deliverable
      const deliverable = await this.deliverablesService.create({
        title,
        type: 'document',
        conversationId,
        agentName: agentSlug,
        initialContent: content,
        initialFormat: 'markdown',
        initialCreationType: 'conversation_task' as any,
        initialMetadata: {
          agentName: agentSlug,
          agentType: 'context',
          mode,
          taskId,
          source: 'agent2agent',
          createdAt: new Date().toISOString(),
        },
      }, userId);

      this.logger.log(`📄 Created deliverable ${deliverable.id} from Agent2Agent task ${taskId}`);
      return deliverable.id;

    } catch (error) {
      this.logger.error(`Failed to create deliverable from task result:`, error);
      return null;
    }
  }

  /**
   * Extract title from content using simple heuristics
   */
  private extractTitleFromContent(content: string): string | null {
    // Look for markdown title (# Title)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    // Look for "Title:" pattern
    const titleColonMatch = content.match(/^Title:\s*(.+)$/m);
    if (titleColonMatch) {
      return titleColonMatch[1].trim();
    }

    // Use first line if it looks like a title (short and not starting with lowercase)
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length < 100 && !firstLine.match(/^[a-z]/)) {
        return firstLine;
      }
    }

    return null;
  }
}
