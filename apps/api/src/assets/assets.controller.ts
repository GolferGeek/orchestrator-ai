import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { AssetsService } from './assets.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get(':id')
  async stream(@Param('id') id: string, @Res() res: Response) {
    try {
      const { stream, mime } = await this.assets.getReadStream(id);
      res.setHeader('Content-Type', mime || 'application/octet-stream');
      stream.pipe(res);
    } catch (e) {
      throw new NotFoundException('Asset not found');
    }
  }
}

