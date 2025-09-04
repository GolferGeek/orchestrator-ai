#!/usr/bin/env node

/**
 * Simple Enhanced Metrics Test
 * 
 * Just test that we can make an LLM call and get enhanced metrics back
 */

const { NestFactory } = require('@nestjs/core');
const { LLMModule } = require('./dist/src/llms/llm.module');
const { LLMService } = require('./dist/src/llms/llm.service');
const { v4: uuidv4 } = require('uuid');

async function testSimple() {
  console.log('🧪 Simple Enhanced Metrics Test');
  console.log('===============================');

  try {
    const app = await NestFactory.createApplicationContext(LLMModule, {
      logger: ['error'], // Minimal logging
    });

    const llmService = app.get(LLMService);
    console.log('✅ LLM Service loaded');

    // Test Ollama call to verify enhanced metrics
    console.log('\n📞 Making Ollama call via centralized service...');
    const response = await llmService.generateCentralizedResponse(
      'You are a helpful assistant.',
      'What is 2+2? Answer very briefly.',
      {
        provider: 'ollama',
        model: 'llama3.2:latest',
        temperature: 0.1,
        maxTokens: 20,
        callerType: 'simple-test',
        callerName: 'enhanced-metrics-simple-test',
        conversationId: uuidv4(), // Use proper UUID for conversation ID
        userId: uuidv4(), // Add user ID as UUID
        dataClassification: 'test',
      }
    );

    console.log('✅ Response received');
    console.log(`📝 Content: "${response.content.substring(0, 50)}..."`);
    console.log(`🆔 Run ID: ${response.runMetadata?.runId || 'N/A'}`);
    
    // Check if enhanced metrics are present
    if (response.runMetadata) {
      console.log('\n📊 Enhanced Metrics Present:');
      console.log(`   💰 Cost: $${response.runMetadata.cost || '0.0000'}`);
      console.log(`   📝 Tokens: ${response.runMetadata.inputTokens || 0} in, ${response.runMetadata.outputTokens || 0} out`);
      console.log(`   🛡️  Sanitization Applied: ${response.runMetadata.dataSanitizationApplied ? '✅' : '❌'}`);
      console.log(`   📈 Sanitization Level: ${response.runMetadata.sanitizationLevel || 'unknown'}`);
      console.log(`   🕵️  Source Blinding Applied: ${response.runMetadata.sourceBlindingApplied ? '✅' : '❌'}`);
      console.log(`   🏠 Sovereign Mode: ${response.runMetadata.sovereignMode ? '✅' : '❌'}`);
      
      // Show full JSON for verification
      console.log('\n📋 Complete Enhanced Metrics JSON:');
      console.log(JSON.stringify(response.runMetadata, null, 2));
      
    } else {
      console.log('❌ No enhanced metrics found in response');
    }

    await app.close();
    console.log('\n🎉 Simple test completed successfully!');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testSimple();