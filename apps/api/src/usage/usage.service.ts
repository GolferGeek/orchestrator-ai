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
    const client = this.supabaseService.getServiceClient();

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

    const stats = this.calculateStats(messages || [], startDate, endDate!);

    if (options.includeDetails) {
      stats.byProvider = this.groupByProvider(messages || []);
      stats.byModel = this.groupByModel(messages || []);
      stats.dailyStats = this.groupByDate(
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
    totalCost: number;
    totalTokens: number;
    totalRequests: number;
    period: { startDate: string; endDate: string };
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
    const trends = this.createTrends(stats.dailyStats || []);

    return {
      totalCost: stats.totalCost,
      totalTokens: stats.totalTokens,
      totalRequests: stats.totalRequests,
      period: { startDate: startDate, endDate: endDate! },
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
        usageCount: number;
        avgUserRating: number;
        avgSpeedRating: number;
        avgAccuracyRating: number;
        avgResponseTimeMs: number;
        avgCostPerRequest: number;
        totalCost: number;
        totalTokens: number;
        costEfficiencyScore: number;
        performanceScore: number;
      };
      rank: number;
    }>
  > {
    const stats = await this.getUserStats(userId, {
      startDate: options.startDate,
      endDate: options.endDate,
      includeDetails: true,
    });

    const modelMetrics = (stats.byModel || [])
      .filter((model) => model.requests >= options.minUsage)
      .map((model) => ({
        model: model.model,
        metrics: {
          usageCount: model.requests,
          avgUserRating: model.avgRating || 0,
          avgSpeedRating: 0, // Would need to calculate from message data
          avgAccuracyRating: 0, // Would need to calculate from message data
          avgResponseTimeMs: 0, // Would need to calculate from message data
          avgCostPerRequest:
            model.requests > 0 ? model.cost / model.requests : 0,
          totalCost: model.cost,
          totalTokens: model.tokens,
          costEfficiencyScore: this.calculateCostEfficiency(model),
          performanceScore: this.calculatePerformanceScore(model),
        },
        rank: 0, // Will be assigned after sorting
      }));

    // Sort by specified metric
    modelMetrics.sort((a, b) => {
      switch (options.sortBy) {
        case 'rating':
          return b.metrics.avgUserRating - a.metrics.avgUserRating;
        case 'speed':
          return (
            a.metrics.avgResponseTimeMs - b.metrics.avgResponseTimeMs
          );
        case 'cost':
          return (
            a.metrics.avgCostPerRequest - b.metrics.avgCostPerRequest
          );
        case 'usage':
          return b.metrics.usageCount - a.metrics.usageCount;
        default:
          return b.metrics.performanceScore - a.metrics.performanceScore;
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
    analysisPeriod: {
      startDate: string;
      endDate: string;
      days: number;
    };
    spendingSummary: {
      totalSpent: number;
      dailyAverage: number;
      projectedMonthly: number;
      mostExpensiveDay: string;
      mostExpensiveAmount: number;
    };
    usagePatterns: {
      peakHours: number[];
      busiestDayOfWeek: string;
      avgRequestsPerDay: number;
      avgTokensPerRequest: number;
    };
    modelInsights: {
      mostUsedModel: string;
      mostExpensiveModel: string;
      bestValueModel: string;
      underutilizedModels: string[];
    };
    recommendations: Array<{
      type: string;
      title: string;
      description: string;
      potentialSavings: number;
      priority: string;
    }>;
  }> {
    const endDate = new Date().toISOString().split('T')[0]!;
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
      analysisPeriod: {
        startDate: startDate,
        endDate: endDate,
        days: lookbackDays,
      },
      spendingSummary: spendingSummary,
      usagePatterns: usagePatterns,
      modelInsights: modelInsights,
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
        totalRequests: stats.totalRequests,
        totalTokens: stats.totalTokens,
        totalCost: stats.totalCost,
        averageResponseTime: stats.averageResponseTime,
        averageUserRating: stats.averageUserRating,
      },
      byProvider: stats.byProvider,
      byModel: stats.byModel,
      dailyStats: stats.dailyStats,
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
    currentMonth: {
      spent: number;
      budget: number;
      percentageUsed: number;
      daysRemaining: number;
      projectedTotal: number;
    };
    alerts: Array<{
      level: 'info' | 'warning' | 'danger';
      message: string;
      threshold: number;
      currentValue: number;
    }>;
    recommendations: Array<{
      action: string;
      description: string;
      estimatedSavings: number;
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

    const dailyAverage = monthlyStats.totalCost / daysElapsed;
    const projectedTotal = dailyAverage * daysInMonth;

    const budget = monthlyBudget || 100; // Default $100 budget
    const percentageUsed = (monthlyStats.totalCost / budget) * 100;

    const currentMonth = {
      spent: monthlyStats.totalCost,
      budget,
      percentageUsed: percentageUsed,
      daysRemaining: daysRemaining,
      projectedTotal: projectedTotal,
    };

    const alerts = this.generateBudgetAlerts(currentMonth);
    const recommendations = this.generateBudgetRecommendations(
      currentMonth,
      monthlyStats,
    );

    return {
      currentMonth: currentMonth,
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
      userId: messages[0]?.user_id || '',
      dateRange: { startDate: startDate, endDate: endDate },
      totalRequests: totalRequests,
      totalTokens: totalTokens,
      totalCost: totalCost,
      averageResponseTime: avgResponseTime,
      averageUserRating: avgUserRating,
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
    const grouped = messages.reduce((acc: Record<string, any>, msg) => {
      const date = new Date(msg.timestamp).toISOString().split('T')[0]!;
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

    return Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date));
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
      totalSpent: stats.totalCost,
      dailyAverage: stats.totalCost / days,
      projectedMonthly: (stats.totalCost / days) * 30,
      mostExpensiveDay: '',
      mostExpensiveAmount: 0,
    };
  }

  private analyzeUsagePatterns(stats: UsageStatsResponseDto): any {
    return {
      peakHours: [9, 10, 14, 15], // Mock data
      busiestDayOfWeek: 'Tuesday',
      avgRequestsPerDay: stats.totalRequests / 30,
      avgTokensPerRequest: stats.totalTokens / stats.totalRequests,
    };
  }

  private analyzeModelInsights(stats: UsageStatsResponseDto): any {
    return {
      mostUsedModel: 'GPT-4o',
      mostExpensiveModel: 'Claude 3 Opus',
      bestValueModel: 'GPT-4o Mini',
      underutilizedModels: [],
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
        potentialSavings: spending.totalSpent * 0.3,
        priority: 'medium',
      },
    ];
  }

  private generateBudgetAlerts(currentMonth: any): any[] {
    const alerts = [];

    if (currentMonth.percentageUsed > 90) {
      alerts.push({
        level: 'danger' as const,
        message: 'You have exceeded 90% of your monthly budget',
        threshold: 90,
        currentValue: currentMonth.percentageUsed,
      });
    } else if (currentMonth.percentageUsed > 75) {
      alerts.push({
        level: 'warning' as const,
        message: 'You have used 75% of your monthly budget',
        threshold: 75,
        currentValue: currentMonth.percentageUsed,
      });
    }

    if (currentMonth.projectedTotal > currentMonth.budget * 1.2) {
      alerts.push({
        level: 'warning' as const,
        message: 'Current spending pace will exceed budget by 20%',
        threshold: currentMonth.budget,
        currentValue: currentMonth.projectedTotal,
      });
    }

    return alerts;
  }

  private generateBudgetRecommendations(currentMonth: any, stats: any): any[] {
    return [
      {
        action: 'switch_to_cheaper_models',
        description: 'Use more cost-effective models for routine tasks',
        estimatedSavings: currentMonth.spent * 0.2,
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
    const dateString = date.toISOString().split('T')[0]!;
    return dateString;
  }
}
