#!/usr/bin/env node
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:9000';

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

async function testAgentConversationSanitization() {
  console.log('🔍 Testing Agent Conversation Sanitization');
  console.log('==========================================');
  
  try {
    // Step 1: Start a conversation with an agent that contains sensitive data
    console.log('\n1. Creating agent conversation with sensitive data...');
    
    const conversationResponse = await axios.post(`${API_BASE_URL}/agent-conversations`, {
      agentType: 'universal',
      agentName: 'test-agent',
      initialMessage: SENSITIVE_MESSAGE,
      metadata: {
        purpose: 'Testing data sanitization in agent conversations'
      }
    });
    
    if (conversationResponse.status === 200 || conversationResponse.status === 201) {
      console.log('✅ Conversation created successfully');
      
      const conversation = conversationResponse.data;
      console.log('📋 Conversation ID:', conversation.id);
      
      // Step 2: Check if the stored message has been sanitized
      console.log('\n2. Checking if stored message was sanitized...');
      
      const conversationDetails = await axios.get(`${API_BASE_URL}/agent-conversations/${conversation.id}`);
      
      if (conversationDetails.status === 200) {
        console.log('✅ Retrieved conversation details');
        
        const messages = conversationDetails.data.messages || [];
        console.log('📊 Number of messages:', messages.length);
        
        if (messages.length > 0) {
          const userMessage = messages.find(msg => msg.role === 'user');
          
          if (userMessage) {
            console.log('\n📝 Original message contained:', SENSITIVE_MESSAGE.length, 'characters');
            console.log('📝 Stored message contains:', userMessage.content.length, 'characters');
            console.log('\n📄 Stored message content:');
            console.log(userMessage.content);
            
            // Check for sensitive data in the stored message
            const sensitivePatterns = [
              'john.doe@company.com',
              '555-123-4567',
              '123-45-6789',
              '4532-1234-5678-9012',
              'sk-abc123def456789',
              'SuperSecret123!',
              'AKIAIOSFODNN7EXAMPLE',
              'ghp_abcdefghijk1234567890'
            ];
            
            let foundSensitive = [];
            sensitivePatterns.forEach(pattern => {
              if (userMessage.content.includes(pattern)) {
                foundSensitive.push(pattern);
              }
            });
            
            if (foundSensitive.length === 0) {
              console.log('\n✅ SUCCESS: All sensitive data was properly sanitized before storage!');
            } else {
              console.log('\n❌ FAILURE: Found unredacted sensitive data in stored message:');
              foundSensitive.forEach(pattern => {
                console.log('   - ' + pattern);
              });
            }
            
            // Look for redaction markers
            const redactionMarkers = [
              '[EMAIL_REDACTED]',
              '[PHONE_REDACTED]', 
              '[SSN_REDACTED]',
              '[CREDIT_CARD_REDACTED]',
              '[REDACTED]'
            ];
            
            let foundMarkers = [];
            redactionMarkers.forEach(marker => {
              if (userMessage.content.includes(marker)) {
                foundMarkers.push(marker);
              }
            });
            
            if (foundMarkers.length > 0) {
              console.log('\n✅ Found redaction markers:', foundMarkers.join(', '));
            } else {
              console.log('\n⚠️  No redaction markers found - data might not have been processed');
            }
            
          } else {
            console.log('❌ No user message found in conversation');
          }
        } else {
          console.log('❌ No messages found in conversation');
        }
      }
      
      // Step 3: Send a task to the agent to test if responses are sanitized
      console.log('\n3. Testing agent task with sensitive data...');
      
      const taskResponse = await axios.post(`${API_BASE_URL}/agents/universal/test-agent/tasks`, {
        input: `Process this sensitive information: 
        Email: admin@secret.com
        Password: TopSecret456!
        API Key: sk-xyz789secretkey
        Please analyze this data and respond.`,
        metadata: {
          sanitization: {
            enableSecretRedaction: true,
            enablePIIDetection: true,
            enablePseudonymization: true
          }
        }
      });
      
      if (taskResponse.status === 200) {
        console.log('✅ Task submitted successfully');
        
        // Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('📊 Task response:', JSON.stringify(taskResponse.data, null, 2));
      } else {
        console.log('❌ Task submission failed:', taskResponse.status);
      }
      
      // Clean up - delete the test conversation
      console.log('\n4. Cleaning up test conversation...');
      try {
        await axios.delete(`${API_BASE_URL}/agent-conversations/${conversation.id}`);
        console.log('✅ Test conversation cleaned up');
      } catch (cleanupError) {
        console.log('⚠️  Cleanup failed, but test completed');
      }
      
    } else {
      console.log('❌ Conversation creation failed:', conversationResponse.status);
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
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAgentConversationSanitization();
}

module.exports = { testAgentConversationSanitization };