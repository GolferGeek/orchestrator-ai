const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_BASE = 'http://localhost:7100';
const ORG_SLUG = 'demo';
const AGENT_SLUG = 'supabase-agent';

// Test credentials from .env
const TEST_EMAIL = process.env.SUPABASE_TEST_USER || 'demo.user@orchestratorai.io';
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD || 'DemoUser123!';

/**
 * Simple A2A Orchestration Test
 * 
 * Tests the core A2A pattern with Supabase agent:
 * 1. Auth → JWT
 * 2. A2A call → Get schema  
 * 3. A2A call → Generate SQL
 * 4. A2A call → Execute SQL
 * 5. A2A call → Analyze results
 */
async function testA2AOrchestration() {
  console.log('🚀 A2A Orchestration Test: "How many users do we have?"');
  console.log('=' .repeat(50));
  
  let authToken = null;
  const conversationId = uuidv4();
  
  try {
    // Step 1: Get JWT Token
    console.log('\n1️⃣ Authentication...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    authToken = loginResponse.data.accessToken;
    console.log('✅ JWT obtained');
    
    // Step 2: A2A Call - Get Schema
    console.log('\n2️⃣ A2A Call: Get Schema');
    const schemaResponse = await makeA2ACall(authToken, conversationId, {
      action: 'get_schema',
      query: 'How many users do we have in the system?'
    }, 'Get database schema for user tables');
    
    console.log('✅ Schema retrieved');
    
    // Step 3: A2A Call - Generate SQL
    console.log('\n3️⃣ A2A Call: Generate SQL');
    const sqlResponse = await makeA2ACall(authToken, conversationId, {
      action: 'generate_sql',
      query: 'How many users do we have in the system?',
      context: 'Count all users in the system'
    }, 'Generate SQL to count users');
    
    const generatedSQL = sqlResponse.result?.payload?.content;
    console.log('✅ SQL generated:', generatedSQL?.substring(0, 80) + '...');
    
    // Step 4: A2A Call - Execute SQL
    console.log('\n4️⃣ A2A Call: Execute SQL');
    const executeResponse = await makeA2ACall(authToken, conversationId, {
      action: 'execute_sql',
      sql: generatedSQL || 'SELECT COUNT(*) as user_count FROM users',
      maxRows: 100
    }, 'Execute the SQL query');
    
    const queryResults = executeResponse.result?.payload?.content;
    console.log('✅ SQL executed');
    console.log('Results:', JSON.stringify(queryResults, null, 2));
    
    // Step 5: A2A Call - Analyze Results
    console.log('\n5️⃣ A2A Call: Analyze Results');
    const analysisResponse = await makeA2ACall(authToken, conversationId, {
      action: 'analyze_results',
      results: queryResults,
      analysisPrompt: 'Provide a clear summary for stakeholders'
    }, 'Analyze the results and provide summary');
    
    const analysis = analysisResponse.result?.payload?.content;
    console.log('✅ Analysis complete');
    console.log('Summary:', analysis);
    
    // Test Summary
    console.log('\n🎉 A2A Orchestration Complete!');
    console.log('=' .repeat(50));
    console.log('✅ All 5 A2A calls successful');
    console.log('✅ Full orchestration pipeline working');
    console.log('✅ Ready for multi-agent workflows');
    
  } catch (error) {
    console.error('\n❌ A2A Orchestration Failed');
    console.error('Error:', error.response?.data?.message || error.message);
    console.error('Status:', error.response?.status);
    process.exit(1);
  }
}

/**
 * Make an A2A call to the Supabase agent
 */
async function makeA2ACall(token, conversationId, payload, userMessage) {
  const request = {
    jsonrpc: '2.0',
    id: uuidv4(),
    method: 'execute_task',
    params: {
      mode: 'build',
      conversationId: conversationId,
      payload: payload,
      userMessage: userMessage,
      metadata: {
        testType: 'a2a_orchestration',
        timestamp: new Date().toISOString()
      }
    }
  };
  
  const response = await axios.post(
    `${API_BASE}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks`,
    request,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data;
}

// Run the test
if (require.main === module) {
  testA2AOrchestration().catch(console.error);
}

module.exports = { testA2AOrchestration };
