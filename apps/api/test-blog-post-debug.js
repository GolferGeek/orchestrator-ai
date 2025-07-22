#!/usr/bin/env node

// Use built-in fetch (Node.js 18+)
const fetch = global.fetch || require('undici').fetch;

const API_BASE = 'http://localhost:4000';
const TEST_EMAIL = 'testuser@golfergeek.com';
const TEST_PASSWORD = 'testuser01!';

async function testBothAgents() {
  console.log('🧪 Comparing Deliverable Formats - Requirements vs Blog Post');
  console.log('===========================================================\n');

  let authToken = null;

  try {
    // Step 1: Login
    console.log('1️⃣ Attempting login...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('❌ Login failed:', loginResponse.status, errorText);
      return;
    }

    const loginData = await loginResponse.json();
    authToken = loginData.accessToken;
    console.log('✅ Login successful - token received:', authToken ? 'YES' : 'NO');
    console.log();

    // Step 2: Check agents endpoint for blog_post execution modes
    console.log('2️⃣ Checking /agents endpoint for blog_post...');
    const agentsResponse = await fetch(`${API_BASE}/agents`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!agentsResponse.ok) {
      const errorText = await agentsResponse.text();
      console.error('❌ Agents endpoint failed:', agentsResponse.status, errorText);
      return;
    }

    const agentsData = await agentsResponse.json();
    const blogPostAgent = agentsData.agents.find(agent => agent.name === 'blog_post');
    const requirementsAgent = agentsData.agents.find(agent => agent.name === 'requirements_writer');
    
    if (!blogPostAgent || !requirementsAgent) {
      console.error('❌ Missing agents:');
      console.log('  Blog post agent found:', !!blogPostAgent);
      console.log('  Requirements agent found:', !!requirementsAgent);
      console.log('Available agents:', agentsData.agents.map(a => a.name).join(', '));
      return;
    }

    console.log('✅ Found both agents:');
    console.log('📝 Blog Post Agent:');
    console.log('  - Name:', blogPostAgent.name, '| Type:', blogPostAgent.type);
    console.log('  - Execution Modes:', JSON.stringify(blogPostAgent.execution_modes));
    console.log('📋 Requirements Writer Agent:');
    console.log('  - Name:', requirementsAgent.name, '| Type:', requirementsAgent.type);
    console.log('  - Execution Modes:', JSON.stringify(requirementsAgent.execution_modes));
    console.log();

    // Step 3: Test both agents and compare deliverable formats
    console.log('3️⃣ Testing both agents and comparing deliverable formats...\n');

    // Test Blog Post Writer
    console.log('📝 Testing Blog Post Writer:');
    const blogPostPayload = {
      method: 'generateBlogPost',
      prompt: 'Write a short blog post about AI benefits. Keep it under 200 words.',
      executionMode: 'immediate'
    };

    const blogPostResponse = await fetch(`${API_BASE}/agents/marketing/blog_post/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(blogPostPayload),
    });

    console.log('Blog Post Response Status:', blogPostResponse.status);
    
    if (!blogPostResponse.ok) {
      const errorText = await blogPostResponse.text();
      console.error('❌ Blog Post task failed:', blogPostResponse.status, errorText);
      return;
    }

    const blogPostData = await blogPostResponse.json();
    console.log('✅ Blog Post Response Structure:');
    console.log('  - Keys:', Object.keys(blogPostData));
    console.log('  - Status:', blogPostData.status);
    console.log('  - Has result:', !!blogPostData.result);
    console.log('  - Has deliverable:', !!blogPostData.deliverable);
    if (blogPostData.result) {
      console.log('  - Result keys:', Object.keys(blogPostData.result));
      console.log('  - Result.success:', blogPostData.result.success);
      console.log('  - Result.response type:', typeof blogPostData.result.response);
      console.log('  - Result.response length:', blogPostData.result.response?.length);
    }
    console.log();

    // Test Requirements Writer  
    console.log('📋 Testing Requirements Writer:');
    const requirementsPayload = {
      method: 'generateRequirements',
      prompt: 'Generate requirements for a simple mobile app. Keep it concise.',
      executionMode: 'immediate'
    };

    const requirementsResponse = await fetch(`${API_BASE}/agents/engineering/requirements_writer/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(requirementsPayload),
    });

    console.log('Requirements Response Status:', requirementsResponse.status);
    
    if (!requirementsResponse.ok) {
      const errorText = await requirementsResponse.text();
      console.error('❌ Requirements task failed:', requirementsResponse.status, errorText);
      return;
    }

    const requirementsData = await requirementsResponse.json();
    console.log('✅ Requirements Response Structure:');
    console.log('  - Keys:', Object.keys(requirementsData));
    console.log('  - Status:', requirementsData.status);
    console.log('  - Has result:', !!requirementsData.result);
    console.log('  - Has deliverable:', !!requirementsData.deliverable);
    if (requirementsData.result) {
      console.log('  - Result keys:', Object.keys(requirementsData.result));
      console.log('  - Result.success:', requirementsData.result.success);
      console.log('  - Result.response type:', typeof requirementsData.result.response);
      console.log('  - Result.response length:', requirementsData.result.response?.length);
    }
    console.log();

    // Compare the formats
    console.log('🔍 DELIVERABLE FORMAT COMPARISON:');
    console.log('=====================================');
    console.log('📝 Blog Post Agent deliverable format:');
    if (blogPostData.deliverable) {
      console.log('  ✅ Has deliverable field');
      console.log('  - Type:', typeof blogPostData.deliverable);
      console.log('  - Content preview:', JSON.stringify(blogPostData.deliverable).substring(0, 100) + '...');
    } else if (blogPostData.result) {
      console.log('  ❌ No deliverable field, but has result field');
      console.log('  - Result.response preview:', blogPostData.result.response?.substring(0, 100) + '...');
    } else {
      console.log('  ❌ No deliverable or result field');
    }

    console.log('\n📋 Requirements Writer deliverable format:');
    if (requirementsData.deliverable) {
      console.log('  ✅ Has deliverable field');
      console.log('  - Type:', typeof requirementsData.deliverable);
      console.log('  - Content preview:', JSON.stringify(requirementsData.deliverable).substring(0, 100) + '...');
    } else if (requirementsData.result) {
      console.log('  ❌ No deliverable field, but has result field');
      console.log('  - Result.response preview:', requirementsData.result.response?.substring(0, 100) + '...');
    } else {
      console.log('  ❌ No deliverable or result field');
    }

    console.log('\n🎯 CONCLUSION:');
    if (blogPostData.deliverable && requirementsData.deliverable) {
      console.log('✅ Both agents return deliverable field - formats should be consistent');
    } else if (!blogPostData.deliverable && !requirementsData.deliverable) {
      console.log('⚠️ Neither agent returns deliverable field - both use result.response');
    } else {
      console.log('❌ INCONSISTENT: One agent uses deliverable, other uses result.response');
      console.log('  - Blog Post has deliverable:', !!blogPostData.deliverable);
      console.log('  - Requirements has deliverable:', !!requirementsData.deliverable);
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testBothAgents().then(() => {
  console.log('\n✨ Deliverable format comparison completed');
}).catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});