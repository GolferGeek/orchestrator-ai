import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
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
  constructor(private readonly supabaseService: SupabaseService) {}

  async evaluateMessage(
    userId: string,
    messageId: string,
    evaluationDto: MessageEvaluationDto,
  ): Promise<EnhancedMessageResponseDto | null> {
    const client = this.supabaseService.getAnonClient();

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
    const client = this.supabaseService.getAnonClient();

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
    const client = this.supabaseService.getAnonClient();

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
      .eq('agent_conversation_id', conversationId)
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
    console.log(
      `[EvaluationService] getAllUserEvaluations called for user: ${userId}, filters:`,
      filters,
    );

    const client = this.supabaseService.getAnonClient();

    // Query only tasks for evaluations (since that's where the data actually is)
    const { data: tasks, error: tasksError } = await client
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .not('evaluation', 'is', null);

    console.log(
      `[EvaluationService] Tasks result:`,
      tasks?.length || 0,
      'items, error:',
      tasksError,
    );

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

    console.log(
      `[EvaluationService] Tasks with actual evaluations: ${tasksWithEvaluations.length}`,
    );

    // Get unique provider and model IDs from tasks to fetch details
    const providerIds = new Set<string>();
    const modelIds = new Set<string>();

    tasksWithEvaluations.forEach((task) => {
      // Provider and model IDs are nested in originalLLMSelection
      const providerId = task.llm_metadata?.originalLLMSelection?.providerId;
      const modelId = task.llm_metadata?.originalLLMSelection?.modelId;

      console.log(`[EvaluationService] Extracting from task ${task.id}:`, {
        hasLLMMetadata: !!task.llm_metadata,
        hasOriginalSelection: !!task.llm_metadata?.originalLLMSelection,
        providerId,
        modelId,
      });

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

    console.log(
      `[EvaluationService] Provider IDs collected:`,
      Array.from(providerIds),
    );
    console.log(
      `[EvaluationService] Model IDs collected:`,
      Array.from(modelIds),
    );
    console.log(`[EvaluationService] Provider IDs size:`, providerIds.size);
    console.log(`[EvaluationService] Model IDs size:`, modelIds.size);

    // Fetch user email
    console.log(
      `[EvaluationService] Fetching user email for userId: ${userId}`,
    );
    const { data: userProfile, error: userError } = await client
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    console.log(
      `[EvaluationService] User profile result:`,
      userProfile,
      'Error:',
      userError,
    );
    const userEmail = userProfile?.email || 'Unknown';

    // Test direct query with known IDs
    console.log(`[EvaluationService] Testing direct llm_provider query...`);
    const { data: testProvider, error: testProviderError } = await client
      .from('llm_providers')
      .select('*')
      .eq('id', '11111111-1111-1111-1111-111111111111');
    console.log(
      `[EvaluationService] Direct llm_provider query result:`,
      testProvider,
      'Error:',
      testProviderError,
    );

    console.log(`[EvaluationService] Testing direct llm_model query...`);
    const { data: testModel, error: testModelError } = await client
      .from('llm_models')
      .select('*')
      .eq('id', 'bb7bd9b6-f120-4847-807e-b0455bad6f31');
    console.log(
      `[EvaluationService] Direct llm_model query result:`,
      testModel,
      'Error:',
      testModelError,
    );

    if (providerIds.size > 0) {
      console.log(`[EvaluationService] About to query llm_providers table...`);
      const { data: providers, error: providerError } = await client
        .from('llm_providers')
        .select('*')
        .in('id', Array.from(providerIds));

      console.log(
        `[EvaluationService] Providers query result:`,
        providers,
        'Error:',
        providerError,
      );

      if (providers) {
        providers.forEach((provider) => {
          console.log(
            `[EvaluationService] Mapping llm_provider:`,
            provider.id,
            '->',
            provider.name || provider.provider_name,
          );
          console.log(`[EvaluationService] Full provider object:`, provider);
          // Use the mapLLMProviderFromDb utility function for consistent mapping
          const mappedProvider = mapLLMProviderFromDb(provider);
          providersMap.set(provider.id, mappedProvider);
        });
      }
    }

    if (modelIds.size > 0) {
      console.log(`[EvaluationService] About to query llm_models table...`);
      const { data: models, error: modelError } = await client
        .from('llm_models')
        .select('*')
        .in('id', Array.from(modelIds));

      console.log(
        `[EvaluationService] Models query result:`,
        models,
        'Error:',
        modelError,
      );

      if (models) {
        models.forEach((model) => {
          console.log(
            `[EvaluationService] Mapping llm_model:`,
            model.id,
            '->',
            model.display_name || model.model_name || model.name,
          );
          console.log(`[EvaluationService] Full model object:`, model);
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
        console.log(
          `[EvaluationService] Task ${task.id} fields:`,
          Object.keys(task),
        );
        console.log(`[EvaluationService] Task actual data:`, {
          method: task.method,
          prompt: task.prompt
            ? task.prompt.substring(0, 100) + '...'
            : undefined,
          response: task.response
            ? task.response.substring(0, 100) + '...'
            : undefined,
          // Check alternative field names for response
          result: task.result
            ? task.result.substring(0, 100) + '...'
            : undefined,
          output: task.output
            ? task.output.substring(0, 100) + '...'
            : undefined,
          answer: task.answer
            ? task.answer.substring(0, 100) + '...'
            : undefined,
          response_metadata: task.response_metadata,
          metadata: task.metadata,
          llm_metadata: task.llm_metadata,
          // Check if response is nested in llm_metadata
          llm_response: task.llm_metadata?.response
            ? task.llm_metadata.response.substring(0, 100) + '...'
            : undefined,
          llm_result: task.llm_metadata?.result
            ? task.llm_metadata.result.substring(0, 100) + '...'
            : undefined,
          // Check deliverable fields
          type: task.type,
          deliverable_metadata: task.deliverable_metadata,
          // Check status and completion
          status: task.status,
          completed_at: task.completed_at,
          progress: task.progress,
          // Check evaluation object for response data
          evaluation_data: task.evaluation,
        });

        // Additional debug for missing response data
        console.log(
          `[EvaluationService] Task ${task.id} response data check:`,
          {
            hasPrompt: !!task.prompt,
            hasResponse: !!task.response,
            hasResponseMetadata: !!task.response_metadata,
            responseMetadataKeys: task.response_metadata
              ? Object.keys(task.response_metadata)
              : [],
            hasWorkflowSteps:
              !!task.response_metadata?.workflow_steps_completed,
            workflowStepsCount:
              task.response_metadata?.workflow_steps_completed?.length || 0,
          },
        );

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

        console.log(
          `[EvaluationService] Task ${task.id}: "${taskContent}" by ${displayAgentName}`,
        );

        // Get provider and model from LLM metadata (nested in originalLLMSelection)
        const providerId = task.llm_metadata?.originalLLMSelection?.providerId;
        const modelId = task.llm_metadata?.originalLLMSelection?.modelId;
        const provider = providerId ? providersMap.get(providerId) : undefined;
        const model = modelId ? modelsMap.get(modelId) : undefined;

        console.log(
          `[EvaluationService] Task ${task.id} - Provider ID: ${providerId}, Model ID: ${modelId}`,
        );
        console.log(
          `[EvaluationService] Task ${task.id} - Provider obj:`,
          provider ? provider.name || provider.display_name : 'not found',
        );
        console.log(
          `[EvaluationService] Task ${task.id} - Model obj:`,
          model ? model.display_name || model.model_name : 'not found',
        );
        console.log(`[EvaluationService] Task ${task.id} - Model lookup:`, {
          modelId,
          foundInMap: !!model,
          modelKeys: model ? Object.keys(model) : [],
        });

        return {
          id: task.id,
          content: taskContent,
          role: 'assistant' as const,
          sessionId: task.agent_conversation_id || task.session_id,
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

    console.log(
      `[EvaluationService] Task evaluations count: ${allEvaluations.length}`,
    );

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

    console.log(
      `[EvaluationService] After filtering and pagination: ${paginatedEvaluations.length} items`,
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
    console.log(
      `[EvaluationService] getAllEvaluationsForAdmin called with filters:`,
      filters,
    );

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

    console.log(
      `[EvaluationService] Admin evaluations found: ${tasksWithEvaluations.length}`,
    );

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
      console.warn('Failed to fetch users for admin evaluations:', error);
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
      console.warn('Failed to fetch providers for admin evaluations:', error);
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
      console.warn('Failed to fetch models for admin evaluations:', error);
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
