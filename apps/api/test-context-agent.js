#!/usr/bin/env node

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');

async function testContextAgent() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const agentFactory = app.get('AgentFactoryService');
  
  console.log('🧪 Testing context agent with pure service container...');
  
  try {
    // Test creating a content agent (context agent)
    const contentAgent = await agentFactory.createAgent('marketing/content');
    console.log('✅ Content agent created successfully');
    console.log('📊 Agent info:', {
      name: contentAgent.getAgentName(),
      type: contentAgent.getAgentType(),
      hasServices: !!contentAgent.services
    });

    // Test executing a task
    const result = await contentAgent.executeTask('executeTask', {
      prompt: 'Write a brief introduction about AI automation',
      userId: 'test-user',
      conversationId: 'test-conversation',
      conversationHistory: []
    });

    console.log('✅ Task execution successful');
    console.log('📄 Result preview:', result.response ? result.response.substring(0, 150) + '...' : 'No response');
    console.log('🏷️  Result metadata:', result.metadata);

  } catch (error) {
    console.error('❌ Context agent test failed:', error.message);
  }

  await app.close();
}

testContextAgent().catch(console.error);