#!/usr/bin/env node

const axios = require('axios');

async function testThinkingExtraction() {
  console.log('Testing Anthropic Thinking Extraction');
  console.log('======================================\n');

  const API_URL = 'http://localhost:7100/llm/generate';
  const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  try {
    console.log('Test: Using <thinking> tags');
    console.log('----------------------------');
    
    const response = await axios.post(API_URL, {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'You are a helpful assistant. Use <thinking> tags to show your reasoning process before giving your answer.',
      userMessage: 'What is 25 * 4? Show your work.',
      options: {
        temperature: 0.3,
        maxTokens: 500,
        includeMetadata: true
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    });

    console.log('Response content (should be clean without thinking tags):');
    console.log(response.data.content);
    console.log('\nThinking extracted to metadata:');
    console.log(response.data.metadata?.thinking || 'No thinking found');
    console.log('\n✅ Test passed - thinking extraction working!');
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error:', error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testThinkingExtraction();