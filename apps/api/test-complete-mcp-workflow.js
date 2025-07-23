#!/usr/bin/env node

const http = require('http');

// Test the complete MCP workflow step by step
async function makeRequest(path, method = 'GET', data = null) {
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testCompleteMCPWorkflow() {
  console.log('🔍 Testing Complete MCP Workflow\n');
  console.log('Step 1: Get Schema');
  console.log('Step 2: Hold Schema (in memory)');
  console.log('Step 3: Create SQL Query');
  console.log('Step 4: Run SQL Query');
  console.log('Step 5: Get Data Back');
  console.log('Step 6: Format Data');
  console.log('Step 7: Return Formatted Data');
  console.log('=' .repeat(60));

  try {
    // Step 1: Get Schema
    console.log('\n🔍 Step 1: Getting database schema...');
    const schemaResponse = await makeRequest('/mcp/supabase/schema');
    
    if (!schemaResponse.tool_result || !schemaResponse.tool_result.content) {
      throw new Error('Failed to get schema');
    }

    const schemaData = JSON.parse(schemaResponse.tool_result.content[0].text);
    console.log(`✅ Schema retrieved: ${schemaData.database_summary.total_tables} tables found`);
    
    // Find KPI-related tables
    const kpiTables = schemaData.database_summary.tables.filter(t => 
      t.name.includes('kpi') || t.name.includes('metrics')
    );
    console.log(`📊 KPI tables found: ${kpiTables.map(t => t.name).join(', ')}`);

    // Step 2: Hold Schema (demonstrate we have it in memory)
    console.log('\n💾 Step 2: Holding schema in memory...');
    const heldSchema = {
      total_tables: schemaData.database_summary.total_tables,
      kpi_tables: kpiTables,
      timestamp: new Date().toISOString()
    };
    console.log('✅ Schema held in memory for query generation');

    // Step 3: Create SQL Query using the schema
    console.log('\n🛠️ Step 3: Creating SQL query from schema...');
    const sqlGenerationResponse = await makeRequest('/mcp/supabase/tools/generate-sql', 'POST', {
      natural_language_query: `Show me all KPI metrics with their names, descriptions, and units from the database. Use the kpi_metrics table.`,
      query_type: 'SELECT',
      include_explanation: true,
      max_rows: 10
    });

    if (!sqlGenerationResponse.tool_result.content) {
      throw new Error('Failed to generate SQL');
    }

    const sqlResult = JSON.parse(sqlGenerationResponse.tool_result.content[0].text);
    console.log('✅ SQL Query Generated:');
    console.log(`📝 Query: ${sqlResult.generated_sql}`);
    console.log(`💡 Explanation: ${sqlResult.explanation}`);

    // Step 4: Run the SQL Query
    console.log('\n⚡ Step 4: Executing the generated SQL query...');
    const executionResponse = await makeRequest('/mcp/supabase/tools/execute-sql', 'POST', {
      sql_query: sqlResult.generated_sql,
      format: 'json',
      max_rows: 10
    });

    if (!executionResponse.tool_result.content) {
      throw new Error('Failed to execute SQL');
    }

    const executionResult = JSON.parse(executionResponse.tool_result.content[0].text);
    console.log('✅ SQL Query Executed Successfully');
    console.log(`📊 Records returned: ${executionResult.data ? executionResult.data.length : 0}`);

    // Step 5: Get Data Back (demonstrate we have the data)
    console.log('\n📥 Step 5: Data retrieved from database...');
    const retrievedData = executionResult.data || [];
    console.log(`✅ Retrieved ${retrievedData.length} records`);
    
    if (retrievedData.length > 0) {
      console.log('🔍 Sample record:', JSON.stringify(retrievedData[0], null, 2));
    }

    // Step 6: Format the Data  
    console.log('\n🎨 Step 6: Formatting data for presentation...');
    const formatResponse = await makeRequest('/mcp/supabase/tools/query-and-format', 'POST', {
      user_prompt: `Format these KPI metrics in a nice table format: ${JSON.stringify(retrievedData)}`,
      output_format: 'table',
      include_explanation: false
    });

    if (!formatResponse.tool_result.content) {
      throw new Error('Failed to format data');
    }

    const formattedResult = JSON.parse(formatResponse.tool_result.content[0].text);
    console.log('✅ Data formatted successfully');

    // Step 7: Return Formatted Data
    console.log('\n📋 Step 7: Final formatted result:');
    console.log('=' .repeat(60));
    console.log(formattedResult.formatted_response || formattedResult.response || 'No formatted response');
    console.log('=' .repeat(60));

    // Summary
    console.log('\n🎉 COMPLETE MCP WORKFLOW VALIDATION');
    console.log('✅ Step 1: Schema Retrieved ✓');
    console.log('✅ Step 2: Schema Held in Memory ✓');
    console.log('✅ Step 3: SQL Query Generated ✓');
    console.log('✅ Step 4: SQL Query Executed ✓');
    console.log('✅ Step 5: Data Retrieved ✓');
    console.log('✅ Step 6: Data Formatted ✓');
    console.log('✅ Step 7: Formatted Data Returned ✓');
    
    console.log('\n📊 Workflow Statistics:');
    console.log(`- Tables in Schema: ${heldSchema.total_tables}`);
    console.log(`- KPI Tables: ${heldSchema.kpi_tables.length}`);
    console.log(`- SQL Query Generated: Yes`);
    console.log(`- Records Retrieved: ${retrievedData.length}`);
    console.log(`- Data Formatted: Yes`);
    
    console.log('\n🎯 The complete MCP workflow is working perfectly!');
    console.log('The Metrics Agent can now:');
    console.log('• Discover database schema dynamically');
    console.log('• Generate SQL queries from natural language');
    console.log('• Execute queries against live database');
    console.log('• Retrieve and format results');
    console.log('• Present data in user-friendly formats');

  } catch (error) {
    console.error('\n❌ MCP Workflow Test Failed:', error.message);
    console.log('\nThis indicates an issue with the MCP infrastructure that needs to be resolved.');
    process.exit(1);
  }
}

// Run the comprehensive test
testCompleteMCPWorkflow()
  .then(() => {
    console.log('\n🎉 Complete MCP workflow validation successful!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Workflow validation failed:', err);
    process.exit(1);
  });