import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  MessageEvaluationDto,
  EnhancedMessageResponseDto,
} from '../dto/llm-evaluation.dto';
import { UserRatingScale } from '../types/llm-evaluation';

interface EvaluationFilters {
  minRating?: number;
  hasNotes?: boolean;
}

interface EvaluationStatsFilters {
  startDate?: string;
  endDate?: string;
  providerId?: string;
  modelId?: string;
}

interface ModelComparisonFilters {
  startDate?: string;
  endDate?: string;
}

interface FeedbackExportOptions {
  format: 'json' | 'csv';
  startDate?: string;
  endDate?: string;
  includeContent?: boolean;
}

@Injectable()
export class EvaluationService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async evaluateMessage(
    userId: string,
    messageId: string,
    evaluationDto: MessageEvaluationDto,
  ): Promise<EnhancedMessageResponseDto | null> {
    const client = this.supabaseService.getClient();

    // Verify message exists and belongs to user
    const { data: message, error: messageError } = await client
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('user_id', userId)
      .single();

    if (messageError || !message) {
      return null;
    }

    // Update message with evaluation data
    const { data: updatedMessage, error: updateError } = await client
      .from('messages')
      .update({
        user_rating: evaluationDto.user_rating,
        speed_rating: evaluationDto.speed_rating,
        accuracy_rating: evaluationDto.accuracy_rating,
        user_notes: evaluationDto.user_notes,
        evaluation_details: evaluationDto.evaluation_details,
        evaluation_timestamp: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('user_id', userId)
      .select(
        `
        *,
        provider:providers(*),
        model:models(*)
      `,
      )
      .single();

    if (updateError) {
      throw new HttpException(
        `Failed to save evaluation: ${updateError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Update usage statistics if ratings are provided
    if (evaluationDto.user_rating) {
      await this.updateUsageStatsWithRating(
        userId,
        message.provider_id,
        message.model_id,
        evaluationDto.user_rating,
      );
    }

    return updatedMessage;
  }

  async getMessageWithEvaluation(
    userId: string,
    messageId: string,
  ): Promise<EnhancedMessageResponseDto | null> {
    const client = this.supabaseService.getClient();

    const { data: message, error } = await client
      .from('messages')
      .select(
        `
        *,
        provider:providers(*),
        model:models(*)
      `,
      )
      .eq('id', messageId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new HttpException(
        `Failed to fetch message: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return message;
  }

  async getSessionEvaluations(
    userId: string,
    sessionId: string,
    filters: EvaluationFilters = {},
  ): Promise<EnhancedMessageResponseDto[]> {
    const client = this.supabaseService.getClient();

    let query = client
      .from('messages')
      .select(
        `
        *,
        provider:providers(*),
        model:models(*)
      `,
      )
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .not('user_rating', 'is', null)
      .order('timestamp');

    if (filters.minRating) {
      query = query.gte('user_rating', filters.minRating);
    }

    if (filters.hasNotes) {
      query = query.not('user_notes', 'is', null);
    }

    const { data: messages, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch session evaluations: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return messages || [];
  }

  async getEvaluationStats(
    userId: string,
    filters: EvaluationStatsFilters = {},
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
    const client = this.supabaseService.getClient();

    // Build base query
    let query = client
      .from('messages')
      .select(
        `
        user_rating,
        speed_rating,
        accuracy_rating,
        provider_id,
        model_id,
        model:models(*),
        timestamp
      `,
      )
      .eq('user_id', userId)
      .not('user_rating', 'is', null);

    if (filters.startDate) {
      query = query.gte('timestamp', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('timestamp', filters.endDate);
    }

    if (filters.providerId) {
      query = query.eq('provider_id', filters.providerId);
    }

    if (filters.modelId) {
      query = query.eq('model_id', filters.modelId);
    }

    const { data: evaluations, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch evaluation stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const stats = this.calculateEvaluationStats(evaluations || []);
    const modelPerformance = this.calculateModelPerformance(evaluations || []);

    return {
      ...stats,
      model_performance: modelPerformance,
    };
  }

  async updateMessageEvaluation(
    userId: string,
    messageId: string,
    evaluationDto: MessageEvaluationDto,
  ): Promise<EnhancedMessageResponseDto | null> {
    // Same as evaluateMessage but for updates
    return this.evaluateMessage(userId, messageId, evaluationDto);
  }

  async exportUserFeedback(
    userId: string,
    options: FeedbackExportOptions,
  ): Promise<any[] | string> {
    const client = this.supabaseService.getClient();

    let query = client
      .from('messages')
      .select(
        `
        id,
        timestamp,
        ${options.includeContent ? 'content,' : ''}
        user_rating,
        speed_rating,
        accuracy_rating,
        user_notes,
        evaluation_timestamp,
        total_cost,
        input_tokens,
        output_tokens,
        response_time_ms,
        provider:providers(name),
        model:models(name, model_id)
      `,
      )
      .eq('user_id', userId)
      .not('user_rating', 'is', null)
      .order('timestamp');

    if (options.startDate) {
      query = query.gte('timestamp', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('timestamp', options.endDate);
    }

    const { data: feedback, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to export feedback: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (options.format === 'csv') {
      return this.convertFeedbackToCSV(feedback || []);
    }

    return feedback || [];
  }

  async compareModels(
    userId: string,
    modelIds: string[],
    filters: ModelComparisonFilters = {},
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
    const client = this.supabaseService.getClient();

    let query = client
      .from('messages')
      .select(
        `
        user_rating,
        speed_rating,
        accuracy_rating,
        response_time_ms,
        total_cost,
        model:models(*),
        timestamp
      `,
      )
      .eq('user_id', userId)
      .in('model_id', modelIds)
      .not('user_rating', 'is', null);

    if (filters.startDate) {
      query = query.gte('timestamp', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('timestamp', filters.endDate);
    }

    const { data: messages, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch model comparison data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const comparison = this.calculateModelComparison(messages || []);
    const recommendations = this.generateModelRecommendations(comparison);

    return {
      comparison,
      recommendations,
    };
  }

  // Helper methods
  private async updateUsageStatsWithRating(
    userId: string,
    providerId: string,
    modelId: string,
    rating: UserRatingScale,
  ): Promise<void> {
    const client = this.supabaseService.getClient();
    const today = new Date().toISOString().split('T')[0];

    // Get current stats for today
    const { data: existingStats } = await client
      .from('user_usage_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .eq('provider_id', providerId)
      .eq('model_id', modelId)
      .single();

    if (existingStats) {
      // Update existing stats with new rating
      const currentRating = existingStats.avg_user_rating || 0;
      const ratingCount = existingStats.total_requests;
      const newAvgRating =
        (currentRating * ratingCount + rating) / (ratingCount + 1);

      await client
        .from('user_usage_stats')
        .update({
          avg_user_rating: newAvgRating,
        })
        .eq('id', existingStats.id);
    }
  }

  private calculateEvaluationStats(evaluations: any[]): {
    total_evaluations: number;
    average_overall_rating: number;
    average_speed_rating: number;
    average_accuracy_rating: number;
    evaluation_distribution: Record<string, number>;
  } {
    const totalEvaluations = evaluations.length;

    const avgOverallRating =
      totalEvaluations > 0
        ? evaluations.reduce((sum, eval) => sum + (eval.user_rating || 0), 0) /
          totalEvaluations
        : 0;

    const avgSpeedRating =
      evaluations.filter((e) => e.speed_rating).length > 0
        ? evaluations.reduce((sum, eval) => sum + (eval.speed_rating || 0), 0) /
          evaluations.filter((e) => e.speed_rating).length
        : 0;

    const avgAccuracyRating =
      evaluations.filter((e) => e.accuracy_rating).length > 0
        ? evaluations.reduce(
            (sum, eval) => sum + (eval.accuracy_rating || 0),
            0,
          ) / evaluations.filter((e) => e.accuracy_rating).length
        : 0;

    // Calculate rating distribution
    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    evaluations.forEach((eval) => {
      if (eval.user_rating) {
        distribution[eval.user_rating.toString()]++;
      }
    });

    return {
      total_evaluations: totalEvaluations,
      average_overall_rating: avgOverallRating,
      average_speed_rating: avgSpeedRating,
      average_accuracy_rating: avgAccuracyRating,
      evaluation_distribution: distribution,
    };
  }

  private calculateModelPerformance(evaluations: any[]): Array<{
    model: any;
    avg_rating: number;
    evaluation_count: number;
  }> {
    const modelGroups = evaluations.reduce((groups, eval) => {
      const modelId = eval.model?.id || 'unknown';
      if (!groups[modelId]) {
        groups[modelId] = {
          model: eval.model,
          ratings: [],
        };
      }
      if (eval.user_rating) {
        groups[modelId].ratings.push(eval.user_rating);
      }
      return groups;
    }, {});

    return Object.values(modelGroups).map((group: any) => ({
      model: group.model,
      avg_rating:
        group.ratings.length > 0
          ? group.ratings.reduce(
              (sum: number, rating: number) => sum + rating,
              0,
            ) / group.ratings.length
          : 0,
      evaluation_count: group.ratings.length,
    }));
  }

  private calculateModelComparison(messages: any[]): Array<{
    model: any;
    metrics: {
      avg_overall_rating: number;
      avg_speed_rating: number;
      avg_accuracy_rating: number;
      avg_response_time_ms: number;
      avg_cost: number;
      evaluation_count: number;
    };
  }> {
    const modelGroups = messages.reduce((groups, msg) => {
      const modelId = msg.model?.id || 'unknown';
      if (!groups[modelId]) {
        groups[modelId] = {
          model: msg.model,
          overall_ratings: [],
          speed_ratings: [],
          accuracy_ratings: [],
          response_times: [],
          costs: [],
        };
      }

      if (msg.user_rating)
        groups[modelId].overall_ratings.push(msg.user_rating);
      if (msg.speed_rating)
        groups[modelId].speed_ratings.push(msg.speed_rating);
      if (msg.accuracy_rating)
        groups[modelId].accuracy_ratings.push(msg.accuracy_rating);
      if (msg.response_time_ms)
        groups[modelId].response_times.push(msg.response_time_ms);
      if (msg.total_cost) groups[modelId].costs.push(msg.total_cost);

      return groups;
    }, {});

    return Object.values(modelGroups).map((group: any) => ({
      model: group.model,
      metrics: {
        avg_overall_rating: this.calculateAverage(group.overall_ratings),
        avg_speed_rating: this.calculateAverage(group.speed_ratings),
        avg_accuracy_rating: this.calculateAverage(group.accuracy_ratings),
        avg_response_time_ms: this.calculateAverage(group.response_times),
        avg_cost: this.calculateAverage(group.costs),
        evaluation_count: group.overall_ratings.length,
      },
    }));
  }

  private generateModelRecommendations(comparison: any[]): string[] {
    const recommendations = [];

    // Find best performer by rating
    const bestRated = comparison.reduce((best, current) =>
      current.metrics.avg_overall_rating > best.metrics.avg_overall_rating
        ? current
        : best,
    );

    // Find most cost-effective
    const cheapest = comparison.reduce((cheapest, current) =>
      current.metrics.avg_cost < cheapest.metrics.avg_cost ? current : cheapest,
    );

    recommendations.push(
      `${bestRated.model?.name} has the highest user satisfaction rating`,
    );
    recommendations.push(
      `${cheapest.model?.name} is the most cost-effective option`,
    );

    return recommendations;
  }

  private calculateAverage(values: number[]): number {
    return values.length > 0
      ? values.reduce((sum, val) => sum + val, 0) / values.length
      : 0;
  }

  private convertFeedbackToCSV(feedback: any[]): string {
    if (feedback.length === 0) return '';

    const headers = Object.keys(feedback[0]).join(',');
    const rows = feedback.map((item) =>
      Object.values(item)
        .map((val) =>
          typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val,
        )
        .join(','),
    );

    return [headers, ...rows].join('\n');
  }
}
