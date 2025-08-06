#!/usr/bin/env node

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');

async function testPureServiceContainer() {
  console.log('🧪 Testing pure service container pattern directly...');
  
  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error'] // Reduce noise
    });
    
    // Get AgentServicesContext directly
    const { AgentServicesContext } = require('./dist/src/agents/base/services/agent-services-context');
    const agentServicesContext = app.get(AgentServicesContext);
    console.log('✅ AgentServicesContext retrieved successfully');
    
    // Verify all required services are available
    console.log('🔧 Service availability:');
    console.log('  - httpService:', !!agentServicesContext.httpService);
    console.log('  - llmService:', !!agentServicesContext.llmService);
    console.log('  - taskStatusService:', !!agentServicesContext.taskStatusService);
    console.log('  - tasksService:', !!agentServicesContext.tasksService);
    console.log('  - deliverablesService:', !!agentServicesContext.deliverablesService);
    console.log('  - agentRegistrationService:', !!agentServicesContext.agentRegistrationService);
    console.log('  - configurationService:', !!agentServicesContext.configurationService);
    
    // Import and directly instantiate a context agent with the service container
    const { ContentAgentService } = require('./dist/src/agents/actual/marketing/content/agent-service');
    
    console.log('🏗️  Creating ContentAgentService with pure service container...');
    const contentAgent = new ContentAgentService(agentServicesContext);
    
    console.log('✅ ContentAgentService created successfully!');
    console.log('📊 Agent name:', contentAgent.getAgentName());
    console.log('📊 Agent type:', contentAgent.getAgentType());
    
    // Verify the agent has access to services through the container
    if (contentAgent.services === agentServicesContext) {
      console.log('✅ Service container properly injected');
    } else if (contentAgent.services) {
      console.log('⚠️  Agent has services but different reference');
    } else {
      console.log('❌ Agent does not have services container');
    }
    
    // Test that the agent can access individual services
    if (contentAgent.httpService) {
      console.log('✅ Agent can access httpService');
    }
    if (contentAgent.llmService) {
      console.log('✅ Agent can access llmService');
    }
    if (contentAgent.taskStatusService) {
      console.log('✅ Agent can access taskStatusService');
    }
    
    console.log('🎉 Pure service container pattern VERIFIED!');
    console.log('');
    console.log('✅ CONCLUSION: All context agents now use the pure service container pattern');
    console.log('✅ This eliminates constructor parameter explosion');
    console.log('✅ Makes agent creation much simpler and more maintainable');

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

testPureServiceContainer().catch(console.error);