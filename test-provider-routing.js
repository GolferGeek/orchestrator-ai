#!/usr/bin/env node

/**
 * Test script to verify provider routing works correctly after fixing the mapping issue
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:9000';

async function testProviderRouting() {
  console.log('🧪 Testing Provider Routing Fix...\n');

  try {
    // 1. Authenticate
    console.log('1. Authenticating...');
    const authResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: process.env.SUPABASE_TEST_USER,
      password: process.env.SUPABASE_TEST_PASSWORD,
    });

    const token = authResponse.data.accessToken;
    console.log('✅ Authentication successful\n');

    // 2. Test different provider/model combinations
    const testCases = [
      { provider: 'anthropic', model: 'claude-3.5-haiku-20241022', description: 'Anthropic Claude' },
      { provider: 'openai', model: 'gpt-4o-mini', description: 'OpenAI GPT' },
      { provider: 'google', model: 'gemini-2.0-flash-exp', description: 'Google Gemini' },
    ];

    for (const testCase of testCases) {
      console.log(`2. Testing ${testCase.description} (${testCase.provider}/${testCase.model})...`);
      
      try {
        const llmResponse = await axios.post(
          `${API_BASE}/llm/generate`,
          {
            systemPrompt: 'You are a helpful assistant.',
            userPrompt: 'Say hello in exactly 5 words.',
            providerName: testCase.provider,
            modelName: testCase.model,
            temperature: 0.1,
            maxTokens: 50
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log(`✅ ${testCase.description} successful!`);
        console.log(`   Response: ${(llmResponse.data.content || llmResponse.data.response || JSON.stringify(llmResponse.data)).substring(0, 50)}...`);
        console.log(`   Provider: ${llmResponse.data.metadata?.providerName || 'unknown'}`);
        console.log(`   Model: ${llmResponse.data.metadata?.modelName || 'unknown'}\n`);

      } catch (error) {
        console.log(`❌ ${testCase.description} failed:`);
        if (error.response?.data?.error) {
          console.log(`   Error: ${error.response.data.error.message || error.response.data.error}`);
        } else {
          console.log(`   Error: ${error.message}`);
        }
        console.log(`   Status: ${error.response?.status || 'Network error'}\n`);
      }
    }

    console.log('🎯 Provider routing test complete!');

  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
  }
}

testProviderRouting();
