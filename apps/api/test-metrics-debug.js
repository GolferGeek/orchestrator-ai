#!/usr/bin/env node

const axios = require('axios');

/**
 * Debug test for Metrics Agent SQL generation
 * 
 * Tests the exact flow:
 * 1. User prompt -> Agent (with debug)
 * 2. Agent -> mcpService.generateSQL (with debug)
 * 3. Check what SQL comes back (with debug)
 */
async function testMetricsAgentSQL() {
  console.log('🔍 DEBUG: Testing Metrics Agent SQL Generation Flow');
  console.log('===================================================\n');

  const API_URL = 'http://localhost:7100';
  const TEST_EMAIL = 'demo.user@orchestratorai.io';
  const TEST_PASSWORD = 'DemoUser123!';

  console.log('🔐 Step 0: AUTHENTICATING');
  console.log('=========================');
  console.log('Email:', TEST_EMAIL);
  
  // Authenticate first
  const authResponse = await axios.post(`${API_URL}/auth/login`, {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });
  
  const JWT_TOKEN = authResponse.data.accessToken;
  console.log('✅ Authentication successful');
  console.log('Token:', JWT_TOKEN.substring(0, 20) + '...');
  console.log('');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${JWT_TOKEN}`
  };

  try {
    // Step 1: Debug - what user prompt are we sending?
    const userPrompt = "Give me all of the revenues by department";
    console.log('📝 Step 1: USER PROMPT DEBUG');
    console.log('============================');
    console.log('User prompt being sent to agent:', userPrompt);
    console.log('');

    // Step 2: Call the metrics agent directly
    console.log('🚀 Step 2: CALLING METRICS AGENT');
    console.log('==================================');
    console.log('Making request to tasks endpoint...');
    
    const taskRequest = {
      method: "process",
      prompt: userPrompt,
      conversationHistory: [],
      llmSelection: {
        providerName: "anthropic",
        modelName: "claude-3-5-sonnet-20241022"
      }
    };
    
    console.log('Task request:', JSON.stringify(taskRequest, null, 2));
    
    const response = await axios.post(`${API_URL}/agents/finance/metrics/tasks`, taskRequest, { headers });
    
    console.log('✅ Agent response received');
    console.log('Response status:', response.status);
    console.log('Response received directly from agent');
    console.log('');
    
    console.log('📊 Step 3: ANALYZING AGENT RESULT');
    console.log('===================================');
    
    // Check if there's a response
    if (response.data) {
      console.log('📋 AGENT RESPONSE ANALYSIS');
      console.log('===========================');
      
      let parsedResponse;
      try {
        // Try to parse response.data if it's a string
        if (typeof response.data === 'string') {
          parsedResponse = JSON.parse(response.data);
          console.log('✅ Response data is valid JSON');
        } else {
          parsedResponse = response.data;
          console.log('✅ Response data is already an object');
        }
      } catch (e) {
        console.log('⚠️  Response is not JSON, treating as string');
        parsedResponse = { content: response.data };
      }
      
      console.log('Response keys:', Object.keys(parsedResponse));
      
      // Look for SQL in the response
      const responseText = parsedResponse.content || parsedResponse.response || JSON.stringify(parsedResponse);
      console.log('Response text preview (first 500 chars):');
      console.log(responseText.substring(0, 500));
      console.log('');
      
      if (responseText.includes('SQL') || responseText.includes('SELECT')) {
        console.log('✅ SQL found in response!');
        
        // Try to extract SQL
        const sqlMatch = responseText.match(/```sql\n(.*?)\n```/s);
        if (sqlMatch) {
          console.log('📝 EXTRACTED SQL:');
          console.log(sqlMatch[1]);
        } else {
          console.log('⚠️  SQL mentioned but not in code block format');
        }
      } else {
        console.log('❌ No SQL found in response');
        console.log('This indicates the generateSQL step failed');
      }
    } else {
      console.log('❌ No response from agent - task may have failed');
    }
    
  } catch (error) {
    console.error('💥 ERROR during debug test:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testMetricsAgentSQL();