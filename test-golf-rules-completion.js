#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_BASE_URL = 'http://localhost:4000';
const TEST_EMAIL = 'testuser@golfergeek.com';
const TEST_PASSWORD = 'testuser01!';

let authToken = null;
let userId = null;

async function authenticate() {
  console.log('🔐 Authenticating...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    authToken = data.token || data.accessToken || data.access_token;
    userId = data.user?.id || data.userId || data.user_id;

    if (!authToken) {
      throw new Error('No auth token received from login response');
    }

    console.log('✅ Authentication successful');
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
    console.log(`   User ID: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    return false;
  }
}

async function createGolfRulesTask() {
  console.log('\n🏌️ Creating golf rules task...');
  
  try {
    const taskRequest = {
      method: 'process',
      prompt: 'I hit my ball into a water hazard marked with yellow stakes. What should I do and what penalty do I get?',
      providerId: null, // Let it use default
      modelId: null,    // Let it use default
      temperature: 0.7,
      sessionId: `test-session-${Date.now()}`,
    };

    const response = await fetch(`${API_BASE_URL}/agents/engineering/golf_rules_agent/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(taskRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Task creation failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Task created successfully');
    console.log(`   Task ID: ${data.taskId}`);
    console.log(`   Response preview: ${data.response?.substring(0, 100) || 'No response yet'}...`);
    
    return data;
  } catch (error) {
    console.error('❌ Task creation failed:', error.message);
    return null;
  }
}

async function checkTaskStatus(taskId) {
  console.log(`\n🔍 Checking task status for ${taskId}...`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Task status check failed: ${response.status} ${response.statusText}`);
    }

    const task = await response.json();
    console.log(`   Status: ${task.status}`);
    console.log(`   Progress: ${task.progress}%`);
    console.log(`   Has Response: ${!!task.response}`);
    console.log(`   Response Length: ${task.response?.length || 0} chars`);
    console.log(`   Has Response Metadata: ${!!task.responseMetadata}`);
    console.log(`   Response Metadata Keys: ${task.responseMetadata ? Object.keys(task.responseMetadata).join(', ') : 'None'}`);
    
    return task;
  } catch (error) {
    console.error('❌ Task status check failed:', error.message);
    return null;
  }
}

async function checkEvaluations() {
  console.log('\n📊 Checking evaluations...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/evaluation/user/all`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Evaluations check failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const evaluations = data.evaluations || data.data || data;
    
    console.log(`   Found ${evaluations.length} evaluations`);
    
    // Look for our recent golf rules task
    const recentEvaluation = evaluations.find(eval => 
      eval.metadata?.agentName?.includes('Golf') ||
      eval.metadata?.agentName?.includes('Rules') ||
      eval.content?.includes('water hazard') ||
      Date.now() - new Date(eval.timestamp).getTime() < 300000 // Last 5 minutes
    );
    
    if (recentEvaluation) {
      console.log('✅ Found recent golf rules evaluation:');
      console.log(`   ID: ${recentEvaluation.id}`);
      console.log(`   Status: ${recentEvaluation.status || 'unknown'}`);
      console.log(`   Agent: ${recentEvaluation.metadata?.agentName || 'unknown'}`);
      console.log(`   Provider: ${recentEvaluation.provider?.name || 'unknown'}`);
      console.log(`   Model: ${recentEvaluation.model?.name || 'unknown'}`);
      console.log(`   Has Response: ${!!recentEvaluation.metadata?.taskResponse}`);
      console.log(`   Has Response Metadata: ${!!recentEvaluation.metadata?.responseMetadata}`);
      console.log(`   Response Metadata Keys: ${recentEvaluation.metadata?.responseMetadata ? Object.keys(recentEvaluation.metadata.responseMetadata).join(', ') : 'None'}`);
      console.log(`   Content Preview: ${recentEvaluation.content?.substring(0, 100) || 'No content'}...`);
      
      return recentEvaluation;
    } else {
      console.log('⚠️  No recent golf rules evaluation found');
      return null;
    }
  } catch (error) {
    console.error('❌ Evaluations check failed:', error.message);
    return null;
  }
}

async function waitForTaskCompletion(taskId, maxWaitTime = 60000) {
  console.log(`\n⏳ Waiting for task ${taskId} to complete...`);
  
  const startTime = Date.now();
  const pollInterval = 2000; // Check every 2 seconds
  
  while (Date.now() - startTime < maxWaitTime) {
    const task = await checkTaskStatus(taskId);
    
    if (task && task.status === 'completed') {
      console.log('✅ Task completed successfully!');
      return task;
    } else if (task && task.status === 'failed') {
      console.log('❌ Task failed');
      return task;
    }
    
    console.log(`   Still ${task?.status || 'unknown'}... waiting ${pollInterval/1000}s`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  console.log('⏰ Timeout waiting for task completion');
  return null;
}

async function runTest() {
  console.log('🧪 Starting Golf Rules Agent Completion Test');
  console.log('=' .repeat(50));
  
  // Step 1: Authenticate
  const authSuccess = await authenticate();
  if (!authSuccess) {
    process.exit(1);
  }
  
  // Step 2: Create golf rules task
  const taskData = await createGolfRulesTask();
  if (!taskData || !taskData.taskId) {
    console.error('💥 Failed to create task');
    process.exit(1);
  }
  
  // Step 3: Wait for completion
  const completedTask = await waitForTaskCompletion(taskData.taskId);
  
  // Step 4: Check final task status
  const finalTask = await checkTaskStatus(taskData.taskId);
  
  // Step 5: Check if it appears in evaluations
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s for evaluation processing
  const evaluation = await checkEvaluations();
  
  // Final assessment
  console.log('\n' + '=' .repeat(50));
  console.log('📋 TEST RESULTS:');
  console.log('=' .repeat(50));
  
  const taskCompleted = finalTask && finalTask.status === 'completed';
  const hasResponse = finalTask && !!finalTask.response;
  const hasResponseMetadata = finalTask && !!finalTask.responseMetadata;
  const inEvaluations = !!evaluation;
  const evaluationComplete = evaluation && evaluation.status !== 'pending';
  const hasEvaluationResponse = evaluation && !!evaluation.metadata?.taskResponse;
  const hasEvaluationResponseMetadata = evaluation && !!evaluation.metadata?.responseMetadata;
  
  console.log(`✅ Task Created: YES`);
  console.log(`${taskCompleted ? '✅' : '❌'} Task Completed: ${taskCompleted ? 'YES' : 'NO'}`);
  console.log(`${hasResponse ? '✅' : '❌'} Has Response: ${hasResponse ? 'YES' : 'NO'}`);
  console.log(`${hasResponseMetadata ? '✅' : '❌'} Has Response Metadata: ${hasResponseMetadata ? 'YES' : 'NO'}`);
  console.log(`${inEvaluations ? '✅' : '❌'} In Evaluations: ${inEvaluations ? 'YES' : 'NO'}`);
  console.log(`${evaluationComplete ? '✅' : '❌'} Evaluation Complete: ${evaluationComplete ? 'YES' : 'NO'}`);
  console.log(`${hasEvaluationResponse ? '✅' : '❌'} Evaluation Has Response: ${hasEvaluationResponse ? 'YES' : 'NO'}`);
  console.log(`${hasEvaluationResponseMetadata ? '✅' : '❌'} Evaluation Has Response Metadata: ${hasEvaluationResponseMetadata ? 'YES' : 'NO'}`);
  
  if (taskCompleted && hasResponse && hasResponseMetadata && inEvaluations && evaluationComplete && hasEvaluationResponse && hasEvaluationResponseMetadata) {
    console.log('\n🎉 SUCCESS! Golf Rules Agent is working correctly!');
    process.exit(0);
  } else {
    console.log('\n💥 FAILURE! Issues found:');
    if (!taskCompleted) console.log('   - Task did not complete');
    if (!hasResponse) console.log('   - Task has no response data');
    if (!hasResponseMetadata) console.log('   - Task has no response metadata');
    if (!inEvaluations) console.log('   - Task not found in evaluations');
    if (!evaluationComplete) console.log('   - Evaluation shows as pending');
    if (!hasEvaluationResponse) console.log('   - Evaluation has no response data');
    if (!hasEvaluationResponseMetadata) console.log('   - Evaluation has no response metadata');
    process.exit(1);
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
runTest().catch(error => {
  console.error('💥 Test failed with error:', error);
  process.exit(1);
});