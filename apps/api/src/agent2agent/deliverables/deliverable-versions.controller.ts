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
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { DeliverableVersionsService } from './deliverable-versions.service';
import { CreateVersionDto, RerunWithLLMDto, EnhanceVersionDto } from './dto';
import { DeliverableVersion } from './entities/deliverable.entity';

interface AuthenticatedRequest {
  user?: {
    sub?: string;
    id?: string;
    userId?: string;
  };
}

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
    @Req() req: AuthenticatedRequest,
  ): Promise<DeliverableVersion> {
    const userId: string =
      req.user?.sub || req.user?.id || req.user?.userId || '';
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.createVersion(
      deliverableId,
      createVersionDto,
      userId,
    );
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
    @Req() req: AuthenticatedRequest,
  ): Promise<DeliverableVersion[]> {
    const userId: string =
      req.user?.sub || req.user?.id || req.user?.userId || '';
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
  @ApiResponse({
    status: 404,
    description: 'Deliverable or current version not found',
  })
  async getCurrentVersion(
    @Param('deliverableId', ParseUUIDPipe) deliverableId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<DeliverableVersion | null> {
    const userId: string =
      req.user?.sub || req.user?.id || req.user?.userId || '';
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
    @Req() req: AuthenticatedRequest,
  ): Promise<DeliverableVersion> {
    const userId: string =
      req.user?.sub || req.user?.id || req.user?.userId || '';
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.getVersion(versionId, userId);
  }

  @Patch('version/:versionId/set-current')
  @ApiOperation({
    summary: 'Set version as current',
    description:
      'Sets a specific version as the current version of its deliverable',
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
    @Req() req: AuthenticatedRequest,
  ): Promise<DeliverableVersion> {
    const userId: string =
      req.user?.sub || req.user?.id || req.user?.userId || '';
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.setCurrentVersion(versionId, userId);
  }

  @Delete('version/:versionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete version',
    description:
      'Deletes a specific version. If it was the current version, the previous version becomes current.',
  })
  @ApiParam({ name: 'versionId', description: 'Version UUID' })
  @ApiResponse({ status: 204, description: 'Version deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete the only version' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  async deleteVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; message: string }> {
    const userId: string =
      req.user?.sub || req.user?.id || req.user?.userId || '';
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.versionsService.deleteVersion(versionId, userId);
  }

  @Post('version/:versionId/rerun')
  @ApiOperation({
    summary: 'Rerun version with different LLM',
    description:
      'Creates a new version by re-running the original prompt with a different LLM model',
  })
  @ApiParam({ name: 'versionId', description: 'Source version UUID to rerun' })
  @ApiResponse({
    status: 201,
    description: 'New version created successfully with different LLM',
    type: DeliverableVersion,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or cannot rerun',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Source version not found' })
  async rerunWithDifferentLLM(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() rerunDto: RerunWithLLMDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DeliverableVersion> {
    console.log('🔄 Rerun request received:', { versionId, rerunDto });
    console.log('🔄 Request body validation passed');

    const userId: string =
      req.user?.sub || req.user?.id || req.user?.userId || '';
    console.log('🔄 User ID extracted:', userId);

    if (!userId) {
      console.error('🚨 No user ID found in request');
      throw new Error('User not authenticated');
    }

    try {
      console.log('🔄 Calling versionsService.rerunWithDifferentLLM...');
      const result = await this.versionsService.rerunWithDifferentLLM(
        versionId,
        rerunDto,
        userId,
      );
      console.log('✅ Rerun completed successfully');
      return result;
    } catch (error) {
      console.error('🚨 Rerun failed:', error);
      console.error('🚨 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
      });
      throw error;
    }
  }

  @Post('version/:versionId/copy')
  @ApiOperation({
    summary: 'Copy a version',
    description:
      'Creates a new version by copying an existing version (same content/metadata).',
  })
  @ApiParam({ name: 'versionId', description: 'Source version UUID to copy' })
  @ApiResponse({
    status: 201,
    description: 'Version copied successfully',
    type: DeliverableVersion,
  })
  async copyVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<DeliverableVersion> {
    const userId: string =
      req.user?.sub || req.user?.id || req.user?.userId || '';
    if (!userId) throw new Error('User not authenticated');
    return this.versionsService.copyVersion(versionId, userId);
  }

  @Post('version/:versionId/enhance')
  @ApiOperation({
    summary: 'Enhance a version with LLM',
    description:
      'Creates a new version by enhancing the content with the given instruction using an LLM.',
  })
  @ApiParam({
    name: 'versionId',
    description: 'Source version UUID to enhance',
  })
  @ApiResponse({
    status: 201,
    description: 'Version enhanced successfully',
    type: DeliverableVersion,
  })
  async enhanceVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: EnhanceVersionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DeliverableVersion> {
    const userId: string =
      req.user?.sub || req.user?.id || req.user?.userId || '';
    if (!userId) throw new Error('User not authenticated');
    return this.versionsService.enhanceVersion(versionId, dto, userId);
  }
}
