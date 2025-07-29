/**
 * Base Intelligent MCP Server
 *
 * Abstract base class for all intelligent MCP servers that provides
 * execution tracking, context learning, and comprehensive error handling.
 */

import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  MCPExecutionTrackerService,
  MCPExecutionContext,
  MCPExecutionResult,
} from '../services/mcp-execution-tracker.service';

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  description: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    logging?: boolean;
  };
  tools: MCPToolDefinition[];
}

export interface MCPToolExecutionOptions {
  maxRetries?: number;
  retryDelay?: number;
  llmProvider?: string;
  llmModel?: string;
  contextUsed?: boolean;
  userId: string;
  agentConversationId?: string;
  sessionId?: string;
}

@Injectable()
export abstract class IntelligentMCPBaseService {
  protected abstract serverInfo: MCPServerInfo;
  protected supabaseClient!: SupabaseClient;

  constructor(
    protected readonly executionTracker: MCPExecutionTrackerService,
  ) {}

  /**
   * Set the Supabase client for execution tracking
   */
  protected setSupabaseClient(client: SupabaseClient): void {
    this.supabaseClient = client;
  }

  /**
   * Get server information and available tools
   */
  async getServerInfo(): Promise<MCPServerInfo> {
    return this.serverInfo;
  }

  /**
   * Get list of available tools
   */
  getAvailableTools(): MCPToolDefinition[] {
    return this.serverInfo.tools;
  }

  /**
   * Execute a tool with comprehensive tracking and error handling
   */
  async executeTool(
    toolName: string,
    parameters: any,
    options: MCPToolExecutionOptions,
  ): Promise<MCPExecutionResult> {
    // Validate tool exists
    const tool = this.serverInfo.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(
        `Tool '${toolName}' not found in ${this.serverInfo.name} server`,
      );
    }

    // Create execution context
    const context: MCPExecutionContext = {
      mcpName: this.serverInfo.name,
      toolName,
      userId: options.userId,
      agentConversationId: options.agentConversationId,
      sessionId: options.sessionId,
      requestData: parameters,
      llmProvider: options.llmProvider,
      llmModel: options.llmModel,
      contextUsed: options.contextUsed || false,
    };

    // Execute with retry logic if specified
    if (options.maxRetries && options.maxRetries > 0) {
      return await this.executionTracker.executeWithRetry(
        context,
        () => this.executeToolImplementation(toolName, parameters, options),
        options.maxRetries,
        options.retryDelay || 1000,
      );
    } else {
      return await this.executionTracker.executeWithTracking(context, () =>
        this.executeToolImplementation(toolName, parameters, options),
      );
    }
  }

  /**
   * Abstract method that subclasses must implement to handle actual tool execution
   */
  protected abstract executeToolImplementation(
    toolName: string,
    parameters: any,
    options: MCPToolExecutionOptions,
  ): Promise<any>;

  /**
   * Get execution statistics for this MCP server
   */
  async getServerStats(
    userId: string,
    days: number = 30,
  ): Promise<{
    serverName: string;
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    toolStats: Array<{
      toolName: string;
      executions: number;
      successRate: number;
      avgTime: number;
    }>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: executions, error } = await this.supabaseClient
      .from('mcp_executions')
      .select('*')
      .eq('user_id', userId)
      .eq('mcp_name', this.serverInfo.name)
      .gte('created_at', since.toISOString());

    if (error || !executions) {
      throw new Error(`Failed to get server stats: ${error?.message}`);
    }

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(
      (e: any) => e.status === 'success',
    ).length;
    const successRate =
      totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
    const avgExecutionTime =
      totalExecutions > 0
        ? executions.reduce(
            (sum: number, e: any) => sum + (e.execution_time_ms || 0),
            0,
          ) / totalExecutions
        : 0;

    // Calculate per-tool statistics
    const toolStatsMap = executions.reduce(
      (acc: any, exec: any) => {
        const toolName = exec.tool_name;
        if (!acc[toolName]) {
          acc[toolName] = { total: 0, successful: 0, totalTime: 0 };
        }
        acc[toolName].total++;
        if (exec.status === 'success') acc[toolName].successful++;
        acc[toolName].totalTime += exec.execution_time_ms || 0;
        return acc;
      },
      {} as Record<
        string,
        { total: number; successful: number; totalTime: number }
      >,
    );

    const toolStats = Object.entries(toolStatsMap).map(([toolName, stats]) => ({
      toolName,
      executions: (stats as any).total,
      successRate: ((stats as any).successful / (stats as any).total) * 100,
      avgTime: (stats as any).totalTime / (stats as any).total,
    }));

    return {
      serverName: this.serverInfo.name,
      totalExecutions,
      successRate,
      avgExecutionTime,
      toolStats,
    };
  }

  /**
   * Get recent executions for debugging and monitoring
   */
  async getRecentExecutions(
    userId: string,
    limit: number = 50,
    toolName?: string,
  ): Promise<
    Array<{
      id: string;
      toolName: string;
      status: string;
      executionTime: number;
      createdAt: string;
      error?: string;
      hasFailure: boolean;
      hasFeedback: boolean;
    }>
  > {
    let query = this.supabaseClient
      .from('mcp_executions')
      .select(
        `
        id,
        tool_name,
        status,
        execution_time_ms,
        created_at,
        error_message,
        mcp_failures (id),
        mcp_feedback (id)
      `,
      )
      .eq('user_id', userId)
      .eq('mcp_name', this.serverInfo.name)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (toolName) {
      query = query.eq('tool_name', toolName);
    }

    const { data: executions, error } = await query;

    if (error) {
      throw new Error(`Failed to get recent executions: ${error.message}`);
    }

    return (executions || []).map((exec: any) => ({
      id: exec.id,
      toolName: exec.tool_name,
      status: exec.status,
      executionTime: exec.execution_time_ms || 0,
      createdAt: exec.created_at,
      error: exec.error_message || undefined,
      hasFailure:
        Array.isArray(exec.mcp_failures) && exec.mcp_failures.length > 0,
      hasFeedback:
        Array.isArray(exec.mcp_feedback) && exec.mcp_feedback.length > 0,
    }));
  }

  /**
   * Store feedback for an execution
   */
  async provideFeedback(
    feedbackToken: string,
    userId: string,
    feedback: {
      rating?: 'up' | 'down';
      ratingScore?: number;
      comment?: string;
      helpfulTags?: string[];
    },
  ): Promise<void> {
    return await this.executionTracker.storeFeedback(
      feedbackToken,
      userId,
      feedback,
    );
  }

  /**
   * Validate tool parameters against schema
   */
  protected validateParameters(
    toolName: string,
    parameters: any,
  ): { valid: boolean; errors: string[] } {
    const tool = this.serverInfo.tools.find((t) => t.name === toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool '${toolName}' not found`] };
    }

    // Basic validation - in a real implementation, you'd use a proper JSON schema validator
    const errors: string[] = [];
    const schema = tool.inputSchema;

    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in parameters)) {
          errors.push(`Missing required parameter: ${requiredField}`);
        }
      }
    }

    if (schema.properties) {
      for (const [fieldName, fieldSchema] of Object.entries(
        schema.properties,
      )) {
        if (fieldName in parameters) {
          const value = parameters[fieldName];
          const type = (fieldSchema as any).type;

          if (type) {
            // Handle JSON Schema types vs JavaScript types
            let isValidType = false;

            if (type === 'integer') {
              isValidType =
                typeof value === 'number' && Number.isInteger(value);
            } else if (type === 'number') {
              isValidType = typeof value === 'number';
            } else {
              isValidType = typeof value === type;
            }

            if (!isValidType) {
              errors.push(
                `Parameter '${fieldName}' should be of type ${type}, got ${typeof value}`,
              );
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Log performance metrics
   */
  protected async logPerformanceMetric(
    toolName: string,
    metricName: string,
    value: number,
    userId: string,
  ): Promise<void> {
    // This could be enhanced to store custom performance metrics
    console.log(
      `Performance Metric - ${this.serverInfo.name}:${toolName}:${metricName} = ${value} (user: ${userId})`,
    );
  }

  /**
   * Handle tool execution errors with context
   */
  protected handleToolError(
    error: any,
    toolName: string,
    parameters: any,
  ): Error {
    const contextualError = new Error(
      `${this.serverInfo.name}:${toolName} failed: ${error.message}`,
    );

    // Preserve original error properties
    (contextualError as any).originalError = error;
    (contextualError as any).toolName = toolName;
    (contextualError as any).parameters = parameters;
    (contextualError as any).serverName = this.serverInfo.name;

    return contextualError;
  }
}
