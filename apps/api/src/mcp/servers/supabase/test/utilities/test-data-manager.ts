/**
 * Test Data Manager for Supabase MCP Testing
 *
 * Manages test data lifecycle using existing production database schema.
 * Provides utilities for creating, managing, and cleaning up test data.
 */

import { SupabaseClient } from '@supabase/supabase-js';
// import { Database } from '../../../../../types/database.types';
type Database = any; // Fallback type for testing

export interface TestUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface TestAgent {
  id: string;
  name: string;
  type: string;
  user_id: string;
  capabilities: any;
  created_at: string;
  is_enabled: boolean;
}

export interface TestConversation {
  id: string;
  agent_name: string;
  agent_type: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  last_active_at: string;
  metadata: any;
}

export interface TestMCPExecution {
  id: string;
  mcp_name: string;
  tool_name: string;
  user_id: string;
  agent_conversation_id?: string;
  session_id?: string;
  request_data: any;
  response_data: any;
  llm_provider?: string;
  llm_model?: string;
  execution_time_ms?: number;
  status: string;
  error_message?: string;
  feedback_token: string;
  retry_count: number;
  context_used: boolean;
  created_at: string;
  updated_at: string;
}

export class TestDataManager {
  private supabase: SupabaseClient<Database>;
  private createdRecords: {
    users: string[];
    sessions: string[];
    messages: string[];
    agent_conversations: string[];
    tasks: string[];
    mcp_executions: string[];
    mcp_failures: string[];
    mcp_feedback: string[];
  } = {
    users: [],
    sessions: [],
    messages: [],
    agent_conversations: [],
    tasks: [],
    mcp_executions: [],
    mcp_failures: [],
    mcp_feedback: [],
  };

  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  /**
   * Create a test user with realistic data
   */
  async createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const userData = {
      email: `test-user-${Date.now()}@example.com`,
      display_name: `Test User ${Date.now()}`,
      ...overrides,
    };

    const { data, error } = await this.supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create test user: ${error.message}`);

    this.createdRecords.users.push(data.id);
    return data as TestUser;
  }

  /**
   * Create a test session for a user
   */
  async createTestSession(userId: string, name?: string) {
    const sessionData = {
      user_id: userId,
      name: name || `Test Session ${Date.now()}`,
    };

    const { data, error } = await this.supabase
      .from('sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to create test session: ${error.message}`);

    this.createdRecords.sessions.push(data.id);
    return data;
  }

  /**
   * Create a test agent conversation
   */
  async createTestAgentConversation(
    userId: string,
    overrides: Partial<TestConversation> = {},
  ): Promise<TestConversation> {
    const conversationData = {
      user_id: userId,
      agent_name: 'test-agent',
      agent_type: 'specialist',
      metadata: {},
      ...overrides,
    };

    const { data, error } = await this.supabase
      .from('agent_conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to create test conversation: ${error.message}`);

    this.createdRecords.agent_conversations.push(data.id);
    return data as TestConversation;
  }

  /**
   * Create a test MCP execution record
   */
  async createTestMCPExecution(
    userId: string,
    overrides: Partial<TestMCPExecution> = {},
  ): Promise<TestMCPExecution> {
    const executionData = {
      mcp_name: 'supabase',
      tool_name: 'generate-sql',
      user_id: userId,
      request_data: { prompt: 'Test SQL query' },
      response_data: { sql: 'SELECT * FROM users;' },
      llm_provider: 'anthropic',
      llm_model: 'claude-3-5-sonnet',
      execution_time_ms: 1500,
      status: 'success',
      retry_count: 0,
      context_used: false,
      ...overrides,
    };

    const { data, error } = await this.supabase
      .from('mcp_executions')
      .insert(executionData)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to create test MCP execution: ${error.message}`);

    this.createdRecords.mcp_executions.push(data.id);
    return data as TestMCPExecution;
  }

  /**
   * Create a test MCP failure record
   */
  async createTestMCPFailure(executionId: string, overrides: any = {}) {
    const failureData = {
      execution_id: executionId,
      error_type: 'sql_syntax_error',
      error_code: 'SYNTAX_ERROR',
      error_details: { message: 'Invalid SQL syntax' },
      retry_attempt: 1,
      sql_attempted: 'SELECT * FORM users;', // Intentional typo
      context_before_failure: {},
      resolved: false,
      ...overrides,
    };

    const { data, error } = await this.supabase
      .from('mcp_failures')
      .insert(failureData)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to create test MCP failure: ${error.message}`);

    this.createdRecords.mcp_failures.push(data.id);
    return data;
  }

  /**
   * Create a test MCP feedback record
   */
  async createTestMCPFeedback(
    executionId: string,
    userId: string,
    feedbackToken: string,
    overrides: any = {},
  ) {
    const feedbackData = {
      feedback_token: feedbackToken,
      execution_id: executionId,
      user_id: userId,
      rating: 'up',
      rating_score: 4,
      comment: 'Great SQL generation!',
      helpful_tags: ['accurate', 'fast'],
      ...overrides,
    };

    const { data, error } = await this.supabase
      .from('mcp_feedback')
      .insert(feedbackData)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to create test MCP feedback: ${error.message}`);

    this.createdRecords.mcp_feedback.push(data.id);
    return data;
  }

  /**
   * Create a complete test scenario with user, conversation, and MCP execution
   */
  async createTestScenario(): Promise<{
    user: TestUser;
    conversation: TestConversation;
    execution: TestMCPExecution;
  }> {
    const user = await this.createTestUser();
    const conversation = await this.createTestAgentConversation(user.id);
    const execution = await this.createTestMCPExecution(user.id, {
      agent_conversation_id: conversation.id,
    });

    return { user, conversation, execution };
  }

  /**
   * Create multiple test executions for performance testing
   */
  async createBulkTestExecutions(
    userId: string,
    count: number,
  ): Promise<TestMCPExecution[]> {
    const executions: TestMCPExecution[] = [];

    for (let i = 0; i < count; i++) {
      const execution = await this.createTestMCPExecution(userId, {
        tool_name: i % 2 === 0 ? 'generate-sql' : 'execute-sql',
        execution_time_ms: Math.floor(Math.random() * 5000) + 500,
        status: i % 10 === 0 ? 'error' : 'success', // 10% error rate
      });
      executions.push(execution);
    }

    return executions;
  }

  /**
   * Get test data for SQL generation complexity tests
   */
  getTestPrompts() {
    return {
      easy: [
        'Get all users',
        'Find users created today',
        'Show active agent conversations',
        'Count total users',
        'Get user by email test@example.com',
        'List all agent types',
        'Find users with Gmail addresses',
        'Show recent conversations',
        'Get agent conversations created this week',
        'Count active conversations',
      ],
      mid: [
        'Show users with their conversation counts',
        'Find conversations between two specific dates with user details',
        'Get average execution time by MCP tool',
        'Show users who have never had conversations',
        'Find agents with more than 10 conversations',
        'Get monthly user registration trends',
        'Show top 5 most active users by conversation count',
        'Find users with conversations but no completed tasks',
        'Get conversations grouped by agent type with success rates',
        'Show daily MCP usage statistics',
      ],
      advanced: [
        'Show running total of user registrations by month with percentage change',
        'Find users whose conversation patterns are similar using window functions',
        'Get complex cohort analysis of user retention by agent type',
        'Show agent conversations with execution time percentiles and outlier detection',
        'Find conversation threads with nested task relationships',
        'Generate time-series analysis of MCP tool adoption rates',
        'Show advanced user segmentation based on usage patterns',
        'Find anomalous execution patterns using statistical functions',
        'Generate pivot table of agent performance metrics',
        'Show complex funnel analysis from registration to conversation completion',
      ],
    };
  }

  /**
   * Setup test context content for context learning tests
   */
  getTestContextContent(): string {
    return `
# Supabase SQL Context for Testing

## Database Schema Notes
- Users table uses \`created_at\` and \`updated_at\` (NOT created_date/updated_date)
- Agent conversations link to users via \`user_id\`
- Tasks table references \`agent_conversation_id\`
- MCP executions track both \`agent_conversation_id\` and \`session_id\` (both nullable)

## Successful Query Patterns
### User Analytics Queries
- For "active users", check if conversations exist: \`WHERE EXISTS (SELECT 1 FROM agent_conversations WHERE user_id = users.id)\`
- For "recent", use: \`WHERE created_at >= NOW() - INTERVAL '7 days'\`
- For "this week", use: \`WHERE created_at >= DATE_TRUNC('week', NOW())\`
- For "this month", use: \`WHERE created_at >= DATE_TRUNC('month', NOW())\`

### Agent Conversation Queries
- Always join with users for user details: \`LEFT JOIN users ON agent_conversations.user_id = users.id\`
- For active conversations: \`WHERE ended_at IS NULL\`
- For conversation counts: \`COUNT(agent_conversations.id)\`

### MCP Analytics Queries
- For execution success rates: \`COUNT(*) FILTER (WHERE status = 'success')\`
- For average execution time: \`AVG(execution_time_ms)\`
- Group by tool for tool-specific metrics: \`GROUP BY mcp_name, tool_name\`

## Common Error Patterns & Fixes
### Column Name Issues
**Error**: Using "created_date" or "updated_date"
**Fix**: Always use "created_at" and "updated_at"

**Error**: Using "agent_id" in conversations table  
**Fix**: The table structure doesn't have agent_id, use agent_name and agent_type

### Join Pattern Issues
**Error**: Direct joins without considering nullable relationships
**Fix**: Use LEFT JOINs for nullable foreign keys like agent_conversation_id and session_id

### Aggregation Issues  
**Error**: Missing GROUP BY when using aggregate functions
**Fix**: Always include non-aggregated columns in GROUP BY clause

## Advanced SQL Patterns
### Window Functions
- For ranking: \`ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC)\`
- For running totals: \`SUM(count) OVER (ORDER BY date_column ROWS UNBOUNDED PRECEDING)\`

### Common Table Expressions (CTEs)
- Use for complex multi-step queries
- Helpful for user cohort analysis and funnel metrics
- Example: \`WITH user_stats AS (SELECT user_id, COUNT(*) as conversation_count FROM agent_conversations GROUP BY user_id)\`
`;
  }

  /**
   * Clean up all test data created during testing
   */
  async cleanup(): Promise<void> {
    try {
      // Delete in reverse dependency order
      if (this.createdRecords.mcp_feedback.length > 0) {
        await this.supabase
          .from('mcp_feedback')
          .delete()
          .in('id', this.createdRecords.mcp_feedback);
      }

      if (this.createdRecords.mcp_failures.length > 0) {
        await this.supabase
          .from('mcp_failures')
          .delete()
          .in('id', this.createdRecords.mcp_failures);
      }

      if (this.createdRecords.mcp_executions.length > 0) {
        await this.supabase
          .from('mcp_executions')
          .delete()
          .in('id', this.createdRecords.mcp_executions);
      }

      if (this.createdRecords.tasks.length > 0) {
        await this.supabase
          .from('tasks')
          .delete()
          .in('id', this.createdRecords.tasks);
      }

      if (this.createdRecords.agent_conversations.length > 0) {
        await this.supabase
          .from('agent_conversations')
          .delete()
          .in('id', this.createdRecords.agent_conversations);
      }

      if (this.createdRecords.messages.length > 0) {
        await this.supabase
          .from('messages')
          .delete()
          .in('id', this.createdRecords.messages);
      }

      if (this.createdRecords.sessions.length > 0) {
        await this.supabase
          .from('sessions')
          .delete()
          .in('id', this.createdRecords.sessions);
      }

      if (this.createdRecords.users.length > 0) {
        await this.supabase
          .from('users')
          .delete()
          .in('id', this.createdRecords.users);
      }

      // Reset tracking
      Object.keys(this.createdRecords).forEach((key) => {
        this.createdRecords[key as keyof typeof this.createdRecords] = [];
      });
    } catch (error) {
      console.error('Error during test cleanup:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics for test analysis
   */
  async getTestMetrics(): Promise<{
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    toolBreakdown: Array<{
      tool_name: string;
      count: number;
      success_rate: number;
      avg_time: number;
    }>;
  }> {
    const { data: executions } = await this.supabase
      .from('mcp_executions')
      .select('*')
      .in('id', this.createdRecords.mcp_executions);

    if (!executions || executions.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        avgExecutionTime: 0,
        toolBreakdown: [],
      };
    }

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(
      (e) => e.status === 'success',
    ).length;
    const successRate = (successfulExecutions / totalExecutions) * 100;
    const avgExecutionTime =
      executions.reduce((sum, e) => sum + (e.execution_time_ms || 0), 0) /
      totalExecutions;

    // Tool breakdown
    const toolStats = executions.reduce(
      (acc, exec) => {
        const key = exec.tool_name;
        if (!acc[key]) {
          acc[key] = { total: 0, successful: 0, totalTime: 0 };
        }
        acc[key].total++;
        if (exec.status === 'success') acc[key].successful++;
        acc[key].totalTime += exec.execution_time_ms || 0;
        return acc;
      },
      {} as Record<
        string,
        { total: number; successful: number; totalTime: number }
      >,
    );

    const toolBreakdown = Object.entries(toolStats).map(
      ([tool_name, stats]) => ({
        tool_name,
        count: (stats as any).total,
        success_rate: ((stats as any).successful / (stats as any).total) * 100,
        avg_time: (stats as any).totalTime / (stats as any).total,
      }),
    );

    return {
      totalExecutions,
      successRate,
      avgExecutionTime,
      toolBreakdown,
    };
  }
}
