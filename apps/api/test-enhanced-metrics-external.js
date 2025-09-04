#!/usr/bin/env node

/**
 * Enhanced Metrics Test with External Provider
 * 
 * Test security features with OpenAI to verify:
 * - Data sanitization (should detect PII and sanitize)
 * - Source blinding (should strip headers)  
 * - No-train headers (should be sent)
 * - Compliance flags (should be set)
 */

// Load environment variables from the root .env file
require('dotenv').config({ path: '../../.env' });

const { NestFactory } = require('@nestjs/core');
const { LLMModule } = require('./dist/src/llms/llm.module');
const { LLMService } = require('./dist/src/llms/llm.service');
const { v4: uuidv4 } = require('uuid');

async function testExternalProvider() {
  console.log('🔒 Enhanced Metrics Test - External Provider (OpenAI)');
  console.log('====================================================');

  try {
    const app = await NestFactory.createApplicationContext(LLMModule, {
      logger: ['error', 'warn', 'log'], // Enable debug logging
    });

    const llmService = app.get(LLMService);
    console.log('✅ LLM Service loaded');

    // Test with extensive PII data to trigger sanitization
    console.log('\n📞 Making OpenAI call with extensive PII data...');
    const piiMessage = `Hi, my name is John Doe and I live at 123 Main Street, New York, NY 10001. 
    My email is john.doe@example.com and my phone number is (555) 123-4567. 
    My social security number is 123-45-6789 and my credit card is 4532-1234-5678-9012. 
    My API key is sk-1234567890abcdef and my password is MySecretPass123!
    I work at Acme Corporation and my employee ID is EMP-98765.
    Can you help me update my account information? My date of birth is 01/15/1985.`;
    
    console.log('📝 Original message (first 100 chars):', piiMessage.substring(0, 100) + '...');
    
    const response = await llmService.generateCentralizedResponse(
      'You are a helpful customer service assistant. Help the user with their account.',
      piiMessage,
      {
        provider: 'openai',  // External provider - should trigger security features
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
        maxTokens: 100,
        callerType: 'security-test',
        callerName: 'enhanced-metrics-security-test',
        conversationId: uuidv4(),
        userId: uuidv4(),
        dataClassification: 'restricted', // Highest level - should trigger strict sanitization
      }
    );

    console.log('✅ Response received');
    console.log(`📝 Sanitized response: "${response.content.substring(0, 200)}..."`);
    console.log(`🆔 Run ID: ${response.runMetadata?.runId || 'N/A'}`);
    
    // Compare original vs response to see sanitization effects
    console.log('\n🔍 Sanitization Analysis:');
    const hasJohnDoe = response.content.toLowerCase().includes('john doe');
    const hasEmail = response.content.includes('john.doe@example.com');
    const hasSSN = response.content.includes('123-45-6789');
    const hasCreditCard = response.content.includes('4532-1234-5678-9012');
    const hasApiKey = response.content.includes('sk-1234567890abcdef');
    const hasPassword = response.content.includes('MySecretPass123!');
    
    console.log(`   👤 Original name "John Doe" in response: ${hasJohnDoe ? '❌ NOT SANITIZED' : '✅ SANITIZED'}`);
    console.log(`   📧 Original email in response: ${hasEmail ? '❌ NOT SANITIZED' : '✅ SANITIZED'}`);  
    console.log(`   🆔 SSN in response: ${hasSSN ? '❌ NOT SANITIZED' : '✅ SANITIZED'}`);
    console.log(`   💳 Credit card in response: ${hasCreditCard ? '❌ NOT SANITIZED' : '✅ SANITIZED'}`);
    console.log(`   🔑 API key in response: ${hasApiKey ? '❌ NOT SANITIZED' : '✅ SANITIZED'}`);
    console.log(`   🔒 Password in response: ${hasPassword ? '❌ NOT SANITIZED' : '✅ SANITIZED'}`);
    
    // Check if security features are working
    if (response.runMetadata?.enhancedMetrics) {
      const metrics = response.runMetadata.enhancedMetrics;
      console.log('\n🔐 Security Features Analysis:');
      console.log(`   🛡️  Data Sanitization Applied: ${metrics.dataSanitizationApplied ? '✅' : '❌'}`);
      console.log(`   📈 Sanitization Level: ${metrics.sanitizationLevel || 'none'}`);
      console.log(`   🔍 PII Detected: ${metrics.piiDetected ? '✅' : '❌'}`);
      console.log(`   👤 Pseudonyms Used: ${metrics.pseudonymsUsed || 0}`);
      console.log(`   🔒 Redactions Applied: ${metrics.redactionsApplied || 0}`);
      console.log(`   🕵️  Source Blinding Applied: ${metrics.sourceBlindingApplied ? '✅' : '❌'}`);
      console.log(`   📡 Headers Stripped: ${metrics.headersStripped || 0}`);
      console.log(`   🚫 No-Train Header Sent: ${metrics.noTrainHeaderSent ? '✅' : '❌'}`);
      console.log(`   🏛️  Sovereign Mode: ${metrics.sovereignMode ? '✅' : '❌'}`);
      
      // Show detected PII types and pseudonyms
      if (metrics.piiTypes && metrics.piiTypes.length > 0) {
        console.log(`   📋 PII Types Detected: ${metrics.piiTypes.join(', ')}`);
      }
      
      if (metrics.redactionTypes && metrics.redactionTypes.length > 0) {
        console.log(`   🔒 Redaction Types Applied: ${metrics.redactionTypes.join(', ')}`);
      }
      
      if (metrics.pseudonymTypes && metrics.pseudonymTypes.length > 0) {  
        console.log(`   👥 Pseudonym Types Used: ${metrics.pseudonymTypes.join(', ')}`);
      }
      
      // Show compliance flags
      if (metrics.complianceFlags) {
        console.log(`   🏆 GDPR Compliant: ${metrics.complianceFlags.gdprCompliant ? '✅' : '❌'}`);
        console.log(`   🏥 HIPAA Compliant: ${metrics.complianceFlags.hipaaCompliant ? '✅' : '❌'}`);
        console.log(`   💳 PCI Compliant: ${metrics.complianceFlags.pciCompliant ? '✅' : '❌'}`);
      }
      
      console.log('\n📋 Complete Enhanced Metrics JSON:');
      console.log(JSON.stringify(metrics, null, 2));
      
    } else {
      console.log('❌ No enhanced metrics found in response');
    }

    await app.close();
    console.log('\n🎉 External provider security test completed!');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testExternalProvider();