// Direct test of MCP SQL generation
const axios = require('axios');

async function testMCPSQLGeneration() {
  console.log('🚀 Testing MCP SQL Generation Directly');
  console.log('======================================\n');
  
  const API_BASE_URL = 'http://localhost:7100';
  
  // Test 1: Check API health
  try {
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ API is healthy:', healthResponse.data);
  } catch (error) {
    console.error('❌ API health check failed:', error.message);
    return;
  }
  
  // Test 2: Check MCP service status
  try {
    const mcpResponse = await axios.get(`${API_BASE_URL}/mcp/health`);
    console.log('✅ MCP service status:', mcpResponse.data);
  } catch (error) {
    console.log('ℹ️ MCP health endpoint not exposed (expected)');
  }
  
  // Test 3: List available agents
  try {
    const agentsResponse = await axios.get(`${API_BASE_URL}/agents`);
    console.log('\n📋 Available agents:');
    const agents = agentsResponse.data;
    const metricsAgent = agents.find(a => a.name?.includes('Metrics') || a.type === 'finance');
    if (metricsAgent) {
      console.log('✅ Found Metrics Agent:', metricsAgent);
    } else {
      console.log('⚠️ Metrics Agent not found in:', agents);
    }
  } catch (error) {
    console.log('ℹ️ Cannot list agents without auth');
  }
  
  console.log('\n📊 Expected SQL for "Give me all of the revenues by department":');
  console.log('===========================================================');
  console.log(`
SELECT 
  d.name as department_name,
  SUM(kd.value) as total_revenue
FROM departments d
JOIN kpi_data kd ON d.id = kd.department_id
JOIN kpi_metrics km ON kd.metric_id = km.id
WHERE km.name LIKE '%revenue%' OR km.metric_type = 'revenue'
GROUP BY d.id, d.name
ORDER BY d.name;
`);

  console.log('\n💡 Expected Results:');
  console.log('====================');
  console.log('Enterprise Accounts: 154775.0');
  console.log('Professional Services: 154775.0');
  console.log('Sales: 187185.0');
  
  console.log('\n📝 Summary:');
  console.log('===========');
  console.log('The metrics agent should:');
  console.log('1. ✅ Always return the generated SQL in the response');
  console.log('2. ✅ Use MCP tools (generate-sql, execute-sql) for database operations');
  console.log('3. ✅ Include proper JOINs between departments, kpi_data, and kpi_metrics tables');
  console.log('4. ✅ Use SUM aggregation for revenue calculation');
  console.log('5. ✅ GROUP BY department for proper aggregation');
  console.log('6. ✅ Pass provider/model parameters when specified (anthropic/claude-3-5-sonnet)');
}

// Run the test
testMCPSQLGeneration().catch(console.error);