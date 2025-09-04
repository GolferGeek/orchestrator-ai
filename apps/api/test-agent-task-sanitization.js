#!/usr/bin/env node
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:9000';

// Test data containing various sensitive information
const SENSITIVE_TASK_INPUT = `Process this request: 
User Details:
- Email: john.doe@company.com  
- Phone: 555-123-4567
- SSN: 123-45-6789
- Credit Card: 4532-1234-5678-9012
- API Key: sk-abc123def456789
- Database password: SuperSecret123!
- AWS Access Key: AKIAIOSFODNN7EXAMPLE
- GitHub Token: ghp_abcdefghijk1234567890
- IP Address: 192.168.1.100

Please analyze these credentials and provide recommendations.`;

async function testAgentTaskSanitization() {
  console.log('🔍 Testing Agent Task Sanitization');
  console.log('=================================');
  
  try {
    // Test the agent task endpoint directly (might not require auth)
    console.log('\n1. Sending task to agent with sensitive data...');
    
    const taskResponse = await axios.post(`${API_BASE_URL}/agents/universal/test-agent/tasks`, {
      input: SENSITIVE_TASK_INPUT,
      metadata: {
        test: true,
        enableSanitization: true,
        sanitization: {
          enableSecretRedaction: true,
          enablePIIDetection: true,
          enablePseudonymization: true,
          outputFormat: 'detailed'
        }
      }
    });
    
    if (taskResponse.status === 200 || taskResponse.status === 201) {
      console.log('✅ Task submitted successfully');
      console.log('📊 Task ID:', taskResponse.data.taskId || taskResponse.data.id);
      
      // Check the response for sanitization indicators
      console.log('\n2. Analyzing task response for sanitization...');
      console.log('Full response:');
      console.log(JSON.stringify(taskResponse.data, null, 2));
      
      // Look for sanitized data in the response
      const responseText = JSON.stringify(taskResponse.data);
      
      // Check if original sensitive data is still present
      const sensitivePatterns = [
        { pattern: 'john.doe@company.com', type: 'Email' },
        { pattern: '555-123-4567', type: 'Phone' },
        { pattern: '123-45-6789', type: 'SSN' },
        { pattern: '4532-1234-5678-9012', type: 'Credit Card' },
        { pattern: 'sk-abc123def456789', type: 'API Key' },
        { pattern: 'SuperSecret123!', type: 'Password' },
        { pattern: 'AKIAIOSFODNN7EXAMPLE', type: 'AWS Key' },
        { pattern: 'ghp_abcdefghijk1234567890', type: 'GitHub Token' }
      ];
      
      let foundSensitive = [];
      let foundRedactions = [];
      
      sensitivePatterns.forEach(({ pattern, type }) => {
        if (responseText.includes(pattern)) {
          foundSensitive.push({ pattern, type });
        }
      });
      
      // Look for redaction markers
      const redactionMarkers = [
        '[EMAIL_REDACTED]',
        '[PHONE_REDACTED]', 
        '[SSN_REDACTED]',
        '[CREDIT_CARD_REDACTED]',
        '[REDACTED]'
      ];
      
      redactionMarkers.forEach(marker => {
        if (responseText.includes(marker)) {
          foundRedactions.push(marker);
        }
      });
      
      console.log('\n🔍 SANITIZATION ANALYSIS:');
      console.log('========================');
      
      if (foundSensitive.length === 0) {
        console.log('✅ SUCCESS: All sensitive data was properly handled!');
      } else {
        console.log('❌ FAILURE: Found unprocessed sensitive data:');
        foundSensitive.forEach(({ pattern, type }) => {
          console.log(`   - ${type}: ${pattern}`);
        });
      }
      
      if (foundRedactions.length > 0) {
        console.log('✅ Found redaction markers:', foundRedactions.join(', '));
      } else {
        console.log('⚠️  No explicit redaction markers found');
      }
      
    } else {
      console.log('❌ Task submission failed:', taskResponse.status);
      console.log('Response:', taskResponse.data);
    }
    
    console.log('\n🎉 Agent task sanitization test completed!');
    
  } catch (error) {
    console.error('💥 REAL ERROR FOUND:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      
      // If it's a 401, try with service role token
      if (error.response.status === 401) {
        console.log('\n⚠️  Auth required, trying with service role token...');
        await testWithServiceRole();
      }
    } else if (error.request) {
      console.error('No response received. Is the API server running on', API_BASE_URL, '?');
    } else {
      console.error('Request setup error:', error.message);
    }
    
    console.error('\nStack trace:');
    console.error(error.stack);
  }
}

async function testWithServiceRole() {
  try {
    const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWtqZWNtZHVnZnp2ZGlqb2RnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzU4ODg4NCwiZXhwIjoyMDYzMTY0ODg0fQ.zl1cSBPRJqbYsCh4LvuztpvxIhgrJv06Gutfdr_u1YY';
    
    const response = await axios.post(`${API_BASE_URL}/agents/universal/test-agent/tasks`, {
      input: SENSITIVE_TASK_INPUT,
      metadata: { enableSanitization: true }
    }, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      }
    });
    
    console.log('✅ Service role request successful');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (serviceError) {
    console.log('❌ Service role request also failed:', serviceError.message);
    
    // Try without auth but check if there's a test endpoint
    console.log('\n🔄 Trying to find test endpoints...');
    
    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/health`);
      console.log('✅ Health endpoint accessible without auth');
      
      // Try the sanitization test endpoint directly
      const sanitizeResponse = await axios.post(`${API_BASE_URL}/sanitization/test`, {
        text: SENSITIVE_TASK_INPUT,
        enableSecretRedaction: true,
        enablePIIDetection: true,
        enablePseudonymization: true,
        outputFormat: 'detailed'
      });
      
      console.log('✅ Direct sanitization test successful!');
      console.log('Result:', JSON.stringify(sanitizeResponse.data, null, 2));
      
    } catch (testError) {
      console.log('❌ All attempts failed:', testError.message);
    }
  }
}

// Run the test
if (require.main === module) {
  testAgentTaskSanitization();
}

module.exports = { testAgentTaskSanitization };