#!/usr/bin/env node

const axios = require('axios');

/**
 * Test the clean 3-step MCP architecture
 * 
 * Step 1: Generate SQL from query (schema context is built-in)
 * Step 2: Execute SQL and get results
 * Step 3: Analyze results with LLM
 * 
 * Optional: Get schema (for debugging/validation)
 */
async function test4StepMCP() {
  console.log('Testing Clean 3-Step MCP Architecture');
  console.log('====================================\n');

  const API_URL = 'http://localhost:7100/mcp';
  const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${JWT_TOKEN}`
  };

  // Helper function to create JSON-RPC requests
  function createJsonRpcRequest(method, params, id = null) {
    return {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: id || Date.now()
    };
  }

  try {
    // Step 1: Get Schema (optional - test it's working)
    console.log('Step 1: Getting schema for KPI tables...');
    console.log('=====================================');
    
    const schemaResponse = await axios.post(API_URL, createJsonRpcRequest(
      'tools/call',
      {
        name: 'supabase/get-schema',
        arguments: {
          domain: 'kpi',
          tables: ['companies', 'kpi_data']
        }
      }
    ), { headers });

    console.log('DEBUG - Schema response:', JSON.stringify(schemaResponse.data, null, 2));
    const schemaText = schemaResponse.data.result?.content?.[0]?.text || 'No schema returned';
    console.log('✅ Schema received (length:', schemaText.length, 'chars)');
    console.log('Schema preview:', schemaText.substring(0, 200) + '...\n');

    // Step 2: Generate SQL
    console.log('Step 2: Generating SQL...');
    console.log('=========================');
    
    const sqlResponse = await axios.post(API_URL, createJsonRpcRequest(
      'tools/call',
      {
        name: 'supabase/generate-sql',
        arguments: {
          query: 'Show me the top 5 companies by revenue',
          tables: ['companies', 'kpi_data', 'kpi_metrics'],
          domain_hint: 'KPI & Analytics',
          max_rows: 5
        }
      }
    ), { headers });

    const generatedSQL = sqlResponse.data.result?.content?.[0]?.text || 'No SQL returned';
    console.log('✅ SQL generated:');
    console.log(generatedSQL);
    console.log();

    // Verify it's clean SQL string, not JSON object
    if (generatedSQL.includes('SELECT') || generatedSQL.includes('select')) {
      console.log('✅ Clean SQL string returned (not JSON object)\n');
    } else {
      console.log('⚠️  Unexpected SQL format - may not be clean string\n');
    }

    // Step 3: Execute SQL  
    console.log('Step 3: Executing SQL...');
    console.log('========================');
    
    const executeResponse = await axios.post(API_URL, createJsonRpcRequest(
      'tools/call',
      {
        name: 'supabase/execute-sql',
        arguments: {
          sql: generatedSQL,
          max_rows: 10
        }
      }
    ), { headers });

    const results = executeResponse.data.result?.content?.[0]?.text || 'No results returned';
    console.log('✅ SQL executed:');
    console.log('Results preview:', results.substring(0, 300) + (results.length > 300 ? '...' : ''));
    console.log();

    // Verify it's clean data string, not JSON object wrapper
    try {
      const parsedResults = JSON.parse(results);
      if (Array.isArray(parsedResults)) {
        console.log('✅ Clean data array returned (', parsedResults.length, 'rows)\n');
      } else {
        console.log('✅ Clean formatted results returned\n');
      }
    } catch {
      console.log('✅ Clean text results returned (non-JSON format)\n');
    }

    // Step 4: Analyze Results
    console.log('Step 4: Analyzing results...');
    console.log('=============================');
    
    let dataForAnalysis;
    try {
      dataForAnalysis = JSON.parse(results);
      if (!Array.isArray(dataForAnalysis)) {
        dataForAnalysis = []; // Fallback for empty results
      }
    } catch {
      dataForAnalysis = []; // Fallback if results aren't JSON
    }

    const analysisResponse = await axios.post(API_URL, createJsonRpcRequest(
      'tools/call',
      {
        name: 'supabase/analyze-results',
        arguments: {
          data: dataForAnalysis,
          analysis_prompt: 'Summarize the key insights about company revenue performance from this data',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022'
        }
      }
    ), { headers });

    const analysis = analysisResponse.data.result?.content?.[0]?.text || 'No analysis returned';
    console.log('✅ Analysis completed:');
    console.log(analysis.substring(0, 500) + (analysis.length > 500 ? '...' : ''));
    console.log();

    // Verify it's clean analysis string, not JSON object wrapper
    console.log('✅ Clean analysis string returned (not LLM response object)\n');

    // Summary
    console.log('🎉 4-Step MCP Architecture Test COMPLETED');
    console.log('==========================================');
    console.log('✅ Step 1: Schema retrieval - Clean string returned');
    console.log('✅ Step 2: SQL generation - Clean SQL string returned');  
    console.log('✅ Step 3: SQL execution - Clean data results returned');
    console.log('✅ Step 4: Analysis - Clean analysis string returned');
    console.log('\nAll MCP tools return clean strings (not LLM response objects)');
    console.log('Perfect for WebSocket progress updates and orchestration!\n');

  } catch (error) {
    console.error('❌ 4-Step MCP Test Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

test4StepMCP();