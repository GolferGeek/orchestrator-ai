#!/usr/bin/env node

/**
 * Test script to verify blog post deliverable creation
 * This tests the actual end-to-end flow
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:4000';

// Test with environment variables or defaults
const TEST_EMAIL = process.env.SUPABASE_TEST_EMAIL || 'testuser@golfergeek.com';
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD || 'testuser01!';

async function login() {
  try {
    console.log(`🔐 Attempting login with: ${TEST_EMAIL}`);
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    console.log('✅ Login successful');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testBlogPostDeliverable(authToken) {
  try {
    console.log('\n🔍 Testing Blog Post Writer deliverable creation...');
    
    const response = await axios.post(
      `${API_BASE_URL}/agents/marketing/blog_post/tasks`,
      {
        prompt: 'Write a comprehensive blog post about "AI-Powered Customer Service: The Future is Here" targeting business decision makers. Include sections on benefits, implementation challenges, and future trends.',
        providerId: 'anthropic',
        modelId: 'claude-3-5-sonnet-20241022'
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Blog post task completed');
    console.log('📊 Response analysis:', {
      success: response.data.success,
      hasResult: !!response.data.result,
      hasContent: !!response.data.result?.response,
      contentLength: response.data.result?.response?.length || 0,
      hasDeliverableId: !!response.data.result?.deliverableId,
      deliverableId: response.data.result?.deliverableId,
      taskId: response.data.taskId
    });

    if (response.data.result?.deliverableId) {
      console.log('🎉 SUCCESS: Deliverable was auto-created with ID:', response.data.result.deliverableId);
      
      // Verify the deliverable exists
      try {
        const deliverableResponse = await axios.get(
          `${API_BASE_URL}/deliverables/${response.data.result.deliverableId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        console.log('✅ Deliverable verified:', {
          id: deliverableResponse.data.id,
          title: deliverableResponse.data.title,
          type: deliverableResponse.data.deliverable_type,
          format: deliverableResponse.data.format,
          contentLength: deliverableResponse.data.content.length,
          createdByAgent: deliverableResponse.data.created_by_agent
        });
        
      } catch (error) {
        console.error('❌ Failed to fetch deliverable:', error.response?.data || error.message);
      }
    } else {
      console.log('❌ PROBLEM: No deliverable was auto-created');
      console.log('📝 Content preview:', response.data.result?.response?.substring(0, 300) + '...');
      
      // Let's check if the content would have been detected as deliverable
      const content = response.data.result?.response;
      if (content) {
        console.log('🔍 Content analysis for deliverable detection:');
        console.log('  - Length:', content.length);
        console.log('  - Has multiple paragraphs:', content.includes('\n\n'));
        console.log('  - Has markdown headers:', /^#+ /m.test(content));
        console.log('  - Should be deliverable:', content.includes('\n\n') || content.length > 300);
      }
    }

    return response.data;
    
  } catch (error) {
    console.error('❌ Blog post test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting blog post deliverable test...');
    console.log(`📧 Using test account: ${TEST_EMAIL}`);
    
    // Login first
    const authToken = await login();
    
    // Test blog post deliverable creation
    await testBlogPostDeliverable(authToken);
    
    console.log('\n✅ Test completed successfully');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();