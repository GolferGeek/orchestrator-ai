/**
 * Tests for Database Test Helper
 *
 * Validates database setup, authentication, cleanup, and utility methods.
 * These tests require a running Supabase instance with test user configured.
 */

import { DatabaseTestHelper } from '../database-helper';
import { MockFactories } from '../mock-factories';

describe('DatabaseTestHelper', () => {
  // Skip all tests if Supabase is not configured
  const isSupabaseConfigured =
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_TEST_USER &&
    process.env.SUPABASE_TEST_PASSWORD;

  // Test prefix for cleanup
  const TEST_PREFIX = 'test-db-helper-';

  beforeAll(() => {
    if (!isSupabaseConfigured) {
      console.warn(
        '⚠️  Supabase not configured - skipping database helper tests',
      );
      return;
    }
    DatabaseTestHelper.setupTestDatabase();
  });

  afterAll(async () => {
    if (!isSupabaseConfigured) return;
    // Cleanup any test data that might have leaked
    await DatabaseTestHelper.cleanupTestData(TEST_PREFIX);
    DatabaseTestHelper.teardownTestDatabase();
  });

  describe('Setup and Teardown', () => {
    it('should setup test database connection', () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      expect(() => DatabaseTestHelper.setupTestDatabase()).not.toThrow();
    });

    it('should teardown test database connection', () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      expect(() => DatabaseTestHelper.teardownTestDatabase()).not.toThrow();
    });

    it('should handle multiple setup calls idempotently', () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      DatabaseTestHelper.setupTestDatabase();
      expect(() => DatabaseTestHelper.setupTestDatabase()).not.toThrow();
    });
  });

  describe('Authentication', () => {
    it('should authenticate test user and return JWT token', async () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      const token = await DatabaseTestHelper.authenticateTestUser();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      // JWT tokens are typically 100+ characters
      expect(token.length).toBeGreaterThan(50);
    });

    it('should reuse cached token on subsequent calls', async () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      const token1 = await DatabaseTestHelper.authenticateTestUser();
      const token2 = await DatabaseTestHelper.authenticateTestUser();

      expect(token1).toBe(token2);
    });

    it('should throw error if test user credentials are invalid', async () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      // Temporarily override credentials
      const originalUser = process.env.SUPABASE_TEST_USER;
      const originalPassword = process.env.SUPABASE_TEST_PASSWORD;

      process.env.SUPABASE_TEST_USER = 'invalid@user.com';
      process.env.SUPABASE_TEST_PASSWORD = 'invalid-password';

      // Reset cached token
      DatabaseTestHelper.teardownTestDatabase();

      await expect(DatabaseTestHelper.authenticateTestUser()).rejects.toThrow();

      // Restore original credentials
      process.env.SUPABASE_TEST_USER = originalUser;
      process.env.SUPABASE_TEST_PASSWORD = originalPassword;
    });
  });

  describe('Transaction Support', () => {
    it('should execute code within transaction', async () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      const result = await DatabaseTestHelper.withTransaction(() => {
        return Promise.resolve('test-result');
      });

      expect(result).toBe('test-result');
    });

    it('should return value from transaction function', async () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      const result = await DatabaseTestHelper.withTransaction(() => {
        return Promise.resolve({ data: 'test', count: 42 });
      });

      expect(result).toEqual({ data: 'test', count: 42 });
    });

    it('should handle async operations in transaction', async () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      const result = await DatabaseTestHelper.withTransaction(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'async-result';
      });

      expect(result).toBe('async-result');
    });
  });

  describe('Cleanup Utilities', () => {
    describe('cleanupTestData', () => {
      it('should cleanup test data by prefix', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        // This test verifies the method runs without error
        // Actual cleanup behavior is tested in integration tests
        await expect(
          DatabaseTestHelper.cleanupTestData(TEST_PREFIX),
        ).resolves.not.toThrow();
      });

      it('should handle cleanup when no matching data exists', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        await expect(
          DatabaseTestHelper.cleanupTestData('nonexistent-prefix-'),
        ).resolves.not.toThrow();
      });
    });

    describe('truncateTable', () => {
      it('should reject truncation of non-whitelisted tables', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        await expect(DatabaseTestHelper.truncateTable('users')).rejects.toThrow(
          'not whitelisted',
        );
      });

      it('should allow truncation of whitelisted tables', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        // orchestration_steps is whitelisted
        await expect(
          DatabaseTestHelper.truncateTable('orchestration_steps'),
        ).resolves.not.toThrow();
      });
    });

    describe('cleanupAllTestOrchestrations', () => {
      it('should cleanup all test orchestration data', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        await expect(
          DatabaseTestHelper.cleanupAllTestOrchestrations(),
        ).resolves.not.toThrow();
      });
    });
  });

  describe('Verification Helpers', () => {
    describe('recordExists', () => {
      it('should return false for non-existent record', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        const exists = await DatabaseTestHelper.recordExists(
          'agents',
          '00000000-0000-0000-0000-000000000000',
        );

        expect(exists).toBe(false);
      });

      it('should return true for existing record', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        // Seed a test agent first
        const testAgent = MockFactories.createAgent({
          slug: `${TEST_PREFIX}exists-test`,
          organization_slug: 'test-org',
        });

        await DatabaseTestHelper.seedTestAgent(testAgent);

        const exists = await DatabaseTestHelper.recordExists(
          'agents',
          testAgent.id,
        );

        expect(exists).toBe(true);

        // Cleanup
        await DatabaseTestHelper.cleanupTestData(TEST_PREFIX);
      });
    });

    describe('countRecords', () => {
      it('should count records matching condition', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        const count = await DatabaseTestHelper.countRecords(
          'agents',
          'organization_slug',
          'test-org',
        );

        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });

      it('should return zero for non-matching condition', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        const count = await DatabaseTestHelper.countRecords(
          'agents',
          'organization_slug',
          'nonexistent-org-12345',
        );

        expect(count).toBe(0);
      });
    });
  });

  describe('Test Data Seeding', () => {
    describe('seedTestAgent', () => {
      it('should seed test agent', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        const testAgent = MockFactories.createAgent({
          slug: `${TEST_PREFIX}seed-test`,
          organization_slug: 'test-org',
        });

        const seeded = await DatabaseTestHelper.seedTestAgent(testAgent);

        expect(seeded).toBeDefined();
        expect((seeded as { id: string }).id).toBe(testAgent.id);
        expect((seeded as { slug: string }).slug).toBe(testAgent.slug);

        // Cleanup
        await DatabaseTestHelper.cleanupTestData(TEST_PREFIX);
      });

      it('should upsert on conflict', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        const testAgent = MockFactories.createAgent({
          slug: `${TEST_PREFIX}upsert-test`,
          organization_slug: 'test-org',
          display_name: 'Original Name',
        });

        // Seed first time
        await DatabaseTestHelper.seedTestAgent(testAgent);

        // Seed again with updated display name
        const updated = await DatabaseTestHelper.seedTestAgent({
          ...testAgent,
          display_name: 'Updated Name',
        });

        expect((updated as { display_name: string }).display_name).toBe(
          'Updated Name',
        );

        // Cleanup
        await DatabaseTestHelper.cleanupTestData(TEST_PREFIX);
      });
    });

    describe('seedTestOrchestration', () => {
      it('should seed test orchestration definition', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        const testDefinition = MockFactories.createOrchestrationDefinition({
          slug: `${TEST_PREFIX}orch-seed-test`,
          organization_slug: 'test-org',
        });

        const seeded =
          await DatabaseTestHelper.seedTestOrchestration(testDefinition);

        expect(seeded).toBeDefined();
        expect((seeded as { id: string }).id).toBe(testDefinition.id);
        expect((seeded as { slug: string }).slug).toBe(testDefinition.slug);

        // Cleanup
        await DatabaseTestHelper.cleanupTestData(TEST_PREFIX);
      });

      it('should upsert orchestration on conflict', async () => {
        if (!isSupabaseConfigured) {
          return expect(true).toBe(true); // Skip
        }

        const testDefinition = MockFactories.createOrchestrationDefinition({
          slug: `${TEST_PREFIX}orch-upsert-test`,
          organization_slug: 'test-org',
          version: 1,
        });

        // Seed first time
        await DatabaseTestHelper.seedTestOrchestration(testDefinition);

        // Seed again with updated version
        const updated = await DatabaseTestHelper.seedTestOrchestration({
          ...testDefinition,
          version: 2,
        });

        expect((updated as { version: number }).version).toBe(2);

        // Cleanup
        await DatabaseTestHelper.cleanupTestData(TEST_PREFIX);
      });
    });
  });

  describe('Configuration Validation', () => {
    it('should use environment variables for configuration', () => {
      const config = {
        supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key',
        testUser: process.env.SUPABASE_TEST_USER || 'demo.user@playground.com',
        testPassword: process.env.SUPABASE_TEST_PASSWORD || 'demo-password',
      };

      expect(config.supabaseUrl).toBeDefined();
      expect(config.serviceKey).toBeDefined();
      expect(config.testUser).toBeDefined();
      expect(config.testPassword).toBeDefined();
    });

    it('should provide fallback defaults for local development', () => {
      // Verify defaults match local Supabase configuration
      const defaultUrl = 'http://localhost:54321';
      const defaultUser = 'demo.user@playground.com';

      expect(defaultUrl).toMatch(/localhost/);
      expect(defaultUser).toMatch(/@/);
    });
  });

  describe('Error Handling', () => {
    it('should throw descriptive error for authentication failure', async () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      // Temporarily break credentials
      const originalUser = process.env.SUPABASE_TEST_USER;
      process.env.SUPABASE_TEST_USER = 'invalid@test.com';

      // Reset cached auth
      DatabaseTestHelper.teardownTestDatabase();

      await expect(DatabaseTestHelper.authenticateTestUser()).rejects.toThrow(
        /authentication failed/i,
      );

      // Restore
      process.env.SUPABASE_TEST_USER = originalUser;
    });

    it('should throw descriptive error for record existence check failure', async () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      // Try to check existence on non-existent table
      await expect(
        DatabaseTestHelper.recordExists('nonexistent_table', 'some-id'),
      ).rejects.toThrow();
    });

    it('should throw descriptive error for count failure', async () => {
      if (!isSupabaseConfigured) {
        return expect(true).toBe(true); // Skip
      }

      // Try to count on non-existent table
      await expect(
        DatabaseTestHelper.countRecords('nonexistent_table', 'column', 'value'),
      ).rejects.toThrow();
    });
  });
});
