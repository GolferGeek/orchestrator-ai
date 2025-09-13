#!/usr/bin/env node

const axios = require('axios');

async function testSonnet4() {
  console.log('Testing Claude Sonnet 4');
  console.log('======================\n');

  const API_URL = 'http://localhost:7100/llm/generate';
  const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  try {
    console.log('Test: Claude Sonnet 4 with basic prompt');
    console.log('---------------------------------------');
    
    const response = await axios.post(API_URL, {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',  // Correct Sonnet 4 model name
      systemPrompt: 'You are a helpful assistant.',
      userMessage: 'What is 2+2?',
      options: {
        temperature: 0.3,
        maxTokens: 200,
        includeMetadata: true
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    });

    console.log('✅ SUCCESS: Sonnet 4 response received');
    console.log('Response content:', response.data.content);
    console.log('\nMetadata:');
    console.log(JSON.stringify(response.data.metadata, null, 2));
    
  } catch (error) {
    console.log('❌ ERROR with Sonnet 4:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }

  // Also test Claude Opus 4
  const otherModels = [
    'claude-opus-4-20250514'
  ];

  for (const modelName of otherModels) {
    try {
      console.log(`\nTest: Trying model name "${modelName}"`);
      console.log('-----------------------------------');
      
      const response = await axios.post(API_URL, {
        provider: 'anthropic',
        model: modelName,
        systemPrompt: 'You are a helpful assistant.',
        userMessage: 'What is 2+2?',
        options: {
          temperature: 0.3,
          maxTokens: 200,
          includeMetadata: true
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JWT_TOKEN}`
        }
      });

      console.log(`✅ SUCCESS: ${modelName} works!`);
      break;
      
    } catch (error) {
      console.log(`❌ FAILED: ${modelName}`);
      if (error.response?.data?.message) {
        console.log(`   Error: ${error.response.data.message}`);
      }
    }
  }
}

testSonnet4();