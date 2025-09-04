#!/usr/bin/env node
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:9000';
const TEST_EMAIL = 'testuser@golfergeek.com';
const TEST_PASSWORD = 'testuser01!';

// Test data with financial sensitive information
const FINANCIAL_SENSITIVE_DATA = `Please analyze our financial metrics:

Company Financial Data:
- Primary Account: john.doe@company.com
- CFO Phone: 555-123-4567
- Tax ID (EIN): 123-45-6789
- Primary Credit Card: 4532-1234-5678-9012 
- Banking API Key: sk-bank123api456key
- Database Password: FinanceSecret123!
- AWS Finance Account: AKIAIOSFODNN7EXAMPLE
- Stripe Secret Key: sk_live_abcdefghijk1234567890
- Customer IP: 192.168.1.100
- Office Address: 123 Main Street, Financial District

Financial Metrics Request:
- Q4 Revenue: $2.5M
- Operating Expenses: $1.2M  
- Customer LTV Analysis
- Churn Rate Calculations
- ROI on Marketing Spend

Please provide comprehensive financial analysis and projections.`;

async function testFinanceAgentSanitization() {
  console.log('🔍 Testing Finance Metrics Agent Sanitization');
  console.log('==============================================');
  
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
    
    // Step 2: Test finance agent task with sensitive financial data
    console.log('\n2. Sending financial analysis task to finance agent...');
    
    try {
      const taskResponse = await axios.post(`${API_BASE_URL}/agents/finance/metrics/tasks`, {
        input: FINANCIAL_SENSITIVE_DATA,
        metadata: {
          taskType: 'financial_analysis',
          enableSanitization: true,
          sanitization: {
            enableSecretRedaction: true,
            enablePIIDetection: true,
            enablePseudonymization: true,
            outputFormat: 'detailed'
          }
        }
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (taskResponse.status === 200 || taskResponse.status === 201) {
        console.log('✅ Finance agent task submitted successfully');
        console.log('📊 Task response received');
        
        // Analyze the task response for sanitization
        console.log('\n3. Analyzing task response for data sanitization...');
        
        const responseData = taskResponse.data;
        console.log('📄 Raw Response:');
        console.log(JSON.stringify(responseData, null, 2));
        
        // Check if the response contains sanitized or raw data
        const responseText = JSON.stringify(responseData);
        
        // Check for sensitive financial data
        const sensitiveFinancialPatterns = [
          { pattern: 'john.doe@company.com', type: 'CFO Email' },
          { pattern: '555-123-4567', type: 'CFO Phone' },
          { pattern: '123-45-6789', type: 'Tax ID/EIN' },
          { pattern: '4532-1234-5678-9012', type: 'Credit Card' },
          { pattern: 'sk-bank123api456key', type: 'Banking API Key' },
          { pattern: 'FinanceSecret123!', type: 'Database Password' },
          { pattern: 'AKIAIOSFODNN7EXAMPLE', type: 'AWS Account' },
          { pattern: 'sk_live_abcdefghijk1234567890', type: 'Stripe Secret' },
          { pattern: '192.168.1.100', type: 'Customer IP' },
          { pattern: '123 Main Street', type: 'Office Address' }
        ];
        
        let foundSensitive = [];
        let foundRedactions = [];
        
        sensitiveFinancialPatterns.forEach(({ pattern, type }) => {
          if (responseText.includes(pattern)) {
            foundSensitive.push({ pattern, type });
          }
        });
        
        // Check for sanitization markers
        const sanitizationMarkers = [
          '[EMAIL_REDACTED]',
          '[PHONE_REDACTED]', 
          '[TAX_ID_REDACTED]',
          '[CREDIT_CARD_REDACTED]',
          '[API_KEY_REDACTED]',
          '[PASSWORD_REDACTED]',
          '[REDACTED]',
          '[AWS_KEY_REDACTED]'
        ];
        
        sanitizationMarkers.forEach(marker => {
          if (responseText.includes(marker)) {
            foundRedactions.push(marker);
          }
        });
        
        // Results Analysis
        console.log('\n🔍 FINANCIAL DATA SANITIZATION ANALYSIS:');
        console.log('========================================');
        
        if (foundSensitive.length === 0) {
          console.log('✅ SUCCESS: All sensitive financial data was properly sanitized!');
        } else {
          console.log('❌ SECURITY RISK: Found unredacted sensitive financial data:');
          foundSensitive.forEach(({ pattern, type }) => {
            console.log(`   - ${type}: ${pattern}`);
          });
        }
        
        if (foundRedactions.length > 0) {
          console.log('✅ Found sanitization markers:', foundRedactions.join(', '));
        } else {
          console.log('⚠️  No explicit redaction markers found');
        }
        
        // Check if financial metrics (non-sensitive) are preserved
        const financialMetrics = ['$2.5M', '$1.2M', 'Q4 Revenue', 'Operating Expenses'];
        let preservedMetrics = [];
        
        financialMetrics.forEach(metric => {
          if (responseText.includes(metric)) {
            preservedMetrics.push(metric);
          }
        });
        
        if (preservedMetrics.length > 0) {
          console.log('✅ Non-sensitive financial metrics preserved:', preservedMetrics.join(', '));
        }
        
      } else {
        console.log('❌ Finance agent task failed:', taskResponse.status);
      }
      
    } catch (financeError) {
      if (financeError.response?.status === 404) {
        console.log('❌ Finance metrics agent not found, trying generic finance agent...');
        
        // Try with generic finance agent
        const genericResponse = await axios.post(`${API_BASE_URL}/agents/finance/finance/tasks`, {
          input: FINANCIAL_SENSITIVE_DATA,
          metadata: { enableSanitization: true }
        }, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        console.log('✅ Generic finance agent response:', genericResponse.status);
      } else {
        console.log('❌ Finance agent error:', financeError.message);
      }
    }
    
    // Step 3: Also test the direct sanitization with financial data
    console.log('\n4. Testing direct sanitization with financial data...');
    
    const directSanitizeResponse = await axios.post(`${API_BASE_URL}/sanitization/test`, {
      text: FINANCIAL_SENSITIVE_DATA,
      enableSecretRedaction: true,
      enablePIIDetection: true,
      enablePseudonymization: true,
      outputFormat: 'detailed'
    });
    
    if (directSanitizeResponse.status === 200) {
      console.log('✅ Direct sanitization successful');
      
      const sanitized = directSanitizeResponse.data.sanitizedText;
      console.log('\n📄 Sanitized Financial Data:');
      console.log('─'.repeat(60));
      console.log(sanitized);
      console.log('─'.repeat(60));
      
      // Quick check for redaction success
      const stillPresent = [];
      ['john.doe@company.com', '555-123-4567', '4532-1234-5678-9012'].forEach(pattern => {
        if (sanitized.includes(pattern)) stillPresent.push(pattern);
      });
      
      if (stillPresent.length === 0) {
        console.log('✅ Direct sanitization working correctly!');
      } else {
        console.log('❌ Some sensitive data still present:', stillPresent);
      }
    }
    
    console.log('\n🎉 Finance agent sanitization test completed!');
    
  } catch (error) {
    console.error('💥 REAL ERROR FOUND:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.error('\nStack trace:');
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testFinanceAgentSanitization();
}

module.exports = { testFinanceAgentSanitization };