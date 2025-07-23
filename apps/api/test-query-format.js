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

async function testQueryFormat() {
  console.log('🔍 Testing query-and-format tool\n');

  const sampleData = [
    {
      "id": "5cc6a791-cce8-4d88-868a-3e6e40af07d9",
      "name": "Project Completion Rate",
      "description": "On-time project completion",
      "unit": "percentage",
      "metric_type": "operations"
    },
    {
      "id": "b9d666e6-264a-4257-8669-bc763f45f889",
      "name": "Cost Per Acquisition",
      "description": "Customer acquisition cost",
      "unit": "USD",
      "metric_type": "marketing"
    }
  ];

  try {
    console.log('⚡ Testing query-and-format tool...');
    
    const response = await makeRequest('/mcp/supabase/tools/query-and-format', 'POST', {
      arguments: {
        user_prompt: `Create a professional KPI metrics summary table showing the name, description, unit, and type for these metrics: ${JSON.stringify(sampleData)}`,
        output_format: 'table',
        include_explanation: false
      }
    });

    console.log('✅ Full response:');
    console.log(JSON.stringify(response, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testQueryFormat();