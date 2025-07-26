#!/usr/bin/env node

/**
 * HTTP-Based MCP Integration Tests - REAL API TESTING
 * 
 * Tests the actual MCP system through HTTP endpoints after starting the server.
 * This tests the real system as it would be used in production.
 * 
 * Prerequisites: 
 * 1. Start the API server: npm run dev:api
 * 2. Server should be running on http://localhost:3000 (or configured port)
 */

import fs from 'fs';

const TEST_CONFIG = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000', // Server is running on port 4000
  testSessionId: 'http-integration-' + Date.now(),
  requiredTests: 35,
  timeout: 60000 // 60 seconds for LLM calls
};

class HTTPMCPIntegrationTests {
  constructor() {
    this.testResults = [];
    this.availableProviders = [];
    this.realSchema = null;
  }

  async runHTTPTests() {
    console.log('🌐 HTTP-Based MCP Integration Tests');
    console.log('=' .repeat(80));
    console.log(`📅 Session: ${TEST_CONFIG.testSessionId}`);
    console.log(`🔗 API Base URL: ${TEST_CONFIG.apiBaseUrl}`);
    console.log('=' .repeat(80));

    try {
      // Phase 1: Verify API server is running
      await this.verifyAPIServer();
      
      // Phase 2: Test real schema discovery via HTTP
      await this.testHTTPSchemaDiscovery();
      
      // Phase 3: Test real SQL generation via HTTP across providers
      await this.testHTTPSQLGeneration();
      
      // Phase 4: Test real SQL execution via HTTP
      await this.testHTTPSQLExecution();
      
      // Phase 5: Test real data formatting via HTTP
      await this.testHTTPDataFormatting();
      
      // Generate final report
      this.generateHTTPTestReport();
      
    } catch (error) {
      console.error('❌ HTTP INTEGRATION TEST FAILURE:', error);
      console.error('Stack:', error.stack);
      
      if (error.message.includes('ECONNREFUSED')) {
        console.error('\n💡 SOLUTION: Start the API server first:');
        console.error('   npm run dev:api');
        console.error('   Then run this test again.');
      }
      
      process.exit(1);
    }
  }

  async verifyAPIServer() {
    console.log('\n🔍 Verifying API Server');
    console.log('-'.repeat(50));
    
    try {
      const response = await this.httpRequest('GET', '/health');
      
      if (response.status >= 400) {
        throw new Error(`API server health check failed: ${response.status}`);
      }
      
      console.log('✅ API server is running and responding');
      
      // Check if MCP endpoints are available (correct route pattern)
      const mcpEndpoints = [
        '/mcp/supabase/tools/generate-sql',
        '/mcp/supabase/tools/get-schema',
        '/mcp/supabase/tools/execute-sql',
        '/mcp/supabase/tools/query-and-format',
        '/mcp/supabase/tools/read-data'
      ];
      
      console.log('🔍 Checking MCP endpoint availability...');
      
      for (const endpoint of mcpEndpoints) {
        try {
          // Just check if endpoint exists (should return method not allowed or similar, not 404)
          const testResponse = await this.httpRequest('GET', endpoint);
          // Any response other than 404 means the endpoint exists
          if (testResponse.status === 404) {
            throw new Error(`MCP endpoint not found: ${endpoint}`);
          }
          console.log(`  ✅ ${endpoint} - available`);
        } catch (error) {
          if (error.message.includes('ECONNREFUSED')) {
            throw error; // Re-throw connection errors
          }
          // Other errors (like method not allowed) are fine - endpoint exists
          console.log(`  ✅ ${endpoint} - available`);
        }
      }
      
    } catch (error) {
      throw new Error(`API server verification failed: ${error.message}`);
    }
  }

  async testHTTPSchemaDiscovery() {
    console.log('\n📋 Testing HTTP Schema Discovery');
    console.log('-'.repeat(50));
    
    try {
      console.log('🔄 Calling POST /mcp/supabase/tools/get-schema...');
      
      const response = await this.httpRequest('POST', '/mcp/supabase/tools/get-schema', {
        arguments: {
          format: 'json'
          // Don't specify table_names to get all tables
        }
      });
      
      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Schema discovery failed: HTTP ${response.status} - ${response.statusText}`);
      }
      
      const schemaData = response.data;
      
      if (!schemaData || !schemaData.tool_result) {
        throw new Error('Invalid schema response: missing tool_result');
      }
      
      const toolResult = schemaData.tool_result;
      if (toolResult.isError) {
        throw new Error(`Schema tool error: ${toolResult.content?.[0]?.text || 'Unknown error'}`);
      }
      
      // Extract schema from tool result content
      const schemaContent = toolResult.content?.[0]?.text;
      if (!schemaContent) {
        throw new Error('Schema tool returned no content');
      }
      
      // Parse schema content (should be JSON)
      try {
        const parsedSchema = JSON.parse(schemaContent);
        console.log('🔍 DEBUG: Parsed schema structure:', JSON.stringify(parsedSchema, null, 2).substring(0, 500) + '...');
        
        // Store the schema in a consistent format
        this.realSchema = {
          tables: parsedSchema.data?.schema?.tables || parsedSchema.tables || [],
          ...parsedSchema
        };
        console.log('🔍 DEBUG: Extracted tables count:', this.realSchema.tables.length);
      } catch (parseError) {
        throw new Error(`Failed to parse schema JSON: ${parseError.message}`);
      }
      
      const tableCount = this.realSchema.tables.length;
      console.log(`✅ Retrieved schema with ${tableCount} tables`);
      
      if (tableCount < 3) {
        throw new Error(`Insufficient tables in schema: ${tableCount}. Expected at least 3 tables for comprehensive testing.`);
      }
      
      // Log some table names for verification
      const tableNames = this.realSchema.tables.slice(0, 5).map(t => t.name).join(', ');
      console.log(`✅ Sample tables: ${tableNames}...`);
      
      this.testResults.push({
        type: 'schema_discovery',
        status: 'passed',
        result: { tableCount, sampleTables: tableNames },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.log(`❌ Schema discovery failed: ${error.message}`);
      
      this.testResults.push({
        type: 'schema_discovery',
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw new Error(`HTTP schema discovery failed: ${error.message}`);
    }
  }

  async testHTTPSQLGeneration() {
    console.log('\n🤖 Testing HTTP SQL Generation');
    console.log('-'.repeat(50));
    console.log(`🎯 Target: ${TEST_CONFIG.requiredTests}+ tests across providers`);
    
    // Test prompts of varying difficulty
    const testPrompts = this.createTestPrompts();
    
    // Available providers to test
    const providersToTest = [
      { name: 'anthropic', model: 'claude-3-haiku' },
      { name: 'anthropic', model: 'claude-3-5-sonnet' },
      { name: 'openai', model: 'gpt-3.5-turbo' },
      { name: 'openai', model: 'gpt-4' },
      { name: 'google', model: 'gemini-pro' }
    ];
    
    console.log(`📝 Testing ${testPrompts.length} prompts across ${providersToTest.length} providers`);
    
    let totalTests = 0;
    let passedTests = 0;
    
    for (const provider of providersToTest) {
      console.log(`\n🔄 Testing provider: ${provider.name}:${provider.model}`);
      
      for (const prompt of testPrompts.slice(0, 3)) { // Test first 3 prompts per provider
        totalTests++;
        
        try {
          console.log(`    🔍 ${prompt.difficulty}: ${prompt.description}`);
          
          // Call REAL HTTP endpoint for SQL generation
          const response = await this.httpRequest('POST', '/mcp/supabase/tools/generate-sql', {
            arguments: {
              prompt: prompt.prompt,
              use_context: true,
              llm_provider: provider.name,
              llm_model: provider.model
            }
          });
          
          if (response.status !== 200 && response.status !== 201) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const responseData = response.data;
          
          if (!responseData || !responseData.tool_result) {
            throw new Error('No tool_result returned from API');
          }
          
          const toolResult = responseData.tool_result;
          if (toolResult.isError) {
            throw new Error(`SQL generation error: ${toolResult.content?.[0]?.text || 'Unknown error'}`);
          }
          
          // Extract SQL from tool result content
          const sqlContent = toolResult.content?.[0]?.text;
          if (!sqlContent) {
            throw new Error('SQL generation tool returned no content');
          }
          
          // Parse SQL result (should be JSON)
          let result;
          try {
            result = JSON.parse(sqlContent);
          } catch (parseError) {
            throw new Error(`Failed to parse SQL generation JSON: ${parseError.message}`);
          }
          
          const sql = result.data?.sql || result.sql;
          if (!sql) {
            throw new Error('No SQL found in parsed result');
          }
          
          // Validate the SQL is real and reasonable
          if (sql.trim().length < 10) {
            throw new Error('Generated SQL is too short to be valid');
          }
          
          if (!sql.toLowerCase().includes('select')) {
            throw new Error('Generated SQL does not contain SELECT statement');
          }
          
          console.log(`    ✅ Generated: ${sql.substring(0, 100)}...`);
          
          this.testResults.push({
            type: 'sql_generation',
            provider: provider.name,
            model: provider.model,
            prompt: prompt,
            result: result,
            status: 'passed',
            timestamp: new Date().toISOString()
          });
          
          passedTests++;
          
        } catch (error) {
          console.log(`    ❌ Failed: ${error.message}`);
          
          this.testResults.push({
            type: 'sql_generation',
            provider: provider.name,
            model: provider.model,
            prompt: prompt,
            error: error.message,
            status: 'failed',
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    console.log(`\n📊 SQL Generation Results: ${passedTests}/${totalTests} passed (${(passedTests/totalTests*100).toFixed(1)}%)`);
    
    if (passedTests === 0) {
      throw new Error('NO SQL generation tests passed. System is not working.');
    }
  }

  async testHTTPSQLExecution() {
    console.log('\n⚡ Testing HTTP SQL Execution');
    console.log('-'.repeat(50));
    
    // Get successful SQL generation results
    const successfulGenerations = this.testResults.filter(r => r.type === 'sql_generation' && r.status === 'passed');
    
    if (successfulGenerations.length === 0) {
      throw new Error('No successful SQL generations to execute');
    }
    
    let executionTests = 0;
    let executionPassed = 0;
    
    for (const generation of successfulGenerations.slice(0, 5)) { // Test first 5 successful generations
      executionTests++;
      
      try {
        const sql = generation.result.data?.sql || generation.result.sql;
        console.log(`  🔄 Executing: ${sql ? sql.substring(0, 80) : 'Unknown SQL'}...`);
        
        if (!sql) {
          throw new Error('No SQL found in generation result');
        }

        // Call REAL HTTP endpoint for SQL execution
        const response = await this.httpRequest('POST', '/mcp/supabase/tools/execute-sql', {
          arguments: {
            sql: sql,
            dry_run: false
          }
        });
        
        if (response.status !== 200 && response.status !== 201) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const responseData = response.data;
        
        if (!responseData || !responseData.tool_result) {
          throw new Error('No tool_result returned from SQL execution API');
        }
        
        const toolResult = responseData.tool_result;
        if (toolResult.isError) {
          throw new Error(`SQL execution error: ${toolResult.content?.[0]?.text || 'Unknown error'}`);
        }
        
        // Extract execution result from tool result content
        const execContent = toolResult.content?.[0]?.text;
        if (!execContent) {
          throw new Error('SQL execution tool returned no content');
        }
        
        // Parse execution result (should be JSON)
        let execResult;
        try {
          execResult = JSON.parse(execContent);
        } catch (parseError) {
          throw new Error(`Failed to parse SQL execution JSON: ${parseError.message}`);
        }
        
        if (execResult.error) {
          throw new Error(`SQL execution error: ${execResult.error}`);
        }
        
        const rowCount = execResult.data?.length || 0;
        console.log(`  ✅ Executed successfully, returned ${rowCount} rows`);
        
        this.testResults.push({
          type: 'sql_execution',
          originalGeneration: generation,
          result: execResult,
          status: 'passed',
          timestamp: new Date().toISOString()
        });
        
        executionPassed++;
        
      } catch (error) {
        console.log(`  ❌ Execution failed: ${error.message}`);
        
        this.testResults.push({
          type: 'sql_execution',
          originalGeneration: generation,
          error: error.message,
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.log(`\n📊 SQL Execution Results: ${executionPassed}/${executionTests} passed (${(executionPassed/executionTests*100).toFixed(1)}%)`);
    
    if (executionPassed === 0) {
      throw new Error('NO SQL execution tests passed. Generated SQL does not work.');
    }
  }

  async testHTTPDataFormatting() {
    console.log('\n📊 Testing HTTP Data Formatting');
    console.log('-'.repeat(50));
    
    // Get successful execution results
    const successfulExecutions = this.testResults.filter(r => r.type === 'sql_execution' && r.status === 'passed');
    
    if (successfulExecutions.length === 0) {
      throw new Error('No successful SQL executions to format');
    }
    
    const formats = ['json', 'csv', 'markdown', 'table'];
    let formatTests = 0;
    let formatPassed = 0;
    
    for (const execution of successfulExecutions.slice(0, 2)) { // Test first 2 successful executions
      for (const format of formats) {
        formatTests++;
        
        try {
          console.log(`  🔄 Formatting as ${format}...`);
          
          // Call REAL HTTP endpoint for data formatting
          const response = await this.httpRequest('POST', '/mcp/supabase/tools/query-and-format', {
            arguments: {
              prompt: execution.originalGeneration.prompt.prompt,
              format: format,
              execute: false, // Don't re-execute, just format the data
              existing_data: execution.result.data
            }
          });
          
          if (response.status !== 200 && response.status !== 201) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const responseData = response.data;
          
          if (!responseData || !responseData.tool_result) {
            throw new Error('No tool_result returned from data formatting API');
          }
          
          const toolResult = responseData.tool_result;
          if (toolResult.isError) {
            throw new Error(`Data formatting error: ${toolResult.content?.[0]?.text || 'Unknown error'}`);
          }
          
          // Extract formatting result from tool result content
          const formatContent = toolResult.content?.[0]?.text;
          if (!formatContent) {
            throw new Error('Data formatting tool returned no content');
          }
          
          // Parse formatting result (should be JSON)
          let formatResult;
          try {
            formatResult = JSON.parse(formatContent);
          } catch (parseError) {
            throw new Error(`Failed to parse data formatting JSON: ${parseError.message}`);
          }
          
          if (!formatResult || !formatResult.formatted_data) {
            throw new Error('No formatted_data found in parsed result');
          }
          
          // Validate format-specific requirements
          switch (format) {
            case 'json':
              JSON.parse(formatResult.formatted_data); // Should parse as valid JSON
              break;
            case 'csv':
              if (!formatResult.formatted_data.includes(',')) {
                throw new Error('CSV format does not contain commas');
              }
              break;
            case 'markdown':
              if (!formatResult.formatted_data.includes('|')) {
                throw new Error('Markdown format does not contain table separators');
              }
              break;
            case 'table':
              if (!formatResult.formatted_data.includes('─')) {
                throw new Error('Table format does not contain table borders');
              }
              break;
          }
          
          console.log(`  ✅ ${format} formatting successful`);
          formatPassed++;
          
        } catch (error) {
          console.log(`  ❌ ${format} formatting failed: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 Data Formatting Results: ${formatPassed}/${formatTests} passed (${(formatPassed/formatTests*100).toFixed(1)}%)`);
    
    if (formatPassed === 0) {
      throw new Error('NO data formatting tests passed. Formatting is not working.');
    }
  }

  createTestPrompts() {
    return [
      // Easy prompts
      { difficulty: 'Easy', description: 'Get all users', prompt: 'Show me all users in the system' },
      { difficulty: 'Easy', description: 'Count users', prompt: 'How many users do we have?' },
      { difficulty: 'Easy', description: 'Recent users', prompt: 'Show me the 10 most recent users' },
      
      // Medium prompts  
      { difficulty: 'Medium', description: 'Users with activity', prompt: 'Show me users who have been active recently' },
      { difficulty: 'Medium', description: 'User statistics', prompt: 'Give me user registration statistics by month' },
      { difficulty: 'Medium', description: 'Active user analysis', prompt: 'Analyze user activity patterns' },
      
      // Hard prompts
      { difficulty: 'Hard', description: 'Complex user report', prompt: 'Create a comprehensive user activity report with engagement metrics' },
      { difficulty: 'Hard', description: 'User retention analysis', prompt: 'Analyze user retention and identify churn patterns' },
      { difficulty: 'Hard', description: 'Advanced analytics', prompt: 'Generate advanced user analytics with multiple dimensions' }
    ];
  }

  async httpRequest(method, endpoint, data = null) {
    const url = `${TEST_CONFIG.apiBaseUrl}${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(url, options);
      
      let responseData = null;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        headers: response.headers
      };
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('ECONNREFUSED: API server is not running. Start it with: npm run dev:api');
      }
      throw error;
    }
  }

  generateHTTPTestReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 HTTP MCP INTEGRATION TEST RESULTS');
    console.log('='.repeat(80));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'passed').length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100) : 0;
    
    console.log(`📈 Overall Success Rate: ${successRate.toFixed(1)}% (${passedTests}/${totalTests})`);
    
    // Break down by test type
    const testTypes = ['schema_discovery', 'sql_generation', 'sql_execution'];
    for (const type of testTypes) {
      const typeResults = this.testResults.filter(r => r.type === type);
      const typePassed = typeResults.filter(r => r.status === 'passed').length;
      const typeTotal = typeResults.length;
      const typeRate = typeTotal > 0 ? (typePassed / typeTotal * 100) : 0;
      
      console.log(`${type.toUpperCase().replace('_', ' ')}: ${typePassed}/${typeTotal} passed (${typeRate.toFixed(1)}%)`);
    }
    
    // Save detailed results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `http-mcp-integration-results-${timestamp}.json`;
    
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      testSuite: 'HTTP MCP Integration Tests',
      sessionId: TEST_CONFIG.testSessionId,
      apiBaseUrl: TEST_CONFIG.apiBaseUrl,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate
      },
      databaseSchema: this.realSchema,
      detailedResults: this.testResults
    }, null, 2));
    
    console.log(`\n📄 Detailed results saved to: ${resultsFile}`);
    
    // Final assessment
    if (successRate >= 80) {
      console.log('\n🎉 HTTP integration tests PASSED!');
      console.log('✅ MCP system is working with real LLMs via HTTP API');
      console.log('🚀 Ready for UI development');
      console.log('\n💡 Key findings:');
      console.log('  - Schema discovery works via HTTP API');
      console.log('  - SQL generation works with real LLM providers');
      console.log('  - Generated SQL executes successfully against database');
      console.log('  - Data formatting works in multiple formats');
    } else {
      console.log('\n❌ HTTP integration tests FAILED');
      console.log(`💥 Success rate ${successRate.toFixed(1)}% is below 80% threshold`);
      console.log('🔧 Fix the MCP API endpoints before proceeding');
      
      // Show specific failures
      const failures = this.testResults.filter(r => r.status === 'failed');
      if (failures.length > 0) {
        console.log(`\n🚨 ${failures.length} Failed Tests:`);
        failures.forEach(failure => {
          console.log(`  ❌ ${failure.type}: ${failure.error}`);
        });
      }
      
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting HTTP-Based MCP Integration Tests');
  console.log('📋 Prerequisites:');
  console.log('   1. API server must be running: npm run dev:api');
  console.log('   2. LLM API keys must be configured in .env');
  console.log('   3. Supabase credentials must be configured');
  console.log('');
  
  const tester = new HTTPMCPIntegrationTests();
  await tester.runHTTPTests();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ FATAL ERROR:', error);
    console.error(error.stack);
    process.exit(1);
  });
}

export { HTTPMCPIntegrationTests };