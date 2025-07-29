/**
 * Test Setup Utilities for Supabase MCP Testing
 *
 * Provides test environment setup, configuration, and shared utilities
 * for all Supabase MCP test suites.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TestDataManager } from './test-data-manager';
import { SQLValidator } from './sql-validator';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TestEnvironment {
  supabase: SupabaseClient;
  testDataManager: TestDataManager;
  sqlValidator: SQLValidator;
}

export interface TestConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  contextFilePath?: string;
  cleanupAfterTests?: boolean;
}

export class TestSetup {
  private static instance: TestSetup;
  private environment: TestEnvironment | null = null;
  private config: TestConfig;

  private constructor(config: TestConfig = {}) {
    this.config = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl,
      supabaseKey:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || config.supabaseKey,
      contextFilePath:
        config.contextFilePath ||
        path.join(__dirname, '../context/supabase-sql-context.md'),
      cleanupAfterTests: config.cleanupAfterTests ?? true,
    };
  }

  static getInstance(config: TestConfig = {}): TestSetup {
    if (!TestSetup.instance) {
      TestSetup.instance = new TestSetup(config);
    }
    return TestSetup.instance;
  }

  /**
   * Initialize test environment
   */
  async initializeTestEnvironment(): Promise<TestEnvironment> {
    if (this.environment) {
      return this.environment;
    }

    if (!this.config.supabaseUrl || !this.config.supabaseKey) {
      throw new Error(
        'Supabase URL and key must be provided in environment variables or config',
      );
    }

    const supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseKey,
    );
    const testDataManager = new TestDataManager(supabase);
    const sqlValidator = new SQLValidator(supabase);

    this.environment = {
      supabase,
      testDataManager,
      sqlValidator,
    };

    return this.environment;
  }

  /**
   * Setup test context file for context learning tests
   */
  async setupTestContext(content?: string): Promise<void> {
    if (!this.config.contextFilePath) {
      throw new Error('Context file path not configured');
    }

    const contextContent = content || this.getDefaultContextContent();

    // Ensure directory exists
    const dir = path.dirname(this.config.contextFilePath);
    await fs.mkdir(dir, { recursive: true });

    // Write context file
    await fs.writeFile(this.config.contextFilePath, contextContent, 'utf-8');
  }

  /**
   * Clean up test context file
   */
  async cleanupTestContext(): Promise<void> {
    if (!this.config.contextFilePath) return;

    try {
      await fs.unlink(this.config.contextFilePath);
    } catch (error) {
      // File might not exist, which is fine
      if ((error as any).code !== 'ENOENT') {
        console.warn('Failed to cleanup test context file:', error);
      }
    }
  }

  /**
   * Get test environment (initialize if needed)
   */
  async getTestEnvironment(): Promise<TestEnvironment> {
    if (!this.environment) {
      return await this.initializeTestEnvironment();
    }
    return this.environment;
  }

  /**
   * Cleanup all test resources
   */
  async cleanup(): Promise<void> {
    if (this.config.cleanupAfterTests && this.environment) {
      await this.environment.testDataManager.cleanup();
      await this.cleanupTestContext();
    }
  }

  /**
   * Get default context content for testing
   */
  private getDefaultContextContent(): string {
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
   * Create a test user for authentication (if needed)
   */
  async createTestUser(): Promise<{ user: any; session: any }> {
    if (!this.environment) {
      throw new Error('Test environment not initialized');
    }

    // For testing, we'll create a regular user record
    // In a real scenario, you might want to create an actual auth user
    const testUser = await this.environment.testDataManager.createTestUser({
      email: `test-${Date.now()}@example.com`,
      display_name: `Test User ${Date.now()}`,
    });

    return {
      user: testUser,
      session: null, // No auth session for basic testing
    };
  }

  /**
   * Validate test database connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      if (!this.environment) {
        await this.initializeTestEnvironment();
      }

      const { data, error } = await this.environment!.supabase.from('users')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Database connection validation failed:', error);
      return false;
    }
  }

  /**
   * Run database migration check
   */
  async checkMigrations(): Promise<{
    hasMCPTables: boolean;
    missingTables: string[];
  }> {
    if (!this.environment) {
      await this.initializeTestEnvironment();
    }

    const requiredTables = ['mcp_executions', 'mcp_failures', 'mcp_feedback'];
    const missingTables: string[] = [];

    for (const table of requiredTables) {
      try {
        const { error } = await this.environment!.supabase.from(table as any)
          .select('id')
          .limit(0);

        if (error) {
          missingTables.push(table);
        }
      } catch (e) {
        missingTables.push(table);
      }
    }

    return {
      hasMCPTables: missingTables.length === 0,
      missingTables,
    };
  }

  /**
   * Get configuration for jest setup
   */
  getJestConfig() {
    return {
      setupFilesAfterEnv: [path.join(__dirname, 'jest-setup.ts')],
      testEnvironment: 'node',
      testTimeout: 30000, // 30 second timeout for database operations
      globalTeardown: path.join(__dirname, 'jest-teardown.ts'),
    };
  }
}

// Export singleton instance getter
export const getTestSetup = (config?: TestConfig) =>
  TestSetup.getInstance(config);

// Export commonly used test utilities
export * from './test-data-manager';
export * from './sql-validator';
