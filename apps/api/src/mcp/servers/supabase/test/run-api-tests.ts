#!/usr/bin/env node

/**
 * MCP API Test Runner
 *
 * This script tests the MCP functionality against the main NestJS API.
 * It assumes the main API is already running with MCP endpoints available.
 */

import { MCPTestClient } from './test-client';

class MCPAPITestRunner {
  private testClient: MCPTestClient;

  constructor() {
    this.testClient = new MCPTestClient();
  }

  /**
   * Run the complete test suite against the main API
   */
  async run(): Promise<void> {
    const apiPort = process.env.API_PORT || '4000';
    const apiHost = process.env.API_HOST || 'localhost';
    const apiUrl = `http://${apiHost}:${apiPort}`;

    console.log('🧪 MCP API Test Runner Starting...\n');
    console.log('📋 Prerequisites:');
    console.log('  - Main NestJS API must be running (npm run start:dev)');
    console.log(
      '  - SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment',
    );
    console.log(`  - API should be accessible at ${apiUrl}\n`);

    // Validate prerequisites
    await this.validatePrerequisites();

    try {
      await this.runTests();
      console.log('\n✅ Test suite completed successfully!');
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Validate that the main API is running and MCP is available
   */
  private async validatePrerequisites(): Promise<void> {
    console.log('🔍 Validating prerequisites...');

    const apiPort = process.env.API_PORT || '4000';
    const apiHost = process.env.API_HOST || 'localhost';
    const apiUrl = `http://${apiHost}:${apiPort}`;

    // Check if main API is running
    try {
      const healthResponse = await fetch(`${apiUrl}/health`);
      if (!healthResponse.ok) {
        throw new Error(
          `API health check failed: ${healthResponse.statusText}`,
        );
      }
      console.log('  ✅ Main API is running');
    } catch (error) {
      console.error(`  ❌ Main API is not accessible at ${apiUrl}`);
      console.error('     Please start the API with: npm run start:dev');
      process.exit(1);
    }

    // Check if MCP endpoints are available
    try {
      const mcpStatusResponse = await fetch(`${apiUrl}/mcp/status`);
      if (!mcpStatusResponse.ok) {
        throw new Error(
          `MCP status check failed: ${mcpStatusResponse.statusText}`,
        );
      }

      const mcpStatus = await mcpStatusResponse.json();
      console.log('  ✅ MCP system is active');

      if (mcpStatus.available_endpoints.supabase.initialized) {
        console.log('  ✅ Supabase MCP server is initialized');
      } else {
        console.log(
          '  ⚠️  Supabase MCP server not initialized (missing env vars)',
        );
      }
    } catch (error) {
      console.error('  ❌ MCP endpoints not available');
      console.error('     Make sure MCPModule is properly integrated');
      process.exit(1);
    }

    // Check environment variables
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missing.length > 0) {
      console.log('  ⚠️  Missing environment variables:');
      missing.forEach((varName) => console.log(`     - ${varName}`));
      console.log(
        '     Some tests may fail without proper Supabase configuration',
      );
    } else {
      console.log('  ✅ Environment variables are set');
    }

    console.log('');
  }

  /**
   * Run the test client
   */
  private async runTests(): Promise<void> {
    console.log('🔬 Running MCP test suite against main API...\n');

    try {
      await this.testClient.runTests();
    } catch (error) {
      console.error('❌ Test client failed:', error);
      throw error;
    }
  }
}

// Environment info
function printEnvironmentInfo(): void {
  console.log('═'.repeat(60));
  console.log('🧪 MCP API TEST SUITE');
  console.log('═'.repeat(60));
  console.log('Testing MCP functionality against the main NestJS API');
  console.log('');
  const apiPort = process.env.API_PORT || '4000';
  const apiHost = process.env.API_HOST || 'localhost';
  const apiUrl = `http://${apiHost}:${apiPort}`;

  console.log('Configuration:');
  console.log(`  • API URL: ${apiUrl}`);
  console.log(`  • MCP Endpoints: /mcp/*`);
  console.log(
    `  • Supabase URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Not set'}`,
  );
  console.log(
    `  • Supabase Key: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set'}`,
  );
  console.log('');
}

// Main execution
async function main() {
  printEnvironmentInfo();

  const runner = new MCPAPITestRunner();
  await runner.run();

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 All tests completed!');
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

export { MCPAPITestRunner };
