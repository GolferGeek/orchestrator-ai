import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ThemesService } from './themes.service';
import type { ThemeSearchQuery } from '../types';

@Controller('api/themes')
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Post()
  async createTheme(@Body() themeData: any, @Res() res: Response) {
    const result = await this.themesService.createTheme(themeData);
    const status = result.success ? HttpStatus.CREATED : HttpStatus.BAD_REQUEST;
    return res.status(status).json(result);
  }

  @Get()
  async searchThemes(
    @Query('query') query?: string,
    @Query('isPublic') isPublic?: string,
    @Query('authorId') authorId?: string,
    @Query('sortBy') sortBy?: any,
    @Query('sortOrder') sortOrder?: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const searchQuery: ThemeSearchQuery = {
      query: query || undefined,
      isPublic: isPublic ? isPublic === 'true' : undefined,
      authorId: authorId || undefined,
      sortBy: sortBy || undefined,
      sortOrder: sortOrder || undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    };

    return this.themesService.searchThemes(searchQuery);
  }

  @Get('stats')
  async getStats() {
    return this.themesService.getThemeStats();
  }

  @Get(':id')
  async getTheme(@Param('id') id: string, @Res() res: Response) {
    const result = await this.themesService.getThemeById(id);
    const status = result.success ? HttpStatus.OK : HttpStatus.NOT_FOUND;
    return res.status(status).json(result);
  }

  @Put(':id')
  async updateTheme(
    @Param('id') id: string,
    @Body() updates: any,
    @Res() res: Response,
  ) {
    const result = await this.themesService.updateThemeById(id, updates);
    const status = result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST;
    return res.status(status).json(result);
  }

  @Delete(':id')
  async deleteTheme(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('authorId') authorId?: string,
  ) {
    const result = await this.themesService.deleteThemeById(id, authorId);
    const status = result.success
      ? HttpStatus.OK
      : result.error?.includes('not found')
      ? HttpStatus.NOT_FOUND
      : HttpStatus.FORBIDDEN;
    return res.status(status).json(result);
  }

  @Get(':id/export')
  async exportTheme(@Param('id') id: string, @Res() res: Response) {
    const result = await this.themesService.exportThemeById(id);
    if (!result.success) {
      const status = result.error?.includes('not found')
        ? HttpStatus.NOT_FOUND
        : HttpStatus.BAD_REQUEST;
      return res.status(status).json(result);
    }

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.data!.theme.name}.json"`,
    );
    return res.json(result.data);
  }

  @Post('import')
  async importTheme(
    @Body() importData: any,
    @Res() res: Response,
    @Query('authorId') authorId?: string,
  ) {
    const result = await this.themesService.importTheme(importData, authorId);
    const status = result.success ? HttpStatus.CREATED : HttpStatus.BAD_REQUEST;
    return res.status(status).json(result);
  }
}
