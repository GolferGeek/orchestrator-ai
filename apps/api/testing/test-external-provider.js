const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function testExternalProvider() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:7100/auth/login', {
      email: 'demo.user@orchestratorai.io',
      password: 'DemoUser123!'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful\n');
    
    console.log('🧪 Testing with EXTERNAL provider (should trigger dictionary pseudonymization)...');
    
    const response = await axios.post('http://localhost:7100/llm/generate', {
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Write about Matt Weber and GolferGeek at Orchestrator AI.',
      options: {
        providerName: 'anthropic',  // External provider
        modelName: 'claude-3-haiku-20240307',
        temperature: 0.7,
        maxTokens: 200
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 EXTERNAL PROVIDER METADATA:');
    console.log('='.repeat(50));
    
    if (response.data.metadata) {
      const metadata = response.data.metadata;
      
      console.log('\n🎯 Dictionary Pseudonymization Metadata:');
      console.log('  dataSanitizationApplied:', metadata.dataSanitizationApplied);
      console.log('  sanitizationLevel:', metadata.sanitizationLevel);
      console.log('  pseudonymsUsed:', metadata.pseudonymsUsed);
      console.log('  pseudonymTypes:', metadata.pseudonymTypes);
      console.log('  sanitizationTimeMs:', metadata.sanitizationTimeMs);
      
      if (metadata.pseudonymMappings) {
        console.log('\n🎭 Dictionary Mappings:');
        metadata.pseudonymMappings.forEach(mapping => {
          console.log(`  "${mapping.originalValue}" → "${mapping.pseudonym}"`);
        });
      } else {
        console.log('\n❌ No pseudonymMappings found!');
      }
      
      console.log('\n📋 Full Metadata:');
      console.log(JSON.stringify(metadata, null, 2));
    }
    
    console.log('\n📝 Response:');
    console.log(response.data.response);
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testExternalProvider();
