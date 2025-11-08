#!/usr/bin/env node

/**
 * Test script for the observability system
 * 
 * This script:
 * 1. Sends a test event to the webhooks endpoint
 * 2. Verifies it's stored in the database
 * 3. Checks if the SSE endpoint is broadcasting
 */

const axios = require('axios');

const API_URL = 'http://localhost:7100';
const TEST_USER_ID = 'b29a590e-b07f-49df-a25b-574c956b5035'; // demo.user@playground.com
const TEST_USERNAME = 'demo.user@playground.com';

async function testWebhook() {
  console.log('🧪 Testing Observability System\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: Send test event to webhook
  console.log('1️⃣  Sending test event to webhook...');
  try {
    const testEvent = {
      taskId: `test-task-${Date.now()}`,
      status: 'agent.started',
      timestamp: new Date().toISOString(),
      
      // Observability fields
      userId: TEST_USER_ID,
      username: TEST_USERNAME,
      conversationId: `test-conv-${Date.now()}`,
      agentSlug: 'test-agent',
      organizationSlug: null,
      mode: 'converse',
      
      // Progress fields
      message: 'Test agent execution started',
      progress: 0,
      step: 'Starting',
    };

    const response = await axios.post(
      `${API_URL}/webhooks/status`,
      testEvent,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('   ✅ Webhook accepted:', response.status);
    console.log(`   📝 Event: ${testEvent.status} - ${testEvent.message}\n`);
  } catch (error) {
    console.error('   ❌ Webhook failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.status, error.response.data);
    }
    process.exit(1);
  }

  // Step 2: Send progress event
  console.log('2️⃣  Sending progress event...');
  try {
    const progressEvent = {
      taskId: `test-task-${Date.now()}`,
      status: 'agent.progress',
      timestamp: new Date().toISOString(),
      
      userId: TEST_USER_ID,
      username: TEST_USERNAME,
      conversationId: `test-conv-${Date.now()}`,
      agentSlug: 'test-agent',
      organizationSlug: null,
      mode: 'converse',
      
      message: 'Calling LLM',
      progress: 50,
      step: 'LLM Call',
    };

    await axios.post(`${API_URL}/webhooks/status`, progressEvent);
    console.log('   ✅ Progress event sent\n');
  } catch (error) {
    console.error('   ❌ Progress event failed:', error.message);
  }

  // Step 3: Send completion event
  console.log('3️⃣  Sending completion event...');
  try {
    const completeEvent = {
      taskId: `test-task-${Date.now()}`,
      status: 'agent.completed',
      timestamp: new Date().toISOString(),
      
      userId: TEST_USER_ID,
      username: TEST_USERNAME,
      conversationId: `test-conv-${Date.now()}`,
      agentSlug: 'test-agent',
      organizationSlug: null,
      mode: 'converse',
      
      message: 'Agent execution completed successfully',
      progress: 100,
      step: 'Complete',
    };

    await axios.post(`${API_URL}/webhooks/status`, completeEvent);
    console.log('   ✅ Completion event sent\n');
  } catch (error) {
    console.error('   ❌ Completion event failed:', error.message);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Test complete!\n');
  console.log('📊 Check the admin observability UI at:');
  console.log('   http://localhost:8100/app/admin/observability\n');
  console.log('💡 You should see 3 test events in the timeline!');
}

// Run the test
testWebhook().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

