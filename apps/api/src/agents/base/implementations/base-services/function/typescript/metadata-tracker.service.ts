import { Injectable } from '@nestjs/common';

export interface LLMCall {
  modelName: string;
  providerId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: string;
  duration?: number;
  prompt?: string;
  response?: string;
}

export interface LLMMetadata {
  primaryLLM?: LLMCall;
  totalCalls: number;
  totalCost: number;
  totalTokens: {
    input: number;
    output: number;
  };
  allCalls: LLMCall[];
  aggregatedAt: string;
}

export interface AgentMetadata {
  agentName: string;
  agentType: string;
  executionType: string;
  processedAt: string;
  llmUsed?: LLMCall;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
  llmCallsSummary?: {
    totalCalls: number;
    totalCost: number;
    allModelsUsed: string[];
  };
  [key: string]: any;
}

/**
 * Service for tracking and aggregating LLM call metadata across TypeScript agents
 * Provides utilities for monitoring LLM usage, costs, and performance metrics
 */
@Injectable()
export class MetadataTrackerService {
  /**
   * Create a new metadata tracker for an agent execution
   */
  createTracker(): {
    calls: LLMCall[];
    totalCost: number;
    totalTokens: { input: number; output: number };
    addCall: (call: LLMCall) => void;
    getAggregated: () => LLMMetadata;
  } {
    const calls: LLMCall[] = [];
    let totalCost = 0;
    const totalTokens = { input: 0, output: 0 };

    return {
      calls,
      totalCost,
      totalTokens,
      addCall: (call: LLMCall) => {
        calls.push(call);
        totalCost += call.cost;
        totalTokens.input += call.inputTokens;
        totalTokens.output += call.outputTokens;
      },
      getAggregated: () =>
        this.aggregateMetadata(calls, totalCost, totalTokens),
    };
  }

  /**
   * Aggregate LLM metadata from multiple calls
   */
  aggregateMetadata(
    calls: LLMCall[],
    totalCost: number,
    totalTokens: { input: number; output: number },
  ): LLMMetadata {
    return {
      primaryLLM: calls.length > 0 ? calls[0] : undefined,
      totalCalls: calls.length,
      totalCost,
      totalTokens,
      allCalls: calls,
      aggregatedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract and track metadata from LLM service response
   */
  trackLLMResponse(
    response: any,
    tracker: ReturnType<typeof this.createTracker>,
  ): any {
    // Extract LLM metadata if this was an enhanced response
    if (typeof response === 'object' && response.llmMetadata) {
      const call: LLMCall = {
        modelName: response.llmMetadata.modelName || 'unknown',
        providerId: response.llmMetadata.providerId || 'unknown',
        inputTokens: response.usage?.inputTokens || 0,
        outputTokens: response.usage?.outputTokens || 0,
        cost: response.costCalculation?.totalCost || 0,
        timestamp: new Date().toISOString(),
        duration: response.llmMetadata.duration,
        prompt: response.llmMetadata.prompt,
        response:
          typeof response.response === 'string'
            ? response.response.substring(0, 500)
            : undefined,
      };

      tracker.addCall(call);
    }

    return response;
  }

  /**
   * Create wrapper for LLM service that automatically tracks metadata
   */
  createLLMServiceWrapper(
    llmService: any,
    tracker: ReturnType<typeof this.createTracker>,
  ) {
    return {
      ...llmService,
      generateResponse: async (
        systemPrompt: string,
        userMessage: string,
        options?: any,
      ) => {
        const startTime = Date.now();

        const result = await llmService.generateResponse(
          systemPrompt,
          userMessage,
          options,
        );

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Add duration to the response metadata if it exists
        if (typeof result === 'object' && result.llmMetadata) {
          result.llmMetadata.duration = duration;
        }

        return this.trackLLMResponse(result, tracker);
      },
    };
  }

  /**
   * Generate agent metadata with LLM tracking information
   */
  generateAgentMetadata(
    agentName: string,
    agentType: string,
    executionType: string,
    llmMetadata?: LLMMetadata,
    additionalMetadata?: Record<string, any>,
  ): AgentMetadata {
    const baseMetadata: AgentMetadata = {
      agentName,
      agentType,
      executionType,
      processedAt: new Date().toISOString(),
      ...additionalMetadata,
    };

    // Add LLM metadata if available
    if (llmMetadata && llmMetadata.totalCalls > 0) {
      baseMetadata.llmUsed = llmMetadata.primaryLLM;
      baseMetadata.usage = {
        inputTokens: llmMetadata.totalTokens.input,
        outputTokens: llmMetadata.totalTokens.output,
        totalCost: llmMetadata.totalCost,
      };
      baseMetadata.llmCallsSummary = {
        totalCalls: llmMetadata.totalCalls,
        totalCost: llmMetadata.totalCost,
        allModelsUsed: llmMetadata.allCalls.map((call) => call.modelName),
      };
    }

    return baseMetadata;
  }

  /**
   * Calculate cost metrics from LLM calls
   */
  calculateCostMetrics(calls: LLMCall[]): {
    totalCost: number;
    averageCostPerCall: number;
    costByModel: Record<string, number>;
    costByProvider: Record<string, number>;
    tokenEfficiency: number; // cost per 1000 tokens
  } {
    const totalCost = calls.reduce((sum, call) => sum + call.cost, 0);
    const totalTokens = calls.reduce(
      (sum, call) => sum + call.inputTokens + call.outputTokens,
      0,
    );

    const costByModel: Record<string, number> = {};
    const costByProvider: Record<string, number> = {};

    calls.forEach((call) => {
      costByModel[call.modelName] =
        (costByModel[call.modelName] || 0) + call.cost;
      costByProvider[call.providerId] =
        (costByProvider[call.providerId] || 0) + call.cost;
    });

    return {
      totalCost,
      averageCostPerCall: calls.length > 0 ? totalCost / calls.length : 0,
      costByModel,
      costByProvider,
      tokenEfficiency: totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0,
    };
  }

  /**
   * Generate usage report for monitoring
   */
  generateUsageReport(
    agentName: string,
    timeframe: { start: Date; end: Date },
    calls: LLMCall[],
  ): {
    agentName: string;
    timeframe: { start: string; end: string };
    summary: {
      totalCalls: number;
      totalCost: number;
      totalTokens: number;
      averageResponseTime: number;
    };
    breakdown: {
      byModel: Record<string, { calls: number; cost: number; tokens: number }>;
      byProvider: Record<
        string,
        { calls: number; cost: number; tokens: number }
      >;
    };
    trends: {
      callsPerHour: number;
      costPerHour: number;
      efficiency: number;
    };
  } {
    const filteredCalls = calls.filter((call) => {
      const callTime = new Date(call.timestamp);
      return callTime >= timeframe.start && callTime <= timeframe.end;
    });

    const summary = {
      totalCalls: filteredCalls.length,
      totalCost: filteredCalls.reduce((sum, call) => sum + call.cost, 0),
      totalTokens: filteredCalls.reduce(
        (sum, call) => sum + call.inputTokens + call.outputTokens,
        0,
      ),
      averageResponseTime:
        filteredCalls.reduce((sum, call) => sum + (call.duration || 0), 0) /
          filteredCalls.length || 0,
    };

    const byModel: Record<
      string,
      { calls: number; cost: number; tokens: number }
    > = {};
    const byProvider: Record<
      string,
      { calls: number; cost: number; tokens: number }
    > = {};

    filteredCalls.forEach((call) => {
      const tokens = call.inputTokens + call.outputTokens;

      if (!byModel[call.modelName]) {
        byModel[call.modelName] = { calls: 0, cost: 0, tokens: 0 };
      }
      byModel[call.modelName]!.calls++;
      byModel[call.modelName]!.cost += call.cost;
      byModel[call.modelName]!.tokens += tokens;

      if (!byProvider[call.providerId]) {
        byProvider[call.providerId] = { calls: 0, cost: 0, tokens: 0 };
      }
      byProvider[call.providerId]!.calls++;
      byProvider[call.providerId]!.cost += call.cost;
      byProvider[call.providerId]!.tokens += tokens;
    });

    const timeframeDurationHours =
      (timeframe.end.getTime() - timeframe.start.getTime()) / (1000 * 60 * 60);

    return {
      agentName,
      timeframe: {
        start: timeframe.start.toISOString(),
        end: timeframe.end.toISOString(),
      },
      summary,
      breakdown: { byModel, byProvider },
      trends: {
        callsPerHour: summary.totalCalls / timeframeDurationHours,
        costPerHour: summary.totalCost / timeframeDurationHours,
        efficiency:
          summary.totalTokens > 0 ? summary.totalCost / summary.totalTokens : 0,
      },
    };
  }
}
