#!/usr/bin/env node

const http = require('http');

// First authenticate to get token
async function authenticate() {
  console.log('🔐 Authenticating with test credentials...');
  
  const authData = JSON.stringify({
    email: 'testuser@golfergeek.com',
    password: 'testuser01!'
  });

  const authOptions = {
    hostname: 'localhost',
    port: 4000,
    path: '/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(authData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(authOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.accessToken) {
            console.log('✅ Authentication successful');
            resolve(response.accessToken);
          } else {
            console.error('❌ Authentication failed:', response);
            reject(new Error('Authentication failed'));
          }
        } catch (e) {
          console.error('❌ Auth response parse error:', e);
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(authData);
    req.end();
  });
}

// Test the Metrics Agent with MCP integration
async function testMetricsAgent(authToken) {
  console.log('🧪 Testing Metrics Agent with MCP integration...');
  
  const requestData = JSON.stringify({
    method: 'analyzeMetrics',
    prompt: 'Show me our key performance metrics and KPI dashboard for this month',
    providerId: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    temperature: 0.3
  });

  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/agents/finance/metrics/tasks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'Content-Length': Buffer.byteLength(requestData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ Metrics Agent Response:');
          console.log('Task Status:', response.status || 'unknown');
          
          if (response.result) {
            console.log('Agent Success:', response.result.success ? 'SUCCESS' : 'FAILED');
            
            if (!response.result.success) {
              console.log('Agent Error:', response.result.error);
            }
            
            console.log('\n📊 Metrics Analysis Preview:');
            console.log((response.result.response || '').substring(0, 800) + '...');
          } else {
            console.log('No result object found');
            console.log('Full response:', JSON.stringify(response, null, 2).substring(0, 1000));
          }
          
          if (response.result && response.result.metadata) {
            console.log('\n📊 Agent Metadata:');
            console.log('- Agent:', response.result.metadata.agentName);
            console.log('- Processing Time:', response.result.metadata.processingTime + 'ms');
            console.log('- Tools Used:', response.result.metadata.toolsUsed);
            console.log('- Response Type:', response.result.metadata.responseType);
            console.log('- MCP Enabled:', response.result.metadata.mcpEnabled);
            console.log('- Data Source:', response.result.metadata.dataSource || 'database');
            
            if (response.result.metadata.dataPoints) {
              console.log('- Data Points Analyzed:', response.result.metadata.dataPoints);
            }
          }
          
          console.log('\n🎉 Metrics Agent with MCP integration test completed!');
          resolve(response);
        } catch (e) {
          console.error('❌ Failed to parse JSON response:', e);
          console.log('Raw response:', data.substring(0, 1000));
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request failed:', err);
      reject(err);
    });

    req.write(requestData);
    req.end();
  });
}

// Run the full test with authentication
async function runTest() {
  try {
    const authToken = await authenticate();
    await testMetricsAgent(authToken);
    console.log('\n🎉 Full test completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  }
}

runTest();