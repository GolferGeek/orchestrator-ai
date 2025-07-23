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

async function testKPISimple() {
  console.log('🔍 Simple KPI test\n');

  try {
    // Use read-data tool instead
    console.log('Using read-data tool to get kpi_metrics data...');
    const response = await makeRequest('/mcp/supabase/tools/read-data', 'POST', {
      arguments: {
        table_name: 'kpi_metrics',
        limit: 3,
        format: 'json'
      }
    });

    console.log('✅ Response:');
    console.log(JSON.stringify(response, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testKPISimple();