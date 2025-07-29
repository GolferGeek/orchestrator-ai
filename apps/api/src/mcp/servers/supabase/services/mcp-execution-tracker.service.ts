/**
 * MCP Execution Tracker Service
 *
 * Handles comprehensive tracking of MCP tool executions with database logging,
 * performance metrics, error handling, and feedback token generation.
 */

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../../supabase/supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export interface MCPExecutionContext {
  mcpName: string;
  toolName: string;
  userId: string;
  agentConversationId?: string;
  sessionId?: string;
  requestData: any;
  llmProvider?: string;
  llmModel?: string;
  contextUsed?: boolean;
}

export interface MCPExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionId: string;
  feedbackToken: string;
  executionTime: number;
  retryCount: number;
}

export interface MCPFailureDetails {
  errorType: string;
  errorCode?: string;
  errorDetails: any;
  retryAttempt: number;
  sqlAttempted?: string;
  contextBeforeFailure?: any;
}

@Injectable()
export class MCPExecutionTrackerService {
  private supabaseClient: SupabaseClient | null = null;

  constructor(private readonly supabaseService?: SupabaseService) {}

  /**
   * Set a Supabase client directly for database operations
   */
  setSupabaseClient(client: SupabaseClient): void {
    this.supabaseClient = client;
  }

  /**
   * Get the working Supabase client (either direct client or from service)
   */
  private getSupabaseClient(): SupabaseClient {
    if (this.supabaseClient) {
      return this.supabaseClient;
    }

    if (this.supabaseService) {
      try {
        return this.supabaseService.getServiceClient();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.warn(
          'SupabaseService.getServiceClient() failed, trying anon client:',
          errorMessage,
        );
        try {
          return this.supabaseService.getAnonClient();
        } catch (anonError) {
          const anonErrorMessage =
            anonError instanceof Error ? anonError.message : 'Unknown error';
          console.error(
            'Both service and anon clients failed:',
            anonErrorMessage,
          );
          throw new Error(`Supabase clients unavailable: ${errorMessage}`);
        }
      }
    }

    throw new Error('No Supabase client available for MCP execution tracking');
  }

  /**
   * Execute an MCP tool with comprehensive tracking
   */
  async executeWithTracking<T = any>(
    context: MCPExecutionContext,
    executionFunction: () => Promise<T>,
  ): Promise<MCPExecutionResult> {
    const startTime = Date.now();
    const executionId = uuidv4();
    const feedbackToken = uuidv4();
    const retryCount = 0;

    try {
      // Create initial execution record
      await this.createExecutionRecord(
        executionId,
        feedbackToken,
        context,
        'pending',
      );

      // Execute the actual MCP tool function
      const result = await executionFunction();
      const executionTime = Date.now() - startTime;

      // Update execution record with success
      await this.updateExecutionRecord(executionId, {
        status: 'success',
        response_data: result,
        execution_time_ms: executionTime,
      });

      return {
        success: true,
        data: result,
        executionId,
        feedbackToken,
        executionTime,
        retryCount,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update execution record with error
      await this.updateExecutionRecord(executionId, {
        status: 'error',
        error_message: errorMessage,
        execution_time_ms: executionTime,
      });

      // Log detailed failure information
      await this.logFailure(executionId, {
        errorType: this.categorizeError(error),
        errorCode: this.extractErrorCode(error),
        errorDetails: this.serializeError(error),
        retryAttempt: retryCount + 1,
        sqlAttempted: this.extractSQLFromError(error),
        contextBeforeFailure: context,
      });

      return {
        success: false,
        error: errorMessage,
        executionId,
        feedbackToken,
        executionTime,
        retryCount,
      };
    }
  }

  /**
   * Execute with automatic retry logic
   */
  async executeWithRetry<T = any>(
    context: MCPExecutionContext,
    executionFunction: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000,
  ): Promise<MCPExecutionResult> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeWithTracking(
          {
            ...context,
            requestData: { ...context.requestData, retry_attempt: attempt },
          },
          executionFunction,
        );

        // Update retry count in the result
        result.retryCount = attempt;

        if (result.success) {
          return result;
        }

        lastError = result.error;

        // Don't retry if it's the last attempt
        if (attempt < maxRetries) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await this.delay(retryDelay * Math.pow(2, attempt));
        }
      }
    }

    // All retries failed, return the last error
    return {
      success: false,
      error:
        lastError instanceof Error
          ? lastError.message
          : lastError || 'Max retries exceeded',
      executionId: uuidv4(), // Generate ID for failed execution
      feedbackToken: uuidv4(),
      executionTime: 0,
      retryCount: maxRetries,
    };
  }

  /**
   * Create initial execution record in database
   */
  private async createExecutionRecord(
    executionId: string,
    feedbackToken: string,
    context: MCPExecutionContext,
    status: string,
  ): Promise<void> {
    const { error } = await this.getSupabaseClient()
      .from('mcp_executions')
      .insert({
        id: executionId,
        mcp_name: context.mcpName,
        tool_name: context.toolName,
        user_id: context.userId,
        agent_conversation_id: context.agentConversationId || null,
        session_id: context.sessionId || null,
        request_data: context.requestData,
        response_data: {},
        llm_provider: context.llmProvider || null,
        llm_model: context.llmModel || null,
        execution_time_ms: null,
        status: status,
        error_message: null,
        feedback_token: feedbackToken,
        retry_count: 0,
        context_used: context.contextUsed || false,
      });

    if (error) {
      console.error('Failed to create MCP execution record:', error);
      throw new Error(`Failed to create execution record: ${error.message}`);
    }
  }

  /**
   * Update execution record with results
   */
  private async updateExecutionRecord(
    executionId: string,
    updates: {
      status?: string;
      response_data?: any;
      execution_time_ms?: number;
      error_message?: string;
      retry_count?: number;
    },
  ): Promise<void> {
    const { error } = await this.getSupabaseClient()
      .from('mcp_executions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', executionId);

    if (error) {
      console.error('Failed to update MCP execution record:', error);
      // Don't throw here to avoid masking the original error
    }
  }

  /**
   * Log detailed failure information
   */
  private async logFailure(
    executionId: string,
    failure: MCPFailureDetails,
  ): Promise<void> {
    const { error } = await this.getSupabaseClient()
      .from('mcp_failures')
      .insert({
        execution_id: executionId,
        error_type: failure.errorType,
        error_code: failure.errorCode || null,
        error_details: failure.errorDetails,
        retry_attempt: failure.retryAttempt,
        sql_attempted: failure.sqlAttempted || null,
        context_before_failure: failure.contextBeforeFailure || {},
        resolved: false,
      });

    if (error) {
      console.error('Failed to log MCP failure:', error);
    }
  }

  /**
   * Get execution statistics for a user
   */
  async getExecutionStats(
    userId: string,
    days: number = 30,
  ): Promise<{
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    topTools: Array<{ tool_name: string; count: number; success_rate: number }>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: executions, error } = await this.getSupabaseClient()
      .from('mcp_executions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString());

    if (error || !executions) {
      throw new Error(`Failed to get execution stats: ${error?.message}`);
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

    // Calculate top tools
    const toolStats = executions.reduce(
      (acc: any, exec: any) => {
        const key = exec.tool_name;
        if (!acc[key]) {
          acc[key] = { total: 0, successful: 0 };
        }
        acc[key].total++;
        if (exec.status === 'success') acc[key].successful++;
        return acc;
      },
      {} as Record<string, { total: number; successful: number }>,
    );

    const topTools = Object.entries(toolStats)
      .map(([tool_name, stats]) => ({
        tool_name,
        count: (stats as any).total,
        success_rate: ((stats as any).successful / (stats as any).total) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalExecutions,
      successRate,
      avgExecutionTime,
      topTools,
    };
  }

  /**
   * Store user feedback for an execution
   */
  async storeFeedback(
    feedbackToken: string,
    userId: string,
    feedback: {
      rating?: 'up' | 'down';
      ratingScore?: number;
      comment?: string;
      helpfulTags?: string[];
    },
  ): Promise<void> {
    // First, get the execution ID from the feedback token
    const { data: execution, error: executionError } =
      await this.getSupabaseClient()
        .from('mcp_executions')
        .select('id')
        .eq('feedback_token', feedbackToken)
        .eq('user_id', userId)
        .single();

    if (executionError || !execution) {
      throw new Error('Invalid feedback token or unauthorized');
    }

    // Store the feedback
    const { error } = await this.getSupabaseClient()
      .from('mcp_feedback')
      .insert({
        feedback_token: feedbackToken,
        execution_id: execution.id,
        user_id: userId,
        rating: feedback.rating || null,
        rating_score: feedback.ratingScore || null,
        comment: feedback.comment || null,
        helpful_tags: feedback.helpfulTags || [],
      });

    if (error) {
      throw new Error(`Failed to store feedback: ${error.message}`);
    }
  }

  // Helper methods for error categorization
  private categorizeError(error: any): string {
    if (error?.message?.includes('syntax')) return 'sql_syntax_error';
    if (error?.message?.includes('permission')) return 'permission_error';
    if (error?.message?.includes('timeout')) return 'timeout_error';
    if (error?.message?.includes('connection'))
      return 'database_connection_error';
    if (error?.message?.includes('LLM') || error?.message?.includes('model'))
      return 'llm_error';
    return 'unknown_error';
  }

  private extractErrorCode(error: any): string | undefined {
    return error?.code || error?.status || undefined;
  }

  private serializeError(error: any): any {
    return {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause,
      ...(error?.details && { details: error.details }),
    };
  }

  private extractSQLFromError(error: any): string | undefined {
    // Try to extract SQL from error message or context
    if (error?.sql) return error.sql;
    if (error?.query) return error.query;

    // Pattern match SQL from error messages
    const sqlMatch = error?.message?.match(/SQL:?\s*(.+?)(?:\n|$)/);
    return sqlMatch?.[1];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
