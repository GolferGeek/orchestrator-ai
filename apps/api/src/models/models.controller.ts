import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModelsService } from './models.service';
import {
  CreateModelDto,
  UpdateModelDto,
  ModelResponseDto,
  CostEstimateDto,
  CostEstimateResponseDto,
} from '../dto/llm-evaluation.dto';

@ApiTags('LLM Models')
@Controller('models')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all LLM models' })
  @ApiQuery({
    name: 'provider_id',
    required: false,
    description: 'Filter by provider UUID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'deprecated'],
    description: 'Filter by model status',
  })
  @ApiQuery({
    name: 'supports_thinking',
    required: false,
    type: Boolean,
    description: 'Filter by thinking mode support',
  })
  @ApiQuery({
    name: 'include_provider',
    required: false,
    type: Boolean,
    description: 'Include provider details in response',
  })
  @ApiResponse({
    status: 200,
    description: 'List of LLM models',
    type: [ModelResponseDto],
  })
  async getModels(
    @Query('provider_id') providerId?: string,
    @Query('status') status?: 'active' | 'inactive' | 'deprecated',
    @Query('supports_thinking') supportsThinking?: boolean,
    @Query('include_provider') includeProvider?: boolean,
  ): Promise<ModelResponseDto[]> {
    return this.modelsService.findAll({
      providerId,
      status,
      supportsThinking,
      includeProvider,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific LLM model by ID' })
  @ApiParam({ name: 'id', description: 'Model UUID' })
  @ApiQuery({
    name: 'include_provider',
    required: false,
    type: Boolean,
    description: 'Include provider details in response',
  })
  @ApiResponse({
    status: 200,
    description: 'Model details',
    type: ModelResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Model not found' })
  async getModel(
    @Param('id') id: string,
    @Query('include_provider') includeProvider?: boolean,
  ): Promise<ModelResponseDto> {
    const model = await this.modelsService.findOne(id, includeProvider);
    if (!model) {
      throw new HttpException('Model not found', HttpStatus.NOT_FOUND);
    }
    return model;
  }

  @Get('by-model-id/:modelId')
  @ApiOperation({ summary: 'Get model by API model ID (e.g., gpt-4o)' })
  @ApiParam({ name: 'modelId', description: 'API Model ID (e.g., gpt-4o)' })
  @ApiQuery({
    name: 'provider_id',
    required: false,
    description: 'Provider UUID to narrow search',
  })
  @ApiResponse({
    status: 200,
    description: 'Model details',
    type: ModelResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Model not found' })
  async getModelByModelId(
    @Param('modelId') modelId: string,
    @Query('provider_id') providerId?: string,
  ): Promise<ModelResponseDto> {
    const model = await this.modelsService.findByModelId(modelId, providerId);
    if (!model) {
      throw new HttpException('Model not found', HttpStatus.NOT_FOUND);
    }
    return model;
  }

  @Post('estimate-cost')
  @ApiOperation({ summary: 'Estimate cost for a message with specific model' })
  @ApiResponse({
    status: 200,
    description: 'Cost estimation',
    type: CostEstimateResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Model not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async estimateCost(
    @Body() costEstimateDto: CostEstimateDto,
  ): Promise<CostEstimateResponseDto> {
    return this.modelsService.estimateCost(costEstimateDto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new LLM model (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Model created successfully',
    type: ModelResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  @ApiResponse({
    status: 409,
    description: 'Model ID already exists for provider',
  })
  async createModel(
    @Body() createModelDto: CreateModelDto,
  ): Promise<ModelResponseDto> {
    return this.modelsService.create(createModelDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an LLM model (Admin only)' })
  @ApiParam({ name: 'id', description: 'Model UUID' })
  @ApiResponse({
    status: 200,
    description: 'Model updated successfully',
    type: ModelResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Model not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async updateModel(
    @Param('id') id: string,
    @Body() updateModelDto: UpdateModelDto,
  ): Promise<ModelResponseDto> {
    const model = await this.modelsService.update(id, updateModelDto);
    if (!model) {
      throw new HttpException('Model not found', HttpStatus.NOT_FOUND);
    }
    return model;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an LLM model (Admin only)' })
  @ApiParam({ name: 'id', description: 'Model UUID' })
  @ApiResponse({ status: 200, description: 'Model deleted successfully' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete model with existing usage',
  })
  async deleteModel(@Param('id') id: string): Promise<{ message: string }> {
    const deleted = await this.modelsService.delete(id);
    if (!deleted) {
      throw new HttpException('Model not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Model deleted successfully' };
  }

  @Get('recommendations/for-use-case')
  @ApiOperation({ summary: 'Get model recommendations for specific use cases' })
  @ApiQuery({
    name: 'use_case',
    required: true,
    description: 'Use case (e.g., "code generation", "reasoning", "chat")',
  })
  @ApiQuery({
    name: 'max_cost',
    required: false,
    type: Number,
    description: 'Maximum cost per 1K tokens',
  })
  @ApiQuery({
    name: 'min_context',
    required: false,
    type: Number,
    description: 'Minimum context window size',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommended models for the use case',
    type: [ModelResponseDto],
  })
  async getRecommendations(
    @Query('use_case') useCase: string,
    @Query('max_cost') maxCost?: number,
    @Query('min_context') minContext?: number,
  ): Promise<ModelResponseDto[]> {
    return this.modelsService.getRecommendations({
      useCase,
      maxCost,
      minContext,
    });
  }
}
