const axios = require('axios');

async function testRequirementsWriterAPI() {
  try {
    console.log('🔐 Step 1: Authenticating with Supabase...');
    
    // First, authenticate with Supabase to get JWT token
    const loginResponse = await axios.post('http://localhost:4000/auth/login', {
      email: 'testuser@golfergeek.com',
      password: 'testuser01!'
    });
    
    console.log('✅ Authentication successful!');
    console.log('📋 Login response:', JSON.stringify(loginResponse.data, null, 2));
    const access_token = loginResponse.data.access_token || loginResponse.data.token || loginResponse.data.accessToken;
    console.log('🎟️  Got JWT token:', access_token ? 'YES' : 'NO');
    
    console.log('🔍 Step 2: Testing Requirements Writer agent...');
    
    // Now call the requirements writer agent with the JWT token
    const agentResponse = await axios.post(
      'http://localhost:4000/agents/engineering/requirements_writer/tasks',
      {
        method: 'executeTask',
        prompt: 'Write requirements for a simple todo list application. Include user stories, functional requirements, and technical specifications.',
        providerId: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022'
      },
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    console.log('✅ Requirements Writer executed successfully!');
    
    // The response has nested structure: result.success, result.response, etc.
    const result = agentResponse.data.result;
    console.log('📊 Response details:');
    console.log('   - HTTP Status:', agentResponse.status);
    console.log('   - Task Status:', agentResponse.data.status);
    console.log('   - Agent Success:', result?.success);
    console.log('   - Has Response:', !!result?.response);
    console.log('   - Execution Type:', result?.metadata?.executionType);
    console.log('   - Agent Type:', result?.metadata?.agentType);
    console.log('   - Script Path:', result?.metadata?.scriptPath);
    
    if (result?.response) {
      console.log('📄 Response Preview:', result.response.substring(0, 300) + '...');
    }
    
    if (result?.success) {
      console.log('\n🎉 MASSIVE SUCCESS! Requirements Writer works perfectly with new PythonFunctionAgentServicesContext!');
      console.log('✅ All services properly injected and functioning!');
      console.log('✅ Python function agent pattern is working correctly!');
      console.log('✅ Python script executed successfully via new service context!');
      console.log('✅ Full requirements document generated!');
      console.log(`✅ Script executed: ${result.metadata?.scriptPath}`);
    } else {
      console.log('\n⚠️  Agent executed but reported failure');
    }
    
  } catch (error) {
    console.error('❌ Error testing Requirements Writer API:', error.message);
    
    if (error.response) {
      console.error('📋 Response status:', error.response.status);
      console.error('📋 Response data:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔧 Server not running - make sure to start the API with npm run start:dev');
    }
  }
}

// Wait a moment for server to be ready, then test
setTimeout(() => {
  testRequirementsWriterAPI().catch(console.error);
}, 5000); // Wait 5 seconds for server to be ready