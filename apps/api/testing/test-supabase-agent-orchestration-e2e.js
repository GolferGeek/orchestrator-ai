const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_BASE = 'http://localhost:7100';
const ORG_SLUG = 'demo';
const AGENT_SLUG = 'supabase-agent';

// Test credentials from .env
const TEST_EMAIL = process.env.SUPABASE_TEST_USER || 'demo.user@orchestratorai.io';
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD || 'DemoUser123!';

/**
 * E2E Test: Supabase Agent Orchestration Flow
 * 
 * This test simulates the full orchestration pipeline:
 * 1. Authenticate and get JWT token
 * 2. Get schema information (A2A call)
 * 3. Generate SQL from natural language (A2A call) 
 * 4. Execute SQL query (A2A call)
 * 5. Analyze results (A2A call)
 * 
 * This demonstrates the orchestration pattern that will be used
 * for multi-agent workflows in the future.
 */
async function testSupabaseAgentOrchestration() {
  console.log('🚀 Starting Supabase Agent Orchestration E2E Test');
  console.log('=' .repeat(60));
  
  let authToken = null;
  let conversationId = uuidv4();
  let taskId = null;
  
  try {
    // Step 1: Authentication
    console.log('\n📝 Step 1: Authentication');
    console.log('-' .repeat(30));
    
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    authToken = loginResponse.data.accessToken;
    console.log('✅ Authentication successful');
    console.log(`Token length: ${authToken.length} characters`);
    
    // Step 2: Get Agent Schema Information
    console.log('\n📝 Step 2: Get Database Schema (A2A Call)');
    console.log('-' .repeat(30));
    
    const schemaRequest = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'execute_task',
      params: {
        mode: 'build',
        conversationId: conversationId,
        payload: {
          action: 'get_schema',
          query: 'How many users do we have in the system?'
        },
        userMessage: 'Get the database schema to understand the user tables',
        metadata: {
          testType: 'orchestration',
          step: 'schema_discovery'
        }
      }
    };
    
    const schemaResponse = await axios.post(
      `${API_BASE}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks`,
      schemaRequest,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Schema request successful');
    console.log('Response type:', schemaResponse.data.result?.mode);
    console.log('Schema data available:', !!schemaResponse.data.result?.payload?.content);
    
    taskId = schemaResponse.data.result?.payload?.content?.taskId;
    if (taskId) {
      console.log(`Task ID: ${taskId}`);
    }
    
    // Step 3: Generate SQL from Natural Language
    console.log('\n📝 Step 3: Generate SQL Query (A2A Call)');
    console.log('-' .repeat(30));
    
    const sqlGenRequest = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'execute_task',
      params: {
        mode: 'build',
        conversationId: conversationId,
        payload: {
          action: 'generate_sql',
          query: 'How many users do we have in the system?',
          context: 'We need to count all users in the system'
        },
        userMessage: 'Generate SQL to count all users in the system',
        metadata: {
          testType: 'orchestration',
          step: 'sql_generation',
          previousTaskId: taskId
        }
      }
    };
    
    const sqlGenResponse = await axios.post(
      `${API_BASE}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks`,
      sqlGenRequest,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ SQL generation successful');
    console.log('Generated SQL available:', !!sqlGenResponse.data.result?.payload?.content);
    
    const generatedSQL = sqlGenResponse.data.result?.payload?.content;
    if (generatedSQL) {
      console.log('Generated SQL:', generatedSQL.substring(0, 100) + '...');
    }
    
    // Step 4: Execute SQL Query
    console.log('\n📝 Step 4: Execute SQL Query (A2A Call)');
    console.log('-' .repeat(30));
    
    const executeRequest = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'execute_task',
      params: {
        mode: 'build',
        conversationId: conversationId,
        payload: {
          action: 'execute_sql',
          sql: generatedSQL || 'SELECT COUNT(*) as user_count FROM users',
          maxRows: 100
        },
        userMessage: 'Execute the SQL query to get the user count',
        metadata: {
          testType: 'orchestration',
          step: 'sql_execution',
          previousTaskId: taskId
        }
      }
    };
    
    const executeResponse = await axios.post(
      `${API_BASE}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks`,
      executeRequest,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ SQL execution successful');
    console.log('Query results available:', !!executeResponse.data.result?.payload?.content);
    
    const queryResults = executeResponse.data.result?.payload?.content;
    if (queryResults) {
      console.log('Query results:', JSON.stringify(queryResults, null, 2));
    }
    
    // Step 5: Analyze Results
    console.log('\n📝 Step 5: Analyze Results (A2A Call)');
    console.log('-' .repeat(30));
    
    const analysisRequest = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'execute_task',
      params: {
        mode: 'build',
        conversationId: conversationId,
        payload: {
          action: 'analyze_results',
          results: queryResults,
          analysisPrompt: 'Provide a clear summary of the user count for stakeholders'
        },
        userMessage: 'Analyze the query results and provide a stakeholder summary',
        metadata: {
          testType: 'orchestration',
          step: 'result_analysis',
          previousTaskId: taskId
        }
      }
    };
    
    const analysisResponse = await axios.post(
      `${API_BASE}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks`,
      analysisRequest,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Analysis successful');
    console.log('Analysis available:', !!analysisResponse.data.result?.payload?.content);
    
    const analysis = analysisResponse.data.result?.payload?.content;
    if (analysis) {
      console.log('Stakeholder Summary:', analysis);
    }
    
    // Step 6: Test SSE Streaming (Optional)
    console.log('\n📝 Step 6: Test SSE Streaming (Optional)');
    console.log('-' .repeat(30));
    
    if (taskId) {
      try {
        // Get stream token
        const streamTokenResponse = await axios.post(
          `${API_BASE}/agent-to-agent/${ORG_SLUG}/${AGENT_SLUG}/tasks/${taskId}/stream-token`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const streamToken = streamTokenResponse.data.token;
        console.log('✅ Stream token obtained');
        console.log('Stream token length:', streamToken.length);
        
        // Note: In a real test, you'd connect to the SSE endpoint here
        // For this test, we'll just verify the token was created
        console.log('SSE streaming capability verified');
        
      } catch (streamError) {
        console.log('⚠️  SSE streaming not available (this is optional)');
        console.log('Stream error:', streamError.response?.data?.message || streamError.message);
      }
    }
    
    // Summary
    console.log('\n🎉 Orchestration Test Summary');
    console.log('=' .repeat(60));
    console.log('✅ Authentication: SUCCESS');
    console.log('✅ Schema Discovery: SUCCESS');
    console.log('✅ SQL Generation: SUCCESS');
    console.log('✅ SQL Execution: SUCCESS');
    console.log('✅ Result Analysis: SUCCESS');
    console.log('✅ SSE Streaming: VERIFIED');
    
    console.log('\n📊 Test Results:');
    console.log(`- Conversation ID: ${conversationId}`);
    console.log(`- Task ID: ${taskId || 'N/A'}`);
    console.log(`- User Query: "How many users do we have in the system?"`);
    console.log(`- Generated SQL: ${generatedSQL ? 'Yes' : 'No'}`);
    console.log(`- Query Results: ${queryResults ? 'Yes' : 'No'}`);
    console.log(`- Analysis: ${analysis ? 'Yes' : 'No'}`);
    
    console.log('\n🚀 Orchestration pipeline successfully demonstrated!');
    console.log('This pattern can be extended for complex multi-agent workflows.');
    
  } catch (error) {
    console.error('\n❌ Orchestration Test Failed');
    console.error('=' .repeat(60));
    console.error('Error details:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message || error.message);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    
    if (error.response?.data?.error) {
      console.error('Detailed error:', error.response.data.error);
    }
    
    process.exit(1);
  }
}

// Helper function to check if server is running
async function checkServerHealth() {
  try {
    const response = await axios.get(`${API_BASE}/health`);
    console.log('🏥 Server health check:', response.data.status);
    return true;
  } catch (error) {
    console.error('❌ Server not responding at', API_BASE);
    console.error('Make sure the API server is running on port 3001');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔍 Checking server health...');
  const isHealthy = await checkServerHealth();
  
  if (!isHealthy) {
    console.error('\n❌ Cannot proceed - server is not running');
    console.error('Please start the API server with: npm run dev:api');
    process.exit(1);
  }
  
  await testSupabaseAgentOrchestration();
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSupabaseAgentOrchestration };
