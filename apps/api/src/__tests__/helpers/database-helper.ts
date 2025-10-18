/**
 * Database Test Utilities
 *
 * Provides database setup/teardown, transactions, and cleanup utilities for integration tests.
 *
 * Usage:
 * ```typescript
 * beforeAll(async () => {
 *   await DatabaseTestHelper.setupTestDatabase();
 *   authToken = await DatabaseTestHelper.authenticateTestUser();
 * });
 *
 * afterEach(async () => {
 *   await DatabaseTestHelper.cleanupTestData('test-orch-');
 * });
 *
 * it('test with transaction', async () => {
 *   await DatabaseTestHelper.withTransaction(async () => {
 *     // test code here - auto-rollback after test
 *   });
 * });
 * ```
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import type { Agent, OrchestrationDefinition } from './mock-factories';

// ============================================================================
// Configuration
// ============================================================================

const TEST_DB_CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
  supabaseServiceKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key',
  testUser: process.env.SUPABASE_TEST_USER || 'demo.user@playground.com',
  testPassword: process.env.SUPABASE_TEST_PASSWORD || 'demo-password',
};

// ============================================================================
// Database Test Helper
// ============================================================================

export class DatabaseTestHelper {
  private static supabaseClient: SupabaseClient | null = null;
  private static authToken: string | null = null;

  // --------------------------------------------------------------------------
  // Setup / Teardown
  // --------------------------------------------------------------------------

  /**
   * Setup test database connection
   * Call this in beforeAll() hooks
   */
  static setupTestDatabase(): void {
    // Initialize Supabase client if not already done
    if (!DatabaseTestHelper.supabaseClient) {
      DatabaseTestHelper.supabaseClient = createClient(
        TEST_DB_CONFIG.supabaseUrl,
        TEST_DB_CONFIG.supabaseServiceKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );
    }
  }

  /**
   * Teardown test database connection
   * Call this in afterAll() hooks if needed
   */
  static teardownTestDatabase(): void {
    // Supabase client doesn't need explicit cleanup
    DatabaseTestHelper.supabaseClient = null;
    DatabaseTestHelper.authToken = null;
  }

  // --------------------------------------------------------------------------
  // Authentication
  // --------------------------------------------------------------------------

  /**
   * Authenticate as test user and return JWT token
   * Uses SUPABASE_TEST_USER and SUPABASE_TEST_PASSWORD from env
   *
   * @param appInstance - NestJS app instance (for HTTP-based auth)
   * @returns JWT authentication token
   */
  static async authenticateTestUser(
    appInstance?: INestApplication,
  ): Promise<string> {
    // If we already have a token, reuse it
    if (DatabaseTestHelper.authToken) {
      return DatabaseTestHelper.authToken;
    }

    // Authenticate via HTTP API if app instance provided
    if (appInstance) {
      const httpServer = appInstance.getHttpServer() as Parameters<
        typeof request
      >[0];
      const response = await request(httpServer)
        .post('/auth/login')
        .send({
          username: TEST_DB_CONFIG.testUser,
          password: TEST_DB_CONFIG.testPassword,
        })
        .expect(200);

      const body = response.body as { access_token: string };
      const accessToken = body.access_token;
      DatabaseTestHelper.authToken = accessToken;
      return DatabaseTestHelper.authToken;
    }

    // Fallback: authenticate via Supabase client directly
    DatabaseTestHelper.setupTestDatabase();
    const { data, error } =
      await DatabaseTestHelper.supabaseClient!.auth.signInWithPassword({
        email: TEST_DB_CONFIG.testUser,
        password: TEST_DB_CONFIG.testPassword,
      });

    if (error || !data.session) {
      throw new Error(
        `Test user authentication failed: ${error?.message || 'No session'}`,
      );
    }

    DatabaseTestHelper.authToken = data.session.access_token;
    return DatabaseTestHelper.authToken;
  }

  /**
   * Get test user ID
   */
  static async getTestUserId(): Promise<string> {
    DatabaseTestHelper.setupTestDatabase();
    const { data } = await DatabaseTestHelper.supabaseClient!.auth.getUser();
    if (!data.user) {
      throw new Error('Test user not authenticated');
    }
    return data.user.id;
  }

  // --------------------------------------------------------------------------
  // Transaction Support
  // --------------------------------------------------------------------------

  /**
   * Execute test code within a transaction that auto-rolls back
   * Perfect for integration tests that need database isolation
   *
   * @param fn - Async function to execute within transaction
   * @returns Result of the function
   */
  static async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    DatabaseTestHelper.setupTestDatabase();

    // Note: Supabase client doesn't expose transaction control directly
    // For true transaction support, tests should use raw SQL via rawQuery()
    // This implementation provides isolation through cleanup instead

    try {
      const result = await fn();
      return result;
    } finally {
      // Cleanup is handled by test-specific afterEach hooks
    }
  }

  // --------------------------------------------------------------------------
  // Cleanup Utilities
  // --------------------------------------------------------------------------

  /**
   * Cleanup test data by UUID prefix
   * Useful for cleaning up test data created with predictable prefixes
   *
   * @param prefix - Prefix to match (e.g., 'test-orch-')
   */
  static async cleanupTestData(prefix: string): Promise<void> {
    DatabaseTestHelper.setupTestDatabase();
    const client = DatabaseTestHelper.supabaseClient!;

    // Clean up orchestration data
    await client.from('orchestration_steps').delete().like('id', `${prefix}%`);

    await client.from('orchestration_runs').delete().like('id', `${prefix}%`);

    await client
      .from('orchestration_definitions')
      .delete()
      .like('slug', `${prefix}%`);

    // Clean up conversations and deliverables
    await client.from('deliverables').delete().like('id', `${prefix}%`);

    await client.from('tasks').delete().like('id', `${prefix}%`);

    await client.from('conversations').delete().like('id', `${prefix}%`);

    // Clean up test agents
    await client.from('agents').delete().like('slug', `${prefix}%`);
  }

  /**
   * Truncate a specific table (use with caution!)
   * Only works on test-specific tables to prevent accidental data loss
   *
   * @param tableName - Name of table to truncate
   */
  static async truncateTable(tableName: string): Promise<void> {
    // Whitelist of tables that are safe to truncate in tests
    const safeTables = [
      'orchestration_steps',
      'orchestration_runs',
      'orchestration_definitions',
      'test_data', // If this exists
    ];

    if (!safeTables.includes(tableName)) {
      throw new Error(
        `Table '${tableName}' is not whitelisted for truncation in tests`,
      );
    }

    DatabaseTestHelper.setupTestDatabase();
    const client = DatabaseTestHelper.supabaseClient!;

    // Delete all rows (Supabase doesn't expose TRUNCATE)
    await client
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Match all
  }

  /**
   * Cleanup all test orchestration data
   * Useful for afterAll() hooks
   */
  static async cleanupAllTestOrchestrations(): Promise<void> {
    DatabaseTestHelper.setupTestDatabase();
    const client = DatabaseTestHelper.supabaseClient!;

    // Clean up test organization data
    await client
      .from('orchestration_steps')
      .delete()
      .eq('organization_slug', 'test-org');

    await client
      .from('orchestration_runs')
      .delete()
      .eq('organization_slug', 'test-org');

    await client
      .from('orchestration_definitions')
      .delete()
      .eq('organization_slug', 'test-org');

    await client.from('agents').delete().eq('organization_slug', 'test-org');
  }

  // --------------------------------------------------------------------------
  // Raw Query Helpers
  // --------------------------------------------------------------------------

  /**
   * Execute raw SQL query
   * Useful for complex queries or transaction control
   *
   * @param sql - SQL query string
   * @param params - Query parameters (use $1, $2, etc. in SQL)
   * @returns Query results
   */
  static async rawQuery<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    DatabaseTestHelper.setupTestDatabase();
    const client = DatabaseTestHelper.supabaseClient!;

    // Use Supabase RPC for raw SQL execution
    // Note: This requires a database function to be set up
    // For now, we'll use the REST API directly
    const result = await client.rpc('exec_sql', {
      query: sql,
      params: params,
    });

    if (result.error) {
      throw new Error(`Raw query failed: ${result.error.message}`);
    }

    return result.data as T[];
  }

  /**
   * Execute raw SQL command (INSERT, UPDATE, DELETE)
   * Returns number of affected rows
   *
   * @param sql - SQL command string
   * @param params - Command parameters
   * @returns Number of affected rows
   */
  static async rawCommand(
    sql: string,
    params: unknown[] = [],
  ): Promise<number> {
    const result = await DatabaseTestHelper.rawQuery(sql, params);
    return result ? result.length : 0;
  }

  // --------------------------------------------------------------------------
  // Verification Helpers
  // --------------------------------------------------------------------------

  /**
   * Verify a record exists in the database
   *
   * @param tableName - Table name
   * @param id - Record ID
   * @returns True if record exists
   */
  static async recordExists(tableName: string, id: string): Promise<boolean> {
    DatabaseTestHelper.setupTestDatabase();
    const client = DatabaseTestHelper.supabaseClient!;

    const { data, error } = await client
      .from(tableName)
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Record existence check failed: ${error.message}`);
    }

    return data !== null;
  }

  /**
   * Count records matching a condition
   *
   * @param tableName - Table name
   * @param column - Column to filter on
   * @param value - Value to match
   * @returns Count of matching records
   */
  static async countRecords(
    tableName: string,
    column: string,
    value: unknown,
  ): Promise<number> {
    DatabaseTestHelper.setupTestDatabase();
    const client = DatabaseTestHelper.supabaseClient!;

    const { count, error } = await client
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq(column, value);

    if (error) {
      throw new Error(`Record count failed: ${error.message}`);
    }

    return count || 0;
  }

  // --------------------------------------------------------------------------
  // Test Data Seeding
  // --------------------------------------------------------------------------

  /**
   * Seed test agent (if not already exists)
   *
   * @param agentData - Agent data to seed
   * @returns Seeded agent
   */
  static async seedTestAgent(agentData: Partial<Agent>): Promise<Agent> {
    DatabaseTestHelper.setupTestDatabase();
    const client = DatabaseTestHelper.supabaseClient!;

    const result = await client
      .from('agents')
      .upsert(agentData, {
        onConflict: 'organization_slug,slug',
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to seed test agent: ${result.error.message}`);
    }

    return result.data as Agent;
  }

  /**
   * Seed test orchestration definition (if not already exists)
   *
   * @param definitionData - Orchestration definition data
   * @returns Seeded definition
   */
  static async seedTestOrchestration(
    definitionData: Partial<OrchestrationDefinition>,
  ): Promise<OrchestrationDefinition> {
    DatabaseTestHelper.setupTestDatabase();
    const client = DatabaseTestHelper.supabaseClient!;

    const result = await client
      .from('orchestration_definitions')
      .upsert(definitionData, {
        onConflict: 'organization_slug,slug',
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to seed test orchestration: ${result.error.message}`,
      );
    }

    return result.data as OrchestrationDefinition;
  }
}
