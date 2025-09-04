#!/usr/bin/env node

/**
 * Simple PII Pattern Detection Test
 * Tests the PIIPatternService directly to verify pattern matching works
 */

// Load environment variables
require('dotenv').config({ path: '../../.env' });

const { NestFactory } = require('@nestjs/core');
const { LLMModule } = require('./dist/src/llms/llm.module');
const { PIIPatternService } = require('./dist/src/llms/pii-pattern.service');
const { DataSanitizationService } = require('./dist/src/llms/data-sanitization.service');

async function testPIIPatterns() {
  console.log('🔍 PII Pattern Detection Test');
  console.log('============================');

  try {
    const app = await NestFactory.createApplicationContext(LLMModule, {
      logger: ['error'], // Minimal logging
    });

    const dataSanitizationService = app.get('DataSanitizationService');
    console.log('✅ DataSanitizationService loaded');

    // Test text with various PII types
    const testText = `Hi, my name is John Doe and I live at 123 Main Street, New York, NY 10001. 
    My email is john.doe@example.com and my phone number is (555) 123-4567. 
    My social security number is 123-45-6789 and my credit card is 4532-1234-5678-9012. 
    My API key is sk-1234567890abcdef and my password is MySecretPass123!
    I work at Acme Corporation and my employee ID is EMP-98765.`;

    console.log('\n📝 Testing data sanitization on sample text...');
    console.log('Sample text (first 100 chars):', testText.substring(0, 100) + '...');

    // Test data sanitization
    const sanitizationResult = await dataSanitizationService.sanitizeText(testText, {
      enableRedaction: true,
      enablePseudonymization: true
    });
    
    console.log('\n🔍 PII Detection Results:');
    console.log(`   📊 Matches Found: ${detectionResult.matches.length}`);
    console.log(`   ⏱️  Processing Time: ${detectionResult.processingTime}ms`);
    console.log(`   🔍 Patterns Checked: ${detectionResult.patternsChecked}`);

    if (detectionResult.matches.length > 0) {
      console.log('\n📋 Detected PII:');
      detectionResult.matches.forEach((match, index) => {
        console.log(`   ${index + 1}. ${match.dataType.toUpperCase()}: "${match.value}"`);
        console.log(`      Pattern: ${match.patternName}`);
        console.log(`      Position: ${match.startIndex}-${match.endIndex}`);
        console.log(`      Confidence: ${(match.confidence * 100).toFixed(1)}%`);
      });
    } else {
      console.log('   ❌ No PII detected');
    }

    // Test individual patterns
    console.log('\n🧪 Testing Individual Patterns:');
    const individualTests = [
      { type: 'email', text: 'Contact john.doe@example.com for details' },
      { type: 'phone', text: 'Call me at (555) 123-4567' },
      { type: 'ssn', text: 'SSN: 123-45-6789' },
      { type: 'credit_card', text: 'Card: 4532-1234-5678-9012' },
      { type: 'name', text: 'Hello John Smith from California' },
    ];

    for (const test of individualTests) {
      const result = await piiPatternService.detectPII(test.text);
      console.log(`   ${test.type}: ${result.matches.length > 0 ? '✅ DETECTED' : '❌ NOT DETECTED'}`);
      if (result.matches.length > 0) {
        console.log(`      Found: "${result.matches[0].value}" (${result.matches[0].patternName})`);
      }
    }

    await app.close();
    console.log('\n🎉 PII Pattern Test completed!');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testPIIPatterns();