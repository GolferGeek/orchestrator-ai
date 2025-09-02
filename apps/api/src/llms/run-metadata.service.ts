import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

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
}

export interface MetadataContext {
  runId: string;
  startTime: number;
  provider: string;
  model: string;
  tier: 'local' | 'centralized' | 'external';
  inputTokens?: number;
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

  constructor() {
    this.logger.log('RunMetadataService initialized');
  }

  /**
   * Start tracking a new LLM request
   */
  startRequest(routingDecision: {
    provider: string;
    model: string;
    isLocal: boolean;
    modelTier?: string;
  }): MetadataContext {
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
    };

    this.activeRuns.set(runId, context);
    
    this.logger.debug(`Started tracking run ${runId} for ${routingDecision.provider}/${routingDecision.model}`);
    
    return context;
  }

  /**
   * Complete tracking for a successful request
   */
  completeRequest(
    context: MetadataContext,
    response: {
      content: string;
      inputTokens?: number;
      outputTokens?: number;
    }
  ): RunMetadata {
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
    };

    // Clean up active tracking
    this.activeRuns.delete(context.runId);
    
    this.logger.debug(`Completed run ${context.runId}: ${duration}ms, $${costEstimate.totalCost.toFixed(6)}`);
    
    return metadata;
  }

  /**
   * Complete tracking for a failed request
   */
  completeRequestWithError(
    context: MetadataContext,
    error: Error
  ): RunMetadata {
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
    const pricing = this.costTable[model] || this.costTable['default'];
    
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
}
