#!/usr/bin/env node

/**
 * Direct Sanitization Test - No LLM calls, just test sanitization services
 * This bypasses all Ollama/model loading issues
 */

require('dotenv').config({ path: '../../.env' });

const { NestFactory } = require('@nestjs/core');
const { Module } = require('@nestjs/common');

// Use the full LLM module but try to avoid Ollama timeouts
const { LLMModule } = require('./dist/src/llms/llm.module');
const { DataSanitizationService } = require('./dist/src/llms/data-sanitization.service');
const { PIIPatternService } = require('./dist/src/llms/pii-pattern.service');

async function testDirectSanitization() {
  console.log('🔍 Direct Sanitization Test (No Ollama)');
  console.log('=====================================');

  try {
    console.log('Creating minimal NestJS context...');
    const app = await NestFactory.createApplicationContext(LLMModule, {
      logger: ['error', 'warn', 'log'],
    });

    console.log('✅ Context created, getting services...');
    
    const dataSanitizationService = app.get(DataSanitizationService);
    const piiPatternService = app.get(PIIPatternService);
    
    console.log('✅ Services retrieved');

    // Test PII detection first
    const testText = `Hi, my name is John Doe and I live at 123 Main Street, New York, NY 10001. 
    My email is john.doe@example.com and my phone number is (555) 123-4567. 
    My social security number is 123-45-6789 and my credit card is 4532-1234-5678-9012. 
    My API key is sk-1234567890abcdef and my password is MySecretPass123!`;

    console.log('\n📝 Testing PII Pattern Detection...');
    const piiResult = await piiPatternService.detectPII(testText);
    console.log(`Found ${piiResult.matches.length} PII matches:`);
    piiResult.matches.forEach(match => {
      console.log(`   - ${match.dataType}: "${match.value}" (${match.patternName})`);
    });

    console.log('\n🔐 Testing Data Sanitization...');
    const sanitizationResult = await dataSanitizationService.sanitizeForLLM(
      'You are a customer service assistant.',
      testText,
      'test-request-123',
      {
        enableRedaction: true,
        enablePseudonymization: true,
      }
    );

    console.log('✅ Sanitization completed!');
    console.log(`Original text length: ${testText.length}`);
    console.log(`Sanitized user message length: ${sanitizationResult.sanitizedUserMessage.length}`);
    console.log(`Sanitized user message: ${sanitizationResult.sanitizedUserMessage.substring(0, 200)}...`);
    
    if (sanitizationResult.reversalContext) {
      console.log(`Reversal context entries: ${Object.keys(sanitizationResult.reversalContext).length}`);
    }

    await app.close();
    console.log('\n🎉 Direct sanitization test completed successfully!');

  } catch (error) {
    console.error('💥 REAL ERROR FOUND:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testDirectSanitization();