import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import {
  MessageEvaluationDto,
  EnhancedMessageResponseDto,
} from '../dto/llm-evaluation.dto';
import { UserRatingScale } from '../types/llm-evaluation';
import {
  mapLLMProviderFromDb,
  mapLLMModelFromDb,
} from '../utils/case-converter';
import {
  EnhancedEvaluationMetadataDto,
  AdminEvaluationFiltersDto,
  EvaluationAnalyticsDto,
  EvaluationUserDto,
  EvaluationDataDto,
  EvaluationTaskDto,
  WorkflowTrackingDto,
  LLMConstraintsDto,
  EnhancedLLMInfoDto,
  WorkflowStepDto,
  ConstraintEffectivenessDto,
  AgentLLMRecommendationDto,
} from '../dto/enhanced-evaluation.dto';
import { UserRole } from '../auth/decorators/roles.decorator';

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

interface AllUserEvaluationsFilters {
  page: number;
  limit: number;
  minRating?: number;
  hasNotes?: boolean;
  agentName?: string;
}

/**
 * Format agent names for display by converting from database format to human-readable format
 */
function formatAgentNameForDisplay(agentName: string): string {
  if (!agentName) return 'AI Assistant';

  // Handle already formatted names
  if (agentName.includes(' ') && agentName !== 'Process Agent') {
    return agentName;
  }

  // Convert snake_case or lowercase names to Title Case
  return (
    agentName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l: string) => l.toUpperCase())
      .replace(/\s+Agent$/, '') // Remove trailing "Agent" if present
      .trim() + ' Agent'
  );
}

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async evaluateMessage(
    userId: string,
    messageId: string,
    evaluationDto: MessageEvaluationDto,
  ): Promise<EnhancedMessageResponseDto | null> {
    const { client, isServiceClient } = this.getAggregationsClient();

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
        user_rating: evaluationDto.userRating,
        speed_rating: evaluationDto.speedRating,
        accuracy_rating: evaluationDto.accuracyRating,
        user_notes: evaluationDto.userNotes,
        evaluation_details: evaluationDto.evaluationDetails,
        evaluation_timestamp: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('user_id', userId)
      .select(
        `
        *,
        provider:llm_providers(*),
        model:llm_models(*)
      `,
      )
      .single();

    if (updateError) {
      throw new HttpException(
        `Failed to save evaluation: ${updateError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Note: Usage statistics tracking removed during database cleanup
    // User rating is stored in the message evaluation data

    return updatedMessage;
  }

  async getMessageWithEvaluation(
    userId: string,
    messageId: string,
  ): Promise<EnhancedMessageResponseDto | null> {
    const { client, isServiceClient } = this.getAggregationsClient();

    const { data: message, error } = await client
      .from('messages')
      .select(
        `
        *,
        provider:llm_providers(*),
        model:llm_models(*)
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
    const { client, isServiceClient } = this.getAggregationsClient();

    let query = client
      .from('messages')
      .select(
        `
        *,
        provider:llm_providers(*),
        model:llm_models(*)
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
    totalEvaluations: number;
    averageOverallRating: number;
    averageSpeedRating: number;
    averageAccuracyRating: number;
    evaluationDistribution: Record<string, number>;
    modelPerformance: Array<{
      model: any;
      avgRating: number;
      evaluationCount: number;
    }>;
  }> {
    const client = this.supabaseService.getAnonClient();

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
        model:llm_models(*),
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
      modelPerformance: modelPerformance,
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
    const client = this.supabaseService.getAnonClient();

    const selectFields = [
      'id',
      'timestamp',
      options.includeContent ? 'content' : null,
      'user_rating',
      'speed_rating',
      'accuracy_rating',
      'user_notes',
      'evaluation_timestamp',
      'total_cost',
      'input_tokens',
      'output_tokens',
      'response_time_ms',
      'provider:llm_providers(name)',
      'model:llm_models(name, model_id)',
    ]
      .filter(Boolean)
      .join(', ');

    let query = client
      .from('messages')
      .select(selectFields)
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
        avgOverallRating: number;
        avgSpeedRating: number;
        avgAccuracyRating: number;
        avgResponseTimeMs: number;
        avgCost: number;
        evaluationCount: number;
      };
    }>;
    recommendations: string[];
  }> {
    const client = this.supabaseService.getAnonClient();

    let query = client
      .from('messages')
      .select(
        `
        user_rating,
        speed_rating,
        accuracy_rating,
        response_time_ms,
        total_cost,
        model:llm_models(*),
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

  async getAgentLLMRecommendations(
    agentIdentifier: string,
    minRating: number = 3,
  ): Promise<AgentLLMRecommendationDto[]> {
    const normalizedTarget = this.normalizeAgentIdentifier(agentIdentifier);
    if (!normalizedTarget) {
      return [];
    }

    interface AggregateEntry {
      providerId?: string;
      providerName?: string;
      modelId?: string;
      modelName?: string;
      totalRating: number;
      evaluationCount: number;
      lastEvaluatedAt?: string;
    }

    const aggregates = new Map<string, AggregateEntry>();
    const providerIds = new Set<string>();
    const modelIds = new Set<string>();

    const { client, isServiceClient } = this.getAggregationsClient();

    const [
      { data: tasksData, error: taskError },
      { data: messagesData, error: messageError },
    ] = await Promise.all([
      client
        .from('tasks')
        .select('*')
        .not('evaluation', 'is', null)
        .not('llm_metadata', 'is', null),
      client
        .from('messages')
        .select(
          `
            *,
            provider:llm_providers(*),
            model:llm_models(*)
          `,
        )
        .not('user_rating', 'is', null),
    ]);

    if (taskError) {
      this.logger.warn(
        `[EvaluationService] Failed to fetch task evaluations for agent ${agentIdentifier}: ${taskError.message}`,
      );
    }

    let effectiveMessages = messagesData || [];

    if (messageError) {
      this.logger.warn(
        `[EvaluationService] Failed to fetch message evaluations for agent ${agentIdentifier}: ${messageError.message}`,
      );

      if (!isServiceClient) {
        const { data: fallbackMessages, error: fallbackError } = await client
          .from('messages')
          .select('*')
          .not('user_rating', 'is', null);

        if (fallbackError) {
          this.logger.warn(
            `[EvaluationService] Fallback message query also failed for agent ${agentIdentifier}: ${fallbackError.message}`,
          );
        } else {
          effectiveMessages = fallbackMessages || [];
        }
      }
    }

    const relevantTasks = (tasksData || []).filter((task) =>
      this.recordMatchesAgent(task, normalizedTarget),
    );

    const relevantMessages = (effectiveMessages || []).filter((message) =>
      this.recordMatchesAgent(message, normalizedTarget),
    );

    if (relevantTasks.length === 0 && relevantMessages.length === 0) {
      return [];
    }

    const accumulateSample = (
      info: {
        rating: number;
        providerId?: string;
        providerName?: string;
        modelId?: string;
        modelName?: string;
        timestamp?: string;
      } | null,
    ) => {
      if (
        !info ||
        typeof info.rating !== 'number' ||
        Number.isNaN(info.rating)
      ) {
        return;
      }

      const {
        rating,
        providerId,
        providerName,
        modelId,
        modelName,
        timestamp,
      } = info;

      if (providerId) {
        providerIds.add(providerId);
      }
      if (modelId) {
        modelIds.add(modelId);
      }

      const aggregateKey = this.buildRecommendationKey(
        providerId,
        providerName,
        modelId,
        modelName,
      );

      let entry = aggregates.get(aggregateKey);
      if (!entry) {
        entry = {
          providerId,
          providerName,
          modelId,
          modelName,
          totalRating: 0,
          evaluationCount: 0,
        };
        aggregates.set(aggregateKey, entry);
      }

      if (providerName && !entry.providerName) {
        entry.providerName = providerName;
      }
      if (modelName && !entry.modelName) {
        entry.modelName = modelName;
      }
      if (providerId && !entry.providerId) {
        entry.providerId = providerId;
      }
      if (modelId && !entry.modelId) {
        entry.modelId = modelId;
      }

      entry.totalRating += rating;
      entry.evaluationCount += 1;

      if (timestamp) {
        const currentTimestamp = entry.lastEvaluatedAt
          ? new Date(entry.lastEvaluatedAt).getTime()
          : 0;
        const candidateTimestamp = new Date(timestamp).getTime();
        if (candidateTimestamp > currentTimestamp) {
          entry.lastEvaluatedAt = new Date(timestamp).toISOString();
        }
      }
    };

    relevantTasks.forEach((task) => {
      const rating = task.evaluation?.user_rating;
      if (typeof rating !== 'number' || Number.isNaN(rating)) {
        return;
      }
      const providerModelInfo = this.extractProviderModelInfo(task);
      if (!providerModelInfo) {
        return;
      }

      accumulateSample({
        rating,
        providerId: providerModelInfo.providerId,
        providerName: providerModelInfo.providerName,
        modelId: providerModelInfo.modelId,
        modelName: providerModelInfo.modelName,
        timestamp:
          task.evaluation?.evaluation_timestamp ||
          task.completed_at ||
          task.updated_at ||
          task.created_at,
      });
    });

    relevantMessages.forEach((message) => {
      const rating = message.user_rating;
      if (typeof rating !== 'number' || Number.isNaN(rating)) {
        return;
      }
      const providerModelInfo = this.extractProviderModelInfo(message);
      if (!providerModelInfo) {
        return;
      }

      accumulateSample({
        rating,
        providerId: providerModelInfo.providerId,
        providerName: providerModelInfo.providerName,
        modelId: providerModelInfo.modelId,
        modelName: providerModelInfo.modelName,
        timestamp:
          message.evaluation_timestamp ||
          message.timestamp ||
          message.updated_at ||
          message.created_at,
      });
    });

    if (aggregates.size === 0) {
      return [];
    }

    const sanitizedMinRating = Math.min(Math.max(minRating || 0, 0), 5);

    const [providersMap, modelsMap] = await Promise.all([
      this.fetchProvidersMap(Array.from(providerIds)),
      this.fetchModelsMap(Array.from(modelIds)),
    ]);

    const recommendations = Array.from(aggregates.values())
      .map((entry) => {
        const averageRating = entry.totalRating / entry.evaluationCount;
        if (averageRating < sanitizedMinRating) {
          return null;
        }

        const provider = entry.providerId
          ? providersMap.get(entry.providerId)
          : undefined;
        const model = entry.modelId ? modelsMap.get(entry.modelId) : undefined;

        return {
          providerId: entry.providerId,
          providerName:
            provider?.name || entry.providerName || 'Unknown Provider',
          modelId: entry.modelId,
          modelName:
            model?.modelName ||
            model?.name ||
            entry.modelName ||
            'Unknown Model',
          averageRating: Number(averageRating.toFixed(2)),
          evaluationCount: entry.evaluationCount,
          lastEvaluatedAt: entry.lastEvaluatedAt,
        } as AgentLLMRecommendationDto;
      })
      .filter((rec): rec is AgentLLMRecommendationDto => rec !== null)
      .sort((a, b) => {
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        if (b.evaluationCount !== a.evaluationCount) {
          return b.evaluationCount - a.evaluationCount;
        }

        const aTime = a.lastEvaluatedAt
          ? new Date(a.lastEvaluatedAt).getTime()
          : 0;
        const bTime = b.lastEvaluatedAt
          ? new Date(b.lastEvaluatedAt).getTime()
          : 0;
        return bTime - aTime;
      });

    return recommendations;
  }

  // Helper methods

  private calculateEvaluationStats(evaluations: any[]): {
    totalEvaluations: number;
    averageOverallRating: number;
    averageSpeedRating: number;
    averageAccuracyRating: number;
    evaluationDistribution: Record<string, number>;
  } {
    const totalEvaluations = evaluations.length;

    const avgOverallRating =
      totalEvaluations > 0
        ? evaluations.reduce(
            (sum, evaluation) => sum + (evaluation.user_rating || 0),
            0,
          ) / totalEvaluations
        : 0;

    const avgSpeedRating =
      evaluations.filter((e) => e.speed_rating).length > 0
        ? evaluations.reduce(
            (sum, evaluation) => sum + (evaluation.speed_rating || 0),
            0,
          ) / evaluations.filter((e) => e.speed_rating).length
        : 0;

    const avgAccuracyRating =
      evaluations.filter((e) => e.accuracy_rating).length > 0
        ? evaluations.reduce(
            (sum, evaluation) => sum + (evaluation.accuracy_rating || 0),
            0,
          ) / evaluations.filter((e) => e.accuracy_rating).length
        : 0;

    // Calculate rating distribution
    const distribution: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    evaluations.forEach((evaluation) => {
      if (evaluation.user_rating) {
        const ratingKey = evaluation.user_rating.toString();
        if (distribution[ratingKey] !== undefined) {
          distribution[ratingKey]++;
        }
      }
    });

    return {
      totalEvaluations: totalEvaluations,
      averageOverallRating: avgOverallRating,
      averageSpeedRating: avgSpeedRating,
      averageAccuracyRating: avgAccuracyRating,
      evaluationDistribution: distribution,
    };
  }

  private calculateModelPerformance(evaluations: any[]): Array<{
    model: any;
    avgRating: number;
    evaluationCount: number;
  }> {
    const modelGroups = evaluations.reduce((groups, evaluation) => {
      const modelId = evaluation.model?.id || 'unknown';
      if (!groups[modelId]) {
        groups[modelId] = {
          model: evaluation.model,
          ratings: [],
        };
      }
      if (evaluation.user_rating) {
        groups[modelId].ratings.push(evaluation.user_rating);
      }
      return groups;
    }, {});

    return Object.values(modelGroups).map((group: any) => ({
      model: group.model,
      avgRating:
        group.ratings.length > 0
          ? group.ratings.reduce(
              (sum: number, rating: number) => sum + rating,
              0,
            ) / group.ratings.length
          : 0,
      evaluationCount: group.ratings.length,
    }));
  }

  private calculateModelComparison(messages: any[]): Array<{
    model: any;
    metrics: {
      avgOverallRating: number;
      avgSpeedRating: number;
      avgAccuracyRating: number;
      avgResponseTimeMs: number;
      avgCost: number;
      evaluationCount: number;
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
        avgOverallRating: this.calculateAverage(group.overall_ratings),
        avgSpeedRating: this.calculateAverage(group.speed_ratings),
        avgAccuracyRating: this.calculateAverage(group.accuracy_ratings),
        avgResponseTimeMs: this.calculateAverage(group.response_times),
        avgCost: this.calculateAverage(group.costs),
        evaluationCount: group.overall_ratings.length,
      },
    }));
  }

  private generateModelRecommendations(comparison: any[]): string[] {
    const recommendations = [];

    // Find best performer by rating
    const bestRated = comparison.reduce((best, current) =>
      current.metrics.avgOverallRating > best.metrics.avgOverallRating
        ? current
        : best,
    );

    // Find most cost-effective
    const cheapest = comparison.reduce((cheapest, current) =>
      current.metrics.avgCost < cheapest.metrics.avgCost ? current : cheapest,
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

  // Task Evaluation Methods
  async evaluateTask(
    userId: string,
    taskId: string,
    evaluationDto: MessageEvaluationDto,
  ): Promise<any> {
    const client = this.supabaseService.getAnonClient();

    // Verify task exists and belongs to user
    const { data: task, error: taskError } = await client
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (taskError || !task) {
      return null;
    }

    // Update task with evaluation data
    const evaluationData = {
      user_rating: evaluationDto.userRating,
      speed_rating: evaluationDto.speedRating,
      accuracy_rating: evaluationDto.accuracyRating,
      user_notes: evaluationDto.userNotes,
      evaluation_details: evaluationDto.evaluationDetails,
      evaluation_timestamp: new Date().toISOString(),
    };

    const { data: updatedTask, error: updateError } = await client
      .from('tasks')
      .update({
        evaluation: evaluationData,
      })
      .eq('id', taskId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateError) {
      throw new HttpException(
        `Failed to save task evaluation: ${updateError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return updatedTask;
  }

  async getTaskWithEvaluation(userId: string, taskId: string): Promise<any> {
    const client = this.supabaseService.getAnonClient();

    const { data: task, error } = await client
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new HttpException(
        `Failed to fetch task: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return task;
  }

  async updateTaskEvaluation(
    userId: string,
    taskId: string,
    evaluationDto: MessageEvaluationDto,
  ): Promise<any> {
    // Same as evaluateTask but for updates
    return this.evaluateTask(userId, taskId, evaluationDto);
  }

  async getConversationTaskEvaluations(
    userId: string,
    conversationId: string,
    filters: EvaluationFilters = {},
  ): Promise<any[]> {
    const client = this.supabaseService.getAnonClient();

    const query = client
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .not('evaluation', 'is', null)
      .order('created_at');

    // Apply filters based on evaluation data
    if (filters.minRating || filters.hasNotes) {
      // For tasks, we need to filter on the evaluation JSON field
      const { data: tasks, error } = await query;

      if (error) {
        throw new HttpException(
          `Failed to fetch conversation task evaluations: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Filter in memory since we're working with JSON fields
      let filteredTasks = tasks || [];

      if (filters.minRating !== undefined) {
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.evaluation?.user_rating &&
            task.evaluation.user_rating >= filters.minRating!,
        );
      }

      if (filters.hasNotes) {
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.evaluation?.user_notes &&
            task.evaluation.user_notes.trim().length > 0,
        );
      }

      return filteredTasks;
    }

    const { data: tasks, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch conversation task evaluations: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return tasks || [];
  }

  async getAllUserEvaluations(
    userId: string,
    filters: AllUserEvaluationsFilters,
  ): Promise<{
    evaluations: EnhancedMessageResponseDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const client = this.supabaseService.getAnonClient();

    // Query only tasks for evaluations (since that's where the data actually is)
    const { data: tasks, error: tasksError } = await client
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .not('evaluation', 'is', null);

    if (tasksError) {
      throw new HttpException(
        `Failed to fetch task evaluations: ${tasksError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Filter out tasks that don't have actual evaluation ratings
    const tasksWithEvaluations = (tasks || []).filter(
      (task) =>
        task.evaluation &&
        (task.evaluation.user_rating ||
          task.evaluation.speed_rating ||
          task.evaluation.accuracy_rating),
    );

    // Get unique provider and model IDs from tasks to fetch details
    const providerIds = new Set<string>();
    const modelIds = new Set<string>();

    tasksWithEvaluations.forEach((task) => {
      // Provider and model IDs are nested in originalLLMSelection
      const providerId = task.llm_metadata?.originalLLMSelection?.providerId;
      const modelId = task.llm_metadata?.originalLLMSelection?.modelId;

      if (providerId) {
        providerIds.add(providerId);
      }
      if (modelId) {
        modelIds.add(modelId);
      }
    });

    // Fetch provider and model details
    const providersMap = new Map();
    const modelsMap = new Map();

    // Fetch user email

    const { data: userProfile, error: userError } = await client
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    const userEmail = userProfile?.email || 'Unknown';

    // Test direct query with known IDs

    const { data: testProvider, error: testProviderError } = await client
      .from('llm_providers')
      .select('*')
      .eq('id', '11111111-1111-1111-1111-111111111111');

    const { data: testModel, error: testModelError } = await client
      .from('llm_models')
      .select('*')
      .eq('id', 'bb7bd9b6-f120-4847-807e-b0455bad6f31');

    if (providerIds.size > 0) {
      const { data: providers, error: providerError } = await client
        .from('llm_providers')
        .select('*')
        .in('id', Array.from(providerIds));

      if (providers) {
        providers.forEach((provider) => {
          // Use the mapLLMProviderFromDb utility function for consistent mapping
          const mappedProvider = mapLLMProviderFromDb(provider);
          providersMap.set(provider.id, mappedProvider);
        });
      }
    }

    if (modelIds.size > 0) {
      const { data: models, error: modelError } = await client
        .from('llm_models')
        .select('*')
        .in('id', Array.from(modelIds));

      if (models) {
        models.forEach((model) => {
          // Use the mapLLMModelFromDb utility function for consistent mapping
          const mappedModel = mapLLMModelFromDb(model);
          modelsMap.set(model.id, mappedModel);
        });
      }
    }

    // Transform task evaluations to the expected DTO format
    const allEvaluations: EnhancedMessageResponseDto[] =
      tasksWithEvaluations.map((task) => {
        // Debug: log all available task fields and data

        // Additional debug for missing response data

        // Create more meaningful content from task details
        let taskContent = 'Task';
        if (task.prompt) {
          // Use the prompt as content, truncated for display
          taskContent = task.prompt;
        } else if (task.response) {
          // Use the response as content if no prompt
          taskContent = task.response;
        } else if (task.method) {
          // Use the method name as a fallback
          taskContent = `${task.method} Task`;
        }

        // Create more meaningful agent name from metadata
        let agentName = 'Agent';
        if (task.response_metadata?.agent_name) {
          agentName = task.response_metadata.agent_name;
        } else if (task.response_metadata?.agentName) {
          // Check for camelCase version (used by function agents)
          agentName = task.response_metadata.agentName;
        } else if (task.metadata?.agent_name) {
          agentName = task.metadata.agent_name;
        } else if (task.metadata?.agentName) {
          // Check for camelCase version
          agentName = task.metadata.agentName;
        } else if (task.llm_metadata?.agent_name) {
          agentName = task.llm_metadata.agent_name;
        } else if (task.llm_metadata?.agentName) {
          // Check for camelCase version
          agentName = task.llm_metadata.agentName;
        } else if (task.method && task.method !== 'process') {
          // Only use method as agent name if it's not the generic 'process' method
          agentName =
            task.method
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (l: string) => l.toUpperCase()) + ' Agent';
        } else {
          // Last resort: use a generic name instead of "Process Agent"
          agentName = 'AI Assistant';
        }

        // Format the agent name for consistent display
        const displayAgentName = formatAgentNameForDisplay(agentName);

        // Get provider and model from LLM metadata (nested in originalLLMSelection)
        const providerId = task.llm_metadata?.originalLLMSelection?.providerId;
        const modelId = task.llm_metadata?.originalLLMSelection?.modelId;
        const provider = providerId ? providersMap.get(providerId) : undefined;
        const model = modelId ? modelsMap.get(modelId) : undefined;

        return {
          id: task.id,
          content: taskContent,
          role: 'assistant' as const,
          sessionId: task.conversation_id || task.session_id,
          userId: task.user_id,
          timestamp:
            task.evaluation?.evaluation_timestamp ||
            task.created_at ||
            new Date().toISOString(),
          order: 0,
          // Store agent name in metadata for frontend (since it's not in DTO)
          metadata: {
            agentName: displayAgentName,
            taskType: task.method,
            status: task.status,
            taskPrompt: task.prompt,
            taskResponse: task.response,
            responseMetadata: task.response_metadata,
            llmMetadata: task.llm_metadata,
            taskMetadata: task.metadata,
            deliverableType: task.type,
            deliverableMetadata: task.deliverable_metadata,
            progressMessage: task.progress_message,
            workflowStepsCompleted:
              task.response_metadata?.workflow_steps_completed,
          },
          // Map evaluation fields directly to DTO (not nested)
          userRating: task.evaluation?.user_rating,
          speedRating: task.evaluation?.speed_rating,
          accuracyRating: task.evaluation?.accuracy_rating,
          userNotes: task.evaluation?.user_notes,
          evaluationTimestamp: task.evaluation?.evaluation_timestamp,
          evaluationDetails: task.evaluation?.evaluation_details,
          // Include provider and model details from LLM metadata
          providerId: providerId,
          modelId: modelId,
          responseTimeMs: task.llm_metadata?.response_time_ms,
          cost: task.llm_metadata?.total_cost,
          provider: provider,
          model: model,
          // Include user email
          userEmail: userEmail,
        };
      });

    // Apply filters using direct DTO fields
    let filteredEvaluations = allEvaluations;

    if (filters.minRating !== undefined) {
      filteredEvaluations = filteredEvaluations.filter(
        (evaluation) =>
          evaluation.userRating && evaluation.userRating >= filters.minRating!,
      );
    }

    if (filters.hasNotes) {
      filteredEvaluations = filteredEvaluations.filter(
        (evaluation) =>
          evaluation.userNotes && evaluation.userNotes.trim().length > 0,
      );
    }

    // Filter by agent name using metadata
    if (filters.agentName) {
      filteredEvaluations = filteredEvaluations.filter(
        (evaluation) =>
          evaluation.metadata?.agentName &&
          evaluation.metadata.agentName
            .toLowerCase()
            .includes(filters.agentName!.toLowerCase()),
      );
    }

    // Sort by evaluation timestamp (most recent first)
    filteredEvaluations.sort((a, b) => {
      const timestampA = a.evaluationTimestamp || a.timestamp;
      const timestampB = b.evaluationTimestamp || b.timestamp;
      return new Date(timestampB).getTime() - new Date(timestampA).getTime();
    });

    // Apply pagination
    const total = filteredEvaluations.length;
    const totalPages = Math.ceil(total / filters.limit);
    const offset = (filters.page - 1) * filters.limit;
    const paginatedEvaluations = filteredEvaluations.slice(
      offset,
      offset + filters.limit,
    );

    const evaluations = paginatedEvaluations;

    return {
      evaluations,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
    };
  }

  // ============================================================================
  // ENHANCED ADMIN EVALUATION METHODS
  // ============================================================================

  /**
   * Get all evaluations across users for admin monitoring
   * Includes enhanced metadata with workflow and constraint data
   */
  async getAllEvaluationsForAdmin(filters: AdminEvaluationFiltersDto): Promise<{
    evaluations: EnhancedEvaluationMetadataDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const client = this.supabaseService.getAnonClient();

    // Build base query for tasks with evaluations (no user filtering for admin)
    let tasksQuery = client
      .from('tasks')
      .select('*', { count: 'exact' })
      .not('evaluation', 'is', null);

    // Note: Date filtering will be applied after fetching tasks
    // since evaluation_timestamp is stored in JSONB and requires
    // special handling for date comparisons
    if (filters.minRating) {
      // Note: This requires filtering in memory since evaluation is JSON
      // For performance, consider adding computed columns for ratings
    }

    // Note: Pagination will be applied after filtering since we need to
    // filter by evaluation timestamp which is stored in JSONB
    tasksQuery = tasksQuery.order('created_at', { ascending: false });

    const { data: tasks, error: tasksError, count } = await tasksQuery;

    if (tasksError) {
      throw new HttpException(
        `Failed to fetch admin evaluations: ${tasksError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Filter tasks with actual evaluation ratings
    const tasksWithEvaluations = (tasks || []).filter((task) => {
      const hasRating =
        task.evaluation &&
        (task.evaluation.user_rating ||
          task.evaluation.speed_rating ||
          task.evaluation.accuracy_rating);

      // Apply filters that require evaluation data inspection
      if (
        filters.minRating &&
        (!task.evaluation?.user_rating ||
          task.evaluation.user_rating < filters.minRating)
      ) {
        return false;
      }
      if (
        filters.maxRating &&
        task.evaluation?.user_rating &&
        task.evaluation.user_rating > filters.maxRating
      ) {
        return false;
      }
      if (filters.hasNotes !== undefined) {
        const hasNotes =
          task.evaluation?.user_notes &&
          task.evaluation.user_notes.trim().length > 0;
        if (filters.hasNotes !== hasNotes) {
          return false;
        }
      }
      if (filters.hasWorkflowSteps !== undefined) {
        const hasWorkflow =
          task.response_metadata?.workflow_steps_completed &&
          task.response_metadata.workflow_steps_completed.length > 0;
        if (filters.hasWorkflowSteps !== hasWorkflow) {
          return false;
        }
      }
      if (filters.hasConstraints !== undefined) {
        const hasConstraints =
          task.llm_metadata?.originalLLMSelection?.cidafmOptions &&
          (task.llm_metadata.originalLLMSelection.cidafmOptions
            .activeStateModifiers?.length > 0 ||
            task.llm_metadata.originalLLMSelection.cidafmOptions
              .responseModifiers?.length > 0);
        if (filters.hasConstraints !== hasConstraints) {
          return false;
        }
      }

      // Apply date filters
      if (filters.startDate && task.evaluation?.evaluation_timestamp) {
        const evaluationDate = new Date(task.evaluation.evaluation_timestamp);
        const startDate = new Date(filters.startDate);
        if (evaluationDate < startDate) {
          return false;
        }
      }
      if (filters.endDate && task.evaluation?.evaluation_timestamp) {
        const evaluationDate = new Date(task.evaluation.evaluation_timestamp);
        const endDate = new Date(filters.endDate);
        // Set end date to end of day for inclusive filtering
        endDate.setHours(23, 59, 59, 999);
        if (evaluationDate > endDate) {
          return false;
        }
      }

      return hasRating;
    });

    // Get unique user IDs and provider/model IDs for batch fetching
    const userIds = new Set<string>();
    const providerIds = new Set<string>();
    const modelIds = new Set<string>();

    tasksWithEvaluations.forEach((task) => {
      userIds.add(task.user_id);

      const providerId = task.llm_metadata?.originalLLMSelection?.providerId;
      const modelId = task.llm_metadata?.originalLLMSelection?.modelId;

      if (providerId) providerIds.add(providerId);
      if (modelId) modelIds.add(modelId);
    });

    // Batch fetch user profiles, providers, and models
    const [usersMap, providersMap, modelsMap] = await Promise.all([
      this.fetchUsersMap(Array.from(userIds)),
      this.fetchProvidersMap(Array.from(providerIds)),
      this.fetchModelsMap(Array.from(modelIds)),
    ]);

    // Transform tasks to enhanced evaluation metadata
    const enhancedEvaluations: EnhancedEvaluationMetadataDto[] =
      tasksWithEvaluations
        .map((task) =>
          this.transformTaskToEnhancedEvaluation(
            task,
            usersMap,
            providersMap,
            modelsMap,
          ),
        )
        .filter((evaluation) => {
          // Apply additional filters that require the transformed data
          if (
            filters.agentName &&
            !evaluation.task.agentName
              .toLowerCase()
              .includes(filters.agentName.toLowerCase())
          ) {
            return false;
          }
          if (
            filters.userEmail &&
            !evaluation.user.email
              .toLowerCase()
              .includes(filters.userEmail.toLowerCase())
          ) {
            return false;
          }
          if (
            filters.provider &&
            evaluation.llmInfo.provider !== filters.provider
          ) {
            return false;
          }
          if (filters.model && evaluation.llmInfo.model !== filters.model) {
            return false;
          }
          if (
            filters.minResponseTime &&
            evaluation.llmInfo.responseTimeMs < filters.minResponseTime
          ) {
            return false;
          }
          if (
            filters.maxResponseTime &&
            evaluation.llmInfo.responseTimeMs > filters.maxResponseTime
          ) {
            return false;
          }
          if (filters.workflowStepStatus && evaluation.workflowSteps) {
            const hasStepWithStatus = evaluation.workflowSteps.stepDetails.some(
              (step) => step.status === filters.workflowStepStatus,
            );
            if (!hasStepWithStatus) {
              return false;
            }
          }
          if (filters.constraintType && evaluation.llmConstraints) {
            const hasConstraintType =
              evaluation.llmConstraints.activeStateModifiers.includes(
                filters.constraintType,
              ) ||
              evaluation.llmConstraints.responseModifiers.includes(
                filters.constraintType,
              );
            if (!hasConstraintType) {
              return false;
            }
          }

          return true;
        });

    // Sort by evaluation timestamp (most recent first)
    enhancedEvaluations.sort(
      (a, b) =>
        new Date(b.evaluation.evaluationTimestamp).getTime() -
        new Date(a.evaluation.evaluationTimestamp).getTime(),
    );

    // Apply pagination after filtering and sorting
    const total = enhancedEvaluations.length;
    const totalPages = Math.ceil(total / filters.limit!);
    const offset = (filters.page! - 1) * filters.limit!;
    const paginatedEvaluations = enhancedEvaluations.slice(
      offset,
      offset + filters.limit!,
    );

    return {
      evaluations: paginatedEvaluations,
      pagination: {
        page: filters.page!,
        limit: filters.limit!,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get system-wide evaluation analytics for admin dashboard
   */
  async getEvaluationAnalytics(
    filters: AdminEvaluationFiltersDto,
  ): Promise<EvaluationAnalyticsDto> {
    const client = this.supabaseService.getAnonClient();

    // Build query for tasks with evaluations
    const query = client
      .from('tasks')
      .select('*')
      .not('evaluation', 'is', null);

    // Note: Date filtering will be applied after fetching tasks
    // since evaluation_timestamp is stored in JSONB

    const { data: tasks, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch evaluation analytics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Filter tasks with actual evaluations and apply date filters
    const evaluatedTasks = (tasks || []).filter((task) => {
      const hasRating =
        task.evaluation &&
        (task.evaluation.user_rating ||
          task.evaluation.speed_rating ||
          task.evaluation.accuracy_rating);

      if (!hasRating) return false;

      // Apply date filters
      if (filters.startDate && task.evaluation?.evaluation_timestamp) {
        const evaluationDate = new Date(task.evaluation.evaluation_timestamp);
        const startDate = new Date(filters.startDate);
        if (evaluationDate < startDate) {
          return false;
        }
      }
      if (filters.endDate && task.evaluation?.evaluation_timestamp) {
        const evaluationDate = new Date(task.evaluation.evaluation_timestamp);
        const endDate = new Date(filters.endDate);
        // Set end date to end of day for inclusive filtering
        endDate.setHours(23, 59, 59, 999);
        if (evaluationDate > endDate) {
          return false;
        }
      }

      return true;
    });

    // Calculate analytics
    const totalEvaluations = evaluatedTasks.length;
    const ratings = evaluatedTasks
      .map((task) => task.evaluation.user_rating)
      .filter((rating) => rating != null);
    const speedRatings = evaluatedTasks
      .map((task) => task.evaluation.speed_rating)
      .filter((rating) => rating != null);
    const accuracyRatings = evaluatedTasks
      .map((task) => task.evaluation.accuracy_rating)
      .filter((rating) => rating != null);

    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : 0;
    const averageSpeedRating =
      speedRatings.length > 0
        ? speedRatings.reduce((sum, rating) => sum + rating, 0) /
          speedRatings.length
        : 0;
    const averageAccuracyRating =
      accuracyRatings.length > 0
        ? accuracyRatings.reduce((sum, rating) => sum + rating, 0) /
          accuracyRatings.length
        : 0;

    // Calculate workflow completion rate
    const workflowTasks = evaluatedTasks.filter(
      (task) => task.response_metadata?.workflow_steps_completed,
    );
    const averageWorkflowCompletionRate =
      workflowTasks.length > 0
        ? workflowTasks.reduce((sum, task) => {
            const steps = task.response_metadata.workflow_steps_completed || [];
            const completedCount = steps.filter(
              (step: any) => step.status === 'completed',
            ).length;
            return sum + (completedCount / steps.length) * 100;
          }, 0) / workflowTasks.length
        : 0;

    // Calculate average response time and cost
    const responseTimes = evaluatedTasks
      .map((task) => task.llm_metadata?.response_time_ms)
      .filter((time) => time != null);
    const costs = evaluatedTasks
      .map((task) => task.llm_metadata?.total_cost)
      .filter((cost) => cost != null);

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;
    const averageCost =
      costs.length > 0
        ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length
        : 0;

    // Rating distribution
    const ratingDistribution: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    ratings.forEach((rating) => {
      const key = Math.floor(rating).toString();
      if (ratingDistribution[key] !== undefined) {
        ratingDistribution[key]++;
      }
    });

    // Top performing agents
    const agentPerformance = this.calculateAgentPerformance(evaluatedTasks);
    const topPerformingAgents = agentPerformance
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 10);

    // Top constraints (from CIDAFM data)
    const constraintEffectiveness =
      this.calculateConstraintEffectiveness(evaluatedTasks);
    const topConstraints = constraintEffectiveness
      .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
      .slice(0, 10);

    // Workflow failure points
    const workflowFailurePoints =
      this.calculateWorkflowFailurePoints(evaluatedTasks);

    return {
      totalEvaluations,
      averageRating,
      averageSpeedRating,
      averageAccuracyRating,
      averageWorkflowCompletionRate,
      averageResponseTime,
      averageCost,
      ratingDistribution,
      topPerformingAgents,
      topConstraints,
      workflowFailurePoints,
    };
  }

  /**
   * Get workflow-specific analytics for admin monitoring
   */
  async getWorkflowAnalytics(filters: AdminEvaluationFiltersDto): Promise<{
    workflowPerformance: Array<{
      stepName: string;
      averageDuration: number;
      successRate: number;
      failureRate: number;
      totalExecutions: number;
    }>;
    commonFailurePatterns: Array<{
      pattern: string;
      occurrences: number;
      impactRating: number;
    }>;
    workflowEfficiencyTrends: Array<{
      date: string;
      averageSteps: number;
      averageDuration: number;
      successRate: number;
    }>;
  }> {
    const client = this.supabaseService.getAnonClient();

    let query = client
      .from('tasks')
      .select('*')
      .not('response_metadata', 'is', null);

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data: tasks, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch workflow analytics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const workflowTasks = (tasks || []).filter(
      (task) => task.response_metadata?.workflow_steps_completed,
    );

    const workflowPerformance =
      this.calculateWorkflowStepPerformance(workflowTasks);
    const commonFailurePatterns =
      this.identifyWorkflowFailurePatterns(workflowTasks);
    const workflowEfficiencyTrends = this.calculateWorkflowEfficiencyTrends(
      workflowTasks,
      filters,
    );

    return {
      workflowPerformance,
      commonFailurePatterns,
      workflowEfficiencyTrends,
    };
  }

  /**
   * Get constraint effectiveness analytics for CIDAFM optimization
   */
  async getConstraintAnalytics(filters: AdminEvaluationFiltersDto): Promise<{
    constraintUsage: Array<{
      constraintName: string;
      usageCount: number;
      averageEffectiveness: number;
      userSatisfaction: number;
    }>;
    constraintCombinations: Array<{
      combination: string[];
      usageCount: number;
      effectivenessScore: number;
      averageRating: number;
    }>;
    constraintImpactOnPerformance: Array<{
      constraintName: string;
      withConstraint: {
        averageRating: number;
        averageResponseTime: number;
        averageCost: number;
      };
      withoutConstraint: {
        averageRating: number;
        averageResponseTime: number;
        averageCost: number;
      };
    }>;
  }> {
    const client = this.supabaseService.getAnonClient();

    const query = client
      .from('tasks')
      .select('*')
      .not('evaluation', 'is', null)
      .not('llm_metadata', 'is', null);

    // Note: Date filtering will be applied after fetching tasks
    // since evaluation_timestamp is stored in JSONB

    const { data: tasks, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch constraint analytics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const evaluatedTasks = (tasks || []).filter((task) => {
      const hasRating =
        task.evaluation &&
        (task.evaluation.user_rating ||
          task.evaluation.speed_rating ||
          task.evaluation.accuracy_rating);

      if (!hasRating) return false;

      // Apply date filters
      if (filters.startDate && task.evaluation?.evaluation_timestamp) {
        const evaluationDate = new Date(task.evaluation.evaluation_timestamp);
        const startDate = new Date(filters.startDate);
        if (evaluationDate < startDate) {
          return false;
        }
      }
      if (filters.endDate && task.evaluation?.evaluation_timestamp) {
        const evaluationDate = new Date(task.evaluation.evaluation_timestamp);
        const endDate = new Date(filters.endDate);
        // Set end date to end of day for inclusive filtering
        endDate.setHours(23, 59, 59, 999);
        if (evaluationDate > endDate) {
          return false;
        }
      }

      return true;
    });

    const constraintUsage = this.calculateConstraintUsageStats(evaluatedTasks);
    const constraintCombinations =
      this.analyzeConstraintCombinations(evaluatedTasks);
    const constraintImpactOnPerformance =
      this.calculateConstraintPerformanceImpact(evaluatedTasks);

    return {
      constraintUsage,
      constraintCombinations,
      constraintImpactOnPerformance,
    };
  }

  /**
   * Export enhanced evaluations for admin analysis
   */
  async exportEnhancedEvaluations(
    filters: AdminEvaluationFiltersDto,
    options: {
      format: 'json' | 'csv';
      includeWorkflowDetails?: boolean;
      includeConstraintDetails?: boolean;
      anonymizeUsers?: boolean;
    },
  ): Promise<any[] | string> {
    // Set a higher limit for export
    const exportFilters = { ...filters, limit: 10000, page: 1 };

    const { evaluations } = await this.getAllEvaluationsForAdmin(exportFilters);

    const exportData = evaluations.map((evaluation) => {
      const baseData = {
        taskId: evaluation.task.id,
        userEmail: options.anonymizeUsers
          ? this.anonymizeEmail(evaluation.user.email)
          : evaluation.user.email,
        userName: options.anonymizeUsers
          ? 'Anonymous User'
          : evaluation.user.name,
        agentName: evaluation.task.agentName,
        method: evaluation.task.method,
        userRating: evaluation.evaluation.userRating,
        speedRating: evaluation.evaluation.speedRating,
        accuracyRating: evaluation.evaluation.accuracyRating,
        userNotes: evaluation.evaluation.userNotes,
        evaluationTimestamp: evaluation.evaluation.evaluationTimestamp,
        taskCreatedAt: evaluation.task.createdAt,
        taskCompletedAt: evaluation.task.completedAt,
        taskStatus: evaluation.task.status,
        provider: evaluation.llmInfo.provider,
        model: evaluation.llmInfo.model,
        responseTimeMs: evaluation.llmInfo.responseTimeMs,
        cost: evaluation.llmInfo.cost,
        inputTokens: evaluation.llmInfo.tokenUsage.input,
        outputTokens: evaluation.llmInfo.tokenUsage.output,
      };

      if (options.includeWorkflowDetails && evaluation.workflowSteps) {
        return {
          ...baseData,
          workflowTotalSteps: evaluation.workflowSteps.totalSteps,
          workflowCompletedSteps: evaluation.workflowSteps.completedSteps,
          workflowFailedSteps: evaluation.workflowSteps.failedSteps,
          workflowProgressPercent: evaluation.workflowSteps.progressPercent,
          workflowTotalDuration: evaluation.workflowSteps.totalDuration,
          workflowFailedStep: evaluation.workflowSteps.failedStep,
        };
      }

      if (options.includeConstraintDetails && evaluation.llmConstraints) {
        return {
          ...baseData,
          activeStateModifiers:
            evaluation.llmConstraints.activeStateModifiers.join(', '),
          responseModifiers:
            evaluation.llmConstraints.responseModifiers.join(', '),
          executedCommands:
            evaluation.llmConstraints.executedCommands.join(', '),
          constraintEffectiveness:
            evaluation.llmConstraints.constraintEffectiveness
              ?.overallEffectiveness,
          constraintCompliance:
            evaluation.llmConstraints.constraintEffectiveness
              ?.modifierCompliance,
        };
      }

      return baseData;
    });

    if (options.format === 'csv') {
      return this.convertToCSV(exportData);
    }

    return exportData;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async fetchUsersMap(userIds: string[]): Promise<Map<string, any>> {
    if (userIds.length === 0) return new Map();

    const { data: users, error } = await this.supabaseService
      .getAnonClient()
      .from('profiles')
      .select('id, email, display_name, roles')
      .in('id', userIds);

    if (error) {
      return new Map();
    }

    const usersMap = new Map();
    (users || []).forEach((user) => {
      usersMap.set(user.id, user);
    });

    return usersMap;
  }

  private async fetchProvidersMap(
    providerIds: string[],
  ): Promise<Map<string, any>> {
    if (providerIds.length === 0) return new Map();

    const { data: providers, error } = await this.supabaseService
      .getAnonClient()
      .from('llm_providers')
      .select('*')
      .in('id', providerIds);

    if (error) {
      return new Map();
    }

    const providersMap = new Map();
    (providers || []).forEach((provider) => {
      const mappedProvider = mapLLMProviderFromDb(provider);
      providersMap.set(provider.id, mappedProvider);
    });

    return providersMap;
  }

  private async fetchModelsMap(modelIds: string[]): Promise<Map<string, any>> {
    if (modelIds.length === 0) return new Map();

    const { data: models, error } = await this.supabaseService
      .getAnonClient()
      .from('llm_models')
      .select('*')
      .in('id', modelIds);

    if (error) {
      return new Map();
    }

    const modelsMap = new Map();
    (models || []).forEach((model) => {
      const mappedModel = mapLLMModelFromDb(model);
      modelsMap.set(model.id, mappedModel);
    });

    return modelsMap;
  }

  private transformTaskToEnhancedEvaluation(
    task: any,
    usersMap: Map<string, any>,
    providersMap: Map<string, any>,
    modelsMap: Map<string, any>,
  ): EnhancedEvaluationMetadataDto {
    // Get user info
    const userProfile = usersMap.get(task.user_id);
    const user: EvaluationUserDto = {
      id: task.user_id,
      email: userProfile?.email || 'unknown@example.com',
      name:
        userProfile?.display_name ||
        userProfile?.email?.split('@')[0] ||
        'Unknown User',
      roles: userProfile?.roles || [UserRole.USER],
    };

    // Extract evaluation data
    const evaluation: EvaluationDataDto = {
      userRating: task.evaluation.user_rating || 0,
      speedRating: task.evaluation.speed_rating,
      accuracyRating: task.evaluation.accuracy_rating,
      userNotes: task.evaluation.user_notes,
      evaluationTimestamp: new Date(
        task.evaluation.evaluation_timestamp || task.created_at,
      ),
      evaluationDetails: task.evaluation.evaluation_details,
    };

    // Format agent name
    let agentName = 'AI Assistant';
    if (task.response_metadata?.agent_name) {
      agentName = task.response_metadata.agent_name;
    } else if (task.method && task.method !== 'process') {
      agentName =
        task.method
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l: string) => l.toUpperCase()) + ' Agent';
    }
    const displayAgentName = formatAgentNameForDisplay(agentName);

    // Extract task info
    const taskInfo: EvaluationTaskDto = {
      id: task.id,
      prompt: task.prompt || '',
      response: task.response,
      agentName: displayAgentName,
      method: task.method || '',
      status: task.status || 'unknown',
      createdAt: new Date(task.created_at),
      completedAt: task.completed_at ? new Date(task.completed_at) : undefined,
      progress: task.progress,
      metadata: task.metadata,
    };

    // Extract workflow information
    let workflowSteps: WorkflowTrackingDto | undefined;
    if (task.response_metadata?.workflow_steps_completed) {
      const steps = task.response_metadata.workflow_steps_completed;
      const completedCount = steps.filter(
        (step: any) => step.status === 'completed',
      ).length;
      const failedCount = steps.filter(
        (step: any) => step.status === 'failed',
      ).length;

      workflowSteps = {
        totalSteps: steps.length,
        completedSteps: completedCount,
        failedSteps: failedCount,
        progressPercent: Math.round((completedCount / steps.length) * 100),
        stepDetails: steps.map((step: any) => ({
          name: step.name,
          status: step.status,
          duration: step.duration,
          error: step.error,
          metadata: step.metadata,
          startTime: step.startTime ? new Date(step.startTime) : undefined,
          endTime: step.endTime ? new Date(step.endTime) : undefined,
        })),
        totalDuration: steps.reduce(
          (sum: number, step: any) => sum + (step.duration || 0),
          0,
        ),
        failedStep: steps.find((step: any) => step.status === 'failed')?.name,
      };
    }

    // Extract CIDAFM constraint information
    let llmConstraints: LLMConstraintsDto | undefined;
    const cidafmOptions =
      task.llm_metadata?.originalLLMSelection?.cidafmOptions;
    if (cidafmOptions) {
      llmConstraints = {
        activeStateModifiers: cidafmOptions.activeStateModifiers || [],
        responseModifiers: cidafmOptions.responseModifiers || [],
        executedCommands: cidafmOptions.executedCommands || [],
        constraintEffectiveness: undefined, // Could be enhanced with actual effectiveness tracking
        processingNotes: cidafmOptions.customOptions,
      };
    }

    // Get LLM info
    const providerId = task.llm_metadata?.originalLLMSelection?.providerId;
    const modelId = task.llm_metadata?.originalLLMSelection?.modelId;
    const provider = providerId ? providersMap.get(providerId) : undefined;
    const model = modelId ? modelsMap.get(modelId) : undefined;

    const llmInfo: EnhancedLLMInfoDto = {
      provider: provider?.name || provider?.display_name || 'Unknown Provider',
      model: model?.display_name || model?.model_name || 'Unknown Model',
      responseTimeMs: task.llm_metadata?.response_time_ms || 0,
      cost: task.llm_metadata?.total_cost || 0,
      tokenUsage: {
        input: task.llm_metadata?.input_tokens || 0,
        output: task.llm_metadata?.output_tokens || 0,
      },
      modelVersion: model?.model_id,
      temperature: task.llm_metadata?.originalLLMSelection?.temperature,
      maxTokens: task.llm_metadata?.originalLLMSelection?.maxTokens,
    };

    return {
      user,
      evaluation,
      task: taskInfo,
      workflowSteps,
      llmConstraints,
      llmInfo,
      systemMetadata: {
        taskMetadata: task.metadata,
        responseMetadata: task.response_metadata,
        llmMetadata: task.llm_metadata,
      },
    };
  }

  private calculateAgentPerformance(tasks: any[]): Array<{
    agentName: string;
    averageRating: number;
    evaluationCount: number;
  }> {
    const agentGroups = tasks.reduce(
      (groups, task) => {
        let agentName = 'AI Assistant';
        if (task.response_metadata?.agent_name) {
          agentName = task.response_metadata.agent_name;
        } else if (task.method && task.method !== 'process') {
          agentName =
            task.method
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (l: string) => l.toUpperCase()) + ' Agent';
        }
        const displayName = formatAgentNameForDisplay(agentName);

        if (!groups[displayName]) {
          groups[displayName] = { ratings: [], count: 0 };
        }

        if (task.evaluation?.user_rating) {
          groups[displayName].ratings.push(task.evaluation.user_rating);
          groups[displayName].count++;
        }

        return groups;
      },
      {} as Record<string, { ratings: number[]; count: number }>,
    );

    return Object.entries(agentGroups).map(
      ([agentName, data]: [string, any]) => ({
        agentName,
        averageRating:
          data.ratings.length > 0
            ? data.ratings.reduce(
                (sum: number, rating: number) => sum + rating,
                0,
              ) / data.ratings.length
            : 0,
        evaluationCount: data.count,
      }),
    );
  }

  private extractProviderModelInfo(task: any): {
    providerId?: string;
    providerName?: string;
    modelId?: string;
    modelName?: string;
  } | null {
    const llmMetadata = task.llm_metadata || {};
    const selection =
      llmMetadata.originalLLMSelection ||
      llmMetadata.currentLLMSelection ||
      llmMetadata.selectedLLM ||
      llmMetadata.llmSelection ||
      {};

    const providerId =
      selection.providerId ||
      selection.provider_id ||
      llmMetadata.providerId ||
      llmMetadata.provider_id ||
      task.provider_id ||
      task.provider?.id ||
      undefined;
    const modelId =
      selection.modelId ||
      selection.model_id ||
      llmMetadata.modelId ||
      llmMetadata.model_id ||
      task.model_id ||
      task.model?.id ||
      undefined;

    const providerName =
      selection.providerName ||
      selection.provider ||
      llmMetadata.providerName ||
      llmMetadata.provider ||
      llmMetadata.provider_name ||
      task.provider_name ||
      task.provider?.display_name ||
      task.provider?.provider_name ||
      task.provider?.name ||
      task.metadata?.providerName ||
      task.metadata?.provider?.name ||
      task.metadata?.provider?.displayName ||
      task.metadata?.provider ||
      undefined;

    const modelName =
      selection.modelName ||
      selection.model ||
      llmMetadata.modelName ||
      llmMetadata.model ||
      llmMetadata.model_name ||
      task.model_name ||
      task.model?.model_name ||
      task.model?.display_name ||
      task.model?.name ||
      task.metadata?.modelName ||
      task.metadata?.model?.name ||
      task.metadata?.model?.displayName ||
      task.metadata?.model ||
      undefined;

    if (!providerId && !providerName) {
      return null;
    }

    if (!modelId && !modelName) {
      return null;
    }

    return { providerId, providerName, modelId, modelName };
  }

  private buildRecommendationKey(
    providerId?: string,
    providerName?: string,
    modelId?: string,
    modelName?: string,
  ): string {
    const providerPart = (providerId || providerName || 'unknown_provider')
      .toString()
      .toLowerCase();
    const modelPart = (modelId || modelName || 'unknown_model')
      .toString()
      .toLowerCase();
    return `${providerPart}::${modelPart}`;
  }

  private normalizeAgentIdentifier(value?: string | null): string {
    if (!value || typeof value !== 'string') {
      return '';
    }

    // Convert to consistent underscore format:
    // 1. Replace spaces, hyphens with underscores
    // 2. Remove common suffixes like 'agent', 'assistant', 'writer'
    // 3. Convert to lowercase
    // 4. Trim and clean up multiple underscores
    return value
      .toLowerCase()
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/-/g, '_') // Replace hyphens with underscores
      .replace(/_writer$/i, '') // Remove 'writer' suffix
      .replace(/_agent$/i, '') // Remove 'agent' suffix
      .replace(/_assistant$/i, '') // Remove 'assistant' suffix
      .replace(/writer$/i, '') // Remove 'writer' suffix without underscore
      .replace(/agent$/i, '') // Remove 'agent' suffix without underscore
      .replace(/assistant$/i, '') // Remove 'assistant' suffix without underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .trim();
  }

  private extractAgentIdentifiers(task: any): string[] {
    const names = new Set<string>();

    const candidateValues = [
      task.response_metadata?.agent_name,
      task.response_metadata?.agentName,
      task.metadata?.agent_name,
      task.metadata?.agentName,
      task.metadata?.agent?.name,
      task.metadata?.agent?.displayName,
      task.metadata?.originalAgent?.agentName,
      task.metadata?.originalAgent?.name,
      task.metadata?.originalAgentName,
      task.metadata?.agentDisplayName,
      task.metadata?.agentLabel,
      task.metadata?.llmMetadata?.originalLLMSelection?.agentName,
      task.metadata?.llmMetadata?.originalLLMSelection?.agent_name,
      task.llm_metadata?.agent_name,
      task.llm_metadata?.agentName,
      task.llm_metadata?.originalLLMSelection?.agentName,
      task.llm_metadata?.originalLLMSelection?.agent_name,
      task.agent_name,
      task.agentName,
      task.method,
    ];

    candidateValues.forEach((value) => {
      const normalized = this.normalizeAgentIdentifier(value);
      if (normalized) {
        names.add(normalized);
      }
    });

    const firstCandidate = candidateValues.find((value) => value);
    if (firstCandidate) {
      const display = formatAgentNameForDisplay(firstCandidate as string);
      const normalizedDisplay = this.normalizeAgentIdentifier(display);
      if (normalizedDisplay) {
        names.add(normalizedDisplay);
      }
    }

    return Array.from(names);
  }

  private recordMatchesAgent(record: any, normalizedTarget: string): boolean {
    if (!normalizedTarget) {
      return false;
    }

    const identifiers = this.extractAgentIdentifiers(record);
    return identifiers.includes(normalizedTarget);
  }

  private getAggregationsClient(): {
    client: SupabaseClient;
    isServiceClient: boolean;
  } {
    try {
      const client = this.supabaseService.getServiceClient();
      return { client, isServiceClient: true };
    } catch (error) {
      this.logger.warn(
        `[EvaluationService] Service client unavailable, falling back to anon client for recommendations: ${error instanceof Error ? error.message : error}`,
      );
      return {
        client: this.supabaseService.getAnonClient(),
        isServiceClient: false,
      };
    }
  }

  private calculateConstraintEffectiveness(tasks: any[]): Array<{
    constraintName: string;
    effectivenessScore: number;
    usageCount: number;
  }> {
    const constraintStats = new Map<
      string,
      { ratings: number[]; count: number }
    >();

    tasks.forEach((task) => {
      const cidafmOptions =
        task.llm_metadata?.originalLLMSelection?.cidafmOptions;
      if (!cidafmOptions || !task.evaluation?.user_rating) return;

      const allConstraints = [
        ...(cidafmOptions.activeStateModifiers || []),
        ...(cidafmOptions.responseModifiers || []),
        ...(cidafmOptions.executedCommands || []),
      ];

      allConstraints.forEach((constraint) => {
        if (!constraintStats.has(constraint)) {
          constraintStats.set(constraint, { ratings: [], count: 0 });
        }

        const stats = constraintStats.get(constraint)!;
        stats.ratings.push(task.evaluation.user_rating);
        stats.count++;
      });
    });

    return Array.from(constraintStats.entries()).map(
      ([constraintName, stats]) => ({
        constraintName,
        effectivenessScore:
          stats.ratings.length > 0
            ? stats.ratings.reduce((sum, rating) => sum + rating, 0) /
              stats.ratings.length
            : 0,
        usageCount: stats.count,
      }),
    );
  }

  private calculateWorkflowFailurePoints(tasks: any[]): Array<{
    stepName: string;
    failureRate: number;
    averageDuration: number;
  }> {
    const stepStats = new Map<
      string,
      { total: number; failed: number; durations: number[] }
    >();

    tasks.forEach((task) => {
      const steps = task.response_metadata?.workflow_steps_completed;
      if (!steps) return;

      steps.forEach((step: any) => {
        if (!stepStats.has(step.name)) {
          stepStats.set(step.name, { total: 0, failed: 0, durations: [] });
        }

        const stats = stepStats.get(step.name)!;
        stats.total++;

        if (step.status === 'failed') {
          stats.failed++;
        }

        if (step.duration) {
          stats.durations.push(step.duration);
        }
      });
    });

    return Array.from(stepStats.entries()).map(([stepName, stats]) => ({
      stepName,
      failureRate: stats.total > 0 ? (stats.failed / stats.total) * 100 : 0,
      averageDuration:
        stats.durations.length > 0
          ? stats.durations.reduce((sum, duration) => sum + duration, 0) /
            stats.durations.length
          : 0,
    }));
  }

  private calculateWorkflowStepPerformance(tasks: any[]): Array<{
    stepName: string;
    averageDuration: number;
    successRate: number;
    failureRate: number;
    totalExecutions: number;
  }> {
    const stepStats = new Map<
      string,
      {
        total: number;
        successful: number;
        failed: number;
        durations: number[];
      }
    >();

    tasks.forEach((task) => {
      const steps = task.response_metadata?.workflow_steps_completed;
      if (!steps) return;

      steps.forEach((step: any) => {
        if (!stepStats.has(step.name)) {
          stepStats.set(step.name, {
            total: 0,
            successful: 0,
            failed: 0,
            durations: [],
          });
        }

        const stats = stepStats.get(step.name)!;
        stats.total++;

        if (step.status === 'completed') {
          stats.successful++;
        } else if (step.status === 'failed') {
          stats.failed++;
        }

        if (step.duration) {
          stats.durations.push(step.duration);
        }
      });
    });

    return Array.from(stepStats.entries()).map(([stepName, stats]) => ({
      stepName,
      averageDuration:
        stats.durations.length > 0
          ? stats.durations.reduce((sum, duration) => sum + duration, 0) /
            stats.durations.length
          : 0,
      successRate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0,
      failureRate: stats.total > 0 ? (stats.failed / stats.total) * 100 : 0,
      totalExecutions: stats.total,
    }));
  }

  private identifyWorkflowFailurePatterns(tasks: any[]): Array<{
    pattern: string;
    occurrences: number;
    impactRating: number;
  }> {
    const failurePatterns = new Map<
      string,
      { count: number; totalImpact: number }
    >();

    tasks.forEach((task) => {
      const steps = task.response_metadata?.workflow_steps_completed;
      if (!steps) return;

      const failedSteps = steps.filter((step: any) => step.status === 'failed');
      if (failedSteps.length === 0) return;

      // Create patterns based on failure sequences
      const failureSequence = failedSteps
        .map((step: any) => step.name)
        .join(' -> ');
      const userRating = task.evaluation?.user_rating || 3;
      const impactScore = 5 - userRating + 1; // Higher impact for lower ratings

      if (!failurePatterns.has(failureSequence)) {
        failurePatterns.set(failureSequence, { count: 0, totalImpact: 0 });
      }

      const pattern = failurePatterns.get(failureSequence)!;
      pattern.count++;
      pattern.totalImpact += impactScore;
    });

    return Array.from(failurePatterns.entries()).map(([pattern, stats]) => ({
      pattern,
      occurrences: stats.count,
      impactRating: stats.count > 0 ? stats.totalImpact / stats.count : 0,
    }));
  }

  private calculateWorkflowEfficiencyTrends(
    tasks: any[],
    filters: AdminEvaluationFiltersDto,
  ): Array<{
    date: string;
    averageSteps: number;
    averageDuration: number;
    successRate: number;
  }> {
    // Group tasks by date
    const dailyStats = new Map<
      string,
      {
        totalSteps: number;
        totalDuration: number;
        totalTasks: number;
        successfulTasks: number;
      }
    >();

    tasks.forEach((task) => {
      const steps = task.response_metadata?.workflow_steps_completed;
      if (!steps) return;

      const date = new Date(task.created_at).toISOString().split('T')[0];
      if (date && !dailyStats.has(date)) {
        dailyStats.set(date, {
          totalSteps: 0,
          totalDuration: 0,
          totalTasks: 0,
          successfulTasks: 0,
        });
      }

      const stats = date ? dailyStats.get(date)! : null;
      if (!stats) return;
      stats.totalSteps += steps.length;
      stats.totalDuration += steps.reduce(
        (sum: number, step: any) => sum + (step.duration || 0),
        0,
      );
      stats.totalTasks++;

      const successfulSteps = steps.filter(
        (step: any) => step.status === 'completed',
      ).length;
      if (successfulSteps === steps.length) {
        stats.successfulTasks++;
      }
    });

    return Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        averageSteps:
          stats.totalTasks > 0 ? stats.totalSteps / stats.totalTasks : 0,
        averageDuration:
          stats.totalTasks > 0 ? stats.totalDuration / stats.totalTasks : 0,
        successRate:
          stats.totalTasks > 0
            ? (stats.successfulTasks / stats.totalTasks) * 100
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateConstraintUsageStats(tasks: any[]): Array<{
    constraintName: string;
    usageCount: number;
    averageEffectiveness: number;
    userSatisfaction: number;
  }> {
    const constraintStats = new Map<
      string,
      {
        usage: number;
        ratings: number[];
        effectivenessScores: number[];
      }
    >();

    tasks.forEach((task) => {
      const cidafmOptions =
        task.llm_metadata?.originalLLMSelection?.cidafmOptions;
      if (!cidafmOptions) return;

      const allConstraints = [
        ...(cidafmOptions.activeStateModifiers || []),
        ...(cidafmOptions.responseModifiers || []),
        ...(cidafmOptions.executedCommands || []),
      ];

      allConstraints.forEach((constraint) => {
        if (!constraintStats.has(constraint)) {
          constraintStats.set(constraint, {
            usage: 0,
            ratings: [],
            effectivenessScores: [],
          });
        }

        const stats = constraintStats.get(constraint)!;
        stats.usage++;

        if (task.evaluation?.user_rating) {
          stats.ratings.push(task.evaluation.user_rating);
        }

        // Mock effectiveness score - could be enhanced with actual tracking
        const effectivenessScore = task.evaluation?.user_rating
          ? task.evaluation.user_rating * 0.8 + Math.random() * 0.4
          : 3;
        stats.effectivenessScores.push(effectivenessScore);
      });
    });

    return Array.from(constraintStats.entries()).map(
      ([constraintName, stats]) => ({
        constraintName,
        usageCount: stats.usage,
        averageEffectiveness:
          stats.effectivenessScores.length > 0
            ? stats.effectivenessScores.reduce((sum, score) => sum + score, 0) /
              stats.effectivenessScores.length
            : 0,
        userSatisfaction:
          stats.ratings.length > 0
            ? stats.ratings.reduce((sum, rating) => sum + rating, 0) /
              stats.ratings.length
            : 0,
      }),
    );
  }

  private analyzeConstraintCombinations(tasks: any[]): Array<{
    combination: string[];
    usageCount: number;
    effectivenessScore: number;
    averageRating: number;
  }> {
    const combinationStats = new Map<
      string,
      {
        constraints: string[];
        usage: number;
        ratings: number[];
        effectivenessScores: number[];
      }
    >();

    tasks.forEach((task) => {
      const cidafmOptions =
        task.llm_metadata?.originalLLMSelection?.cidafmOptions;
      if (!cidafmOptions) return;

      const allConstraints = [
        ...(cidafmOptions.activeStateModifiers || []),
        ...(cidafmOptions.responseModifiers || []),
      ].sort(); // Sort for consistent combination keys

      if (allConstraints.length < 2) return; // Only analyze combinations

      const combinationKey = allConstraints.join('|');
      if (!combinationStats.has(combinationKey)) {
        combinationStats.set(combinationKey, {
          constraints: allConstraints,
          usage: 0,
          ratings: [],
          effectivenessScores: [],
        });
      }

      const stats = combinationStats.get(combinationKey)!;
      stats.usage++;

      if (task.evaluation?.user_rating) {
        stats.ratings.push(task.evaluation.user_rating);
        // Mock effectiveness calculation
        const effectivenessScore =
          task.evaluation.user_rating * 0.9 + Math.random() * 0.2;
        stats.effectivenessScores.push(effectivenessScore);
      }
    });

    return Array.from(combinationStats.entries())
      .map(([_, stats]) => ({
        combination: stats.constraints,
        usageCount: stats.usage,
        effectivenessScore:
          stats.effectivenessScores.length > 0
            ? stats.effectivenessScores.reduce((sum, score) => sum + score, 0) /
              stats.effectivenessScores.length
            : 0,
        averageRating:
          stats.ratings.length > 0
            ? stats.ratings.reduce((sum, rating) => sum + rating, 0) /
              stats.ratings.length
            : 0,
      }))
      .filter((combo) => combo.usageCount >= 3) // Only show combinations used at least 3 times
      .sort((a, b) => b.effectivenessScore - a.effectivenessScore);
  }

  private calculateConstraintPerformanceImpact(tasks: any[]): Array<{
    constraintName: string;
    withConstraint: {
      averageRating: number;
      averageResponseTime: number;
      averageCost: number;
    };
    withoutConstraint: {
      averageRating: number;
      averageResponseTime: number;
      averageCost: number;
    };
  }> {
    const constraintStats = new Map<
      string,
      {
        withConstraint: {
          ratings: number[];
          responseTimes: number[];
          costs: number[];
        };
        withoutConstraint: {
          ratings: number[];
          responseTimes: number[];
          costs: number[];
        };
      }
    >();

    // First pass: identify all constraints
    const allConstraints = new Set<string>();
    tasks.forEach((task) => {
      const cidafmOptions =
        task.llm_metadata?.originalLLMSelection?.cidafmOptions;
      if (cidafmOptions) {
        [
          ...(cidafmOptions.activeStateModifiers || []),
          ...(cidafmOptions.responseModifiers || []),
        ].forEach((constraint) => allConstraints.add(constraint));
      }
    });

    // Initialize stats for each constraint
    allConstraints.forEach((constraint) => {
      constraintStats.set(constraint, {
        withConstraint: { ratings: [], responseTimes: [], costs: [] },
        withoutConstraint: { ratings: [], responseTimes: [], costs: [] },
      });
    });

    // Second pass: categorize tasks
    tasks.forEach((task) => {
      const cidafmOptions =
        task.llm_metadata?.originalLLMSelection?.cidafmOptions;
      const taskConstraints = cidafmOptions
        ? [
            ...(cidafmOptions.activeStateModifiers || []),
            ...(cidafmOptions.responseModifiers || []),
          ]
        : [];

      const rating = task.evaluation?.user_rating;
      const responseTime = task.llm_metadata?.response_time_ms;
      const cost = task.llm_metadata?.total_cost;

      if (!rating) return;

      allConstraints.forEach((constraint) => {
        const stats = constraintStats.get(constraint)!;
        const hasConstraint = taskConstraints.includes(constraint);

        const targetStats = hasConstraint
          ? stats.withConstraint
          : stats.withoutConstraint;
        targetStats.ratings.push(rating);
        if (responseTime) targetStats.responseTimes.push(responseTime);
        if (cost) targetStats.costs.push(cost);
      });
    });

    return Array.from(constraintStats.entries())
      .map(([constraintName, stats]) => ({
        constraintName,
        withConstraint: {
          averageRating: this.calculateAverage(stats.withConstraint.ratings),
          averageResponseTime: this.calculateAverage(
            stats.withConstraint.responseTimes,
          ),
          averageCost: this.calculateAverage(stats.withConstraint.costs),
        },
        withoutConstraint: {
          averageRating: this.calculateAverage(stats.withoutConstraint.ratings),
          averageResponseTime: this.calculateAverage(
            stats.withoutConstraint.responseTimes,
          ),
          averageCost: this.calculateAverage(stats.withoutConstraint.costs),
        },
      }))
      .filter(
        (result) =>
          result.withConstraint.averageRating > 0 &&
          result.withoutConstraint.averageRating > 0,
      );
  }

  private anonymizeEmail(email: string): string {
    const [username, domain] = email.split('@');
    const anonymizedUsername =
      username && username.length > 3
        ? username.substring(0, 2) + '*'.repeat(username.length - 2)
        : '***';
    return `${anonymizedUsername}@${domain}`;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((item) =>
      Object.values(item)
        .map((val) => {
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(','),
    );

    return [headers, ...rows].join('\n');
  }
}
