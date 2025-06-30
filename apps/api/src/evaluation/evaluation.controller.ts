import {
  Controller,
  Get,
  Post,
  Put,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EvaluationService } from './evaluation.service';
import {
  MessageEvaluationDto,
  EnhancedMessageResponseDto,
} from '../dto/llm-evaluation.dto';

@ApiTags('Message Evaluation')
@Controller('evaluation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('messages/:messageId')
  @ApiOperation({ summary: 'Submit evaluation for a message' })
  @ApiParam({ name: 'messageId', description: 'Message UUID' })
  @ApiResponse({
    status: 200,
    description: 'Evaluation submitted successfully',
    type: EnhancedMessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to evaluate this message',
  })
  async evaluateMessage(
    @CurrentUser() user: any,
    @Param('messageId') messageId: string,
    @Body() evaluationDto: MessageEvaluationDto,
  ): Promise<EnhancedMessageResponseDto> {
    const result = await this.evaluationService.evaluateMessage(
      user.id,
      messageId,
      evaluationDto,
    );
    if (!result) {
      throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('messages/:messageId')
  @ApiOperation({ summary: 'Get evaluation for a specific message' })
  @ApiParam({ name: 'messageId', description: 'Message UUID' })
  @ApiResponse({
    status: 200,
    description: 'Message evaluation details',
    type: EnhancedMessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async getMessageEvaluation(
    @CurrentUser() user: any,
    @Param('messageId') messageId: string,
  ): Promise<EnhancedMessageResponseDto> {
    const message = await this.evaluationService.getMessageWithEvaluation(
      user.id,
      messageId,
    );
    if (!message) {
      throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
    }
    return message;
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Get all evaluated messages in a session' })
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiQuery({
    name: 'min_rating',
    required: false,
    type: Number,
    description: 'Filter by minimum user rating (1-5)',
  })
  @ApiQuery({
    name: 'has_notes',
    required: false,
    type: Boolean,
    description: 'Filter messages with user notes',
  })
  @ApiResponse({
    status: 200,
    description: 'List of evaluated messages in session',
    type: [EnhancedMessageResponseDto],
  })
  async getSessionEvaluations(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Query('min_rating') minRating?: number,
    @Query('has_notes') hasNotes?: boolean,
  ): Promise<EnhancedMessageResponseDto[]> {
    return this.evaluationService.getSessionEvaluations(user.id, sessionId, {
      minRating,
      hasNotes,
    });
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Get evaluation statistics summary for user' })
  @ApiQuery({
    name: 'start_date',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'provider_id',
    required: false,
    description: 'Filter by provider UUID',
  })
  @ApiQuery({
    name: 'model_id',
    required: false,
    description: 'Filter by model UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Evaluation statistics summary',
    schema: {
      type: 'object',
      properties: {
        total_evaluations: { type: 'number' },
        average_overall_rating: { type: 'number' },
        average_speed_rating: { type: 'number' },
        average_accuracy_rating: { type: 'number' },
        evaluation_distribution: {
          type: 'object',
          properties: {
            '1': { type: 'number' },
            '2': { type: 'number' },
            '3': { type: 'number' },
            '4': { type: 'number' },
            '5': { type: 'number' },
          },
        },
        model_performance: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              model: { $ref: '#/components/schemas/ModelResponseDto' },
              avg_rating: { type: 'number' },
              evaluation_count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getEvaluationStats(
    @CurrentUser() user: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('provider_id') providerId?: string,
    @Query('model_id') modelId?: string,
  ): Promise<{
    total_evaluations: number;
    average_overall_rating: number;
    average_speed_rating: number;
    average_accuracy_rating: number;
    evaluation_distribution: Record<string, number>;
    model_performance: Array<{
      model: any;
      avg_rating: number;
      evaluation_count: number;
    }>;
  }> {
    return this.evaluationService.getEvaluationStats(user.id, {
      startDate,
      endDate,
      providerId,
      modelId,
    });
  }

  @Get('feedback/export')
  @ApiOperation({ summary: 'Export user feedback and evaluations' })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'csv'],
    description: 'Export format',
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'include_content',
    required: false,
    type: Boolean,
    description: 'Include message content in export',
  })
  @ApiResponse({
    status: 200,
    description: 'Exported evaluation data',
    schema: {
      oneOf: [
        {
          type: 'array',
          description: 'JSON format export',
        },
        {
          type: 'string',
          description: 'CSV format export',
        },
      ],
    },
  })
  async exportFeedback(
    @CurrentUser() user: any,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('include_content') includeContent?: boolean,
  ): Promise<any[] | string> {
    return this.evaluationService.exportUserFeedback(user.id, {
      format,
      startDate,
      endDate,
      includeContent,
    });
  }

  @Put('messages/:messageId')
  @ApiOperation({ summary: 'Update evaluation for a message' })
  @ApiParam({ name: 'messageId', description: 'Message UUID' })
  @ApiResponse({
    status: 200,
    description: 'Evaluation updated successfully',
    type: EnhancedMessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to update this evaluation',
  })
  async updateMessageEvaluation(
    @CurrentUser() user: any,
    @Param('messageId') messageId: string,
    @Body() evaluationDto: MessageEvaluationDto,
  ): Promise<EnhancedMessageResponseDto> {
    const result = await this.evaluationService.updateMessageEvaluation(
      user.id,
      messageId,
      evaluationDto,
    );
    if (!result) {
      throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('insights/model-comparison')
  @ApiOperation({ summary: 'Get model performance comparison insights' })
  @ApiQuery({
    name: 'models',
    required: true,
    description: 'Comma-separated list of model UUIDs to compare',
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Model comparison insights',
    schema: {
      type: 'object',
      properties: {
        comparison: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              model: { $ref: '#/components/schemas/ModelResponseDto' },
              metrics: {
                type: 'object',
                properties: {
                  avg_overall_rating: { type: 'number' },
                  avg_speed_rating: { type: 'number' },
                  avg_accuracy_rating: { type: 'number' },
                  avg_response_time_ms: { type: 'number' },
                  avg_cost: { type: 'number' },
                  evaluation_count: { type: 'number' },
                },
              },
            },
          },
        },
        recommendations: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  async getModelComparison(
    @CurrentUser() user: any,
    @Query('models') models: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ): Promise<{
    comparison: Array<{
      model: any;
      metrics: {
        avg_overall_rating: number;
        avg_speed_rating: number;
        avg_accuracy_rating: number;
        avg_response_time_ms: number;
        avg_cost: number;
        evaluation_count: number;
      };
    }>;
    recommendations: string[];
  }> {
    const modelIds = models.split(',').map((id) => id.trim());
    return this.evaluationService.compareModels(user.id, modelIds, {
      startDate,
      endDate,
    });
  }
}
