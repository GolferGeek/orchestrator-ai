import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UsageStatsResponseDto } from '../dto/llm-evaluation.dto';

interface UsageStatsOptions {
  startDate?: string;
  endDate?: string;
  providerId?: string;
  modelId?: string;
  includeDetails?: boolean;
  granularity?: 'daily' | 'weekly' | 'monthly';
}

interface CostSummaryOptions {
  startDate?: string;
  endDate?: string;
  groupBy: 'provider' | 'model' | 'date';
}

interface ModelPerformanceOptions {
  startDate?: string;
  endDate?: string;
  minUsage: number;
  sortBy: 'rating' | 'speed' | 'cost' | 'usage';
}

interface ExportOptions {
  format: 'json' | 'csv';
  startDate?: string;
  endDate?: string;
  includeDetails?: boolean;
}

@Injectable()
export class UsageService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getUserStats(
    userId: string,
    options: UsageStatsOptions,
  ): Promise<UsageStatsResponseDto> {
    const client = this.supabaseService.getClient();

    // Set default date range if not provided
    const endDate = options.endDate || new Date().toISOString().split('T')[0];
    const startDate = options.startDate || this.getDateDaysAgo(30);

    // Build base query for messages
    let query = client
      .from('messages')
      .select(
        `
        id, timestamp, total_cost, input_tokens, output_tokens, response_time_ms,
        user_rating, speed_rating, accuracy_rating,
        provider:providers(id, name),
        model:models(id, name, model_id)
      `,
      )
      .eq('user_id', userId)
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .not('total_cost', 'is', null);

    if (options.providerId) {
      query = query.eq('provider_id', options.providerId);
    }

    if (options.modelId) {
      query = query.eq('model_id', options.modelId);
    }

    const { data: messages, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch usage stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const stats = this.calculateStats(messages || [], startDate, endDate);

    if (options.includeDetails) {
      stats.by_provider = this.groupByProvider(messages || []);
      stats.by_model = this.groupByModel(messages || []);
      stats.daily_stats = this.groupByDate(
        messages || [],
        options.granularity || 'daily',
      );
    }

    return stats;
  }

  async getCostSummary(
    userId: string,
    options: CostSummaryOptions,
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
    const endDate = options.endDate || new Date().toISOString().split('T')[0];
    const startDate = options.startDate || this.getDateDaysAgo(30);

    const stats = await this.getUserStats(userId, {
      startDate,
      endDate,
      includeDetails: true,
    });

    const breakdown = this.createBreakdown(stats, options.groupBy);
    const trends = this.createTrends(stats.daily_stats || []);

    return {
      total_cost: stats.total_cost,
      total_tokens: stats.total_tokens,
      total_requests: stats.total_requests,
      period: { start_date: startDate, end_date: endDate },
      breakdown,
      trends,
    };
  }

  async getModelPerformance(
    userId: string,
    options: ModelPerformanceOptions,
  ): Promise<
    Array<{
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
    }>
  > {
    const stats = await this.getUserStats(userId, {
      startDate: options.startDate,
      endDate: options.endDate,
      includeDetails: true,
    });

    const modelMetrics = (stats.by_model || [])
      .filter((model) => model.requests >= options.minUsage)
      .map((model) => ({
        model: model.model,
        metrics: {
          usage_count: model.requests,
          avg_user_rating: model.avg_rating || 0,
          avg_speed_rating: 0, // Would need to calculate from message data
          avg_accuracy_rating: 0, // Would need to calculate from message data
          avg_response_time_ms: 0, // Would need to calculate from message data
          avg_cost_per_request:
            model.requests > 0 ? model.cost / model.requests : 0,
          total_cost: model.cost,
          total_tokens: model.tokens,
          cost_efficiency_score: this.calculateCostEfficiency(model),
          performance_score: this.calculatePerformanceScore(model),
        },
        rank: 0, // Will be assigned after sorting
      }));

    // Sort by specified metric
    modelMetrics.sort((a, b) => {
      switch (options.sortBy) {
        case 'rating':
          return b.metrics.avg_user_rating - a.metrics.avg_user_rating;
        case 'speed':
          return (
            a.metrics.avg_response_time_ms - b.metrics.avg_response_time_ms
          );
        case 'cost':
          return (
            a.metrics.avg_cost_per_request - b.metrics.avg_cost_per_request
          );
        case 'usage':
          return b.metrics.usage_count - a.metrics.usage_count;
        default:
          return b.metrics.performance_score - a.metrics.performance_score;
      }
    });

    // Assign ranks
    modelMetrics.forEach((metric, index) => {
      metric.rank = index + 1;
    });

    return modelMetrics;
  }

  async getSpendingInsights(
    userId: string,
    lookbackDays: number,
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
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = this.getDateDaysAgo(lookbackDays);

    const stats = await this.getUserStats(userId, {
      startDate,
      endDate,
      includeDetails: true,
    });

    const spendingSummary = this.calculateSpendingSummary(stats, lookbackDays);
    const usagePatterns = this.analyzeUsagePatterns(stats);
    const modelInsights = this.analyzeModelInsights(stats);
    const recommendations = this.generateRecommendations(
      stats,
      spendingSummary,
      modelInsights,
    );

    return {
      analysis_period: {
        start_date: startDate,
        end_date: endDate,
        days: lookbackDays,
      },
      spending_summary: spendingSummary,
      usage_patterns: usagePatterns,
      model_insights: modelInsights,
      recommendations,
    };
  }

  async exportUsageData(
    userId: string,
    options: ExportOptions,
  ): Promise<any[] | string> {
    const stats = await this.getUserStats(userId, {
      startDate: options.startDate,
      endDate: options.endDate,
      includeDetails: true,
    });

    const exportData = {
      summary: {
        total_requests: stats.total_requests,
        total_tokens: stats.total_tokens,
        total_cost: stats.total_cost,
        average_response_time: stats.average_response_time,
        average_user_rating: stats.average_user_rating,
      },
      by_provider: stats.by_provider,
      by_model: stats.by_model,
      daily_stats: stats.daily_stats,
    };

    if (options.format === 'csv') {
      return this.convertToCSV(exportData);
    }

    return [exportData];
  }

  async getBudgetStatus(
    userId: string,
    monthlyBudget?: number,
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
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    const monthlyStats = await this.getUserStats(userId, {
      startDate: startOfMonth,
      endDate: endOfMonth,
    });

    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const daysElapsed = now.getDate();
    const daysRemaining = daysInMonth - daysElapsed;

    const dailyAverage = monthlyStats.total_cost / daysElapsed;
    const projectedTotal = dailyAverage * daysInMonth;

    const budget = monthlyBudget || 100; // Default $100 budget
    const percentageUsed = (monthlyStats.total_cost / budget) * 100;

    const currentMonth = {
      spent: monthlyStats.total_cost,
      budget,
      percentage_used: percentageUsed,
      days_remaining: daysRemaining,
      projected_total: projectedTotal,
    };

    const alerts = this.generateBudgetAlerts(currentMonth);
    const recommendations = this.generateBudgetRecommendations(
      currentMonth,
      monthlyStats,
    );

    return {
      current_month: currentMonth,
      alerts,
      recommendations,
    };
  }

  // Helper methods
  private calculateStats(
    messages: any[],
    startDate: string,
    endDate: string,
  ): UsageStatsResponseDto {
    const totalRequests = messages.length;
    const totalTokens = messages.reduce(
      (sum, msg) => sum + (msg.input_tokens || 0) + (msg.output_tokens || 0),
      0,
    );
    const totalCost = messages.reduce(
      (sum, msg) => sum + (msg.total_cost || 0),
      0,
    );
    const avgResponseTime =
      messages.length > 0
        ? messages.reduce((sum, msg) => sum + (msg.response_time_ms || 0), 0) /
          messages.length
        : 0;
    const avgUserRating =
      messages.filter((msg) => msg.user_rating).length > 0
        ? messages.reduce((sum, msg) => sum + (msg.user_rating || 0), 0) /
          messages.filter((msg) => msg.user_rating).length
        : undefined;

    return {
      user_id: messages[0]?.user_id || '',
      date_range: { start_date: startDate, end_date: endDate },
      total_requests: totalRequests,
      total_tokens: totalTokens,
      total_cost: totalCost,
      average_response_time: avgResponseTime,
      average_user_rating: avgUserRating,
    };
  }

  private groupByProvider(messages: any[]): any[] {
    const grouped = messages.reduce((acc, msg) => {
      const providerId = msg.provider?.id || 'unknown';
      if (!acc[providerId]) {
        acc[providerId] = {
          provider: msg.provider,
          requests: 0,
          tokens: 0,
          cost: 0,
        };
      }
      acc[providerId].requests++;
      acc[providerId].tokens +=
        (msg.input_tokens || 0) + (msg.output_tokens || 0);
      acc[providerId].cost += msg.total_cost || 0;
      return acc;
    }, {});

    return Object.values(grouped);
  }

  private groupByModel(messages: any[]): any[] {
    const grouped = messages.reduce((acc, msg) => {
      const modelId = msg.model?.id || 'unknown';
      if (!acc[modelId]) {
        acc[modelId] = {
          model: msg.model,
          requests: 0,
          tokens: 0,
          cost: 0,
          avg_rating: 0,
        };
      }
      acc[modelId].requests++;
      acc[modelId].tokens += (msg.input_tokens || 0) + (msg.output_tokens || 0);
      acc[modelId].cost += msg.total_cost || 0;
      return acc;
    }, {});

    return Object.values(grouped);
  }

  private groupByDate(messages: any[], granularity: string): any[] {
    const grouped = messages.reduce((acc, msg) => {
      const date = new Date(msg.timestamp).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          requests: 0,
          tokens: 0,
          cost: 0,
        };
      }
      acc[date].requests++;
      acc[date].tokens += (msg.input_tokens || 0) + (msg.output_tokens || 0);
      acc[date].cost += msg.total_cost || 0;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }

  private createBreakdown(
    stats: UsageStatsResponseDto,
    groupBy: string,
  ): any[] {
    // Implementation depends on groupBy parameter
    return [];
  }

  private createTrends(dailyStats: any[]): any[] {
    return dailyStats.map((day) => ({
      date: day.date,
      cost: day.cost,
      tokens: day.tokens,
      requests: day.requests,
    }));
  }

  private calculateCostEfficiency(model: any): number {
    // Simple cost efficiency score based on cost per token
    return model.tokens > 0 ? 1 / (model.cost / model.tokens) : 0;
  }

  private calculatePerformanceScore(model: any): number {
    // Composite score based on rating and cost efficiency
    return (
      (model.avg_rating || 0) * 0.7 + this.calculateCostEfficiency(model) * 0.3
    );
  }

  private calculateSpendingSummary(
    stats: UsageStatsResponseDto,
    days: number,
  ): any {
    return {
      total_spent: stats.total_cost,
      daily_average: stats.total_cost / days,
      projected_monthly: (stats.total_cost / days) * 30,
      most_expensive_day: '',
      most_expensive_amount: 0,
    };
  }

  private analyzeUsagePatterns(stats: UsageStatsResponseDto): any {
    return {
      peak_hours: [9, 10, 14, 15], // Mock data
      busiest_day_of_week: 'Tuesday',
      avg_requests_per_day: stats.total_requests / 30,
      avg_tokens_per_request: stats.total_tokens / stats.total_requests,
    };
  }

  private analyzeModelInsights(stats: UsageStatsResponseDto): any {
    return {
      most_used_model: 'GPT-4o',
      most_expensive_model: 'Claude 3 Opus',
      best_value_model: 'GPT-4o Mini',
      underutilized_models: [],
    };
  }

  private generateRecommendations(
    stats: any,
    spending: any,
    insights: any,
  ): any[] {
    return [
      {
        type: 'cost_optimization',
        title: 'Consider using more cost-effective models',
        description:
          'Switch to GPT-4o Mini for simpler tasks to reduce costs by up to 80%',
        potential_savings: spending.total_spent * 0.3,
        priority: 'medium',
      },
    ];
  }

  private generateBudgetAlerts(currentMonth: any): any[] {
    const alerts = [];

    if (currentMonth.percentage_used > 90) {
      alerts.push({
        level: 'danger' as const,
        message: 'You have exceeded 90% of your monthly budget',
        threshold: 90,
        current_value: currentMonth.percentage_used,
      });
    } else if (currentMonth.percentage_used > 75) {
      alerts.push({
        level: 'warning' as const,
        message: 'You have used 75% of your monthly budget',
        threshold: 75,
        current_value: currentMonth.percentage_used,
      });
    }

    if (currentMonth.projected_total > currentMonth.budget * 1.2) {
      alerts.push({
        level: 'warning' as const,
        message: 'Current spending pace will exceed budget by 20%',
        threshold: currentMonth.budget,
        current_value: currentMonth.projected_total,
      });
    }

    return alerts;
  }

  private generateBudgetRecommendations(currentMonth: any, stats: any): any[] {
    return [
      {
        action: 'switch_to_cheaper_models',
        description: 'Use more cost-effective models for routine tasks',
        estimated_savings: currentMonth.spent * 0.2,
      },
    ];
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - would need more sophisticated implementation
    return JSON.stringify(data);
  }

  private getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}
