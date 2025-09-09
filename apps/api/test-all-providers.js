const axios = require('axios');

async function testAllProviders() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:7100/auth/login', {
      email: 'demo.user@playground.com',
      password: 'demouser'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful\n');
    
    const providers = [
      { name: 'OpenAI', provider: 'openai', model: 'gpt-3.5-turbo' },
      { name: 'Anthropic', provider: 'anthropic', model: 'claude-3-haiku-20240307' },
      { name: 'Google', provider: 'google', model: 'gemini-pro' },
      { name: 'Grok', provider: 'grok', model: 'grok-beta' },
      { name: 'Ollama (Local)', provider: 'ollama', model: 'llama3.2:1b' }
    ];
    
    for (const { name, provider, model } of providers) {
      console.log(`\n🧪 Testing ${name} (${provider}/${model})...`);
      console.log('-'.repeat(50));
      
      try {
        const response = await axios.post('http://localhost:7100/llm/generate', {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Say hello in exactly 5 words.',
          options: {
            providerName: provider,
            modelName: model,
            temperature: 0.1,
            maxTokens: 20
          }
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        });
        
        console.log(`✅ ${name} SUCCESS:`);
        console.log(`   Response: "${response.data.response}"`);
        console.log(`   Tokens: ${response.data.metadata?.usage?.totalTokens || 'N/A'}`);
        
      } catch (error) {
        console.log(`❌ ${name} FAILED:`);
        if (error.response) {
          console.log(`   Status: ${error.response.status}`);
          console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
        } else if (error.code === 'ECONNABORTED') {
          console.log(`   Error: Request timeout (30s)`);
        } else {
          console.log(`   Error: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
  }
}

testAllProviders();
