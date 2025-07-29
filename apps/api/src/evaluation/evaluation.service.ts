import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  MessageEvaluationDto,
  EnhancedMessageResponseDto,
} from '../dto/llm-evaluation.dto';
import { UserRatingScale } from '../types/llm-evaluation';
import { mapLLMProviderFromDb, mapLLMModelFromDb } from '../utils/case-converter';

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
  return agentName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l: string) => l.toUpperCase())
    .replace(/\s+Agent$/, '') // Remove trailing "Agent" if present
    .trim() + ' Agent';
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
    if (evaluationDto.userRating) {
      await this.updateUsageStatsWithRating(
        userId,
        message.provider_id,
        message.model_id,
        evaluationDto.userRating,
      );
    }

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
    const client = this.supabaseService.getAnonClient();

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
      'provider:providers(name)',
      'model:models(name, model_id)',
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
    const client = this.supabaseService.getAnonClient();
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
    console.log(`[EvaluationService] getAllUserEvaluations called for user: ${userId}, filters:`, filters);
    
    const client = this.supabaseService.getAnonClient();

    // Query only tasks for evaluations (since that's where the data actually is)
    const { data: tasks, error: tasksError } = await client
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .not('evaluation', 'is', null);

    console.log(`[EvaluationService] Tasks result:`, tasks?.length || 0, 'items, error:', tasksError);

    if (tasksError) {
      throw new HttpException(
        `Failed to fetch task evaluations: ${tasksError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Filter out tasks that don't have actual evaluation ratings
    const tasksWithEvaluations = (tasks || []).filter((task) => 
      task.evaluation && 
      (task.evaluation.user_rating || task.evaluation.speed_rating || task.evaluation.accuracy_rating)
    );

    console.log(`[EvaluationService] Tasks with actual evaluations: ${tasksWithEvaluations.length}`);

    // Get unique provider and model IDs from tasks to fetch details
    const providerIds = new Set<string>();
    const modelIds = new Set<string>();
    
    tasksWithEvaluations.forEach(task => {
      // Provider and model IDs are nested in originalLLMSelection
      const providerId = task.llm_metadata?.originalLLMSelection?.providerId;
      const modelId = task.llm_metadata?.originalLLMSelection?.modelId;
      
      console.log(`[EvaluationService] Extracting from task ${task.id}:`, {
        hasLLMMetadata: !!task.llm_metadata,
        hasOriginalSelection: !!task.llm_metadata?.originalLLMSelection,
        providerId,
        modelId
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

    console.log(`[EvaluationService] Provider IDs collected:`, Array.from(providerIds));
    console.log(`[EvaluationService] Model IDs collected:`, Array.from(modelIds));
    console.log(`[EvaluationService] Provider IDs size:`, providerIds.size);
    console.log(`[EvaluationService] Model IDs size:`, modelIds.size);

    // Fetch user email
    console.log(`[EvaluationService] Fetching user email for userId: ${userId}`);
    const { data: userProfile, error: userError } = await client
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
    
    console.log(`[EvaluationService] User profile result:`, userProfile, 'Error:', userError);
    const userEmail = userProfile?.email || 'Unknown';

    // Test direct query with known IDs
    console.log(`[EvaluationService] Testing direct llm_provider query...`);
    const { data: testProvider, error: testProviderError } = await client
      .from('llm_providers')
      .select('*')
      .eq('id', '11111111-1111-1111-1111-111111111111');
    console.log(`[EvaluationService] Direct llm_provider query result:`, testProvider, 'Error:', testProviderError);

    console.log(`[EvaluationService] Testing direct llm_model query...`);
    const { data: testModel, error: testModelError } = await client
      .from('llm_models')
      .select('*')
      .eq('id', 'bb7bd9b6-f120-4847-807e-b0455bad6f31');
    console.log(`[EvaluationService] Direct llm_model query result:`, testModel, 'Error:', testModelError);

    if (providerIds.size > 0) {
      console.log(`[EvaluationService] About to query llm_providers table...`);
      const { data: providers, error: providerError } = await client
        .from('llm_providers')
        .select('*')
        .in('id', Array.from(providerIds));
      
      console.log(`[EvaluationService] Providers query result:`, providers, 'Error:', providerError);
      
      if (providers) {
        providers.forEach(provider => {
          console.log(`[EvaluationService] Mapping llm_provider:`, provider.id, '->', provider.name || provider.provider_name);
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
      
      console.log(`[EvaluationService] Models query result:`, models, 'Error:', modelError);
      
      if (models) {
        models.forEach(model => {
          console.log(`[EvaluationService] Mapping llm_model:`, model.id, '->', model.display_name || model.model_name || model.name);
          console.log(`[EvaluationService] Full model object:`, model);
          // Use the mapLLMModelFromDb utility function for consistent mapping
          const mappedModel = mapLLMModelFromDb(model);
          modelsMap.set(model.id, mappedModel);
        });
      }
    }

    // Transform task evaluations to the expected DTO format
    const allEvaluations: EnhancedMessageResponseDto[] = tasksWithEvaluations.map((task) => {
      // Debug: log all available task fields and data
      console.log(`[EvaluationService] Task ${task.id} fields:`, Object.keys(task));
      console.log(`[EvaluationService] Task actual data:`, {
        method: task.method,
        prompt: task.prompt ? task.prompt.substring(0, 100) + '...' : undefined,
        response: task.response ? task.response.substring(0, 100) + '...' : undefined,
        // Check alternative field names for response
        result: task.result ? task.result.substring(0, 100) + '...' : undefined,
        output: task.output ? task.output.substring(0, 100) + '...' : undefined,
        answer: task.answer ? task.answer.substring(0, 100) + '...' : undefined,
        response_metadata: task.response_metadata,
        metadata: task.metadata,
        llm_metadata: task.llm_metadata,
        // Check if response is nested in llm_metadata
        llm_response: task.llm_metadata?.response ? task.llm_metadata.response.substring(0, 100) + '...' : undefined,
        llm_result: task.llm_metadata?.result ? task.llm_metadata.result.substring(0, 100) + '...' : undefined,
        // Check deliverable fields
        deliverable_type: task.deliverable_type,
        deliverable_metadata: task.deliverable_metadata,
        // Check status and completion
        status: task.status,
        completed_at: task.completed_at,
        progress: task.progress,
        // Check evaluation object for response data
        evaluation_data: task.evaluation
      });
      
      // Additional debug for missing response data
      console.log(`[EvaluationService] Task ${task.id} response data check:`, {
        hasPrompt: !!task.prompt,
        hasResponse: !!task.response,
        hasResponseMetadata: !!task.response_metadata,
        responseMetadataKeys: task.response_metadata ? Object.keys(task.response_metadata) : [],
        hasWorkflowSteps: !!task.response_metadata?.workflow_steps_completed,
        workflowStepsCount: task.response_metadata?.workflow_steps_completed?.length || 0
      });

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
        agentName = task.method.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) + ' Agent';
      } else {
        // Last resort: use a generic name instead of "Process Agent"
        agentName = 'AI Assistant';
      }

      // Format the agent name for consistent display
      const displayAgentName = formatAgentNameForDisplay(agentName);

      console.log(`[EvaluationService] Task ${task.id}: "${taskContent}" by ${displayAgentName}`);

      // Get provider and model from LLM metadata (nested in originalLLMSelection)
      const providerId = task.llm_metadata?.originalLLMSelection?.providerId;
      const modelId = task.llm_metadata?.originalLLMSelection?.modelId;
      const provider = providerId ? providersMap.get(providerId) : undefined;
      const model = modelId ? modelsMap.get(modelId) : undefined;

      console.log(`[EvaluationService] Task ${task.id} - Provider ID: ${providerId}, Model ID: ${modelId}`);
      console.log(`[EvaluationService] Task ${task.id} - Provider obj:`, provider ? (provider.name || provider.display_name) : 'not found');
      console.log(`[EvaluationService] Task ${task.id} - Model obj:`, model ? (model.display_name || model.model_name) : 'not found');
      console.log(`[EvaluationService] Task ${task.id} - Model lookup:`, { modelId, foundInMap: !!model, modelKeys: model ? Object.keys(model) : [] });

      return {
        id: task.id,
        content: taskContent,
        role: 'assistant' as const,
        sessionId: task.agent_conversation_id || task.session_id,
        userId: task.user_id,
        timestamp: task.evaluation?.evaluation_timestamp || task.created_at || new Date().toISOString(),
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
          deliverableType: task.deliverable_type,
          deliverableMetadata: task.deliverable_metadata,
          progressMessage: task.progress_message,
          workflowStepsCompleted: task.response_metadata?.workflow_steps_completed,
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

    console.log(`[EvaluationService] Task evaluations count: ${allEvaluations.length}`);

    // Apply filters using direct DTO fields
    let filteredEvaluations = allEvaluations;

    if (filters.minRating !== undefined) {
      filteredEvaluations = filteredEvaluations.filter(
        (evaluation) =>
          evaluation.userRating &&
          evaluation.userRating >= filters.minRating!,
      );
    }

    if (filters.hasNotes) {
      filteredEvaluations = filteredEvaluations.filter(
        (evaluation) =>
          evaluation.userNotes &&
          evaluation.userNotes.trim().length > 0,
      );
    }

    // Filter by agent name using metadata
    if (filters.agentName) {
      filteredEvaluations = filteredEvaluations.filter(
        (evaluation) =>
          evaluation.metadata?.agentName &&
          evaluation.metadata.agentName.toLowerCase().includes(filters.agentName!.toLowerCase()),
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
    const paginatedEvaluations = filteredEvaluations.slice(offset, offset + filters.limit);

    console.log(`[EvaluationService] After filtering and pagination: ${paginatedEvaluations.length} items`);

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
}
