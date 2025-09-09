const axios = require('axios');

async function testCustomPseudonyms() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:7100/auth/login', {
      email: 'demo.user@playground.com',
      password: 'demouser'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful\n');
    
    // Test messages containing our custom pseudonyms
    const testMessages = [
      'Hello Matt Weber, how are you today?',
      'GolferGeek is working on the project.',
      'We are using Orchestrator-AI for this task.',
      'Matt Weber and GolferGeek are collaborating on Orchestrator-AI development.'
    ];
    
    console.log('🧪 Testing custom pseudonym detection and replacement...\n');
    
    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`Test ${i + 1}: "${message}"`);
      
      try {
        const response = await axios.post('http://localhost:7100/agents/marketing/blog_post/tasks', {
          method: 'process',
          prompt: message,
          conversationId: `test-conv-${Date.now()}-${i}`,
          conversationHistory: [],
          llmSelection: {
            providerName: 'ollama',
            modelName: 'llama3.2:1b',
            temperature: 0.7
          },
          executionMode: 'immediate',
          taskId: `test-task-${Date.now()}-${i}`
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data.success && response.data.response) {
          console.log('✅ Response received:');
          console.log(`   "${response.data.response.substring(0, 200)}..."`);
          
          // Check if original names are still present (they shouldn't be)
          const originalText = response.data.response;
          const hasOriginalNames = originalText.includes('Matt Weber') || 
                                 originalText.includes('GolferGeek') || 
                                 originalText.includes('Orchestrator-AI');
          
          if (hasOriginalNames) {
            console.log('❌ Original names still present - pseudonymization may not be working');
          } else {
            console.log('✅ Original names replaced - pseudonymization appears to be working');
          }
          
          // Check for sanitization metadata
          if (response.data.sanitizationMetadata) {
            console.log('🔍 Sanitization metadata:', JSON.stringify(response.data.sanitizationMetadata, null, 2));
          }
          
        } else if (response.data.blocked) {
          console.log('🚫 Request was blocked:', response.data.reason || 'No reason provided');
        } else {
          console.log('❓ Unexpected response format:', JSON.stringify(response.data, null, 2));
        }
      } catch (error) {
        console.log('❌ Error:', error.response?.status, error.response?.statusText);
        if (error.response?.data) {
          console.log('   Error details:', JSON.stringify(error.response.data, null, 2));
        }
      }
      
      console.log(''); // Empty line between tests
    }
    
  } catch (error) {
    console.log('❌ Login Error:', error.response?.data || error.message);
  }
}

testCustomPseudonyms();
