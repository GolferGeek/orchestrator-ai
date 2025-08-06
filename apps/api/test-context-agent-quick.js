#!/usr/bin/env node

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');
const { AgentFactoryService } = require('./dist/src/agent-factory.service');

async function testContextAgentQuick() {
  console.log('🧪 Quick test: Context agent with pure service container...');
  
  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error'] // Reduce log noise
    });
    
    let agentFactory;
    try {
      agentFactory = app.get('AgentFactoryService');
      console.log('✅ AgentFactoryService retrieved via string token');
    } catch (error) {
      console.log('⚠️  String token failed, trying class constructor...');
      agentFactory = app.get(AgentFactoryService);
      console.log('✅ AgentFactoryService retrieved via class constructor');
    }

    // First discover agents to get a proper DiscoveredAgent object
    const agentDiscovery = app.get('AgentDiscoveryService');
    const discoveredAgents = await agentDiscovery.discoverAgents();
    console.log(`📋 Discovered ${discoveredAgents.length} agents`);

    // Find a context agent to test with
    const contentAgent = discoveredAgents.find(a => a.name === 'content' && a.type === 'marketing');
    if (!contentAgent) {
      throw new Error('Content agent not found among discovered agents');
    }
    console.log(`🎯 Found content agent at: ${contentAgent.path}`);

    // Create the agent instance using the proper DiscoveredAgent object
    const contentAgentInstance = await agentFactory.createAgent(contentAgent);
    console.log('✅ Content agent instance created successfully');
    console.log('📊 Agent name:', contentAgentInstance.getAgentName());
    console.log('📊 Agent type:', contentAgentInstance.getAgentType());

    // Test a simple method call to verify the service container works
    if (typeof contentAgentInstance.getAgentDescription === 'function') {
      const description = contentAgentInstance.getAgentDescription();
      console.log('📄 Agent description:', description);
    }

    console.log('🎉 Pure service container pattern working!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    if (app) {
      await app.close();
    }
  }
}

testContextAgentQuick().catch(console.error);