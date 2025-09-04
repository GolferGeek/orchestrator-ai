#!/usr/bin/env node
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:9000';
const TEST_EMAIL = 'testuser@golfergeek.com';
const TEST_PASSWORD = 'testuser01!';

// Test data with financial sensitive information
const FINANCIAL_SENSITIVE_DATA = `Urgent: Financial Analysis Needed

Client Information:
- Primary Contact: john.doe@megacorp.com
- CFO Direct Line: 555-987-6543
- Company Tax ID: 987-65-4321
- Corporate Card: 4532-9876-5432-1098
- Banking API Token: sk-live-bank789xyz123
- Admin Password: MegaCorpFinance2024!
- AWS Finance Key: AKIAIFINANCEKEY7EXAMPLE
- Stripe Live Key: sk_live_financetokenabc123def456
- Server IP: 10.0.1.50
- HQ Address: 456 Corporate Blvd, Suite 800, NYC

Financial Analysis Request:
- Analyze Q1 2024 revenue of $4.2M
- Compare to Q4 2023 expenses of $2.8M
- Calculate customer acquisition cost trends
- Determine optimal budget allocation for Q2
- Project cash flow for next 6 months

This data is HIGHLY CONFIDENTIAL and should be sanitized before any processing.`;

async function testActualAgentSanitization() {
  console.log('🔍 Testing Actual Agent Path with Sanitization');
  console.log('===============================================');
  
  let authToken = null;
  
  try {
    // Step 1: Authenticate
    console.log('\n1. Authenticating with test user...');
    
    const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    authToken = authResponse.data.access_token || authResponse.data.accessToken || authResponse.data.token;
    console.log('✅ Authentication successful');
    
    // Step 2: Test the actual agent path
    console.log('\n2. Testing /agents/actual/finance/metrics/tasks endpoint...');
    
    try {
      const actualAgentResponse = await axios.post(`${API_BASE_URL}/agents/actual/finance/metrics/tasks`, {
        input: FINANCIAL_SENSITIVE_DATA,
        metadata: {
          taskType: 'financial_analysis',
          priority: 'high',
          enableSanitization: true,
          sanitizationConfig: {
            enableSecretRedaction: true,
            enablePIIDetection: true,
            enablePseudonymization: true,
            outputFormat: 'detailed'
          }
        }
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      console.log('✅ Actual agent request successful!');
      console.log('📊 Status:', actualAgentResponse.status);
      console.log('📄 Response data:');
      console.log(JSON.stringify(actualAgentResponse.data, null, 2));
      
      // Analyze response for sanitization
      const responseText = JSON.stringify(actualAgentResponse.data);
      
      // Check for sensitive data leakage
      const criticalSensitiveData = [
        { pattern: 'john.doe@megacorp.com', type: 'Client Email' },
        { pattern: '555-987-6543', type: 'CFO Phone' },
        { pattern: '987-65-4321', type: 'Tax ID' },
        { pattern: '4532-9876-5432-1098', type: 'Corporate Card' },
        { pattern: 'sk-live-bank789xyz123', type: 'Banking Token' },
        { pattern: 'MegaCorpFinance2024!', type: 'Admin Password' },
        { pattern: 'AKIAIFINANCEKEY7EXAMPLE', type: 'AWS Key' },
        { pattern: 'sk_live_financetokenabc123def456', type: 'Stripe Key' }
      ];
      
      let leakedData = [];
      criticalSensitiveData.forEach(({ pattern, type }) => {
        if (responseText.includes(pattern)) {
          leakedData.push({ pattern, type });
        }
      });
      
      console.log('\n🚨 CRITICAL SECURITY ANALYSIS:');
      console.log('==============================');
      
      if (leakedData.length === 0) {
        console.log('✅ EXCELLENT: No sensitive data leaked in agent response!');
      } else {
        console.log('🚨 CRITICAL SECURITY ISSUE: Sensitive data found in response:');
        leakedData.forEach(({ pattern, type }) => {
          console.log(`   🚫 ${type}: ${pattern}`);
        });
      }
      
      // Check if financial business data is preserved
      const businessMetrics = ['$4.2M', '$2.8M', 'Q1 2024', 'Q4 2023', 'customer acquisition'];
      let preservedBusiness = [];
      
      businessMetrics.forEach(metric => {
        if (responseText.includes(metric)) {
          preservedBusiness.push(metric);
        }
      });
      
      if (preservedBusiness.length > 0) {
        console.log('✅ Business metrics preserved:', preservedBusiness.join(', '));
      }
      
    } catch (actualAgentError) {
      console.log('❌ Actual agent path error:', actualAgentError.message);
      if (actualAgentError.response) {
        console.log('   Status:', actualAgentError.response.status);
        console.log('   Error:', JSON.stringify(actualAgentError.response.data, null, 2));
      }
      
      // Fall back to regular agent path
      console.log('\n3. Falling back to regular agent path...');
      try {
        const regularAgentResponse = await axios.post(`${API_BASE_URL}/agents/finance/metrics/tasks`, {
          input: FINANCIAL_SENSITIVE_DATA,
          metadata: { enableSanitization: true }
        }, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        console.log('✅ Regular agent path worked:', regularAgentResponse.status);
      } catch (regularError) {
        console.log('❌ Regular agent path also failed:', regularError.message);
      }
    }
    
    // Step 3: Verify direct sanitization still works
    console.log('\n4. Verifying direct sanitization works...');
    
    const directSanitizeResponse = await axios.post(`${API_BASE_URL}/sanitization/sanitize`, {
      text: FINANCIAL_SENSITIVE_DATA,
      enableSecretRedaction: true,
      enablePIIDetection: true,
      enablePseudonymization: true,
      outputFormat: 'detailed'
    });
    
    if (directSanitizeResponse.status === 200 || directSanitizeResponse.status === 201) {
      console.log('✅ Direct sanitization successful');
      
      const sanitizedData = directSanitizeResponse.data;
      const sanitizedText = sanitizedData.sanitizedText || sanitizedData.result?.sanitizedText;
      
      if (sanitizedText) {
        console.log('\n📋 SANITIZED OUTPUT PREVIEW:');
        console.log('─'.repeat(50));
        console.log(sanitizedText.substring(0, 500) + (sanitizedText.length > 500 ? '...' : ''));
        console.log('─'.repeat(50));
        
        // Quick security check
        const stillHasSensitive = criticalSensitiveData.some(({ pattern }) => 
          sanitizedText.includes(pattern)
        );
        
        if (!stillHasSensitive) {
          console.log('✅ Direct sanitization successfully removed all sensitive data!');
        } else {
          console.log('❌ Some sensitive data still present in sanitized output');
        }
      }
    }
    
    console.log('\n🎉 Agent sanitization testing completed!');
    
  } catch (error) {
    console.error('💥 REAL ERROR FOUND:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
if (require.main === module) {
  testActualAgentSanitization();
}

module.exports = { testActualAgentSanitization };