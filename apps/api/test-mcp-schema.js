#!/usr/bin/env node

const http = require('http');

// Test the MCP get-schema tool
async function testMCPSchema() {
  console.log('🧪 Testing MCP schema discovery...');
  
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/mcp/supabase/schema',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
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
          console.log('✅ MCP Schema Response:');
          console.log(JSON.stringify(response, null, 2));
          
          if (response.content && response.content[0] && response.content[0].text) {
            const schemaText = response.content[0].text;
            const tableCount = (schemaText.match(/table_name:/g) || []).length;
            console.log(`\n📊 Found ${tableCount} tables in schema`);
            
            // Check for specific tables mentioned by user
            const hasKpiData = schemaText.includes('kpi_data');
            const hasKpiGoals = schemaText.includes('kpi_goals');
            const hasKpiMetrics = schemaText.includes('kpi_metrics');
            const hasLlmModels = schemaText.includes('llm_models');
            
            console.log(`\n🎯 Key tables found:`);
            console.log(`   KPI Data: ${hasKpiData ? '✅' : '❌'}`);
            console.log(`   KPI Goals: ${hasKpiGoals ? '✅' : '❌'}`);
            console.log(`   KPI Metrics: ${hasKpiMetrics ? '✅' : '❌'}`);
            console.log(`   LLM Models: ${hasLlmModels ? '✅' : '❌'}`);
          }
          
          resolve(response);
        } catch (e) {
          console.error('❌ Failed to parse JSON response:', e);
          console.log('Raw response:', data);
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request failed:', err);
      reject(err);
    });

    req.end();
  });
}

// Run the test
testMCPSchema()
  .then(() => {
    console.log('\n🎉 Schema discovery test completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });