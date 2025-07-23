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

async function testExecuteSQL() {
  console.log('🔍 Testing execute-sql tool directly\n');

  try {
    console.log('⚡ Testing simple SQL query...');
    
    const response = await makeRequest('/mcp/supabase/tools/execute-sql', 'POST', {
      arguments: {
        sql_query: 'SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = \'public\'',
        format: 'json'
      }
    });

    console.log('✅ Response received:');
    console.log(JSON.stringify(response, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testExecuteSQL();