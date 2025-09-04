import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../supabase/supabase.service';
import { getTableName } from '../supabase/supabase.config';
import { LLMUsageMetrics } from '../types/llm-evaluation';

export interface RunMetadata {
  runId: string;
  provider: string;
  model: string;
  tier: 'local' | 'centralized' | 'external';
  cost: number;
  duration: number;
  timestamp: string;
  inputTokens?: number;
  outputTokens?: number;
  status: 'started' | 'completed' | 'error';
  errorMessage?: string;
  // Enhanced metrics from LLMUsageMetrics
  enhancedMetrics?: LLMUsageMetrics;
}

export interface MetadataContext {
  runId: string;
  startTime: number;
  provider: string;
  model: string;
  tier: 'local' | 'centralized' | 'external';
  inputTokens?: number;
  userId?: string;
  callerType?: string; // 'agent', 'api', 'user', 'system', 'service'
  callerName?: string; // 'metrics-agent', 'user-chat', 'api-endpoint', etc.
  conversationId?: string; // Optional conversation/session context
  complexityLevel?: string;
  complexityScore?: number;
  dataClassification?: string;
  isLocal?: boolean;
  modelTier?: string;
  fallbackUsed?: boolean;
  routingReason?: string;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

@Injectable()
export class RunMetadataService {
  private readonly logger = new Logger(RunMetadataService.name);
  private readonly activeRuns = new Map<string, MetadataContext>();

  constructor(private readonly supabaseService: SupabaseService) {}

  // Cost estimates per 1K tokens (in USD)
  private readonly costTable = {
    // OpenAI pricing
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'gpt-3.5-turbo-instruct': { input: 0.0015, output: 0.002 },
    
    // Anthropic pricing
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    
    // Local models (estimated electricity cost)
    'llama3.2:1b': { input: 0.0001, output: 0.0001 },
    'llama3.2:3b': { input: 0.0002, output: 0.0002 },
    'llama3.1:8b': { input: 0.0005, output: 0.0005 },
    'gpt-oss-2b': { input: 0.0001, output: 0.0001 },
    'gpt-oss-20b': { input: 0.001, output: 0.001 },
    'qwen2.5:7b': { input: 0.0004, output: 0.0004 },
    
    // Default fallback
    'default': { input: 0.001, output: 0.002 },
  };

  // Constructor already defined above

  /**
   * Start tracking a new LLM request
   */
  async startRequest(routingDecision: {
    provider: string;
    model: string;
    isLocal: boolean;
    modelTier?: string;
    fallbackUsed?: boolean;
    complexityLevel?: string;
    complexityScore?: number;
    routingReason?: string;
  }, options?: {
    userId?: string;
    callerType?: string;
    callerName?: string;
    conversationId?: string;
    dataClassification?: string;
  }): Promise<MetadataContext> {
    const runId = this.generateRunId();
    const startTime = Date.now();
    
    const tier: 'local' | 'centralized' | 'external' = routingDecision.isLocal 
      ? 'local' 
      : 'external'; // TODO: Add 'centralized' tier logic when implemented

    const context: MetadataContext = {
      runId,
      startTime,
      provider: routingDecision.provider,
      model: routingDecision.model,
      tier,
      userId: options?.userId,
      callerType: options?.callerType,
      callerName: options?.callerName,
      conversationId: options?.conversationId,
      complexityLevel: routingDecision.complexityLevel,
      complexityScore: routingDecision.complexityScore,
      dataClassification: options?.dataClassification,
      isLocal: routingDecision.isLocal,
      modelTier: routingDecision.modelTier,
      fallbackUsed: routingDecision.fallbackUsed || false,
      routingReason: routingDecision.routingReason,
    };

    this.activeRuns.set(runId, context);
    
    // Insert initial record into database (async, non-blocking)
    this.insertUsageRecord(context, 'started')
      .then(() => {
        this.logger.debug(`Started tracking run ${runId} for ${routingDecision.provider}/${routingDecision.model}`);
      })
      .catch(error => {
        this.logger.error(`Failed to insert initial usage record for ${runId}:`, error);
        // Continue execution even if database insert fails
      });
    
    return context;
  }

  /**
   * Complete tracking for a successful request
   */
  async completeRequest(
    context: MetadataContext,
    response: {
      content: string;
      inputTokens?: number;
      outputTokens?: number;
      enhancedMetrics?: LLMUsageMetrics;
    }
  ): Promise<RunMetadata> {
    const endTime = Date.now();
    const duration = endTime - context.startTime;
    
    // Estimate tokens if not provided
    const inputTokens = response.inputTokens || this.estimateTokens(''); // TODO: Pass actual input
    const outputTokens = response.outputTokens || this.estimateTokens(response.content);
    
    // Calculate cost
    const costEstimate = this.calculateCost(context.model, inputTokens, outputTokens);
    
    const metadata: RunMetadata = {
      runId: context.runId,
      provider: context.provider,
      model: context.model,
      tier: context.tier,
      cost: costEstimate.totalCost,
      duration,
      timestamp: new Date().toISOString(),
      inputTokens,
      outputTokens,
      status: 'completed',
      enhancedMetrics: response.enhancedMetrics,
    };

    // Update database record (async, non-blocking)
    this.updateUsageRecord(context.runId, {
      status: 'completed',
      inputTokens,
      outputTokens,
      inputCost: costEstimate.inputCost,
      outputCost: costEstimate.outputCost,
      durationMs: duration,
      completedAt: new Date().toISOString(),
      enhancedMetrics: response.enhancedMetrics,
    }).catch(error => {
      this.logger.error(`Failed to update usage record for ${context.runId}:`, error);
      // Continue execution even if database update fails
    });

    // Clean up active tracking
    this.activeRuns.delete(context.runId);
    
    this.logger.debug(`Completed run ${context.runId}: ${duration}ms, $${costEstimate.totalCost.toFixed(6)}`);
    
    return metadata;
  }

  /**
   * Complete tracking for a failed request
   */
  async completeRequestWithError(
    context: MetadataContext,
    error: Error
  ): Promise<RunMetadata> {
    const endTime = Date.now();
    const duration = endTime - context.startTime;
    
    const metadata: RunMetadata = {
      runId: context.runId,
      provider: context.provider,
      model: context.model,
      tier: context.tier,
      cost: 0, // No cost for failed requests
      duration,
      timestamp: new Date().toISOString(),
      status: 'error',
      errorMessage: error.message,
    };

    // Update database record with error (async, non-blocking)
    this.updateUsageRecord(context.runId, {
      status: 'error',
      durationMs: duration,
      errorMessage: error.message,
      completedAt: new Date().toISOString(),
    }).catch(dbError => {
      this.logger.error(`Failed to update error record for ${context.runId}:`, dbError);
    });

    // Clean up active tracking
    this.activeRuns.delete(context.runId);
    
    this.logger.warn(`Failed run ${context.runId}: ${error.message} (${duration}ms)`);
    
    return metadata;
  }

  /**
   * Generate a unique run ID using UUID v4
   */
  private generateRunId(): string {
    return uuidv4();
  }

  /**
   * Estimate token count from text (4 characters ≈ 1 token)
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost estimate based on model and token usage
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): CostEstimate {
    const pricing = this.costTable[model as keyof typeof this.costTable] || this.costTable['default'];
    
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      currency: 'USD',
    };
  }

  /**
   * Get metadata for a specific run ID
   */
  getRunMetadata(runId: string): MetadataContext | null {
    return this.activeRuns.get(runId) || null;
  }

  /**
   * Get all active runs (for monitoring)
   */
  getActiveRuns(): MetadataContext[] {
    return Array.from(this.activeRuns.values());
  }

  /**
   * Clean up stale runs (older than 5 minutes)
   */
  cleanupStaleRuns(): void {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    for (const [runId, context] of this.activeRuns.entries()) {
      if (context.startTime < fiveMinutesAgo) {
        this.activeRuns.delete(runId);
        this.logger.warn(`Cleaned up stale run ${runId}`);
      }
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeRuns: number;
    totalRunsToday: number;
    avgDuration: number;
    avgCost: number;
  } {
    // TODO: Implement persistent statistics tracking
    return {
      activeRuns: this.activeRuns.size,
      totalRunsToday: 0,
      avgDuration: 0,
      avgCost: 0,
    };
  }

  /**
   * Insert initial usage record into database
   */
  private async insertUsageRecord(context: MetadataContext, status: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();
    
    const { error } = await client
      .from(getTableName('llm_usage'))
      .insert({
        run_id: context.runId,
        user_id: context.userId,
        caller_type: context.callerType || 'system',
        caller_name: context.callerName || 'unknown',
        conversation_id: context.conversationId,
        provider_name: context.provider,
        model_name: context.model,
        is_local: context.isLocal || false,
        model_tier: context.modelTier,
        fallback_used: context.fallbackUsed || false,
        routing_reason: context.routingReason,
        complexity_level: context.complexityLevel,
        complexity_score: context.complexityScore,
        data_classification: context.dataClassification,
        status: status,
        started_at: new Date(context.startTime).toISOString(),
        duration_ms: 0,
      });

    if (error) {
      throw new Error(`Failed to insert usage record: ${error.message}`);
    }
  }

  /**
   * Update usage record in database
   */
  private async updateUsageRecord(runId: string, updates: {
    status: string;
    inputTokens?: number;
    outputTokens?: number;
    inputCost?: number;
    outputCost?: number;
    durationMs?: number;
    completedAt?: string;
    errorMessage?: string;
    enhancedMetrics?: LLMUsageMetrics;
  }): Promise<void> {
    const client = this.supabaseService.getServiceClient();
    
    // Prepare update data with enhanced metrics
    const updateData: any = {
      status: updates.status,
      input_tokens: updates.inputTokens,
      output_tokens: updates.outputTokens,
      input_cost: updates.inputCost,
      output_cost: updates.outputCost,
      // Note: total_cost is a generated column, so we don't update it manually
      duration_ms: updates.durationMs,
      completed_at: updates.completedAt,
      error_message: updates.errorMessage,
      updated_at: new Date().toISOString(),
    };

    // Add enhanced metrics if provided
    if (updates.enhancedMetrics) {
      const metrics = updates.enhancedMetrics;
      
      // Data sanitization fields
      if (metrics.dataSanitizationApplied !== undefined) {
        updateData.data_sanitization_applied = metrics.dataSanitizationApplied;
      }
      if (metrics.sanitizationLevel !== undefined) {
        updateData.sanitization_level = metrics.sanitizationLevel;
      }
      
      // PII detection fields
      if (metrics.piiDetected !== undefined) {
        updateData.pii_detected = metrics.piiDetected;
      }
      if (metrics.piiTypes !== undefined) {
        updateData.pii_types = JSON.stringify(metrics.piiTypes);
      }
      if (metrics.pseudonymsUsed !== undefined) {
        updateData.pseudonyms_used = metrics.pseudonymsUsed;
      }
      if (metrics.pseudonymTypes !== undefined) {
        updateData.pseudonym_types = JSON.stringify(metrics.pseudonymTypes);
      }
      
      // Redaction fields
      if (metrics.redactionsApplied !== undefined) {
        updateData.redactions_applied = metrics.redactionsApplied;
      }
      if (metrics.redactionTypes !== undefined) {
        updateData.redaction_types = JSON.stringify(metrics.redactionTypes);
      }
      
      // Source blinding fields
      if (metrics.sourceBlindingApplied !== undefined) {
        updateData.source_blinding_applied = metrics.sourceBlindingApplied;
      }
      if (metrics.headersStripped !== undefined) {
        updateData.headers_stripped = metrics.headersStripped;
      }
      if (metrics.customUserAgentUsed !== undefined) {
        updateData.custom_user_agent_used = metrics.customUserAgentUsed;
      }
      if (metrics.proxyUsed !== undefined) {
        updateData.proxy_used = metrics.proxyUsed;
      }
      if (metrics.noTrainHeaderSent !== undefined) {
        updateData.no_train_header_sent = metrics.noTrainHeaderSent;
      }
      if (metrics.noRetainHeaderSent !== undefined) {
        updateData.no_retain_header_sent = metrics.noRetainHeaderSent;
      }
      
      // Performance fields
      if (metrics.sanitizationTimeMs !== undefined) {
        updateData.sanitization_time_ms = metrics.sanitizationTimeMs;
      }
      if (metrics.reversalContextSize !== undefined) {
        updateData.reversal_context_size = metrics.reversalContextSize;
      }
      
      // Policy and classification fields
      if (metrics.policyProfile !== undefined) {
        updateData.policy_profile = metrics.policyProfile;
      }
      if (metrics.sovereignMode !== undefined) {
        updateData.sovereign_mode = metrics.sovereignMode;
      }
      if (metrics.dataClassification !== undefined) {
        updateData.data_classification = metrics.dataClassification;
      }
      
      // Compliance fields
      if (metrics.complianceFlags !== undefined) {
        updateData.compliance_flags = JSON.stringify(metrics.complianceFlags);
      }
      
      // Additional metadata
      if (metrics.langsmithRunId !== undefined) {
        updateData.langsmith_run_id = metrics.langsmithRunId;
      }
    }

    const { error } = await client
      .from(getTableName('llm_usage'))
      .update(updateData)
      .eq('run_id', runId);

    if (error) {
      throw new Error(`Failed to update usage record: ${error.message}`);
    }
  }

  /**
   * Get usage records from database
   */
  async getUsageRecords(filters?: {
    userId?: string;
    callerType?: string;
    callerName?: string;
    conversationId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<any[]> {
    const client = this.supabaseService.getServiceClient();
    
    let query = client
      .from(getTableName('llm_usage'))
      .select('*')
      .order('started_at', { ascending: false });

    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.callerType) query = query.eq('caller_type', filters.callerType);
    if (filters?.callerName) query = query.eq('caller_name', filters.callerName);
    if (filters?.conversationId) query = query.eq('conversation_id', filters.conversationId);
    if (filters?.startDate) query = query.gte('started_at', filters.startDate);
    if (filters?.endDate) query = query.lte('started_at', filters.endDate);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch usage records: ${error.message}`);
    return data || [];
  }

  /**
   * Get usage analytics from database
   */
  async getUsageAnalytics(filters?: {
    startDate?: string;
    endDate?: string;
    callerType?: string;
  }): Promise<any[]> {
    const client = this.supabaseService.getServiceClient();
    
    let query = client
      .from('llm_usage_analytics')
      .select('*')
      .order('date', { ascending: false });

    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);
    if (filters?.callerType) query = query.eq('caller_type', filters.callerType);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch usage analytics: ${error.message}`);
    return data || [];
  }
}
