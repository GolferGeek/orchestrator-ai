import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOnly } from '../auth/decorators/roles.decorator';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all videos',
    description: 'Retrieve all video data from videos.json',
  })
  @ApiResponse({
    status: 200,
    description: 'Videos data retrieved successfully',
  })
  async getVideos() {
    return this.videosService.getVideos();
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get video categories',
    description: 'Get list of available video categories for admin dropdown',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  })
  async getCategories() {
    return this.videosService.getCategories();
  }

  @Get('transcripts/:id')
  @ApiOperation({
    summary: 'Get video transcript',
    description: 'Retrieve transcript content for a specific video',
  })
  @ApiParam({
    name: 'id',
    description: 'Video ID',
    example: 'agent-default-overview',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcript retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Transcript not found',
  })
  async getTranscript(@Param('id') id: string) {
    return this.videosService.getTranscript(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new video (Admin only)',
    description:
      'Add a new video to the videos.json file. Requires admin authentication.',
  })
  @ApiResponse({
    status: 201,
    description: 'Video created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid video data or video already exists',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Admin access required',
  })
  async createVideo(@Body() createVideoDto: CreateVideoDto) {
    return this.videosService.createVideo(createVideoDto);
  }
}
