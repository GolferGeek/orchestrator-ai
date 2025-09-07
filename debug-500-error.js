#!/usr/bin/env node

/**
 * Debug 500 Error in Agent Endpoints
 * Systematic testing to isolate the issue
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:9000';
const TEST_USER = process.env.SUPABASE_TEST_USER;
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD;

async function authenticate() {
  const response = await axios.post(`${API_BASE}/auth/login`, {
    email: TEST_USER,
    password: TEST_PASSWORD
  });
  return response.data.accessToken;
}

async function testEndpoints() {
  console.log('🔍 Debugging 500 Error in Agent Endpoints\n');
  
  try {
    const token = await authenticate();
    console.log('✅ Authentication successful\n');
    
    // Test 1: Basic LLM endpoint (this works)
    console.log('🧪 Test 1: Basic LLM Generate...');
    try {
      const llmResponse = await axios.post(`${API_BASE}/llm/generate`, {
        systemPrompt: 'You are helpful.',
        userPrompt: 'Say hello briefly.',
        options: {
          providerName: 'openai',
          modelName: 'o1-mini',
          maxTokens: 50
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ LLM Generate works:', llmResponse.data.response.substring(0, 50));
    } catch (error) {
      console.log('❌ LLM Generate failed:', error.response?.status, error.response?.data?.message);
    }
    
    // Test 2: Agent discovery (this works)
    console.log('\n🧪 Test 2: Agent Discovery...');
    try {
      const agentsResponse = await axios.get(`${API_BASE}/agents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Agent Discovery works:', agentsResponse.data.discoveredAgents, 'agents found');
    } catch (error) {
      console.log('❌ Agent Discovery failed:', error.response?.status, error.response?.data?.message);
    }
    
    // Test 3: Minimal agent call
    console.log('\n🧪 Test 3: Minimal Agent Call...');
    try {
      const agentResponse = await axios.post(`${API_BASE}/agents/finance/metrics/tasks`, {
        message: 'Hello'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Agent call works:', agentResponse.data);
    } catch (error) {
      console.log('❌ Agent call failed:', error.response?.status, error.response?.data?.message);
      console.log('📊 Full error:', JSON.stringify(error.response?.data, null, 2));
    }
    
    // Test 4: Agent call with LLM selection
    console.log('\n🧪 Test 4: Agent Call with LLM Selection...');
    try {
      const agentResponse = await axios.post(`${API_BASE}/agents/finance/metrics/tasks`, {
        message: 'Hello',
        llmSelection: {
          providerName: 'openai',
          modelName: 'o1-mini'
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Agent call with LLM selection works:', agentResponse.data);
    } catch (error) {
      console.log('❌ Agent call with LLM selection failed:', error.response?.status, error.response?.data?.message);
    }
    
    // Test 5: Different agent
    console.log('\n🧪 Test 5: Different Agent (Blog Post)...');
    try {
      const agentResponse = await axios.post(`${API_BASE}/agents/marketing/blog_post/tasks`, {
        message: 'Hello'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Blog post agent works:', agentResponse.data);
    } catch (error) {
      console.log('❌ Blog post agent failed:', error.response?.status, error.response?.data?.message);
    }
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
  }
}

testEndpoints();
