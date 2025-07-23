#!/usr/bin/env node

const http = require('http');

async function makeRequest(path, method = 'GET', data = null) {
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: path,
    method: method,
    headers: { 'Content-Type': 'application/json' }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testSimpleMCPWorkflow() {
  console.log('🔍 Testing Simple MCP Workflow\n');

  try {
    // Step 1: Get Schema
    console.log('🔍 Step 1: Getting database schema...');
    const schemaResponse = await makeRequest('/mcp/supabase/schema');
    const schemaData = JSON.parse(schemaResponse.tool_result.content[0].text);
    console.log(`✅ Schema retrieved: ${schemaData.database_summary.total_tables} tables`);

    // Step 2: Hold Schema 
    console.log('💾 Step 2: Holding schema in memory...');
    const kpiTables = schemaData.database_summary.tables.filter(t => t.name.includes('kpi'));
    console.log(`📊 KPI tables: ${kpiTables.map(t => t.name).join(', ')}`);

    // Step 3: Create and Run SQL Query (direct approach)
    console.log('⚡ Step 3: Creating and executing SQL query...');
    const sqlQuery = 'SELECT * FROM kpi_metrics LIMIT 5';
    console.log(`📝 Query: ${sqlQuery}`);
    
    const executionResponse = await makeRequest('/mcp/supabase/tools/execute-sql', 'POST', {
      sql_query: sqlQuery,
      format: 'json'
    });

    const executionResult = JSON.parse(executionResponse.tool_result.content[0].text);
    console.log(`✅ Query executed: ${executionResult.data ? executionResult.data.length : 0} records returned`);

    // Step 4: Get Data Back
    console.log('📥 Step 4: Data retrieved...');
    const data = executionResult.data || [];
    if (data.length > 0) {
      console.log('🔍 Sample record:', JSON.stringify(data[0], null, 2));
    }

    // Step 5: Format with query-and-format tool
    console.log('🎨 Step 5: Formatting data...');
    const formatResponse = await makeRequest('/mcp/supabase/tools/query-and-format', 'POST', {
      user_prompt: `Create a nice table showing these KPI metrics with their names and descriptions`,
      output_format: 'table',
      suggested_tables: ['kpi_metrics']
    });

    const formatResult = JSON.parse(formatResponse.tool_result.content[0].text);
    
    // Step 6: Return Formatted Data
    console.log('📋 Step 6: Final formatted result:');
    console.log('=' .repeat(60));
    console.log(formatResult.formatted_response || formatResult.response || 'Formatted data');
    console.log('=' .repeat(60));

    console.log('\n🎉 SIMPLE MCP WORKFLOW SUCCESSFUL!');
    console.log('✅ Schema Retrieved and Held');
    console.log('✅ SQL Query Created and Executed'); 
    console.log('✅ Data Retrieved from Database');
    console.log('✅ Data Formatted and Returned');

  } catch (error) {
    console.error('\n❌ MCP Workflow Failed:', error.message);
    process.exit(1);
  }
}

testSimpleMCPWorkflow();