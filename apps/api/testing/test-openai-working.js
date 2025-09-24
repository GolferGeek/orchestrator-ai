const axios = require('axios');

async function testOpenAIWorking() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:7100/auth/login', {
      email: 'demo.user@orchestratorai.io',
      password: 'DemoUser123!'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful\n');
    
    console.log('🧪 Testing OpenAI with valid model...');
    
    try {
      const response = await axios.post('http://localhost:7100/llm/generate', {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Say hello in exactly 3 words.',
        options: {
          providerName: 'openai',
          modelName: 'gpt-4o-mini',  // Valid model
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
      
      console.log('✅ OPENAI SUCCESS:');
      console.log(`Response: "${response.data.response}"`);
      
    } catch (error) {
      console.log('❌ OPENAI FAILED:');
      console.log('Status:', error.response?.status);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
      
      if (error.code === 'ECONNABORTED') {
        console.log('Error: Request timeout');
      } else if (error.message) {
        console.log('Error Message:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
  }
}

testOpenAIWorking();
