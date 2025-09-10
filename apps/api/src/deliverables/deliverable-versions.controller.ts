import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeliverableVersionsService } from './deliverable-versions.service';
import {
  CreateVersionDto,
  RerunWithLLMDto,
} from './dto';
import {
  DeliverableVersion,
} from './entities/deliverable.entity';

@ApiTags('deliverable-versions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deliverable-versions')
export class DeliverableVersionsController {
  constructor(private readonly versionsService: DeliverableVersionsService) {}

  @Post(':deliverableId')
  @ApiOperation({
    summary: 'Create new version of deliverable',
    description: 'Creates a new version of an existing deliverable',
  })
  @ApiParam({ name: 'deliverableId', description: 'Deliverable UUID' })
  @ApiResponse({
    status: 201,
    description: 'Version created successfully',
    type: DeliverableVersion,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Deliverable not found' })
  async createVersion(
    @Param('deliverableId', ParseUUIDPipe) deliverableId: string,
    @Body() createVersionDto: CreateVersionDto,
    @Req() req: any,
  ): Promise<DeliverableVersion> {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.createVersion(deliverableId, createVersionDto, userId);
  }

  @Get(':deliverableId/history')
  @ApiOperation({
    summary: 'Get version history',
    description: 'Retrieves the version history for a specific deliverable',
  })
  @ApiParam({ name: 'deliverableId', description: 'Deliverable UUID' })
  @ApiResponse({
    status: 200,
    description: 'Version history retrieved successfully',
    type: [DeliverableVersion],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Deliverable not found' })
  async getVersionHistory(
    @Param('deliverableId', ParseUUIDPipe) deliverableId: string,
    @Req() req: any,
  ): Promise<DeliverableVersion[]> {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.getVersionHistory(deliverableId, userId);
  }

  @Get(':deliverableId/current')
  @ApiOperation({
    summary: 'Get current version',
    description: 'Retrieves the current version of a specific deliverable',
  })
  @ApiParam({ name: 'deliverableId', description: 'Deliverable UUID' })
  @ApiResponse({
    status: 200,
    description: 'Current version retrieved successfully',
    type: DeliverableVersion,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Deliverable or current version not found' })
  async getCurrentVersion(
    @Param('deliverableId', ParseUUIDPipe) deliverableId: string,
    @Req() req: any,
  ): Promise<DeliverableVersion | null> {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.getCurrentVersion(deliverableId, userId);
  }

  @Get('version/:versionId')
  @ApiOperation({
    summary: 'Get specific version',
    description: 'Retrieves a specific version by its ID',
  })
  @ApiParam({ name: 'versionId', description: 'Version UUID' })
  @ApiResponse({
    status: 200,
    description: 'Version retrieved successfully',
    type: DeliverableVersion,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  async getVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() req: any,
  ): Promise<DeliverableVersion> {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.getVersion(versionId, userId);
  }

  @Patch('version/:versionId/set-current')
  @ApiOperation({
    summary: 'Set version as current',
    description: 'Sets a specific version as the current version of its deliverable',
  })
  @ApiParam({ name: 'versionId', description: 'Version UUID' })
  @ApiResponse({
    status: 200,
    description: 'Version set as current successfully',
    type: DeliverableVersion,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  async setCurrentVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() req: any,
  ): Promise<DeliverableVersion> {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.setCurrentVersion(versionId, userId);
  }

  @Delete('version/:versionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete version',
    description: 'Deletes a specific version. If it was the current version, the previous version becomes current.',
  })
  @ApiParam({ name: 'versionId', description: 'Version UUID' })
  @ApiResponse({ status: 204, description: 'Version deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete the only version' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  async deleteVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.deleteVersion(versionId, userId);
  }

  @Post('version/:versionId/rerun')
  @ApiOperation({
    summary: 'Rerun version with different LLM',
    description: 'Creates a new version by re-running the original prompt with a different LLM model',
  })
  @ApiParam({ name: 'versionId', description: 'Source version UUID to rerun' })
  @ApiResponse({
    status: 201,
    description: 'New version created successfully with different LLM',
    type: DeliverableVersion,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed or cannot rerun' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Source version not found' })
  async rerunWithDifferentLLM(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() rerunDto: RerunWithLLMDto,
    @Req() req: any,
  ): Promise<DeliverableVersion> {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.rerunWithDifferentLLM(versionId, rerunDto, userId);
  }
}