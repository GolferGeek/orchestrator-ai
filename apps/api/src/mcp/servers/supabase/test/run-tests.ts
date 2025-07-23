#!/usr/bin/env node

/**
 * MCP Test Runner
 *
 * This script runs the MCP tests in a controlled environment.
 * It handles server startup, test execution, and cleanup.
 */

import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { MCPTestClient } from './test-client';

// Simple test module for the MCP controller
import { Module } from '@nestjs/common';
import { SupabaseMCPController } from './supabase-mcp.controller';

@Module({
  controllers: [SupabaseMCPController],
})
class MCPTestModule {}

class MCPTestRunner {
  private app: INestApplication | null = null;
  private testClient: MCPTestClient;

  constructor() {
    this.testClient = new MCPTestClient();
  }

  /**
   * Run the complete test suite
   */
  async run(): Promise<void> {
    console.log('🧪 MCP Test Runner Starting...\n');

    try {
      await this.startServer();
      await this.runTests();
    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    } finally {
      await this.stopServer();
    }
  }

  /**
   * Start the NestJS server with MCP controller
   */
  private async startServer(): Promise<void> {
    console.log('🚀 Starting test server...');

    try {
      this.app = await NestFactory.create(MCPTestModule, {
        logger: ['error', 'warn', 'log'],
      });

      // Enable CORS for testing
      this.app.enableCors();

      // Start listening on a test port
      const port = process.env.MCP_TEST_PORT || 3001;
      await this.app.listen(port);

      console.log(`✅ Test server running on http://localhost:${port}`);

      // Give the server a moment to fully start
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('❌ Failed to start test server:', error);
      throw error;
    }
  }

  /**
   * Run the test client
   */
  private async runTests(): Promise<void> {
    console.log('🔬 Running test client...\n');

    try {
      await this.testClient.runTests();
    } catch (error) {
      console.error('❌ Test client failed:', error);
      throw error;
    }
  }

  /**
   * Stop the test server
   */
  private async stopServer(): Promise<void> {
    if (this.app) {
      console.log('\n🛑 Stopping test server...');
      await this.app.close();
      console.log('✅ Test server stopped');
    }
  }
}

// Environment validation
function validateEnvironment(): void {
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_KEY'];
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((varName) => console.error(`  - ${varName}`));
    console.error('\nPlease set these environment variables and try again.');
    console.error('Example:');
    console.error('  export SUPABASE_URL="https://your-project.supabase.co"');
    console.error('  export SUPABASE_KEY="your-anon-key"');
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('═'.repeat(60));
  console.log('🧪 MCP SUPABASE SERVER TEST SUITE');
  console.log('═'.repeat(60));

  // Validate environment
  validateEnvironment();

  // Run tests
  const runner = new MCPTestRunner();
  await runner.run();

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Test suite completed!');
  console.log('═'.repeat(60));
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { MCPTestRunner };
