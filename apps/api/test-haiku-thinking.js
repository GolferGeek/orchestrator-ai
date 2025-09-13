#!/usr/bin/env node

const axios = require('axios');

async function testHaikuThinking() {
  console.log('Testing Claude Haiku 3.5 Thinking Extraction');
  console.log('===============================================\n');

  const API_URL = 'http://localhost:7100/llm/generate';
  const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  try {
    console.log('Test: Claude Haiku 3.5 with <thinking> tags');
    console.log('---------------------------------------------');
    
    const response = await axios.post(API_URL, {
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      systemPrompt: 'You are a helpful assistant. Use <thinking> tags to show your reasoning process before giving your answer.',
      userMessage: 'What is 15 * 8? Show your work using thinking tags.',
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
    console.log('\nMetadata thinking field:');
    console.log(response.data.metadata?.thinking || 'No thinking field found');
    
    if (response.data.metadata?.thinking) {
      console.log('\n✅ SUCCESS: Thinking extraction working for Haiku 3.5!');
    } else {
      console.log('\n❌ ISSUE: No thinking field in metadata for Haiku 3.5');
      console.log('Full metadata:');
      console.log(JSON.stringify(response.data.metadata, null, 2));
    }
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error:', error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testHaikuThinking();