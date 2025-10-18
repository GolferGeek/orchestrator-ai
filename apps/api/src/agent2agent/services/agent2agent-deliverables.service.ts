import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { getTableName } from '../../supabase/supabase.config';
import {
  DeliverableFormat,
  DeliverableVersionCreationType,
} from '../deliverables/dto/create-deliverable.dto';

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

      if (!result || typeof result !== 'object') {
        return null;
      }

      const existingDeliverableId =
        result?.deliverableId ||
        result?.deliverable?.id ||
        result?.payload?.deliverableId ||
        result?.payload?.metadata?.deliverableId;
      if (existingDeliverableId) {
        return existingDeliverableId;
      }

      const payload = result?.payload;
      if (!payload) {
        return null;
      }

      const status =
        payload.content?.status ||
        payload.status ||
        payload.metadata?.status ||
        null;

      if (
        status &&
        status !== 'build_completed' &&
        status !== 'completed' &&
        status !== 'succeeded'
      ) {
        return null;
      }

      const rawOutput =
        typeof payload.content?.output === 'string'
          ? payload.content.output
          : '';
      const images = this.normalizeImages([
        ...(Array.isArray(payload.images) ? payload.images : []),
        ...(Array.isArray(payload.content?.images)
          ? payload.content.images
          : []),
        ...(Array.isArray(payload.metadata?.images)
          ? payload.metadata.images
          : []),
      ]);

      const hasImages = images.length > 0;
      const hasText = rawOutput.trim().length > 0;

      if (!hasImages && !hasText) {
        return null;
      }

      // Extract title from content (simple heuristic)
      const title =
        (hasText && this.extractTitleFromContent(rawOutput)) ||
        (hasImages
          ? `${agentSlug} Image Output ${this.currentDateSuffix()}`
          : `${agentSlug} Output ${this.currentDateSuffix()}`);

      // Create the deliverable record directly
      const deliverableId = await this.createDeliverable({
        title,
        type: hasImages ? 'image' : 'document',
        conversationId,
        agentName: agentSlug,
        userId,
      });

      // Create the first version with the content
      await this.createDeliverableVersion({
        deliverableId,
        content:
          hasText || !hasImages ? rawOutput : this.describeImageSet(images),
        format: hasImages
          ? this.resolveImageFormat(images[0])
          : DeliverableFormat.MARKDOWN,
        createdByType: DeliverableVersionCreationType.CONVERSATION_TASK,
        taskId, // Associate with the task for LLM rerun functionality
        userId,
        metadata: {
          agentName: agentSlug,
          agentType:
            (payload.metadata && payload.metadata.agentType) || 'agent',
          mode,
          taskId,
          source: 'agent2agent',
          createdAt: new Date().toISOString(),
          ...(hasImages ? { imagesCount: images.length } : {}),
        },
        fileAttachments: hasImages ? { images } : undefined,
      });

      if (hasImages) {
        this.logger.log(
          `🖼️ Created image deliverable ${deliverableId} for task ${taskId} ${this.renderImageLogPreview(images)}`,
        );
      } else {
        this.logger.log(
          `📄 Created deliverable ${deliverableId} with first version from Agent2Agent task ${taskId}`,
        );
      }
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

  private normalizeImages(entries: any[]): Array<Record<string, any>> {
    if (!Array.isArray(entries)) {
      return [];
    }

    const seen = new Set<string>();

    return entries
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => {
        const normalized: Record<string, any> = {
          url: typeof entry.url === 'string' ? entry.url : '',
          mime:
            typeof entry.mime === 'string'
              ? entry.mime
              : typeof entry.contentType === 'string'
                ? entry.contentType
                : 'image/png',
        };

        if (entry.width) normalized.width = entry.width;
        if (entry.height) normalized.height = entry.height;
        if (entry.size) normalized.size = entry.size;
        if (entry.thumbnailUrl) normalized.thumbnailUrl = entry.thumbnailUrl;
        if (entry.altText) normalized.altText = entry.altText;
        if (entry.hash) normalized.hash = entry.hash;

        return normalized;
      })
      .filter((entry) => {
        if (typeof entry.url !== 'string' || entry.url.length === 0) {
          return false;
        }
        if (seen.has(entry.url)) {
          return false;
        }
        seen.add(entry.url);
        return true;
      });
  }

  private resolveImageFormat(
    image: Record<string, any> | undefined,
  ): DeliverableFormat {
    const mime = String(image?.mime || '').toLowerCase();
    switch (mime) {
      case 'image/jpeg':
      case 'image/jpg':
        return DeliverableFormat.IMAGE_JPEG;
      case 'image/webp':
        return DeliverableFormat.IMAGE_WEBP;
      case 'image/gif':
        return DeliverableFormat.IMAGE_GIF;
      case 'image/svg+xml':
        return DeliverableFormat.IMAGE_SVG;
      case 'image/png':
        return DeliverableFormat.IMAGE_PNG;
      default:
        return DeliverableFormat.IMAGE_PNG;
    }
  }

  private describeImageSet(images: Array<Record<string, any>>): string {
    if (!images.length) {
      return 'Image assets';
    }

    const lines = images.map((image, index) => {
      const mime = image.mime || 'image';
      const dims =
        image.width && image.height
          ? `${image.width}x${image.height}`
          : image.width || image.height
            ? `${image.width ?? image.height}px`
            : 'unknown size';
      return `- Image ${index + 1}: ${mime} (${dims})`;
    });

    return ['Generated image set:', ...lines].join('\n');
  }

  private currentDateSuffix(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private renderImageLogPreview(images: Array<Record<string, any>>): string {
    if (!images.length) {
      return '';
    }

    const preview = images.slice(0, 2).map((image, index) => {
      const redactedUrl = this.redactUrlForLogs(image.url);
      const dims =
        image.width && image.height
          ? `${image.width}x${image.height}`
          : 'unknown';
      return `[${index + 1}] ${redactedUrl} (${image.mime || 'image'}, ${dims})`;
    });

    return preview.length ? preview.join(' ') : '';
  }

  private redactUrlForLogs(url: string): string {
    if (!url || typeof url !== 'string') {
      return '[image]';
    }

    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const visible =
        segments.length <= 2
          ? segments.join('/')
          : `${segments.slice(0, 1).join('')}/…/${segments.slice(-1).join('')}`;
      return `${parsed.hostname}/${visible || ''}`.replace(/\/$/, '');
    } catch {
      return '[image]';
    }
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
    fileAttachments?: Record<string, any>;
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
          file_attachments: params.fileAttachments || {},
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
