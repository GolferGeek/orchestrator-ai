const axios = require('axios');

async function testGoogleRouting() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:7100/auth/login', {
      email: 'demo.user@playground.com',
      password: 'demouser'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful\n');
    
    console.log('�� Testing Google routing...');
    
    try {
      const response = await axios.post('http://localhost:7100/llm/generate', {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Say hello in exactly 3 words.',
        options: {
          providerName: 'google',
          modelName: 'gemini-2.0-flash',
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
      
      console.log('✅ GOOGLE SUCCESS:');
      console.log(`Response: "${response.data.response}"`);
      
    } catch (error) {
      console.log('❌ GOOGLE FAILED:');
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.log(`Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
  }
}

testGoogleRouting();
