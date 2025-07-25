/**
 * Ad-hoc Test Runner for Supabase MCP
 * 
 * Quick test runner for manual testing and debugging of MCP tools.
 * Useful for isolated testing of specific functionality.
 */

import { getTestSetup } from '../utilities/test-setup';
import { TEST_PROMPTS, TestPromptCase } from '../fixtures/test-data';

interface TestResult {
  id: string;
  description: string;
  success: boolean;
  sql?: string;
  executionTime: number;
  error?: string;
  validationResult?: any;
}

class AdHocTestRunner {
  private testSetup = getTestSetup();

  async initialize() {
    console.log('Initializing ad-hoc test environment...');
    const env = await this.testSetup.getTestEnvironment();
    
    // Check database connection
    const isConnected = await this.testSetup.validateConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    // Check migrations
    const { hasMCPTables, missingTables } = await this.testSetup.checkMigrations();
    if (!hasMCPTables) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    }

    console.log('✅ Test environment ready');
    return env;
  }

  async runSinglePrompt(prompt: string): Promise<TestResult> {
    const startTime = Date.now();
    const env = await this.testSetup.getTestEnvironment();

    try {
      // For now, we'll simulate SQL generation since we don't have the actual tool yet
      // This is where the actual MCP generate-sql tool would be called
      const mockSQL = this.generateMockSQL(prompt);
      
      // Validate the SQL
      const validationResult = await env.sqlValidator.validateSQL(mockSQL);
      
      return {
        id: 'ad-hoc',
        description: prompt,
        success: validationResult.isValid,
        sql: mockSQL,
        executionTime: Date.now() - startTime,
        validationResult
      };

    } catch (error) {
      return {
        id: 'ad-hoc',
        description: prompt,
        success: false,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async runTestCase(testCase: TestPromptCase): Promise<TestResult> {
    console.log(`\n🧪 Testing: ${testCase.description}`);
    console.log(`📝 Prompt: "${testCase.prompt}"`);
    console.log(`🏷️  Category: ${testCase.category} (${testCase.complexity})`);
    
    const result = await this.runSinglePrompt(testCase.prompt);
    
    if (result.success) {
      console.log('✅ PASSED');
      if (result.sql) {
        console.log(`📊 Generated SQL:\n${result.sql}`);
      }
    } else {
      console.log('❌ FAILED');
      if (result.error) {
        console.log(`💥 Error: ${result.error}`);
      }
      if (result.validationResult?.errors) {
        console.log(`🔍 Validation errors: ${result.validationResult.errors.join(', ')}`);
      }
    }
    
    console.log(`⏱️  Execution time: ${result.executionTime}ms`);
    
    return result;
  }

  async runComplexityLevel(complexity: 'easy' | 'mid' | 'advanced'): Promise<TestResult[]> {
    console.log(`\n🎯 Running ${complexity.toUpperCase()} level tests...\n`);
    
    const testCases = TEST_PROMPTS.filter(tc => tc.complexity === complexity);
    const results: TestResult[] = [];
    
    for (const testCase of testCases) {
      const result = await this.runTestCase(testCase);
      results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Summary
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    console.log(`\n📊 ${complexity.toUpperCase()} Level Summary: ${passed}/${total} passed (${Math.round(passed/total*100)}%)`);
    
    return results;
  }

  async runAllTests(): Promise<{ easy: TestResult[]; mid: TestResult[]; advanced: TestResult[] }> {
    console.log('🚀 Running comprehensive test suite...');
    
    const easy = await this.runComplexityLevel('easy');
    const mid = await this.runComplexityLevel('mid');
    const advanced = await this.runComplexityLevel('advanced');
    
    // Overall summary
    const allResults = [...easy, ...mid, ...advanced];
    const totalPassed = allResults.filter(r => r.success).length;
    const totalTests = allResults.length;
    
    console.log(`\n🎉 OVERALL SUMMARY:`);
    console.log(`   Total tests: ${totalTests}`);
    console.log(`   Passed: ${totalPassed}`);
    console.log(`   Failed: ${totalTests - totalPassed}`);
    console.log(`   Success rate: ${Math.round(totalPassed/totalTests*100)}%`);
    
    return { easy, mid, advanced };
  }

  async testDatabaseConnection(): Promise<void> {
    console.log('🔌 Testing database connection...');
    
    const env = await this.testSetup.getTestEnvironment();
    
    try {
      // Test basic query
      const { data, error } = await env.supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        console.log('❌ Database connection failed:', error.message);
        return;
      }
      
      console.log('✅ Database connection successful');
      
      // Test MCP tables
      const { hasMCPTables, missingTables } = await this.testSetup.checkMigrations();
      if (hasMCPTables) {
        console.log('✅ All MCP tables exist');
      } else {
        console.log('⚠️  Missing MCP tables:', missingTables.join(', '));
      }
      
    } catch (error) {
      console.log('❌ Connection test failed:', error);
    }
  }

  async createTestData(): Promise<void> {
    console.log('📊 Creating test data...');
    
    const env = await this.testSetup.getTestEnvironment();
    
    try {
      // Create test user
      const user = await env.testDataManager.createTestUser({
        email: 'ad-hoc-test@example.com',
        display_name: 'Ad Hoc Test User'
      });
      console.log('✅ Created test user:', user.email);
      
      // Create test conversation
      const conversation = await env.testDataManager.createTestAgentConversation(user.id, {
        agent_name: 'test-agent',
        agent_type: 'specialist'
      });
      console.log('✅ Created test conversation:', conversation.id);
      
      // Create test execution
      const execution = await env.testDataManager.createTestMCPExecution(user.id, {
        agent_conversation_id: conversation.id,
        tool_name: 'generate-sql',
        request_data: { prompt: 'Test prompt' },
        response_data: { sql: 'SELECT * FROM users;' }
      });
      console.log('✅ Created test execution:', execution.id);
      
      console.log('📊 Test data creation complete');
      
    } catch (error) {
      console.log('❌ Test data creation failed:', error);
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test data...');
    await this.testSetup.cleanup();
    console.log('✅ Cleanup complete');
  }

  // Mock SQL generation for testing purposes
  private generateMockSQL(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    // Simple pattern matching for mock SQL generation
    if (lowerPrompt.includes('all users') || lowerPrompt.includes('get users')) {
      return 'SELECT * FROM users;';
    }
    
    if (lowerPrompt.includes('count') && lowerPrompt.includes('users')) {
      return 'SELECT COUNT(*) FROM users;';
    }
    
    if (lowerPrompt.includes('created today')) {
      return "SELECT * FROM users WHERE created_at >= CURRENT_DATE;";
    }
    
    if (lowerPrompt.includes('active conversations')) {
      return "SELECT * FROM agent_conversations WHERE ended_at IS NULL;";
    }
    
    if (lowerPrompt.includes('conversation counts')) {
      return `
        SELECT u.*, COUNT(ac.id) as conversation_count 
        FROM users u 
        LEFT JOIN agent_conversations ac ON u.id = ac.user_id 
        GROUP BY u.id;
      `;
    }
    
    // Default fallback
    return "SELECT 'Generated SQL would appear here' as placeholder;";
  }
}

// CLI interface for ad-hoc testing
async function main() {
  const runner = new AdHocTestRunner();
  const command = process.argv[2];
  
  try {
    await runner.initialize();
    
    switch (command) {
      case 'connection':
        await runner.testDatabaseConnection();
        break;
        
      case 'create-data':
        await runner.createTestData();
        break;
        
      case 'test-easy':
        await runner.runComplexityLevel('easy');
        break;
        
      case 'test-mid':
        await runner.runComplexityLevel('mid');
        break;
        
      case 'test-advanced':
        await runner.runComplexityLevel('advanced');
        break;
        
      case 'test-all':
        await runner.runAllTests();
        break;
        
      case 'prompt':
        const prompt = process.argv[3];
        if (!prompt) {
          console.log('Usage: npm run ad-hoc prompt "Your SQL prompt here"');
          process.exit(1);
        }
        await runner.runSinglePrompt(prompt);
        break;
        
      default:
        console.log(`
🧪 Ad-hoc Test Runner Commands:

  connection     - Test database connection
  create-data    - Create sample test data
  test-easy      - Run easy level tests
  test-mid       - Run mid level tests  
  test-advanced  - Run advanced level tests
  test-all       - Run all test levels
  prompt "text"  - Test a single prompt

Examples:
  npm run ad-hoc connection
  npm run ad-hoc test-easy
  npm run ad-hoc prompt "Get all users with their conversation counts"
        `);
    }
    
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { AdHocTestRunner };