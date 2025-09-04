#!/usr/bin/env node
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:9000';
const SANITIZATION_ENDPOINT = `${API_BASE_URL}/sanitization`;

// Test data containing various sensitive information
const TEST_TEXT = `
User john.doe@example.com (SSN: 123-45-6789) called from 555-123-4567.
His credit card 4532-1234-5678-9012 was declined.
The API key sk-abc123def456 needs to be rotated.
Database password: MySecretPassword123!
AWS Access Key: AKIAIOSFODNN7EXAMPLE
GitHub Token: ghp_1234567890abcdefghijklmnopqrstuv
The user's IP address is 192.168.1.100 and MAC address is 00:1B:44:11:3A:B7.
License plate ABC-123 was registered to resident at 123 Main Street, Anytown.
`;

async function testSanitizationAPI() {
  console.log('🔍 Testing Sanitization API Endpoints');
  console.log('=====================================');
  
  try {
    // Test 1: Complete sanitization pipeline
    console.log('\n1. Testing Complete Sanitization Pipeline...');
    
    const sanitizeResponse = await axios.post(`${SANITIZATION_ENDPOINT}/sanitize`, {
      text: TEST_TEXT,
      enableSecretRedaction: true,
      enablePIIDetection: true,
      enablePseudonymization: true,
      outputFormat: 'detailed'
    });
    
    if (sanitizeResponse.status === 200) {
      console.log('✅ Sanitization API call successful');
      console.log('📊 Response:', JSON.stringify(sanitizeResponse.data, null, 2));
      
      // Verify sensitive data was actually sanitized
      const sanitized = sanitizeResponse.data.sanitizedText || sanitizeResponse.data.result;
      
      const sensitivePatterns = [
        'john.doe@example.com',
        '123-45-6789',
        '4532-1234-5678-9012',
        'sk-abc123def456',
        'MySecretPassword123!',
        'AKIAIOSFODNN7EXAMPLE',
        'ghp_1234567890abcdefghijklmnopqrstuv'
      ];
      
      let foundSensitive = [];
      sensitivePatterns.forEach(pattern => {
        if (sanitized && sanitized.includes(pattern)) {
          foundSensitive.push(pattern);
        }
      });
      
      if (foundSensitive.length === 0) {
        console.log('✅ All sensitive data properly redacted/pseudonymized');
      } else {
        console.log('❌ Found unredacted sensitive data:', foundSensitive);
      }
    } else {
      console.log('❌ Sanitization API call failed:', sanitizeResponse.status);
    }
    
    // Test 2: Secret redaction test
    console.log('\n2. Testing Secret Redaction...');
    
    const redactionResponse = await axios.post(`${SANITIZATION_ENDPOINT}/redaction/test`, {
      text: `API key: sk-abc123def456 and password MySecret123!`
    });
    
    if (redactionResponse.status === 200) {
      console.log('✅ Secret redaction test successful');
      console.log('📊 Response:', JSON.stringify(redactionResponse.data, null, 2));
    } else {
      console.log('❌ Secret redaction test failed:', redactionResponse.status);
    }
    
    // Test 3: PII detection test
    console.log('\n3. Testing PII Detection...');
    
    const piiResponse = await axios.post(`${SANITIZATION_ENDPOINT}/pii/test`, {
      text: `Contact John at john.doe@example.com or 555-123-4567. SSN: 123-45-6789`
    });
    
    if (piiResponse.status === 200) {
      console.log('✅ PII detection test successful');
      console.log('📊 Response:', JSON.stringify(piiResponse.data, null, 2));
    } else {
      console.log('❌ PII detection test failed:', piiResponse.status);
    }
    
    // Test 4: Complete sanitization test endpoint
    console.log('\n4. Testing Complete Sanitization Test Endpoint...');
    
    const completeTestResponse = await axios.post(`${SANITIZATION_ENDPOINT}/test`, {
      text: TEST_TEXT,
      enableSecretRedaction: true,
      enablePIIDetection: true,
      enablePseudonymization: true,
      outputFormat: 'detailed'
    });
    
    if (completeTestResponse.status === 200) {
      console.log('✅ Complete sanitization test successful');
      console.log('📊 Response:', JSON.stringify(completeTestResponse.data, null, 2));
    } else {
      console.log('❌ Complete sanitization test failed:', completeTestResponse.status);
    }
    
    console.log('\n🎉 All API tests completed successfully!');
    
  } catch (error) {
    console.error('💥 REAL ERROR FOUND:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received. Is the API server running on', API_BASE_URL, '?');
    } else {
      console.error('Request setup error:', error.message);
    }
    
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSanitizationAPI();
}

module.exports = { testSanitizationAPI };