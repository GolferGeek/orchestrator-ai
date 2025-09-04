#!/usr/bin/env node

/**
 * Minimal service isolation test to identify DI issues
 */

require('dotenv').config({ path: '../../.env' });

const { NestFactory } = require('@nestjs/core');
const { Module } = require('@nestjs/common');
const { SupabaseModule } = require('./dist/src/supabase/supabase.module');

// Try creating a minimal module with just the PII services
async function testMinimalModule() {
  console.log('🧪 Testing minimal service isolation...');

  try {
    // Import services
    const { PIIPatternService } = require('./dist/src/llms/pii-pattern.service');
    const { PseudonymizationService } = require('./dist/src/llms/pseudonymization.service');
    const { SecretRedactionService } = require('./dist/src/llms/secret-redaction.service');
    const { DataSanitizationService } = require('./dist/src/llms/data-sanitization.service');

    // Create a minimal test module
    @Module({
      imports: [SupabaseModule],
      providers: [
        PIIPatternService,
        PseudonymizationService,
        SecretRedactionService,
        DataSanitizationService,
      ],
      exports: [
        PIIPatternService,
        PseudonymizationService,
        SecretRedactionService,
        DataSanitizationService,
      ],
    })
    class TestModule {}

    console.log('✅ Test module created');

    const app = await NestFactory.createApplicationContext(TestModule, {
      logger: ['error'],
    });

    console.log('✅ Application context created');

    // Test each service
    const piiService = app.get(PIIPatternService);
    console.log('✅ PIIPatternService:', !!piiService);

    const pseudoService = app.get(PseudonymizationService);
    console.log('✅ PseudonymizationService:', !!pseudoService);

    const redactionService = app.get(SecretRedactionService);
    console.log('✅ SecretRedactionService:', !!redactionService);

    const sanitizationService = app.get(DataSanitizationService);
    console.log('✅ DataSanitizationService:', !!sanitizationService);

    // Test a simple PII detection
    console.log('\n📝 Testing PII detection...');
    const testText = 'My email is john@example.com and SSN is 123-45-6789';
    const result = await piiService.detectPII(testText);
    console.log(`Found ${result.matches.length} PII matches:`, result.matches.map(m => `${m.dataType}: ${m.value}`));

    await app.close();
    console.log('🎉 All services working!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testMinimalModule();