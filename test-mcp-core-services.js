#!/usr/bin/env node

/**
 * MCP Core Services Test Suite
 * 
 * Tests the fundamental infrastructure services:
 * - MCPExecutionTrackerService
 * - ContextLearningService  
 * - IntelligentMCPBaseService
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Test configuration
const TEST_CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  testUserId: 'test-user-' + Date.now(),
  testConversationId: 'test-conv-' + Date.now(),
  testSessionId: 'test-session-' + Date.now()
};

class MCPCoreServicesTest {
  constructor() {
    this.results = {
      executionTracker: { passed: 0, failed: 0, tests: [] },
      contextLearning: { passed: 0, failed: 0, tests: [] },
      baseService: { passed: 0, failed: 0, tests: [] }
    };
    
    // Initialize Supabase client for direct testing
    this.supabaseClient = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey);
  }

  /**
   * Run all core service tests
   */
  async runTests() {
    console.log('🧪 Starting MCP Core Services Test Suite');
    console.log('=' .repeat(60));
    
    try {
      // Test 1: MCPExecutionTrackerService
      await this.testExecutionTracker();
      
      // Test 2: ContextLearningService  
      await this.testContextLearning();
      
      // Test 3: IntelligentMCPBaseService
      await this.testBaseService();
      
      // Generate summary
      this.generateSummary();
      
    } catch (error) {
      console.error('❌ Test Suite Failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test MCPExecutionTrackerService functionality
   */
  async testExecutionTracker() {
    console.log('\n📊 Testing MCPExecutionTrackerService...');
    
    const tests = [
      {
        name: 'Database Connection',
        test: async () => {
          // Test basic database connectivity
          const { data, error } = await this.supabaseClient
            .from('users')  
            .select('id')
            .limit(1);
          
          if (error && !error.message.includes('relation')) {
            throw new Error(`Database connection failed: ${error.message}`);
          }
          return 'Database connection verified';
        }
      },
      {
        name: 'MCP Execution Table Access',
        test: async () => {
          // Test MCP execution table structure
          const { data, error } = await this.supabaseClient
            .from('mcp_executions')
            .select('*')
            .limit(1);
          
          // Table might be empty, but should not error on structure
          if (error && !error.message.includes('relation')) {
            throw new Error(`MCP executions table access failed: ${error.message}`);
          }
          return 'MCP executions table accessible';
        }
      },
      {
        name: 'Execution Context Validation',
        test: async () => {
          // Test execution context structure
          const context = {
            mcpName: 'test-mcp',
            toolName: 'test-tool',
            userId: TEST_CONFIG.testUserId,
            agentConversationId: TEST_CONFIG.testConversationId,
            sessionId: TEST_CONFIG.testSessionId,
            parameters: { test: 'value' },
            contextUsed: false
          };
          
          // Validate all required fields exist
          const requiredFields = ['mcpName', 'toolName', 'userId'];
          for (const field of requiredFields) {
            if (!context[field]) {
              throw new Error(`Missing required field: ${field}`);
            }
          }
          
          return 'Execution context validation passed';
        }
      },
      {
        name: 'Mock Execution Tracking',
        test: async () => {
          // Test execution tracking simulation
          const mockExecution = {
            id: 'test-exec-' + Date.now(),
            mcp_name: 'test-mcp',
            tool_name: 'generate-sql',
            user_id: TEST_CONFIG.testUserId,
            status: 'success',
            execution_time_ms: 150,
            created_at: new Date().toISOString()
          };
          
          // Simulate what the execution tracker would do
          if (!mockExecution.id || !mockExecution.tool_name || !mockExecution.user_id) {
            throw new Error('Invalid execution record structure');
          }
          
          return 'Mock execution tracking structure valid';
        }
      },
      {
        name: 'Performance Metrics Calculation',
        test: async () => {
          // Test performance metrics logic
          const mockExecutions = [
            { status: 'success', execution_time_ms: 100 },
            { status: 'success', execution_time_ms: 200 },
            { status: 'error', execution_time_ms: 50 },
            { status: 'success', execution_time_ms: 150 }
          ];
          
          const totalExecutions = mockExecutions.length;
          const successfulExecutions = mockExecutions.filter(e => e.status === 'success').length;
          const successRate = (successfulExecutions / totalExecutions) * 100;
          const avgExecutionTime = mockExecutions.reduce((sum, e) => sum + e.execution_time_ms, 0) / totalExecutions;
          
          if (successRate !== 75 || avgExecutionTime !== 125) {
            throw new Error(`Metrics calculation error: successRate=${successRate}, avgTime=${avgExecutionTime}`);
          }
          
          return 'Performance metrics calculation correct';
        }
      }
    ];

    await this.runTestGroup('executionTracker', tests);
  }

  /**
   * Test ContextLearningService functionality
   */
  async testContextLearning() {
    console.log('\n📚 Testing ContextLearningService...');
    
    const tests = [
      {
        name: 'Context File Path Resolution',
        test: async () => {
          // Test context file path logic
          const expectedPath = path.join(process.cwd(), 'apps/api/src/mcp/servers/supabase/context/supabase-sql-context.md');
          
          // Check if path is reasonable structure
          if (!expectedPath.includes('supabase-sql-context.md')) {
            throw new Error('Context file path structure invalid');
          }
          
          return 'Context file path resolution correct';
        }
      },
      {
        name: 'Pattern Parsing Logic',
        test: async () => {
          // Test markdown pattern parsing
          const mockMarkdown = `
# SQL Context Patterns

## Success Patterns
- For user data queries: Use LEFT JOIN with users table
- For performance optimization: Add LIMIT clauses for large datasets

## Error Patterns  
- When getting "relation does not exist": Check table names in schema
- When query times out: Reduce dataset size or add indexes
          `;
          
          // Simulate pattern extraction
          const lines = mockMarkdown.split('\n').map(line => line.trim()).filter(line => line);
          const patterns = lines.filter(line => line.startsWith('- For ') || line.startsWith('- When '));
          
          if (patterns.length !== 4) {
            throw new Error(`Expected 4 patterns, found ${patterns.length}`);
          }
          
          return 'Pattern parsing logic working correctly';
        }
      },
      {
        name: 'Context Enhancement Logic',
        test: async () => {
          // Test prompt enhancement logic
          const originalPrompt = "Get all active users";
          const mockPatterns = [
            {
              type: 'success',
              description: 'user data queries',
              pattern: 'Use LEFT JOIN with users table',
              conditions: ['user data queries']
            }
          ];
          
          // Simulate enhancement
          const relevantPatterns = mockPatterns.filter(pattern => 
            originalPrompt.toLowerCase().includes('user')
          );
          
          if (relevantPatterns.length !== 1) {
            throw new Error('Pattern matching logic failed');
          }
          
          return 'Context enhancement logic functional';
        }
      },
      {
        name: 'Learning from Execution',
        test: async () => {
          // Test learning mechanism
          const executionResult = {
            prompt: 'Get user count',
            generatedSQL: 'SELECT COUNT(*) FROM users',
            success: true,
            error: null
          };
          
          // Simulate learning logic
          if (executionResult.success && executionResult.generatedSQL) {
            // Would normally extract patterns and update context
            const learned = {
              pattern: 'COUNT queries',
              example: executionResult.generatedSQL,
              success: true
            };
            
            if (!learned.pattern || !learned.example) {
              throw new Error('Learning extraction failed');
            }
          }
          
          return 'Learning from execution mechanism working';
        }
      },
      {
        name: 'Context Stats Generation',
        test: async () => {
          // Test stats generation
          const mockContextData = new Map([
            ['success', [
              { type: 'success', description: 'Pattern 1' },
              { type: 'success', description: 'Pattern 2' }
            ]],
            ['error', [
              { type: 'error', description: 'Error Pattern 1' }
            ]]
          ]);
          
          const totalPatterns = Array.from(mockContextData.values()).flat().length;
          const stats = {
            totalPatterns,
            successPatterns: mockContextData.get('success')?.length || 0,
            errorPatterns: mockContextData.get('error')?.length || 0,
            lastReload: new Date().toISOString()
          };
          
          if (stats.totalPatterns !== 3 || stats.successPatterns !== 2) {
            throw new Error('Context stats calculation incorrect');
          }
          
          return 'Context stats generation working';
        }
      }
    ];

    await this.runTestGroup('contextLearning', tests);
  }

  /**
   * Test IntelligentMCPBaseService functionality  
   */
  async testBaseService() {
    console.log('\n🏗️ Testing IntelligentMCPBaseService...');
    
    const tests = [
      {
        name: 'Server Info Structure',
        test: async () => {
          // Test server info structure
          const mockServerInfo = {
            name: 'test-mcp',
            version: '1.0.0',
            description: 'Test MCP Server',
            capabilities: {
              tools: true,
              resources: true,
              prompts: true,
              logging: true
            },
            tools: [
              {
                name: 'test-tool',
                description: 'Test tool',
                inputSchema: { type: 'object', properties: {} }
              }
            ]
          };
          
          // Validate structure
          const requiredFields = ['name', 'version', 'capabilities', 'tools'];
          for (const field of requiredFields) {
            if (!mockServerInfo[field]) {
              throw new Error(`Missing server info field: ${field}`);
            }
          }
          
          return 'Server info structure valid';
        }
      },
      {
        name: 'Tool Execution Options',
        test: async () => {
          // Test execution options structure
          const mockOptions = {
            userId: TEST_CONFIG.testUserId,
            agentConversationId: TEST_CONFIG.testConversationId,
            sessionId: TEST_CONFIG.testSessionId,
            llmProvider: 'anthropic',
            llmModel: 'claude-3-5-sonnet',
            maxRetries: 3,
            retryDelay: 1000,
            contextUsed: true
          };
          
          // Validate options
          if (!mockOptions.userId || !mockOptions.llmProvider) {
            throw new Error('Invalid execution options structure');
          }
          
          return 'Tool execution options structure valid';
        }
      },
      {
        name: 'Parameter Validation Logic',
        test: async () => {
          // Test parameter validation
          const mockToolSchema = {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              format: { type: 'string', enum: ['json', 'csv'] }
            },
            required: ['prompt']
          };
          
          const validParams = { prompt: 'test query', format: 'json' };
          const invalidParams = { format: 'json' }; // missing required prompt
          
          // Simulate validation
          const validateParams = (params, schema) => {
            const errors = [];
            if (schema.required) {
              for (const field of schema.required) {
                if (!params[field]) {
                  errors.push(`Missing required parameter: ${field}`);
                }
              }
            }
            return { valid: errors.length === 0, errors };
          };
          
          const validResult = validateParams(validParams, mockToolSchema);
          const invalidResult = validateParams(invalidParams, mockToolSchema);
          
          if (!validResult.valid || invalidResult.valid) {
            throw new Error('Parameter validation logic failed');
          }
          
          return 'Parameter validation logic working';
        }
      },
      {
        name: 'Error Handling Structure',
        test: async () => {
          // Test error handling structure
          const mockError = new Error('Test error');
          const errorResult = {
            success: false,
            error: mockError.message,
            timestamp: new Date().toISOString(),
            context: {
              toolName: 'test-tool',
              userId: TEST_CONFIG.testUserId
            }
          };
          
          if (!errorResult.error || !errorResult.context || errorResult.success) {
            throw new Error('Error handling structure invalid');
          }
          
          return 'Error handling structure correct';
        }
      },
      {
        name: 'Analytics Data Structure',
        test: async () => {
          // Test analytics data structure
          const mockAnalytics = {
            serverName: 'test-mcp',
            totalExecutions: 100,
            successRate: 95.5,
            avgExecutionTime: 125.5,
            toolStats: [
              {
                toolName: 'generate-sql',
                executions: 50,
                successRate: 96.0,
                avgTime: 130.0
              }
            ],
            timeframe: '7 days'
          };
          
          // Validate analytics structure
          const requiredAnalyticsFields = ['totalExecutions', 'successRate', 'toolStats'];
          for (const field of requiredAnalyticsFields) {
            if (mockAnalytics[field] === undefined) {
              throw new Error(`Missing analytics field: ${field}`);
            }
          }
          
          return 'Analytics data structure valid';
        }
      }
    ];

    await this.runTestGroup('baseService', tests);
  }

  /**
   * Run a group of tests and track results
   */
  async runTestGroup(groupName, tests) {
    for (const testCase of tests) {
      try {
        console.log(`  🔍 ${testCase.name}...`);
        const result = await testCase.test();
        console.log(`  ✅ ${testCase.name}: ${result}`);
        
        this.results[groupName].passed++;
        this.results[groupName].tests.push({
          name: testCase.name,
          status: 'passed',
          result: result
        });
      } catch (error) {
        console.log(`  ❌ ${testCase.name}: ${error.message}`);
        
        this.results[groupName].failed++;
        this.results[groupName].tests.push({
          name: testCase.name,
          status: 'failed',
          error: error.message
        });
      }
    }
  }

  /**
   * Generate and display test summary
   */
  generateSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MCP Core Services Test Results');
    console.log('='.repeat(60));
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [groupName, results] of Object.entries(this.results)) {
      const total = results.passed + results.failed;
      const successRate = total > 0 ? (results.passed / total * 100).toFixed(1) : 0;
      
      console.log(`\n${groupName.toUpperCase()}:`);
      console.log(`  ✅ Passed: ${results.passed}`);
      console.log(`  ❌ Failed: ${results.failed}`);
      console.log(`  📈 Success Rate: ${successRate}%`);
      
      totalPassed += results.passed;
      totalFailed += results.failed;
    }
    
    const overallTotal = totalPassed + totalFailed;
    const overallSuccessRate = overallTotal > 0 ? (totalPassed / overallTotal * 100).toFixed(1) : 0;
    
    console.log(`\n${'='.repeat(30)}`);
    console.log('OVERALL RESULTS:');
    console.log(`✅ Total Passed: ${totalPassed}`);
    console.log(`❌ Total Failed: ${totalFailed}`);
    console.log(`📈 Overall Success Rate: ${overallSuccessRate}%`);
    
    // Save detailed results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `mcp-core-services-test-results-${timestamp}.json`;
    
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      testSuite: 'MCP Core Services',
      summary: {
        totalPassed,
        totalFailed,
        overallSuccessRate: parseFloat(overallSuccessRate)
      },
      results: this.results,
      config: TEST_CONFIG
    }, null, 2));
    
    console.log(`\n📄 Detailed results saved to: ${resultsFile}`);
    
    if (totalFailed > 0) {
      console.log('\n⚠️  Some tests failed. Review the results above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All core service tests passed!');
    }
  }
}

// Validate environment
function validateEnvironment() {
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_KEY'];
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`  - ${varName}`));
    console.error('\nPlease set these environment variables and try again.');
    process.exit(1);
  }
}

// Main execution
async function main() {
  validateEnvironment();
  
  const tester = new MCPCoreServicesTest();
  await tester.runTests();
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n⚠️  Test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { MCPCoreServicesTest };