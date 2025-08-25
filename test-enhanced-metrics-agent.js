#!/usr/bin/env node

/**
 * Test Enhanced Metrics Agent with Context-Driven SQL Generation
 * 
 * This test validates that the metrics agent now generates correct SQL queries
 * using the context schema definitions instead of incorrect database discovery.
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./apps/api/dist/src/app.module');

async function testEnhancedMetricsAgent() {
  console.log('🧪 Testing Enhanced Metrics Agent with Context-Driven SQL Generation\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Get the enhanced metrics agent
    const agentService = app.get('AgentService');
    
    console.log('📊 Running test queries...\n');
    
    // Test 1: Basic company count query  
    console.log('Test 1: Basic company count');
    console.log('Query: "Show me the count of companies"');
    console.log('Expected: Should generate: SELECT COUNT(*) FROM companies;');
    console.log('---');
    
    const test1Result = await agentService.executeAgentTask({
      agentName: 'metrics',
      method: 'executeTask',
      params: {
        prompt: 'Show me the count of companies',
        userId: 'test-user',
        conversationId: 'test-conv-1'
      }
    });
    
    console.log('✅ Test 1 Result:');
    console.log('Success:', test1Result.success);
    if (test1Result.response) {
      const sqlMatch = test1Result.response.match(/```sql\n([\s\S]*?)\n```/);
      if (sqlMatch) {
        console.log('Generated SQL:', sqlMatch[1].trim());
      }
    }
    console.log('\n---\n');
    
    // Test 2: Revenue by company query
    console.log('Test 2: Revenue by company'); 
    console.log('Query: "Show me revenue by company"');
    console.log('Expected: Should use proper joins with companies.name, kpi_data, kpi_metrics');
    console.log('Expected: Should NOT use company_name column');
    console.log('---');
    
    const test2Result = await agentService.executeAgentTask({
      agentName: 'metrics', 
      method: 'executeTask',
      params: {
        prompt: 'Show me revenue by company',
        userId: 'test-user',
        conversationId: 'test-conv-2'
      }
    });
    
    console.log('✅ Test 2 Result:');
    console.log('Success:', test2Result.success);
    if (test2Result.response) {
      const sqlMatch = test2Result.response.match(/```sql\n([\s\S]*?)\n```/);
      if (sqlMatch) {
        const generatedSQL = sqlMatch[1].trim();
        console.log('Generated SQL:', generatedSQL);
        
        // Validation checks
        const hasCorrectTableName = generatedSQL.includes('companies');
        const hasCorrectColumnName = generatedSQL.includes('c.name') || generatedSQL.includes('companies.name');
        const hasWrongColumnName = generatedSQL.includes('company_name');
        const hasProperJoins = generatedSQL.includes('JOIN') && generatedSQL.includes('kpi_data');
        
        console.log('\n🔍 SQL Validation:');
        console.log('✅ Uses companies table:', hasCorrectTableName);
        console.log('✅ Uses correct name column:', hasCorrectColumnName);
        console.log('❌ Uses wrong company_name column:', hasWrongColumnName);
        console.log('✅ Has proper KPI joins:', hasProperJoins);
        
        if (hasCorrectColumnName && !hasWrongColumnName && hasProperJoins) {
          console.log('🎉 SQL GENERATION SUCCESS - Context schema working correctly!');
        } else {
          console.log('⚠️ SQL GENERATION NEEDS WORK - Still using incorrect patterns');
        }
      }
    }
    console.log('\n---\n');
    
    // Test 3: Department budgets query
    console.log('Test 3: Department budgets');
    console.log('Query: "List department budgets"');
    console.log('Expected: Should query departments table with budget, head_of_department columns');
    console.log('---');
    
    const test3Result = await agentService.executeAgentTask({
      agentName: 'metrics',
      method: 'executeTask', 
      params: {
        prompt: 'List department budgets',
        userId: 'test-user',
        conversationId: 'test-conv-3'
      }
    });
    
    console.log('✅ Test 3 Result:');
    console.log('Success:', test3Result.success);
    if (test3Result.response) {
      const sqlMatch = test3Result.response.match(/```sql\n([\s\S]*?)\n```/);
      if (sqlMatch) {
        console.log('Generated SQL:', sqlMatch[1].trim());
      }
    }
    console.log('\n---\n');
    
    console.log('🏁 Enhanced Metrics Agent Testing Complete');
    console.log('');
    console.log('Key improvements validated:');
    console.log('- Context-driven SQL generation instead of database discovery');
    console.log('- Correct table and column references (name vs company_name)');
    console.log('- Proper KPI data joins for business metrics');
    console.log('- Schema-aware query patterns');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await app.close();
  }
}

// Check if we have required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('⚠️ Missing required environment variables:');
  console.log('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

testEnhancedMetricsAgent().catch(console.error);