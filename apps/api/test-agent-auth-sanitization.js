#!/usr/bin/env node
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:9000';

// Test credentials from .env
const TEST_EMAIL = 'testuser@golfergeek.com';
const TEST_PASSWORD = 'testuser01!';

// Test data containing various sensitive information for agent conversation
const SENSITIVE_MESSAGE = `Hi, I need help with my system setup. Here are my details:
- Email: john.doe@company.com  
- Phone: 555-123-4567
- SSN: 123-45-6789
- Credit Card: 4532-1234-5678-9012
- API Key: sk-abc123def456789
- Database password: SuperSecret123!
- AWS Access Key: AKIAIOSFODNN7EXAMPLE
- GitHub Token: ghp_abcdefghijk1234567890
- IP Address: 192.168.1.100

Can you help me configure my application with these credentials?`;

async function authenticateAndTestSanitization() {
  console.log('🔍 Testing Agent Conversation Sanitization with Authentication');
  console.log('============================================================');
  
  let authToken = null;
  let conversationId = null;
  
  try {
    // Step 1: Authenticate to get token
    console.log('\n1. Authenticating with test user...');
    
    const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (authResponse.status === 200) {
      authToken = authResponse.data.access_token || authResponse.data.accessToken || authResponse.data.token;
      console.log('✅ Authentication successful');
      console.log('🔑 Token obtained:', authToken ? 'Yes' : 'No');
    } else {
      throw new Error(`Authentication failed with status: ${authResponse.status}`);
    }
    
    // Set up axios with auth header
    const authenticatedAxios = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Step 2: Create a conversation with sensitive data
    console.log('\n2. Creating agent conversation with sensitive data...');
    
    const conversationResponse = await authenticatedAxios.post('/agent-conversations', {
      agentType: 'universal',
      agentName: 'test-agent',
      initialMessage: SENSITIVE_MESSAGE,
      metadata: {
        purpose: 'Testing data sanitization in agent conversations',
        enableSanitization: true
      }
    });
    
    if (conversationResponse.status === 200 || conversationResponse.status === 201) {
      console.log('✅ Conversation created successfully');
      
      const conversation = conversationResponse.data;
      conversationId = conversation.id;
      console.log('📋 Conversation ID:', conversationId);
      
      // Step 3: Retrieve the conversation to check sanitization
      console.log('\n3. Checking if stored message was sanitized...');
      
      const conversationDetails = await authenticatedAxios.get(`/agent-conversations/${conversationId}`);
      
      if (conversationDetails.status === 200) {
        console.log('✅ Retrieved conversation details');
        
        const messages = conversationDetails.data.messages || [];
        console.log('📊 Number of messages:', messages.length);
        
        if (messages.length > 0) {
          const userMessage = messages.find(msg => msg.role === 'user');
          
          if (userMessage) {
            console.log('\n📝 Analysis of stored message:');
            console.log('   - Original length:', SENSITIVE_MESSAGE.length, 'characters');
            console.log('   - Stored length:', userMessage.content.length, 'characters');
            
            console.log('\n📄 Stored message content:');
            console.log('─'.repeat(50));
            console.log(userMessage.content);
            console.log('─'.repeat(50));
            
            // Check for sensitive data in the stored message
            const sensitivePatterns = [
              { pattern: 'john.doe@company.com', type: 'Email' },
              { pattern: '555-123-4567', type: 'Phone' },
              { pattern: '123-45-6789', type: 'SSN' },
              { pattern: '4532-1234-5678-9012', type: 'Credit Card' },
              { pattern: 'sk-abc123def456789', type: 'API Key' },
              { pattern: 'SuperSecret123!', type: 'Password' },
              { pattern: 'AKIAIOSFODNN7EXAMPLE', type: 'AWS Key' },
              { pattern: 'ghp_abcdefghijk1234567890', type: 'GitHub Token' },
              { pattern: '192.168.1.100', type: 'IP Address' }
            ];
            
            let foundSensitive = [];
            let foundRedactions = [];
            
            sensitivePatterns.forEach(({ pattern, type }) => {
              if (userMessage.content.includes(pattern)) {
                foundSensitive.push({ pattern, type });
              }
            });
            
            // Look for redaction markers
            const redactionMarkers = [
              '[EMAIL_REDACTED]',
              '[PHONE_REDACTED]', 
              '[SSN_REDACTED]',
              '[CREDIT_CARD_REDACTED]',
              '[REDACTED]',
              '[API_KEY_REDACTED]',
              '[PASSWORD_REDACTED]',
              '[AWS_KEY_REDACTED]'
            ];
            
            redactionMarkers.forEach(marker => {
              if (userMessage.content.includes(marker)) {
                foundRedactions.push(marker);
              }
            });
            
            // Results
            console.log('\n🔍 SANITIZATION ANALYSIS:');
            console.log('========================');
            
            if (foundSensitive.length === 0) {
              console.log('✅ SUCCESS: All sensitive data was properly sanitized!');
            } else {
              console.log('❌ FAILURE: Found unredacted sensitive data:');
              foundSensitive.forEach(({ pattern, type }) => {
                console.log(`   - ${type}: ${pattern}`);
              });
            }
            
            if (foundRedactions.length > 0) {
              console.log('✅ Found redaction markers:', foundRedactions.join(', '));
            } else {
              console.log('⚠️  No redaction markers found');
            }
            
            // Check for pseudonyms (realistic fake data)
            const possiblePseudonyms = userMessage.content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
            if (possiblePseudonyms && possiblePseudonyms.length > 0) {
              console.log('🔄 Possible pseudonymized emails found:', possiblePseudonyms);
            }
            
          } else {
            console.log('❌ No user message found in conversation');
          }
        } else {
          console.log('❌ No messages found in conversation');
        }
      } else {
        console.log('❌ Failed to retrieve conversation details');
      }
      
    } else {
      throw new Error(`Conversation creation failed with status: ${conversationResponse.status}`);
    }
    
    console.log('\n🎉 Agent conversation sanitization test completed!');
    
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
  } finally {
    // Cleanup - delete the test conversation if it was created
    if (conversationId && authToken) {
      try {
        console.log('\n4. Cleaning up test conversation...');
        await axios.delete(`${API_BASE_URL}/agent-conversations/${conversationId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        console.log('✅ Test conversation cleaned up');
      } catch (cleanupError) {
        console.log('⚠️  Cleanup failed, but test completed');
      }
    }
  }
}

// Run the test
if (require.main === module) {
  authenticateAndTestSanitization();
}

module.exports = { authenticateAndTestSanitization };