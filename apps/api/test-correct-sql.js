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
          console.log('Raw response:', responseData);
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testCorrectSQL() {
  console.log('🔍 Testing correct SQL\n');

  try {
    console.log('⚡ Testing SQL with correct column names...');
    
    const response = await makeRequest('/mcp/supabase/tools/execute-sql', 'POST', {
      arguments: {
        sql_query: 'SELECT id, name, description, unit, metric_type FROM kpi_metrics ORDER BY created_at DESC LIMIT 5',
        format: 'json'
      }
    });

    const result = JSON.parse(response.tool_result.content[0].text);
    console.log('✅ SQL executed successfully:');
    console.log(`   Records returned: ${result.data.length}`);
    console.log(`   Execution time: ${result.metadata.execution_time_ms}ms`);
    
    if (result.data.length > 0) {
      console.log('\n📊 Sample record:');
      console.log(JSON.stringify(result.data[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCorrectSQL();