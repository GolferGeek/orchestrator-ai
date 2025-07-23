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

async function testSQLDebug() {
  console.log('🔍 Debug SQL execution\n');

  try {
    console.log('⚡ Testing SQL execution...');
    
    const response = await makeRequest('/mcp/supabase/tools/execute-sql', 'POST', {
      arguments: {
        sql_query: 'SELECT id, name, description, unit, metric_type FROM kpi_metrics ORDER BY created_at DESC LIMIT 5',
        format: 'json'
      }
    });

    console.log('✅ Full response:');
    console.log(JSON.stringify(response, null, 2));

    console.log('\n📋 Response content text:');
    console.log(response.tool_result.content[0].text);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSQLDebug();