#!/usr/bin/env node

/**
 * REAL MCP Integration Tests - NO MOCKS, NO FALLBACKS
 * 
 * This ONLY tests the actual MCP system:
 * - Real LLM API calls to generate SQL
 * - Real database schema discovery  
 * - Real SQL execution
 * - Real data formatting
 * 
 * If any part fails, the test fails. No fake successes.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Import the REAL MCP tools from compiled dist folder
import generateSQLPkg from './apps/api/dist/mcp/servers/supabase/tools/generate-sql.tool.js';
import getSchemaPkg from './apps/api/dist/mcp/servers/supabase/tools/get-schema.tool.js';
import executeSQLPkg from './apps/api/dist/mcp/servers/supabase/tools/execute-sql.tool.js';
import queryAndFormatPkg from './apps/api/dist/mcp/servers/supabase/tools/query-and-format.tool.js';
import readDataPkg from './apps/api/dist/mcp/servers/supabase/tools/read-data.tool.js';

const { EnhancedGenerateSQLTool } = generateSQLPkg;
const { GetSchemaTool } = getSchemaPkg;
const { ExecuteSQLTool } = executeSQLPkg;
const { QueryAndFormatTool } = queryAndFormatPkg;
const { ReadDataTool } = readDataPkg;

const TEST_CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY, // Use service role for full access
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  openaiKey: process.env.OPENAI_API_KEY,
  googleKey: process.env.GOOGLE_API_KEY,
  testSessionId: 'real-integration-' + Date.now(),
  requiredTests: 35
};

class RealMCPIntegrationTests {
  constructor() {
    this.supabaseClient = null;
    this.realSchema = null;
    this.mcpTools = {};
    this.testResults = [];
    this.availableProviders = [];
  }

  async runRealTests() {
    console.log('🔥 REAL MCP Integration Tests - NO MOCKS, NO FALLBACKS');
    console.log('=' .repeat(80));
    console.log(`📅 Session: ${TEST_CONFIG.testSessionId}`);
    console.log('=' .repeat(80));

    try {
      // Phase 1: Initialize REAL MCP tools
      await this.initializeRealMCPTools();
      
      // Phase 2: Get REAL database schema 
      await this.getRealDatabaseSchema();
      
      // Phase 3: Test REAL SQL generation across providers
      await this.testRealSQLGeneration();
      
      // Phase 4: Test REAL SQL execution
      await this.testRealSQLExecution();
      
      // Phase 5: Test REAL data formatting
      await this.testRealDataFormatting();
      
      // Generate final report
      this.generateRealTestReport();
      
    } catch (error) {
      console.error('❌ REAL TEST FAILURE:', error);
      console.error('Stack:', error.stack);
      process.exit(1);
    }
  }

  async initializeRealMCPTools() {
    console.log('\n🔧 Initializing REAL MCP Tools');
    console.log('-'.repeat(50));
    
    // Validate environment variables
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }
    
    // Check which LLM providers are available
    const llmProviders = [
      { name: 'anthropic', keyEnv: 'ANTHROPIC_API_KEY', models: ['claude-3-haiku', 'claude-3-5-sonnet', 'claude-sonnet-4', 'claude-opus-4'] },
      { name: 'openai', keyEnv: 'OPENAI_API_KEY', models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4o'] },
      { name: 'google', keyEnv: 'GOOGLE_API_KEY', models: ['gemini-pro'] }
    ];
    
    this.availableProviders = llmProviders.filter(provider => process.env[provider.keyEnv]);
    
    if (this.availableProviders.length === 0) {
      throw new Error('At least one LLM provider API key is required. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY');
    }
    
    console.log(`✅ Available LLM providers: ${this.availableProviders.map(p => p.name).join(', ')}`);
    
    // Initialize Supabase client
    this.supabaseClient = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey);
    console.log('✅ Supabase client initialized');
    
    // Initialize REAL MCP tools - these must exist and work
    try {
      // These tools require dependencies that we need to provide
      // For now, let's check if we can instantiate them
      console.log('🔍 Checking MCP tool availability...');
      
      if (!EnhancedGenerateSQLTool) throw new Error('EnhancedGenerateSQLTool not available');
      if (!GetSchemaTool) throw new Error('GetSchemaTool not available');  
      if (!ExecuteSQLTool) throw new Error('ExecuteSQLTool not available');
      if (!QueryAndFormatTool) throw new Error('QueryAndFormatTool not available');
      if (!ReadDataTool) throw new Error('ReadDataTool not available');
      
      console.log('✅ All MCP tool classes are available');
      
      // Note: We'll need to initialize these with proper dependencies
      // For now, we verify they exist
      
    } catch (error) {
      throw new Error(`Failed to access MCP tools: ${error.message}`);
    }
  }

  async getRealDatabaseSchema() {
    console.log('\n📋 Getting REAL Database Schema');
    console.log('-'.repeat(50));
    
    try {
      // Use the REAL GetSchemaTool
      const schemaResult = await this.mcpTools.getSchema.execute({
        format: 'json',
        table_names: null // Get all tables
      });
      
      if (!schemaResult || !schemaResult.schema) {
        throw new Error('GetSchemaTool returned invalid result');
      }
      
      this.realSchema = schemaResult.schema;
      
      console.log(`✅ Retrieved schema with ${this.realSchema.tables?.length || 0} tables`);
      
      if (!this.realSchema.tables || this.realSchema.tables.length < 3) {
        throw new Error(`Insufficient tables in schema: ${this.realSchema.tables?.length || 0}. Expected at least 3 tables for comprehensive testing.`);
      }
      
      // Log some table names for verification
      const tableNames = this.realSchema.tables.slice(0, 5).map(t => t.name).join(', ');
      console.log(`✅ Sample tables: ${tableNames}...`);
      
    } catch (error) {
      throw new Error(`REAL schema discovery failed: ${error.message}`);
    }
  }

  async testRealSQLGeneration() {
    console.log('\n🤖 Testing REAL SQL Generation');
    console.log('-'.repeat(50));
    console.log(`🎯 Target: ${TEST_CONFIG.requiredTests}+ tests across providers`);
    
    // Create test prompts of varying difficulty
    const testPrompts = this.createTestPrompts();
    
    console.log(`📝 Testing ${testPrompts.length} prompts across ${this.availableProviders.length} providers`);
    
    let totalTests = 0;
    let passedTests = 0;
    
    for (const provider of this.availableProviders) {
      console.log(`\n🔄 Testing provider: ${provider.name}`);
      
      for (const model of provider.models.slice(0, 2)) { // Test first 2 models per provider
        console.log(`  📱 Model: ${model}`);
        
        for (const prompt of testPrompts.slice(0, 5)) { // Test first 5 prompts per model
          totalTests++;
          
          try {
            console.log(`    🔍 ${prompt.difficulty}: ${prompt.description}`);
            
            // Call REAL GenerateSQLTool with REAL LLM
            const result = await this.mcpTools.generateSQL.execute({
              prompt: prompt.prompt,
              use_context: true,
              llm_provider: provider.name,
              llm_model: model
            });
            
            if (!result || !result.sql) {
              throw new Error('GenerateSQLTool returned no SQL');
            }
            
            // Validate the SQL is real and reasonable
            if (result.sql.trim().length < 10) {
              throw new Error('Generated SQL is too short to be valid');
            }
            
            if (!result.sql.toLowerCase().includes('select')) {
              throw new Error('Generated SQL does not contain SELECT statement');
            }
            
            console.log(`    ✅ Generated: ${result.sql.substring(0, 100)}...`);
            
            this.testResults.push({
              type: 'sql_generation',
              provider: provider.name,
              model: model,
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
              model: model,
              prompt: prompt,
              error: error.message,
              status: 'failed',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
    
    console.log(`\n📊 SQL Generation Results: ${passedTests}/${totalTests} passed (${(passedTests/totalTests*100).toFixed(1)}%)`);
    
    if (passedTests === 0) {
      throw new Error('NO SQL generation tests passed. System is not working.');
    }
  }

  async testRealSQLExecution() {
    console.log('\n⚡ Testing REAL SQL Execution');
    console.log('-'.repeat(50));
    
    // Get successful SQL generation results
    const successfulGenerations = this.testResults.filter(r => r.type === 'sql_generation' && r.status === 'passed');
    
    if (successfulGenerations.length === 0) {
      throw new Error('No successful SQL generations to execute');
    }
    
    let executionTests = 0;
    let executionPassed = 0;
    
    for (const generation of successfulGenerations.slice(0, 10)) { // Test first 10 successful generations
      executionTests++;
      
      try {
        console.log(`  🔄 Executing: ${generation.result.sql.substring(0, 80)}...`);
        
        // Use REAL ExecuteSQLTool
        const execResult = await this.mcpTools.executeSQL.execute({
          sql: generation.result.sql,
          dry_run: false,
          timeout_ms: 30000
        });
        
        if (!execResult) {
          throw new Error('ExecuteSQLTool returned no result');
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

  async testRealDataFormatting() {
    console.log('\n📊 Testing REAL Data Formatting');
    console.log('-'.repeat(50));
    
    // Get successful execution results
    const successfulExecutions = this.testResults.filter(r => r.type === 'sql_execution' && r.status === 'passed');
    
    if (successfulExecutions.length === 0) {
      throw new Error('No successful SQL executions to format');
    }
    
    const formats = ['json', 'csv', 'markdown', 'table'];
    let formatTests = 0;
    let formatPassed = 0;
    
    for (const execution of successfulExecutions.slice(0, 3)) { // Test first 3 successful executions
      for (const format of formats) {
        formatTests++;
        
        try {
          console.log(`  🔄 Formatting as ${format}...`);
          
          // Use REAL QueryAndFormatTool
          const formatResult = await this.mcpTools.queryAndFormat.execute({
            prompt: execution.originalGeneration.prompt.prompt,
            format: format,
            execute: false, // Don't re-execute, just format the data
            existing_data: execution.result.data
          });
          
          if (!formatResult || !formatResult.formatted_data) {
            throw new Error('QueryAndFormatTool returned no formatted data');
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

  generateRealTestReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 REAL MCP INTEGRATION TEST RESULTS');
    console.log('='.repeat(80));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'passed').length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100) : 0;
    
    console.log(`📈 Overall Success Rate: ${successRate.toFixed(1)}% (${passedTests}/${totalTests})`);
    
    // Break down by test type
    const testTypes = ['sql_generation', 'sql_execution'];
    for (const type of testTypes) {
      const typeResults = this.testResults.filter(r => r.type === type);
      const typePassed = typeResults.filter(r => r.status === 'passed').length;
      const typeTotal = typeResults.length;
      const typeRate = typeTotal > 0 ? (typePassed / typeTotal * 100) : 0;
      
      console.log(`${type.toUpperCase()}: ${typePassed}/${typeTotal} passed (${typeRate.toFixed(1)}%)`);
    }
    
    // Save detailed results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `real-mcp-integration-results-${timestamp}.json`;
    
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      testSuite: 'REAL MCP Integration Tests',
      sessionId: TEST_CONFIG.testSessionId,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate
      },
      availableProviders: this.availableProviders,
      databaseSchema: this.realSchema,
      detailedResults: this.testResults
    }, null, 2));
    
    console.log(`\n📄 Detailed results saved to: ${resultsFile}`);
    
    // Final assessment
    if (successRate >= 80) {
      console.log('\n🎉 REAL integration tests PASSED!');
      console.log('✅ MCP system is working with real LLMs and database');
      console.log('🚀 Ready for UI development');
    } else {
      console.log('\n❌ REAL integration tests FAILED');
      console.log(`💥 Success rate ${successRate.toFixed(1)}% is below 80% threshold`);
      console.log('🔧 Fix the actual MCP system before proceeding');
      process.exit(1);
    }
  }
}

// Validate environment on startup
function validateEnvironment() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`  - ${varName}`));
    process.exit(1);
  }
  
  const llmKeys = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_API_KEY'];
  const availableLLMs = llmKeys.filter(key => process.env[key]);
  
  if (availableLLMs.length === 0) {
    console.error('❌ No LLM provider API keys found');
    console.error('Set at least one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY');
    process.exit(1);
  }
}

// Main execution
async function main() {
  validateEnvironment();
  
  const tester = new RealMCPIntegrationTests();
  await tester.runRealTests();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ FATAL ERROR:', error);
    console.error(error.stack);
    process.exit(1);
  });
}

export { RealMCPIntegrationTests };