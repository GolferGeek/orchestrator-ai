const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function testResponseStructure() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post('http://localhost:7100/auth/login', {
      email: 'demo.user@orchestratorai.io',
      password: 'DemoUser123!'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Login successful\n');
    
    console.log('🧪 Testing response structure...');
    
    const response = await axios.post('http://localhost:7100/agents/marketing/blog_post/tasks', {
      method: 'process',
      prompt: 'Write about Matt Weber and GolferGeek at Orchestrator AI.',
      conversationId: uuidv4(),
      conversationHistory: [],
      executionMode: 'immediate',
      taskId: uuidv4()
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📋 FULL RESPONSE STRUCTURE:');
    console.log('='.repeat(50));
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testResponseStructure();
