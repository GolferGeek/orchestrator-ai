import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { getTableName } from '../../supabase/supabase.config';
import {
  DeliverableFormat,
  DeliverableVersionCreationType,
} from '../deliverables/dto/create-deliverable.dto';

/**
 * Database record type for deliverable ID only
 */
interface DeliverableIdRecord {
  id: string;
}

@Injectable()
export class Agent2AgentDeliverablesService {
  private readonly logger = new Logger(Agent2AgentDeliverablesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create deliverable from Agent2Agent task result
   */
  async createFromTaskResult(
    result: unknown,
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

      const typedResult = result as Record<string, unknown>;
      const deliverableRec = typedResult?.deliverable as
        | Record<string, unknown>
        | undefined;
      const payloadRec = typedResult?.payload as
        | Record<string, unknown>
        | undefined;
      const existingDeliverableId =
        typedResult?.deliverableId ||
        deliverableRec?.id ||
        payloadRec?.deliverableId ||
        (payloadRec?.metadata as Record<string, unknown> | undefined)
          ?.deliverableId;
      if (existingDeliverableId) {
        return existingDeliverableId as string;
      }

      const payload = payloadRec;
      if (!payload) {
        return null;
      }

      const contentRec = payload.content as Record<string, unknown> | undefined;
      const metadataRec = payload.metadata as
        | Record<string, unknown>
        | undefined;

      const status =
        contentRec?.status || payload.status || metadataRec?.status || null;

      if (
        status &&
        status !== 'build_completed' &&
        status !== 'completed' &&
        status !== 'succeeded'
      ) {
        return null;
      }

      const rawOutput: string =
        typeof contentRec?.output === 'string' ? contentRec.output : '';
      const payloadImages: unknown[] = Array.isArray(payload.images)
        ? (payload.images as unknown[])
        : [];
      const contentImages: unknown[] = Array.isArray(contentRec?.images)
        ? (contentRec.images as unknown[])
        : [];
      const metadataImages: unknown[] = Array.isArray(metadataRec?.images)
        ? (metadataRec.images as unknown[])
        : [];
      const images = this.normalizeImages([
        ...payloadImages,
        ...contentImages,
        ...metadataImages,
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
          agentType: (metadataRec && metadataRec.agentType) || 'agent',
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

  private normalizeImages(entries: unknown[]): Array<Record<string, unknown>> {
    if (!Array.isArray(entries)) {
      return [];
    }

    const seen = new Set<string>();

    return entries
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => {
        const entryRec = entry as Record<string, unknown>;
        const normalized: Record<string, unknown> = {
          url: typeof entryRec.url === 'string' ? entryRec.url : '',
          mime:
            typeof entryRec.mime === 'string'
              ? entryRec.mime
              : typeof entryRec.contentType === 'string'
                ? entryRec.contentType
                : 'image/png',
        };

        if (entryRec.width) normalized.width = entryRec.width;
        if (entryRec.height) normalized.height = entryRec.height;
        if (entryRec.size) normalized.size = entryRec.size;
        if (entryRec.thumbnailUrl)
          normalized.thumbnailUrl = entryRec.thumbnailUrl;
        if (entryRec.altText) normalized.altText = entryRec.altText;
        if (entryRec.hash) normalized.hash = entryRec.hash;

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
    image: Record<string, unknown> | undefined,
  ): DeliverableFormat {
    const mimeValue = image?.mime;
    const mime = (typeof mimeValue === 'string' ? mimeValue : '').toLowerCase();
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

  private describeImageSet(images: Array<Record<string, unknown>>): string {
    if (!images.length) {
      return 'Image assets';
    }

    const lines = images.map((image, index) => {
      const mimeValue = image.mime;
      const mime = typeof mimeValue === 'string' ? mimeValue : 'image';
      const width = typeof image.width === 'number' ? image.width : null;
      const height = typeof image.height === 'number' ? image.height : null;
      const dims =
        width && height
          ? `${width}x${height}`
          : width || height
            ? `${width ?? height}px`
            : 'unknown size';
      return `- Image ${index + 1}: ${mime} (${dims})`;
    });

    return ['Generated image set:', ...lines].join('\n');
  }

  private currentDateSuffix(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private renderImageLogPreview(
    images: Array<Record<string, unknown>>,
  ): string {
    if (!images.length) {
      return '';
    }

    const preview = images.slice(0, 2).map((image, index) => {
      const redactedUrl = this.redactUrlForLogs(image.url as string);
      const width = typeof image.width === 'number' ? image.width : null;
      const height = typeof image.height === 'number' ? image.height : null;
      const dims = width && height ? `${width}x${height}` : 'unknown';
      const mimeValue = image.mime;
      const mime = typeof mimeValue === 'string' ? mimeValue : 'image';
      return `[${index + 1}] ${redactedUrl} (${mime}, ${dims})`;
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
    const { data: result, error } = await this.supabaseService
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

    const data = result as DeliverableIdRecord | null;
    if (!data) {
      throw new BadRequestException(
        'Failed to create deliverable: No data returned',
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
    metadata: Record<string, unknown>;
    fileAttachments?: Record<string, unknown>;
  }): Promise<string> {
    const { data: result, error } = await this.supabaseService
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

    const data = result as DeliverableIdRecord | null;
    if (!data) {
      throw new BadRequestException(
        'Failed to create deliverable version: No data returned',
      );
    }

    return data.id;
  }
}
