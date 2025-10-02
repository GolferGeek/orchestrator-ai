import { Injectable, Logger } from '@nestjs/common';
import { DeliverablesService } from '@/deliverables/deliverables.service';
import { DeliverableVersionsService } from '@/deliverables/deliverable-versions.service';
import {
  CreateDeliverableDto,
  DeliverableFormat,
  DeliverableType,
  DeliverableVersionCreationType,
} from '@/deliverables/dto';
import { AgentTaskMode, TaskRequestDto } from '@agent2agent/dto/task-request.dto';
import { AssetsService } from '@/assets/assets.service';

export interface BuildDeliverableInput {
  organizationSlug: string | null;
  agentSlug: string;
  mode: AgentTaskMode;
  conversationId?: string;
  userId?: string | null;
  title?: string | null;
  content?: string | null;
  titleTemplate?: string | null;
  deliverableType?: DeliverableType | string | null;
  deliverableFormat?: DeliverableFormat | string | null;
}

@Injectable()
export class AgentRuntimeDeliverablesAdapter {
  private readonly logger = new Logger(AgentRuntimeDeliverablesAdapter.name);

  constructor(
    private readonly deliverables: DeliverablesService,
    private readonly versions: DeliverableVersionsService,
    private readonly assets?: AssetsService,
  ) {}

  async maybeCreateFromBuild(
    ctx: BuildDeliverableInput,
    request: TaskRequestDto,
  ): Promise<any | null> {
    try {
      if (ctx.mode !== AgentTaskMode.BUILD) return null;
      const userId = this.resolveUserId(request);
      const conversationId = ctx.conversationId;
      if (!userId || !conversationId) {
        return null;
      }

      const baseTitle = ctx.title || `Build output from ${ctx.agentSlug}`;
      const content = ctx.content || (request.payload as any)?.output || '';
      const images = Array.isArray((request.payload as any)?.images)
        ? ((request.payload as any).images as any[]).filter(Boolean)
        : [];
      const storedImages = await this.maybePersistImages(images, {
        organizationSlug: ctx.organizationSlug,
        conversationId,
        userId,
      });
      const title = this.computeTitle(baseTitle, ctx);

      // Enhancement path: if a target deliverableId is provided, create a new version instead
      const targetDeliverableId =
        (request.payload as any)?.deliverableId ||
        (request.payload as any)?.metadata?.deliverableId;
      if (targetDeliverableId) {
        const version = await this.versions.createVersion(
          targetDeliverableId,
          {
            content: content || (storedImages.length ? 'Image assets' : ''),
            format:
              storedImages.length > 0
                ? DeliverableFormat.JSON
                : this.coerceDeliverableFormat(ctx.deliverableFormat) ?? DeliverableFormat.TEXT,
            createdByType: DeliverableVersionCreationType.AI_ENHANCEMENT,
            taskId: (request as any).taskId,
            metadata: {
              organizationSlug: ctx.organizationSlug,
              agentSlug: ctx.agentSlug,
              mode: ctx.mode,
            },
            fileAttachments:
              storedImages.length > 0
                ? { images: storedImages }
                : {},
          },
          userId,
        );
        return { kind: 'version', deliverableId: targetDeliverableId, version };
      }
      const dto: CreateDeliverableDto = {
        title,
        type: this.coerceDeliverableType(ctx.deliverableType) ?? DeliverableType.DOCUMENT,
        conversationId,
        agentName: ctx.agentSlug,
        initialContent: content || undefined,
        initialFormat: this.coerceDeliverableFormat(ctx.deliverableFormat) ?? DeliverableFormat.TEXT,
        initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
        initialTaskId: (request as any).taskId,
        initialMetadata: {
          organizationSlug: ctx.organizationSlug,
          agentSlug: ctx.agentSlug,
          mode: ctx.mode,
        },
      };

      const deliverable = await this.deliverables.create(dto, userId);

      // If images provided, append a version with the image file attachments and make it current
      if (storedImages.length > 0) {
        await this.versions.createVersion(
          deliverable.id,
          {
            content: content || 'Image assets',
            format: DeliverableFormat.JSON,
            createdByType: DeliverableVersionCreationType.AI_RESPONSE,
            taskId: (request as any).taskId,
            metadata: {
              organizationSlug: ctx.organizationSlug,
              agentSlug: ctx.agentSlug,
              mode: ctx.mode,
            },
            fileAttachments: { images: storedImages },
          },
          userId,
        );
      }

      return { kind: 'deliverable', deliverable };
    } catch (error) {
      this.logger.warn(
        `Failed to auto-create deliverable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private resolveUserId(request: TaskRequestDto): string | null {
    // prefer top-level metadata, then payload.metadata
    const fromTop = request.metadata?.userId || request.metadata?.createdBy;
    const fromPayload = request.payload?.metadata?.userId || request.payload?.metadata?.createdBy;
    return (fromTop as string) || (fromPayload as string) || null;
  }

  private computeTitle(defaultTitle: string, ctx: BuildDeliverableInput): string {
    const template = ctx.titleTemplate?.trim();
    if (!template) {
      return defaultTitle;
    }
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return template
      .replaceAll('{agent}', ctx.agentSlug)
      .replaceAll('{date}', date)
      .replaceAll('{conversation}', String(ctx.conversationId ?? ''))
      .replaceAll('{title}', defaultTitle);
  }

  private coerceDeliverableType(value?: DeliverableType | string | null): DeliverableType | undefined {
    if (!value) return undefined;
    if (Object.values(DeliverableType).includes(value as DeliverableType)) return value as DeliverableType;
    const s = String(value).toLowerCase();
    switch (s) {
      case 'document':
        return DeliverableType.DOCUMENT;
      case 'analysis':
        return DeliverableType.ANALYSIS;
      case 'report':
        return DeliverableType.REPORT;
      case 'plan':
        return DeliverableType.PLAN;
      case 'requirements':
        return DeliverableType.REQUIREMENTS;
      default:
        return undefined;
    }
  }

  private coerceDeliverableFormat(value?: DeliverableFormat | string | null): DeliverableFormat | undefined {
    if (!value) return undefined;
    if (Object.values(DeliverableFormat).includes(value as DeliverableFormat)) return value as DeliverableFormat;
    const s = String(value).toLowerCase();
    switch (s) {
      case 'markdown':
        return DeliverableFormat.MARKDOWN;
      case 'text':
        return DeliverableFormat.TEXT;
      case 'json':
        return DeliverableFormat.JSON;
      case 'html':
        return DeliverableFormat.HTML;
      default:
        return undefined;
    }
  }
  private normalizeImageAttachment(input: any) {
    const obj = typeof input === 'object' && input ? input : {};
    const out: Record<string, any> = {
      url: obj.url || obj.href || '',
      mime: obj.mime || obj.contentType || null,
    };
    if (obj.width) out.width = obj.width;
    if (obj.height) out.height = obj.height;
    if (obj.size) out.size = obj.size;
    if (obj.thumbnailUrl) out.thumbnailUrl = obj.thumbnailUrl;
    if (obj.altText) out.altText = obj.altText;
    if (obj.hash) out.hash = obj.hash;
    return out;
  }

  private async maybePersistImages(
    images: any[],
    ctx: { organizationSlug: string | null; conversationId: string | null; userId: string | null },
  ): Promise<any[]> {
    if (!images || images.length === 0) return [];
    const results: any[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i] || {};
      const hasData = typeof img.data === 'string' && img.data.length > 0;
      if (hasData && this.assets) {
        try {
          let mime = img.mime || img.contentType || 'image/png';
          let base64 = img.data as string;
          const match = /^data:([^;]+);base64,(.*)$/i.exec(base64);
          if (match) {
            mime = match[1] || mime;
            base64 = match[2] || '';
          }
          const buffer = Buffer.from(base64, 'base64');
          const filename = img.filename || `image-${Date.now()}-${i}.${this.extFromMime(mime)}`;
          const rec = await this.assets.saveBuffer({
            organizationSlug: ctx.organizationSlug,
            conversationId: ctx.conversationId,
            userId: ctx.userId,
            mime,
            buffer,
            filename,
            subpath: 'images',
          });
          results.push({
            assetId: rec.id,
            url: `/assets/${rec.id}`,
            mime,
            width: img.width || undefined,
            height: img.height || undefined,
            size: rec.size || undefined,
            thumbnailUrl: img.thumbnailUrl || undefined,
            altText: img.altText || undefined,
            hash: img.hash || undefined,
          });
          continue;
        } catch (e) {
          this.logger.warn(`Failed to persist image asset: ${String(e)}`);
        }
      }
      // Optionally fetch-and-store external URLs
      const hasUrl = typeof img.url === 'string' && /^https?:\/\//i.test(img.url);
      if (hasUrl && this.assets) {
        try {
          const rec = await this.assets.saveFromUrl({
            url: img.url,
            organizationSlug: ctx.organizationSlug,
            conversationId: ctx.conversationId,
            userId: ctx.userId,
            filename: img.filename,
            subpath: 'images',
          });
          results.push({
            assetId: rec.id,
            url: `/assets/${rec.id}`,
            mime: rec.mime,
            width: img.width || undefined,
            height: img.height || undefined,
            size: rec.size || undefined,
            thumbnailUrl: img.thumbnailUrl || undefined,
            altText: img.altText || undefined,
            hash: img.hash || undefined,
          });
          continue;
        } catch (e) {
          this.logger.warn(`Fetch-and-store disabled or failed, registering external: ${String(e)}`);
          try {
            const rec = await this.assets.registerExternal({ url: img.url, mime: img.mime || img.contentType });
            results.push({
              assetId: rec.id,
              url: `/assets/${rec.id}`,
              mime: img.mime || img.contentType || 'application/octet-stream',
              width: img.width || undefined,
              height: img.height || undefined,
              size: img.size || undefined,
              thumbnailUrl: img.thumbnailUrl || undefined,
              altText: img.altText || undefined,
              hash: img.hash || undefined,
            });
            continue;
          } catch (e2) {
            this.logger.warn(`Failed to register external reference: ${String(e2)}`);
          }
        }
      }
      results.push(this.normalizeImageAttachment(img));
    }
    return results;
  }

  private extFromMime(mime: string): string {
    const m = (mime || '').toLowerCase();
    if (m.includes('png')) return 'png';
    if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
    if (m.includes('webp')) return 'webp';
    if (m.includes('gif')) return 'gif';
    return 'bin';
  }
}
