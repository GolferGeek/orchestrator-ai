/**
 * Jest Setup for Supabase MCP Tests
 * 
 * Global setup configuration for all MCP test suites.
 * Initializes test environment and provides shared utilities.
 */

import { getTestSetup } from './test-setup';

// Global test setup
beforeAll(async () => {
  const testSetup = getTestSetup();
  
  // Validate database connection
  const isConnected = await testSetup.validateConnection();
  if (!isConnected) {
    throw new Error('Failed to connect to test database. Check your Supabase configuration.');
  }

  // Check required migrations
  const { hasMCPTables, missingTables } = await testSetup.checkMigrations();
  if (!hasMCPTables) {
    throw new Error(`Missing required database tables: ${missingTables.join(', ')}. Run the MCP tracking migration first.`);
  }

  // Initialize test environment
  await testSetup.initializeTestEnvironment();
  
  console.log('Test environment initialized successfully');
});

// Global test teardown
afterAll(async () => {
  const testSetup = getTestSetup();
  await testSetup.cleanup();
  console.log('Test environment cleaned up');
});

// Add custom matchers for SQL testing
expect.extend({
  toBeValidSQL(received: string) {
    const isValid = received && 
      received.trim().length > 0 && 
      /^(SELECT|INSERT|UPDATE|DELETE|WITH)/i.test(received.trim());
    
    return {
      message: () => 
        isValid 
          ? `Expected ${received} not to be valid SQL`
          : `Expected ${received} to be valid SQL`,
      pass: isValid,
    };
  },

  toContainTable(received: string, tableName: string) {
    const containsTable = new RegExp(`\\b${tableName}\\b`, 'i').test(received);
    
    return {
      message: () =>
        containsTable
          ? `Expected SQL not to contain table "${tableName}"`
          : `Expected SQL to contain table "${tableName}"`,
      pass: containsTable,
    };
  },

  toHaveJoin(received: string) {
    const hasJoin = /\bJOIN\b/i.test(received);
    
    return {
      message: () =>
        hasJoin
          ? `Expected SQL not to have JOIN`
          : `Expected SQL to have JOIN`,
      pass: hasJoin,
    };
  },

  toHaveAggregation(received: string) {
    const hasAggregation = /\b(COUNT|SUM|AVG|MIN|MAX|GROUP BY)\b/i.test(received);
    
    return {
      message: () =>
        hasAggregation
          ? `Expected SQL not to have aggregation`
          : `Expected SQL to have aggregation (COUNT, SUM, AVG, etc.)`,
      pass: hasAggregation,
    };
  },

  toHaveAdvancedFeatures(received: string) {
    const hasAdvanced = /\b(WITH|CTE|WINDOW|OVER|PARTITION|RECURSIVE|PERCENTILE)\b/i.test(received);
    
    return {
      message: () =>
        hasAdvanced
          ? `Expected SQL not to have advanced features`
          : `Expected SQL to have advanced features (CTE, Window functions, etc.)`,
      pass: hasAdvanced,
    };
  }
});

// Extend Jest matchers type definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidSQL(): R;
      toContainTable(tableName: string): R;
      toHaveJoin(): R;
      toHaveAggregation(): R;
      toHaveAdvancedFeatures(): R;
    }
  }
}

// Test timeout configuration
jest.setTimeout(30000); // 30 seconds for database operations