import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsageService } from './usage.service';
import {
  UsageStatsQueryDto,
  UsageStatsResponseDto,
} from '../dto/llm-evaluation.dto';

@ApiTags('Usage Analytics')
@Controller('usage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get usage statistics for the current user' })
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
  @ApiQuery({
    name: 'include_details',
    required: false,
    type: Boolean,
    description: 'Include detailed breakdown by provider/model',
  })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
    description: 'Time granularity for breakdown',
  })
  @ApiResponse({
    status: 200,
    description: 'User usage statistics',
    type: UsageStatsResponseDto,
  })
  async getUserStats(
    @CurrentUser() user: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('provider_id') providerId?: string,
    @Query('model_id') modelId?: string,
    @Query('include_details') includeDetails?: boolean,
    @Query('granularity') granularity: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<UsageStatsResponseDto> {
    return this.usageService.getUserStats(user.id, {
      startDate,
      endDate,
      providerId,
      modelId,
      includeDetails,
      granularity,
    });
  }

  @Get('costs/summary')
  @ApiOperation({ summary: 'Get cost summary for the current user' })
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
    name: 'group_by',
    required: false,
    enum: ['provider', 'model', 'date'],
    description: 'Group costs by provider, model, or date',
  })
  @ApiResponse({
    status: 200,
    description: 'Cost summary with breakdown',
    schema: {
      type: 'object',
      properties: {
        total_cost: { type: 'number' },
        total_tokens: { type: 'number' },
        total_requests: { type: 'number' },
        period: {
          type: 'object',
          properties: {
            start_date: { type: 'string' },
            end_date: { type: 'string' },
          },
        },
        breakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              cost: { type: 'number' },
              tokens: { type: 'number' },
              requests: { type: 'number' },
              percentage: { type: 'number' },
            },
          },
        },
        trends: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              cost: { type: 'number' },
              tokens: { type: 'number' },
              requests: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getCostSummary(
    @CurrentUser() user: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('group_by') groupBy: 'provider' | 'model' | 'date' = 'provider',
  ): Promise<{
    total_cost: number;
    total_tokens: number;
    total_requests: number;
    period: { start_date: string; end_date: string };
    breakdown: Array<{
      key: string;
      cost: number;
      tokens: number;
      requests: number;
      percentage: number;
    }>;
    trends: Array<{
      date: string;
      cost: number;
      tokens: number;
      requests: number;
    }>;
  }> {
    return this.usageService.getCostSummary(user.id, {
      startDate,
      endDate,
      groupBy,
    });
  }

  @Get('performance/models')
  @ApiOperation({ summary: 'Get model performance metrics for user' })
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
    name: 'min_usage',
    required: false,
    type: Number,
    description: 'Minimum number of requests to include model',
  })
  @ApiQuery({
    name: 'sort_by',
    required: false,
    enum: ['rating', 'speed', 'cost', 'usage'],
    description: 'Sort models by metric',
  })
  @ApiResponse({
    status: 200,
    description: 'Model performance metrics',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          model: { $ref: '#/components/schemas/ModelResponseDto' },
          metrics: {
            type: 'object',
            properties: {
              usage_count: { type: 'number' },
              avg_user_rating: { type: 'number' },
              avg_speed_rating: { type: 'number' },
              avg_accuracy_rating: { type: 'number' },
              avg_response_time_ms: { type: 'number' },
              avg_cost_per_request: { type: 'number' },
              total_cost: { type: 'number' },
              total_tokens: { type: 'number' },
              cost_efficiency_score: { type: 'number' },
              performance_score: { type: 'number' },
            },
          },
          rank: { type: 'number' },
        },
      },
    },
  })
  async getModelPerformance(
    @CurrentUser() user: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('min_usage') minUsage: number = 1,
    @Query('sort_by') sortBy: 'rating' | 'speed' | 'cost' | 'usage' = 'rating',
  ): Promise<Array<{
    model: any;
    metrics: {
      usage_count: number;
      avg_user_rating: number;
      avg_speed_rating: number;
      avg_accuracy_rating: number;
      avg_response_time_ms: number;
      avg_cost_per_request: number;
      total_cost: number;
      total_tokens: number;
      cost_efficiency_score: number;
      performance_score: number;
    };
    rank: number;
  }>> {
    return this.usageService.getModelPerformance(user.id, {
      startDate,
      endDate,
      minUsage,
      sortBy,
    });
  }

  @Get('insights/spending-patterns')
  @ApiOperation({ summary: 'Get spending pattern insights and recommendations' })
  @ApiQuery({
    name: 'lookback_days',
    required: false,
    type: Number,
    description: 'Number of days to analyze (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Spending pattern insights',
    schema: {
      type: 'object',
      properties: {
        analysis_period: {
          type: 'object',
          properties: {
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            days: { type: 'number' },
          },
        },
        spending_summary: {
          type: 'object',
          properties: {
            total_spent: { type: 'number' },
            daily_average: { type: 'number' },
            projected_monthly: { type: 'number' },
            most_expensive_day: { type: 'string' },
            most_expensive_amount: { type: 'number' },
          },
        },
        usage_patterns: {
          type: 'object',
          properties: {
            peak_hours: { type: 'array', items: { type: 'number' } },
            busiest_day_of_week: { type: 'string' },
            avg_requests_per_day: { type: 'number' },
            avg_tokens_per_request: { type: 'number' },
          },
        },
        model_insights: {
          type: 'object',
          properties: {
            most_used_model: { type: 'string' },
            most_expensive_model: { type: 'string' },
            best_value_model: { type: 'string' },
            underutilized_models: { type: 'array', items: { type: 'string' } },
          },
        },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              potential_savings: { type: 'number' },
              priority: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async getSpendingInsights(
    @CurrentUser() user: any,
    @Query('lookback_days') lookbackDays: number = 30,
  ): Promise<{
    analysis_period: {
      start_date: string;
      end_date: string;
      days: number;
    };
    spending_summary: {
      total_spent: number;
      daily_average: number;
      projected_monthly: number;
      most_expensive_day: string;
      most_expensive_amount: number;
    };
    usage_patterns: {
      peak_hours: number[];
      busiest_day_of_week: string;
      avg_requests_per_day: number;
      avg_tokens_per_request: number;
    };
    model_insights: {
      most_used_model: string;
      most_expensive_model: string;
      best_value_model: string;
      underutilized_models: string[];
    };
    recommendations: Array<{
      type: string;
      title: string;
      description: string;
      potential_savings: number;
      priority: string;
    }>;
  }> {
    return this.usageService.getSpendingInsights(user.id, lookbackDays);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export usage data' })
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
    name: 'include_details',
    required: false,
    type: Boolean,
    description: 'Include detailed per-message data',
  })
  @ApiResponse({
    status: 200,
    description: 'Exported usage data',
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
  async exportUsageData(
    @CurrentUser() user: any,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('include_details') includeDetails?: boolean,
  ): Promise<any[] | string> {
    return this.usageService.exportUsageData(user.id, {
      format,
      startDate,
      endDate,
      includeDetails,
    });
  }

  @Get('alerts/budget-status')
  @ApiOperation({ summary: 'Get budget alerts and spending warnings' })
  @ApiQuery({
    name: 'monthly_budget',
    required: false,
    type: Number,
    description: 'Monthly budget limit in USD',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget status and alerts',
    schema: {
      type: 'object',
      properties: {
        current_month: {
          type: 'object',
          properties: {
            spent: { type: 'number' },
            budget: { type: 'number' },
            percentage_used: { type: 'number' },
            days_remaining: { type: 'number' },
            projected_total: { type: 'number' },
          },
        },
        alerts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              level: { type: 'string', enum: ['info', 'warning', 'danger'] },
              message: { type: 'string' },
              threshold: { type: 'number' },
              current_value: { type: 'number' },
            },
          },
        },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              description: { type: 'string' },
              estimated_savings: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getBudgetStatus(
    @CurrentUser() user: any,
    @Query('monthly_budget') monthlyBudget?: number,
  ): Promise<{
    current_month: {
      spent: number;
      budget: number;
      percentage_used: number;
      days_remaining: number;
      projected_total: number;
    };
    alerts: Array<{
      level: 'info' | 'warning' | 'danger';
      message: string;
      threshold: number;
      current_value: number;
    }>;
    recommendations: Array<{
      action: string;
      description: string;
      estimated_savings: number;
    }>;
  }> {
    return this.usageService.getBudgetStatus(user.id, monthlyBudget);
  }
}