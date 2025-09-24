const axios = require('axios');

async function testFinalStatus() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:7100/auth/login', {
      email: 'demo.user@orchestratorai.io',
      password: 'DemoUser123!'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful\n');
    
    const tests = [
      { name: 'OpenAI', provider: 'openai', model: 'gpt-3.5-turbo' },
      { name: 'Anthropic', provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
      { name: 'Google', provider: 'google', model: 'gemini-2.0-flash' },
      { name: 'Grok', provider: 'grok', model: 'grok-3-mini' },
      { name: 'Ollama', provider: 'ollama', model: 'llama3.2:latest' }
    ];
    
    for (const test of tests) {
      console.log(`🧪 Testing ${test.name} (${test.provider}/${test.model})...`);
      console.log('--------------------------------------------------');
      
      try {
        const response = await axios.post('http://localhost:7100/llm/generate', {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Say hello in exactly 3 words.',
          options: {
            providerName: test.provider,
            modelName: test.model,
            temperature: 0.1,
            maxTokens: 10
          }
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        
        console.log(`✅ ${test.name} SUCCESS:`);
        console.log(`   Response: "${response.data.response}"`);
        console.log(`   Tokens: N/A\n`);
        
      } catch (error) {
        console.log(`❌ ${test.name} FAILED:`);
        if (error.code === 'ECONNABORTED') {
          console.log('   Error: Request timeout (30s)\n');
        } else {
          console.log(`   Status: ${error.response?.status}`);
          console.log(`   Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}\n`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
  }
}

testFinalStatus();
