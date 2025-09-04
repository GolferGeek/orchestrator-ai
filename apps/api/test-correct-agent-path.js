#!/usr/bin/env node
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:9000';
const TEST_EMAIL = 'testuser@golfergeek.com';
const TEST_PASSWORD = 'testuser01!';

// Test data with sensitive financial information
const SENSITIVE_FINANCIAL_PROMPT = `Please analyze our Q4 financial performance:

CONFIDENTIAL CLIENT DATA:
- CFO Email: sarah.cfo@megacorp.com
- Direct Phone: 555-789-1234  
- Tax ID: 876-54-3210
- Company Card: 4532-8765-4321-0987
- Banking API: sk-live-banking456xyz789
- Finance DB Password: MegaCorpQ4Finance2024!
- AWS Account Key: AKIAIFINQ4KEY8EXAMPLE
- Stripe Live Secret: sk_live_q4finance789abc123

BUSINESS METRICS TO ANALYZE:
- Q4 Revenue: $8.7M (vs Q3: $7.2M)
- Operating Expenses: $4.1M 
- Net Income: $4.6M
- Monthly Recurring Revenue Growth: 23%

Please provide comprehensive financial analysis.`;

async function testCorrectAgentPath() {
  console.log('🔍 Testing Correct Agent Path: /agent/finance/metrics/tasks');
  console.log('=========================================================');
  
  let authToken = null;
  
  try {
    // Step 1: Authenticate
    console.log('\n1. Authenticating...');
    
    const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    authToken = authResponse.data.access_token || authResponse.data.accessToken || authResponse.data.token;
    console.log('✅ Authentication successful');
    
    // Step 2: Send request to CORRECT agent path with proper UUID
    console.log('\n2. Sending task to /agent/finance/metrics/tasks...');
    
    const taskId = uuidv4(); // Generate proper UUID
    
    const agentTaskRequest = {
      method: 'analyze_financial_data',
      prompt: SENSITIVE_FINANCIAL_PROMPT,
      params: {
        taskType: 'financial_analysis',
        analysisType: 'quarterly_performance',
        enableSanitization: true,
        sanitizationConfig: {
          enableSecretRedaction: true,
          enablePIIDetection: true,
          enablePseudonymization: true
        }
      },
      conversationId: null,
      taskId: taskId, // Use proper UUID
      timeoutSeconds: 30,
      executionMode: 'standard'
    };
    
    console.log('📋 Request details:');
    console.log(`   - URL: /agent/finance/metrics/tasks`);
    console.log(`   - Method: ${agentTaskRequest.method}`);
    console.log(`   - Prompt length: ${agentTaskRequest.prompt.length} chars`);
    console.log(`   - Task ID: ${taskId}`);
    console.log(`   - Sanitization enabled: ${agentTaskRequest.params.enableSanitization}`);
    
    try {
      const agentResponse = await axios.post(
        `${API_BASE_URL}/agent/finance/metrics/tasks`, // Correct singular path
        agentTaskRequest,
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      
      console.log('✅ SUCCESS: Agent task submitted!');
      console.log('📊 Response status:', agentResponse.status);
      console.log('📄 Response data:');
      console.log(JSON.stringify(agentResponse.data, null, 2));
      
      // Step 3: CRITICAL SECURITY ANALYSIS
      console.log('\n3. 🚨 SECURITY ANALYSIS - Checking for Data Leaks:');
      console.log('===================================================');
      
      const responseText = JSON.stringify(agentResponse.data);
      
      // Define sensitive data that MUST be sanitized
      const criticalSensitiveData = [
        { pattern: 'sarah.cfo@megacorp.com', type: 'CFO Email' },
        { pattern: '555-789-1234', type: 'Phone Number' },
        { pattern: '876-54-3210', type: 'Tax ID' },
        { pattern: '4532-8765-4321-0987', type: 'Credit Card' },
        { pattern: 'sk-live-banking456xyz789', type: 'Banking API' },
        { pattern: 'MegaCorpQ4Finance2024!', type: 'DB Password' },
        { pattern: 'AKIAIFINQ4KEY8EXAMPLE', type: 'AWS Key' },
        { pattern: 'sk_live_q4finance789abc123', type: 'Stripe Secret' }
      ];
      
      // Business metrics that should be preserved  
      const businessMetrics = [
        '$8.7M', '$7.2M', '$4.1M', '$4.6M', '23%',
        'Q4 Revenue', 'Operating Expenses', 'Net Income'
      ];
      
      let leakedData = [];
      let preservedMetrics = [];
      let sanitizationMarkers = [];
      
      // Check for leaked sensitive data
      criticalSensitiveData.forEach(({ pattern, type }) => {
        if (responseText.includes(pattern)) {
          leakedData.push({ pattern, type });
        }
      });
      
      // Check for preserved business data
      businessMetrics.forEach(metric => {
        if (responseText.includes(metric)) {
          preservedMetrics.push(metric);
        }
      });
      
      // Check for sanitization evidence
      const markers = ['[EMAIL_REDACTED]', '[PHONE_REDACTED]', '[REDACTED]', '[CREDIT_CARD_REDACTED]'];
      markers.forEach(marker => {
        if (responseText.includes(marker)) {
          sanitizationMarkers.push(marker);
        }
      });
      
      // Security verdict
      console.log('\n🔒 SECURITY ASSESSMENT:');
      if (leakedData.length === 0) {
        console.log('✅ EXCELLENT: No sensitive data leaked in agent response!');
      } else {
        console.log('🚨 SECURITY BREACH: Found sensitive data in response:');
        leakedData.forEach(({ pattern, type }) => {
          console.log(`   🚫 ${type}: ${pattern}`);
        });
      }
      
      if (sanitizationMarkers.length > 0) {
        console.log('✅ Sanitization markers found:', sanitizationMarkers.join(', '));
      }
      
      if (preservedMetrics.length > 0) {
        console.log('✅ Business metrics preserved:', preservedMetrics.slice(0, 3).join(', '));
      }
      
      // Final conclusion
      const isSecure = leakedData.length === 0;
      const hasEvidence = sanitizationMarkers.length > 0 || preservedMetrics.length > 0;
      
      console.log('\n🎯 FINAL VERDICT:');
      if (isSecure && hasEvidence) {
        console.log('🎉 SUCCESS: Agent properly sanitized data while preserving business intelligence!');
      } else if (isSecure) {
        console.log('⚠️  UNCLEAR: No leaks detected, but limited evidence of sanitization');
      } else {
        console.log('🚨 FAILURE: Sensitive data was not properly sanitized!');
      }
      
    } catch (agentError) {
      console.log('❌ Agent request failed:', agentError.message);
      if (agentError.response) {
        console.log('   Status:', agentError.response.status);
        console.log('   Error:', JSON.stringify(agentError.response.data, null, 2));
      }
    }
    
  } catch (error) {
    console.error('💥 REAL ERROR FOUND:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
if (require.main === module) {
  testCorrectAgentPath();
}

module.exports = { testCorrectAgentPath };