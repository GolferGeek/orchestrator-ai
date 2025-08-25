#!/usr/bin/env node

/**
 * Simple Test for Enhanced Metrics Agent Context-Driven SQL Generation
 */

const { initializeForCompany, generateAndExecuteCompanySQL } = require('./apps/api/dist/src/supabase/utils/supabase-tools');

async function testMetricsSQL() {
  console.log('🧪 Testing Enhanced Metrics Agent SQL Generation\n');
  
  try {
    // Initialize for KPI & Analytics
    await initializeForCompany({
      includeDomains: ['KPI & Analytics'],
      agentName: 'Enhanced Metrics Agent Test',
    });
    
    console.log('✅ Database connection initialized\n');
    
    // Test 1: Context-driven company count query
    console.log('Test 1: Context-Driven Company Count');
    console.log('Using schema context instead of database discovery');
    console.log('---');
    
    const schemaContext1 = `
DATABASE SCHEMA: companies table has columns: id (UUID), name (VARCHAR), industry (VARCHAR), founded_year (INTEGER), created_at, updated_at.
User Question: "Show me the count of companies in the database"
Generate SQL using: SELECT COUNT(*) FROM companies;`;
    
    const result1 = await generateAndExecuteCompanySQL(schemaContext1, {
      executeQuery: true,
      maxRows: 10,
      provider: 'openai',
      model: 'gpt-4'
    });
    
    console.log('SQL Generated:', result1.sql);
    console.log('Query Success:', !result1.error);
    console.log('Results:', result1.result);
    console.log('\n---\n');
    
    // Test 2: Context-driven revenue query  
    console.log('Test 2: Context-Driven Revenue Query');
    console.log('Using complete schema context for proper joins');
    console.log('---');
    
    const schemaContext2 = `
DATABASE SCHEMA (Supabase SaaS - Public Schema):

companies table: id (UUID, Primary Key), name (VARCHAR(255), NOT NULL), industry (VARCHAR(100)), founded_year (INTEGER)
departments table: id (UUID, Primary Key), company_id (UUID, Foreign Key → companies.id), name (VARCHAR(255), NOT NULL), budget (DECIMAL(15,2))
kpi_metrics table: id (UUID, Primary Key), name (VARCHAR(255), NOT NULL), metric_type (VARCHAR(100)), unit (VARCHAR(50))
kpi_data table: id (UUID, Primary Key), department_id (UUID, Foreign Key → departments.id), metric_id (UUID, Foreign Key → kpi_metrics.id), value (DECIMAL(15,4), NOT NULL), date_recorded (DATE, NOT NULL)

CRITICAL: Companies table has 'name' column, NOT 'company_name'. Revenue data is in kpi_data table joined with kpi_metrics.

Example Pattern: SELECT c.name, SUM(kd.value) as total_revenue FROM companies c JOIN departments d ON c.id = d.company_id JOIN kpi_data kd ON d.id = kd.department_id JOIN kpi_metrics km ON kd.metric_id = km.id WHERE km.name = 'Revenue' GROUP BY c.id, c.name ORDER BY total_revenue DESC;

User Question: "Show me revenue by company"
Generate SQL using the exact schema above. Use correct table and column names.`;
    
    const result2 = await generateAndExecuteCompanySQL(schemaContext2, {
      executeQuery: true,
      maxRows: 10,
      provider: 'openai',
      model: 'gpt-4'
    });
    
    console.log('SQL Generated:', result2.sql);
    console.log('Query Success:', !result2.error);
    console.log('Results:', result2.result);
    
    // Validation
    const sqlCorrect = result2.sql && 
      result2.sql.includes('companies') &&
      (result2.sql.includes('c.name') || result2.sql.includes('companies.name')) &&
      !result2.sql.includes('company_name') &&
      result2.sql.includes('JOIN');
      
    console.log('\n🔍 SQL Validation:');
    console.log('✅ Uses companies table:', result2.sql.includes('companies'));
    console.log('✅ Uses correct name column:', result2.sql.includes('c.name') || result2.sql.includes('companies.name'));
    console.log('❌ Uses wrong company_name:', result2.sql.includes('company_name'));
    console.log('✅ Has proper joins:', result2.sql.includes('JOIN'));
    console.log('🎯 Overall SQL Correctness:', sqlCorrect);
    
    if (sqlCorrect) {
      console.log('\n🎉 SUCCESS: Context-driven SQL generation is working correctly!');
      console.log('The enhanced metrics agent is now generating proper SQL queries.');
    } else {
      console.log('\n⚠️ NEEDS WORK: SQL generation still has issues.');
      console.log('The context schema is not being used effectively by LangChain.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Check environment
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('⚠️ Missing required environment variables:');
  console.log('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

testMetricsSQL().catch(console.error);