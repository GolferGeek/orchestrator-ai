import { Body, Controller, Post, Req } from '@nestjs/common';
import { ImageAgentsService } from './image-agents.service';

@Controller('api/image-agents')
export class ImageAgentsController {
  constructor(private readonly images: ImageAgentsService) {}

  @Post('generate')
  async generate(@Body() body: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId || process.env.SYSTEM_USER_ID || null;
    const organizationSlug = body.organizationSlug ?? null;
    const conversationId = body.conversationId;
    if (!conversationId) {
      throw new Error('conversationId is required');
    }
    if (!userId) {
      throw new Error('userId is required');
    }
    const out = await this.images.generateImage({
      prompt: body.prompt || 'Generate an illustrative image',
      organizationSlug,
      conversationId,
      userId,
      provider: body.provider || 'openai',
      size: body.size || '512x512',
      n: body.n || 1,
      title: body.title || undefined,
    });
    return { success: true, ...out };
  }
}

