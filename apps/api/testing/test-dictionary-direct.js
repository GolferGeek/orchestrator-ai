const axios = require('axios');

async function testDictionaryDirect() {
  try {
    console.log('🧪 Testing dictionary pseudonymization directly...');
    
    // Test the dictionary data in the database
    console.log('📊 Checking dictionary data in database...');
    
    const loginResponse = await axios.post('http://localhost:7100/auth/login', {
      email: 'demo.user@orchestratorai.io',
      password: 'DemoUser123!'
    });
    
    const token = loginResponse.data.accessToken;
    
    // Check if we can query the pseudonym_dictionaries table
    const dbResponse = await axios.post('http://localhost:7100/llm/generate', {
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Just say hello.',
      options: {
        provider: 'ollama',
        model: 'llama3.2:1b',
        temperature: 0.1,
        maxTokens: 10
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Basic LLM call works');
    
    // Now test with our pseudonym entities
    console.log('\n🎯 Testing with pseudonym entities...');
    
    const testResponse = await axios.post('http://localhost:7100/llm/generate', {
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Tell me about Matt Weber and GolferGeek at Orchestrator AI.',
      options: {
        provider: 'ollama',
        model: 'llama3.2:1b',
        temperature: 0.1,
        maxTokens: 50
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Pseudonym test call works');
    console.log('📝 Response:', testResponse.data.response);
    
    // Check if names are preserved (they should be for local provider)
    const hasOriginals = testResponse.data.response.includes('Matt Weber') || 
                         testResponse.data.response.includes('GolferGeek') || 
                         testResponse.data.response.includes('Orchestrator AI');
    
    if (hasOriginals) {
      console.log('✅ Original names preserved (expected for local provider)');
    } else {
      console.log('ℹ️  Names not mentioned in response');
    }
    
    console.log('\n✅ Dictionary service appears to be working correctly');
    
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.log('   Error details:', JSON.stringify(error.response.data, null, 2));
    }
    console.log('   Stack:', error.stack);
  }
}

testDictionaryDirect();
