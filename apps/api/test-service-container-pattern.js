#!/usr/bin/env node

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');
const { AgentFactoryService } = require('./dist/src/agent-factory.service');
const path = require('path');

async function testServiceContainerPattern() {
  console.log('🧪 Testing pure service container pattern for context agents...');
  
  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'] // Enable more logging to debug DI issues
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

    // Check if AgentServicesContext is available
    let agentServicesContext;
    try {
      const { AgentServicesContext } = require('./dist/src/agents/base/services/agent-services-context');
      agentServicesContext = app.get(AgentServicesContext);
      console.log('✅ AgentServicesContext is available in DI container');
      
      // Test the services are injected
      console.log('🔧 Available services in context:');
      console.log('  - httpService:', !!agentServicesContext.httpService);
      console.log('  - llmService:', !!agentServicesContext.llmService);
      console.log('  - taskStatusService:', !!agentServicesContext.taskStatusService);
      console.log('  - tasksService:', !!agentServicesContext.tasksService);
      console.log('  - deliverablesService:', !!agentServicesContext.deliverablesService);
      console.log('  - agentRegistrationService:', !!agentServicesContext.agentRegistrationService);
      console.log('  - configurationService:', !!agentServicesContext.configurationService);
      
    } catch (error) {
      console.log('❌ AgentServicesContext not available:', error.message);
      
      // If AgentServicesContext isn't available, we can't test the pure service container pattern
      console.log('❌ Cannot test pure service container pattern without AgentServicesContext');
      return;
    }

    // Manually create a DiscoveredAgent object for testing
    // This simulates what AgentDiscoveryService would provide
    const mockDiscoveredAgent = {
      name: 'content',
      type: 'marketing',
      path: 'marketing/content',
      servicePath: path.join(__dirname, 'src/agents/actual/marketing/content/agent-service.ts'),
    };

    console.log(`🎯 Testing with mock agent: ${mockDiscoveredAgent.path}`);

    // Create the agent instance using the pure service container pattern
    const contentAgentInstance = await agentFactory.createAgent(mockDiscoveredAgent);
    console.log('✅ Content agent instance created successfully with pure service container!');
    
    // Test basic methods
    console.log('📊 Agent name:', contentAgentInstance.getAgentName());
    console.log('📊 Agent type:', contentAgentInstance.getAgentType());

    // Verify the agent has access to services through the container
    if (contentAgentInstance.services) {
      console.log('✅ Services container is available');
      console.log('🔧 Services available:', Object.keys(contentAgentInstance.services).length > 0 ? 'Yes' : 'No');
    } else {
      console.log('❌ No services container found');
    }

    // Test a method that would use the services (without actually calling LLM)
    if (typeof contentAgentInstance.getAgentDescription === 'function') {
      const description = contentAgentInstance.getAgentDescription();
      console.log('📄 Agent description:', description ? 'Available' : 'Not set');
    }

    console.log('🎉 Pure service container pattern verification SUCCESSFUL!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  } finally {
    if (app) {
      await app.close();
    }
  }
}

testServiceContainerPattern().catch(console.error);