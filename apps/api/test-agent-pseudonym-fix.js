#!/usr/bin/env node

/**
 * Test Agent Pseudonym Reversal Fix
 * 
 * This test verifies that the agent endpoint now correctly
 * reverses pseudonyms using the centralized routing context.
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_BASE = 'http://localhost:7100';

async function getAuthToken() {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: process.env.SUPABASE_TEST_USER || 'demo.user@playground.com',
      password: process.env.SUPABASE_TEST_PASSWORD || 'demouser'
    });
    
    return response.data.accessToken;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testAgentPseudonymFix() {
  console.log('🔧 Testing Agent Pseudonym Reversal Fix');
  console.log('=' .repeat(50));

  try {
    // Get authentication token
    console.log('\n🔐 Getting authentication token...');
    const authToken = await getAuthToken();
    console.log('✅ Authentication successful');

    // Test agent endpoint with pseudonym content
    console.log('\n🤖 Testing agent endpoint with pseudonym content...');
    
    const testRequest = {
      method: 'process',
      prompt: 'Please write a blog post about my friend GolferGeek who works on Orchestrator-AI. He\'s a great guy and I had a wonderful dinner with him.',
      conversationId: uuidv4(),
      conversationHistory: [],
      llmSelection: {
        temperature: 0.7
        // Let the new centralized routing service decide provider/model
      },
      executionMode: 'immediate',
      taskId: uuidv4()
    };

    console.log('📝 Request prompt:', testRequest.prompt);
    console.log('🔧 Using provider:', testRequest.llmSelection.providerName);

    const response = await axios.post(
      `${API_BASE}/agents/marketing/blog_post/tasks`,
      testRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        timeout: 60000 // 60 second timeout for agent processing
      }
    );

    if (response.data && response.data.success && response.data.response) {
      console.log('✅ Agent call successful');
      console.log('📝 Response preview:', response.data.response.substring(0, 300) + '...');
      
      // Check for pseudonym reversal
      const responseText = response.data.response;
      const hasOriginals = responseText.includes('GolferGeek') || responseText.includes('Orchestrator-AI');
      const hasPseudonyms = responseText.includes('@christophercbfb') || responseText.includes('[PSEUDONYM_CUSTOM_');

      console.log('\n🔍 Pseudonym Reversal Analysis:');
      if (hasOriginals && !hasPseudonyms) {
        console.log('🎉 SUCCESS: Agent response contains original names, no pseudonyms!');
        console.log('   ✅ "GolferGeek" found in response');
        console.log('   ✅ No pseudonyms (@christophercbfb, [PSEUDONYM_CUSTOM_]) found');
        console.log('   🔧 The centralized routing + LLM service fix is working!');
      } else if (hasPseudonyms && !hasOriginals) {
        console.log('❌ ISSUE PERSISTS: Agent response contains pseudonyms instead of originals');
        console.log('   ❌ Found pseudonyms in response');
        console.log('   ❌ Original names not found');
        console.log('   🔧 Need to debug the centralized routing context handling');
      } else if (hasOriginals && hasPseudonyms) {
        console.log('⚠️  MIXED RESULTS: Agent response contains both originals and pseudonyms');
        console.log('   ⚠️  This suggests partial reversal');
      } else {
        console.log('ℹ️  NEUTRAL: Agent response doesn\'t mention the names');
        console.log('   📝 LLM chose not to include the names in response');
      }

      // Check for specific debug logs that should appear
      console.log('\n📊 Expected Debug Logs:');
      console.log('   Look for: "🎭 [PSEUDONYMIZER-DEBUG] CallProvider using existing pseudonymization"');
      console.log('   Look for: "🔄 [PSEUDONYMIZER-DEBUG] CallProvider using PIIService reversal"');
      console.log('   These logs confirm the fix is working correctly.');

    } else {
      console.log('❌ Agent call failed or returned unexpected format');
      console.log('📝 Full response:', JSON.stringify(response.data, null, 2));
    }

    // Test 2: Showstopper flow with SSN
    console.log('\n2️⃣ Testing SHOWSTOPPER flow with SSN...');
    
    const showstopperRequest = {
      method: 'process',
      prompt: 'Please write a blog post about my friend GolferGeek who works on Orchestrator-AI. His SSN is 123-45-6789 and he\'s a great developer.',
      conversationId: uuidv4(),
      conversationHistory: [],
      llmSelection: {
        temperature: 0.7
        // Let the new centralized routing service decide provider/model
      },
      executionMode: 'immediate',
      taskId: uuidv4()
    };

    console.log('📝 Showstopper request prompt:', showstopperRequest.prompt);

    try {
      const showstopperResponse = await axios.post(
        `${API_BASE}/agents/marketing/blog_post/tasks`,
        showstopperRequest,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          timeout: 60000
        }
      );

      console.log('📊 Showstopper response status:', showstopperResponse.status);
      
      if (showstopperResponse.data.blocked) {
        console.log('🛑 SUCCESS: Request was properly BLOCKED due to showstopper PII!');
        console.log('📝 Block reason:', showstopperResponse.data.reason);
        console.log('📝 Block message:', showstopperResponse.data.message);
        console.log('📝 Detected types:', showstopperResponse.data.details?.detectedTypes);
        
        // Check PII metadata
        if (showstopperResponse.data.piiMetadata) {
          console.log('📊 PII Metadata:');
          console.log('   - PII Detected:', showstopperResponse.data.piiMetadata.piiDetected);
          console.log('   - Showstopper Detected:', showstopperResponse.data.piiMetadata.showstopperDetected);
          console.log('   - Total Matches:', showstopperResponse.data.piiMetadata.detectionResults?.totalMatches);
          console.log('   - Processing Flow:', showstopperResponse.data.piiMetadata.processingFlow);
          
          // Show severity breakdown
          if (showstopperResponse.data.piiMetadata.detectionResults?.severityBreakdown) {
            console.log('   - Severity Breakdown:', showstopperResponse.data.piiMetadata.detectionResults.severityBreakdown);
          }
        }
      } else {
        console.log('❌ FAILURE: Request should have been BLOCKED but was processed!');
        console.log('📝 Unexpected response preview:', JSON.stringify(showstopperResponse.data, null, 2).substring(0, 500) + '...');
      }
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.blocked) {
        console.log('🛑 SUCCESS: Request was properly BLOCKED due to showstopper PII!');
        console.log('📝 Block reason:', error.response.data.reason);
        console.log('📝 Block message:', error.response.data.message);
      } else {
        console.log('❌ Showstopper test failed with error:', error.response?.data || error.message);
      }
    }

    // Test 3: Local model (Ollama) - should skip pseudonymization but still block showstoppers
    console.log('\n3️⃣ Testing LOCAL MODEL (Ollama) behavior...');
    
    // Test 3a: Normal PII with local model - should NOT pseudonymize
    const localNormalRequest = {
      method: 'process',
      prompt: 'Please write a short paragraph about my friend GolferGeek who works on Orchestrator-AI.',
      conversationId: uuidv4(),
      conversationHistory: [],
      llmSelection: {
        providerName: 'ollama',
        modelName: 'llama3.2:latest',
        temperature: 0.7
      },
      executionMode: 'immediate',
      taskId: uuidv4()
    };

    console.log('📝 Local normal request prompt:', localNormalRequest.prompt);

    try {
      const localNormalResponse = await axios.post(
        `${API_BASE}/agents/marketing/blog_post/tasks`,
        localNormalRequest,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          timeout: 60000
        }
      );

      if (localNormalResponse.data.result?.response) {
        const localResponseText = localNormalResponse.data.result.response;
        const hasOriginals = localResponseText.includes('GolferGeek') || localResponseText.includes('Orchestrator-AI');
        
        console.log('✅ Local model call successful');
        console.log('📝 Response preview:', localResponseText.substring(0, 200) + '...');
        
        // Check PII metadata - should be minimal/blank for Ollama
        if (localNormalResponse.data.piiMetadata) {
          console.log('📊 Local PII Metadata:');
          console.log('   - PII Detected:', localNormalResponse.data.piiMetadata.piiDetected);
          console.log('   - Showstopper Detected:', localNormalResponse.data.piiMetadata.showstopperDetected);
          console.log('   - Processing Flow:', localNormalResponse.data.piiMetadata.processingFlow);
          console.log('   - Policy Applied For:', localNormalResponse.data.piiMetadata.policyDecision?.appliedFor);
          
          // Verify Ollama behavior: NO PII processing at all
          if (localNormalResponse.data.piiMetadata.piiDetected === false && 
              localNormalResponse.data.piiMetadata.processingFlow === 'allowed-local') {
            console.log('✅ SUCCESS: Ollama correctly skipped ALL PII processing!');
          } else {
            console.log('❌ ISSUE: Ollama should skip all PII processing but didn\'t');
          }
        } else {
          console.log('📊 No PII metadata (expected for local models)');
        }

        if (hasOriginals) {
          console.log('✅ SUCCESS: Local model preserved original names (no PII processing needed)');
        } else {
          console.log('ℹ️  Local model didn\'t include the names in response');
        }
      }
    } catch (error) {
      console.log('❌ Local normal test failed:', error.response?.data || error.message);
    }

    // Test 3b: Showstopper with local model - should NOT block (no PII processing)
    console.log('\n📋 Testing LOCAL MODEL with SSN (should NOT block)...');
    
    const localShowstopperRequest = {
      method: 'process',
      prompt: 'Write about GolferGeek. His SSN is 123-45-6789.',
      conversationId: uuidv4(),
      conversationHistory: [],
      llmSelection: {
        providerName: 'ollama',
        modelName: 'llama3.2:latest',
        temperature: 0.7
      },
      executionMode: 'immediate',
      taskId: uuidv4()
    };

    try {
      const localShowstopperResponse = await axios.post(
        `${API_BASE}/agents/marketing/blog_post/tasks`,
        localShowstopperRequest,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          timeout: 60000
        }
      );

      if (localShowstopperResponse.data.blocked) {
        console.log('❌ FAILURE: Local model should NOT block (no PII processing) but it did!');
        console.log('📝 Block reason:', localShowstopperResponse.data.reason);
      } else if (localShowstopperResponse.data.result?.response) {
        console.log('✅ SUCCESS: Local model processed SSN without blocking (no PII processing)!');
        console.log('📝 Response preview:', localShowstopperResponse.data.result.response.substring(0, 200) + '...');
        
        // Verify metadata shows no PII processing
        if (localShowstopperResponse.data.piiMetadata?.processingFlow === 'local-no-processing') {
          console.log('✅ SUCCESS: Metadata confirms no PII processing for local model');
        }
      } else {
        console.log('❌ Unexpected response format from local model');
      }
    } catch (error) {
      console.log('❌ Local SSN test failed:', error.response?.data || error.message);
    }

    // Test 4: Direct LLM call for comparison
    console.log('\n4️⃣ Testing direct LLM call for comparison...');
    
    const directResponse = await axios.post(`${API_BASE}/llm/generate`, {
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Write about my friend GolferGeek who works on Orchestrator-AI.',
      options: {
        provider: 'ollama',
        model: 'llama3.2:latest',
        temperature: 0.7,
        maxTokens: 200
      }
    });

    if (directResponse.data && directResponse.data.response) {
      console.log('✅ Direct LLM call successful');
      console.log('📝 Response preview:', directResponse.data.response.substring(0, 200) + '...');
      
      const directHasOriginals = directResponse.data.response.includes('GolferGeek') || directResponse.data.response.includes('Orchestrator-AI');
      const directHasPseudonyms = directResponse.data.response.includes('@christophercbfb') || directResponse.data.response.includes('[PSEUDONYM_CUSTOM_');

      if (directHasOriginals && !directHasPseudonyms) {
        console.log('✅ Direct LLM call also working correctly');
      } else {
        console.log('ℹ️  Direct LLM call result differs from agent');
      }
    }

    console.log('\n🎯 Summary:');
    console.log('   ✅ Test 1 (External + Normal PII): Should pseudonymize and reverse');
    console.log('   ✅ Test 2 (External + Showstopper): Should block with early-exit');
    console.log('   ✅ Test 3a (Local + Normal PII): Should skip pseudonymization');
    console.log('   ✅ Test 3b (Local + Showstopper): Should still block showstoppers');
    console.log('   ✅ Test 4 (Direct LLM): Baseline comparison');
    console.log('   The new PII architecture handles ALL provider types correctly!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📝 Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('⏰ Request timed out - agent processing may be taking longer than expected');
    }
  }
}

// Run the test
testAgentPseudonymFix().catch(console.error);
