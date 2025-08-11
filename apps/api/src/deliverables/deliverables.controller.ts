import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeliverablesService } from './deliverables.service';
import {
  CreateDeliverableDto,
  UpdateDeliverableDto,
  CreateVersionDto,
  DeliverableFiltersDto,
} from './dto';
import { Deliverable, DeliverableVersion, DeliverableSearchResult } from './entities/deliverable.entity';

@ApiTags('deliverables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deliverables')
export class DeliverablesController {
  constructor(private readonly deliverablesService: DeliverablesService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new deliverable',
    description: 'Creates a new deliverable for the authenticated user'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Deliverable created successfully',
    type: Deliverable 
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createDeliverableDto: CreateDeliverableDto,
    @Req() req: any,
  ): Promise<Deliverable> {
    const userId = req.user.sub;
    return this.deliverablesService.create(createDeliverableDto, userId);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get user deliverables',
    description: 'Retrieves all deliverables for the authenticated user with optional filtering'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Deliverables retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/DeliverableSearchResult' } },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        has_more: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for title and content' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by deliverable type' })
  @ApiQuery({ name: 'format', required: false, description: 'Filter by format' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return (1-100)', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip', type: Number })
  @ApiQuery({ name: 'latest_only', required: false, description: 'Show only latest versions', type: Boolean })
  async findAll(
    @Query() filters: DeliverableFiltersDto,
    @Req() req: any,
  ): Promise<{ items: DeliverableSearchResult[], total: number, limit: number, offset: number, has_more: boolean }> {
    const userId = req.user.sub;
    return this.deliverablesService.findAll(userId, filters);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get deliverable by ID',
    description: 'Retrieves a specific deliverable by its ID'
  })
  @ApiParam({ name: 'id', description: 'Deliverable UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Deliverable retrieved successfully',
    type: Deliverable 
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Deliverable not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<Deliverable> {
    const userId = req.user.sub;
    return this.deliverablesService.findOne(id, userId);
  }

  @Get('conversation/:conversationId')
  @ApiOperation({ 
    summary: 'Get deliverables by conversation ID',
    description: 'Retrieves all deliverables associated with a specific conversation'
  })
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Deliverables retrieved successfully',
    type: [Deliverable]
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findByConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Req() req: any,
  ): Promise<Deliverable[]> {
    const userId = req.user.sub;
    return this.deliverablesService.findByConversation(conversationId, userId);
  }

  @Get(':id/versions')
  @ApiOperation({ 
    summary: 'Get deliverable version history',
    description: 'Retrieves the version history for a specific deliverable'
  })
  @ApiParam({ name: 'id', description: 'Deliverable UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Version history retrieved successfully',
    type: [DeliverableVersion]
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Deliverable not found' })
  async getVersionHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<DeliverableVersion[]> {
    const userId = req.user.sub;
    return this.deliverablesService.getVersionHistory(id, userId);
  }

  @Post(':id/versions')
  @ApiOperation({ 
    summary: 'Create new version of deliverable',
    description: 'Creates a new version of an existing deliverable'
  })
  @ApiParam({ name: 'id', description: 'Parent deliverable UUID' })
  @ApiResponse({ 
    status: 201, 
    description: 'Version created successfully',
    type: Deliverable 
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Parent deliverable not found' })
  async createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createVersionDto: CreateVersionDto,
    @Req() req: any,
  ): Promise<Deliverable> {
    const userId = req.user.sub;
    return this.deliverablesService.createVersion(id, createVersionDto, userId);
  }

  @Patch(':id')
  @ApiOperation({ 
    summary: 'Update deliverable',
    description: 'Updates an existing deliverable'
  })
  @ApiParam({ name: 'id', description: 'Deliverable UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Deliverable updated successfully',
    type: Deliverable 
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Deliverable not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDeliverableDto: UpdateDeliverableDto,
    @Req() req: any,
  ): Promise<Deliverable> {
    const userId = req.user.sub;
    return this.deliverablesService.update(id, updateDeliverableDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Delete deliverable',
    description: 'Deletes a deliverable and all its versions'
  })
  @ApiParam({ name: 'id', description: 'Deliverable UUID' })
  @ApiResponse({ status: 204, description: 'Deliverable deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Deliverable not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<void> {
    const userId = req.user.sub;
    return this.deliverablesService.remove(id, userId);
  }
}