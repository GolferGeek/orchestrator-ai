import { Injectable } from '@nestjs/common';
import { AssetsService } from '@/assets/assets.service';
import { DeliverablesService } from '@/deliverables/deliverables.service';
import { DeliverableVersionsService } from '@/deliverables/deliverable-versions.service';
import { DeliverableVersionCreationType, DeliverableFormat } from '@/deliverables/dto';
import { OpenAIImageProvider } from './providers/openai-image.provider';

@Injectable()
export class ImageAgentsService {
  constructor(
    private readonly assets: AssetsService,
    private readonly deliverables: DeliverablesService,
    private readonly versions: DeliverableVersionsService,
  ) {}

  async generateImage(input: {
    prompt: string;
    organizationSlug?: string | null;
    conversationId: string;
    userId: string;
    provider?: 'openai';
    size?: '256x256' | '512x512' | '1024x1024';
    n?: number;
    title?: string;
  }) {
    const provider = input.provider || 'openai';
    let images: { mime: string; base64: string }[] = [];
    if (provider === 'openai') {
      const svc = new OpenAIImageProvider();
      images = await svc.generate({ prompt: input.prompt, size: input.size, n: input.n });
    } else {
      throw new Error(`Unsupported image provider: ${provider}`);
    }

    // Persist assets
    const stored: any[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const buf = Buffer.from(img.base64, 'base64');
      const rec = await this.assets.saveBuffer({
        organizationSlug: input.organizationSlug ?? null,
        conversationId: input.conversationId,
        userId: input.userId,
        mime: img.mime || 'image/png',
        buffer: buf,
        filename: `gen-${Date.now()}-${i}.png`,
        subpath: 'images',
      });
      stored.push({ assetId: rec.id, url: `/assets/${rec.id}`, mime: rec.mime, size: rec.size });
    }

    // Create deliverable then add image version
    const title = input.title || 'Generated Images';
    const d = await this.deliverables.create(
      {
        title,
        type: 'image' as any,
        conversationId: input.conversationId,
        agentName: 'image_agent',
        initialContent: 'Image assets',
        initialFormat: DeliverableFormat.JSON,
        initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
        initialTaskId: undefined,
        initialMetadata: {
          organizationSlug: input.organizationSlug ?? null,
          mode: 'build',
          prompt: input.prompt,
          provider,
        },
      } as any,
      input.userId,
    );

    const v = await this.versions.createVersion(
      d.id,
      {
        content: 'Image assets',
        format: DeliverableFormat.JSON,
        createdByType: DeliverableVersionCreationType.AI_RESPONSE,
        metadata: { provider, prompt: input.prompt, size: input.size, n: input.n },
        fileAttachments: { images: stored },
      },
      input.userId,
    );

    return { deliverable: d, version: v, images: stored };
  }
}

