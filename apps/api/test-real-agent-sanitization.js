#!/usr/bin/env node
const axios = require('axios');

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
- Finance Server IP: 10.2.5.100
- Corporate HQ: 789 Finance Plaza, Suite 1200, Manhattan

BUSINESS METRICS TO ANALYZE:
- Q4 Revenue: $8.7M (vs Q3: $7.2M)
- Operating Expenses: $4.1M 
- Net Income: $4.6M
- Customer Acquisition Cost: $145
- Monthly Recurring Revenue Growth: 23%
- Cash Flow Positive: Yes
- Runway: 18 months

ANALYSIS REQUESTED:
1. Compare Q4 vs Q3 performance
2. Identify growth drivers
3. Calculate key financial ratios
4. Forecast Q1 2025 projections
5. Recommend cost optimization areas

Please provide comprehensive financial analysis with charts and projections.`;

async function testRealAgentSanitization() {
  console.log('🔍 Testing REAL Agent Sanitization with Proper Format');
  console.log('====================================================');
  
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
    
    // Step 2: Send properly formatted request to finance metrics agent
    console.log('\n2. Sending financial analysis task to finance/metrics agent...');
    
    const agentTaskRequest = {
      method: 'analyze_financial_data',
      prompt: SENSITIVE_FINANCIAL_PROMPT,
      params: {
        taskType: 'financial_analysis',
        analysisType: 'quarterly_performance',
        includeProjections: true,
        enableSanitization: true, // Request sanitization
        sanitizationConfig: {
          enableSecretRedaction: true,
          enablePIIDetection: true,
          enablePseudonymization: true,
          outputFormat: 'detailed'
        }
      },
      conversationId: null,
      taskId: `finance_analysis_${Date.now()}`,
      timeoutSeconds: 30,
      executionMode: 'standard'
    };
    
    console.log('📋 Sending request with format:');
    console.log(`   - method: ${agentTaskRequest.method}`);
    console.log(`   - prompt length: ${agentTaskRequest.prompt.length} chars`);
    console.log(`   - sanitization enabled: ${agentTaskRequest.params.enableSanitization}`);
    
    try {
      const agentResponse = await axios.post(
        `${API_BASE_URL}/agents/finance/metrics/tasks`,
        agentTaskRequest,
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      
      console.log('✅ Agent task submitted successfully!');
      console.log('📊 Response status:', agentResponse.status);
      
      // Analyze the response for sanitization effectiveness
      console.log('\n3. CRITICAL SECURITY ANALYSIS of Agent Response:');
      console.log('================================================');
      
      const responseText = JSON.stringify(agentResponse.data);
      
      // Check for highly sensitive data that MUST be sanitized
      const criticalSensitiveData = [
        { pattern: 'sarah.cfo@megacorp.com', type: 'CFO Email', critical: true },
        { pattern: '555-789-1234', type: 'Direct Phone', critical: true },
        { pattern: '876-54-3210', type: 'Tax ID', critical: true },
        { pattern: '4532-8765-4321-0987', type: 'Company Card', critical: true },
        { pattern: 'sk-live-banking456xyz789', type: 'Banking API', critical: true },
        { pattern: 'MegaCorpQ4Finance2024!', type: 'DB Password', critical: true },
        { pattern: 'AKIAIFINQ4KEY8EXAMPLE', type: 'AWS Key', critical: true },
        { pattern: 'sk_live_q4finance789abc123', type: 'Stripe Secret', critical: true },
        { pattern: '10.2.5.100', type: 'Server IP', critical: false },
        { pattern: '789 Finance Plaza', type: 'Corporate Address', critical: false }
      ];
      
      // Business data that should be preserved
      const businessMetrics = [
        '$8.7M', '$7.2M', '$4.1M', '$4.6M', '$145', '23%', '18 months',
        'Q4 Revenue', 'Operating Expenses', 'Net Income', 'Customer Acquisition Cost'
      ];
      
      let criticalLeaks = [];
      let normalLeaks = [];
      let preservedMetrics = [];
      let sanitizationMarkers = [];
      
      // Check for data leaks
      criticalSensitiveData.forEach(({ pattern, type, critical }) => {
        if (responseText.includes(pattern)) {
          if (critical) {
            criticalLeaks.push({ pattern, type });
          } else {
            normalLeaks.push({ pattern, type });
          }
        }
      });
      
      // Check for preserved business metrics
      businessMetrics.forEach(metric => {
        if (responseText.includes(metric)) {
          preservedMetrics.push(metric);
        }
      });
      
      // Check for sanitization markers
      const markers = ['[EMAIL_REDACTED]', '[PHONE_REDACTED]', '[SSN_REDACTED]', '[CREDIT_CARD_REDACTED]', '[REDACTED]'];
      markers.forEach(marker => {
        if (responseText.includes(marker)) {
          sanitizationMarkers.push(marker);
        }
      });
      
      // Security Assessment
      console.log('\n🚨 SECURITY ASSESSMENT:');
      if (criticalLeaks.length === 0) {
        console.log('✅ EXCELLENT: No critical sensitive data leaked!');
      } else {
        console.log('🚨 CRITICAL SECURITY FAILURE: Highly sensitive data found:');
        criticalLeaks.forEach(({ pattern, type }) => {
          console.log(`   🚫 ${type}: ${pattern}`);
        });
      }
      
      if (normalLeaks.length > 0) {
        console.log('⚠️  Minor leaks (less critical):');
        normalLeaks.forEach(({ pattern, type }) => {
          console.log(`   - ${type}: ${pattern}`);
        });
      }
      
      if (sanitizationMarkers.length > 0) {
        console.log('✅ Sanitization markers found:', sanitizationMarkers.join(', '));
      }
      
      if (preservedMetrics.length > 0) {
        console.log('✅ Business metrics preserved:', preservedMetrics.slice(0, 5).join(', ') + '...');
      }
      
      console.log('\n📄 Agent Response Preview:');
      console.log('─'.repeat(60));
      console.log(responseText.substring(0, 800) + (responseText.length > 800 ? '...' : ''));
      console.log('─'.repeat(60));
      
      // Final verdict
      if (criticalLeaks.length === 0 && sanitizationMarkers.length > 0) {
        console.log('\n🎉 SUCCESS: Agent properly sanitized sensitive data while preserving business metrics!');
      } else if (criticalLeaks.length === 0) {
        console.log('\n⚠️  PARTIAL: No critical leaks but unclear if sanitization was applied');
      } else {
        console.log('\n🚨 FAILURE: Critical sensitive data was not sanitized by agent!');
      }
      
    } catch (agentError) {
      console.log('❌ Agent request failed:', agentError.message);
      if (agentError.response) {
        console.log('   Status:', agentError.response.status);
        console.log('   Error details:', JSON.stringify(agentError.response.data, null, 2));
      }
      
      // Fall back to test what we know works
      console.log('\n4. Falling back to direct sanitization test...');
      await testFallbackSanitization();
    }
    
  } catch (error) {
    console.error('💥 REAL ERROR FOUND:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testFallbackSanitization() {
  try {
    const response = await axios.post(`${API_BASE_URL}/sanitization/sanitize`, {
      text: SENSITIVE_FINANCIAL_PROMPT,
      enableSecretRedaction: true,
      enablePIIDetection: true,
      enablePseudonymization: true,
      outputFormat: 'detailed'
    });
    
    console.log('✅ Fallback sanitization successful');
    const sanitized = response.data.sanitizedText || response.data.result?.sanitizedText;
    
    if (sanitized) {
      // Quick check
      const hasEmail = sanitized.includes('sarah.cfo@megacorp.com');
      const hasCard = sanitized.includes('4532-8765-4321-0987');
      const hasMetrics = sanitized.includes('$8.7M');
      
      console.log(`   - Email sanitized: ${!hasEmail ? '✅' : '❌'}`);
      console.log(`   - Card sanitized: ${!hasCard ? '✅' : '❌'}`);
      console.log(`   - Metrics preserved: ${hasMetrics ? '✅' : '❌'}`);
    }
  } catch (fallbackError) {
    console.log('❌ Fallback also failed:', fallbackError.message);
  }
}

// Run the test
if (require.main === module) {
  testRealAgentSanitization();
}

module.exports = { testRealAgentSanitization };