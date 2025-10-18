import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Post,
  Body,
} from '@nestjs/common';
import { Response } from 'express';
import { AssetsService } from './assets.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get(':id')
  async stream(@Param('id') id: string, @Res() res: Response) {
    try {
      await this.assets.streamByIdOrRedirect(id, res);
    } catch {
      throw new NotFoundException('Asset not found');
    }
  }

  // Test/helper endpoint: register an existing local file (relative to IMAGE_STORAGE_DIR)
  @Post('register-local')
  async registerLocal(
    @Body() body: { path: string; mime?: string; size?: number },
  ) {
    if (!body?.path) {
      throw new NotFoundException('path is required');
    }
    const mime = body.mime || this.inferMime(body.path);
    const rec = await this.assets.registerLocalPath({
      path: body.path,
      mime,
      size: body.size,
    });
    return { success: true, id: rec.id, url: `/assets/${rec.id}` };
  }

  // Test/helper endpoint: register an external URL as metadata-only asset
  @Post('register-external')
  async registerExternal(@Body() body: { url: string; mime?: string }) {
    if (!body?.url) {
      throw new NotFoundException('url is required');
    }
    const rec = await this.assets.registerExternal({
      url: body.url,
      mime: body.mime,
    });
    return { success: true, id: rec.id, url: `/assets/${rec.id}` };
  }

  private inferMime(path: string): string {
    const p = path.toLowerCase();
    if (p.endsWith('.png')) return 'image/png';
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
    if (p.endsWith('.webp')) return 'image/webp';
    if (p.endsWith('.gif')) return 'image/gif';
    return 'application/octet-stream';
  }
}
