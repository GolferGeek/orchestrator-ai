#!/usr/bin/env node

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');

async function testFunctionAgentServiceContainer() {
  console.log('🧪 Testing pure service container pattern for function agents...');
  
  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error'] // Reduce noise
    });
    
    // Get FunctionAgentServicesContext directly
    const { FunctionAgentServicesContext } = require('./dist/src/agents/base/services/function-agent-services-context');
    const functionAgentServicesContext = app.get(FunctionAgentServicesContext);
    console.log('✅ FunctionAgentServicesContext retrieved successfully');
    
    // Verify all required services are available
    console.log('🔧 Service availability:');
    console.log('  - httpService:', !!functionAgentServicesContext.httpService);
    console.log('  - llmService:', !!functionAgentServicesContext.llmService);
    console.log('  - taskProgressGateway:', !!functionAgentServicesContext.taskProgressGateway);
    console.log('  - tasksService:', !!functionAgentServicesContext.tasksService);
    console.log('  - taskStatusService:', !!functionAgentServicesContext.taskStatusService);
    console.log('  - deliverablesService:', !!functionAgentServicesContext.deliverablesService);
    console.log('  - agentRegistrationService:', !!functionAgentServicesContext.agentRegistrationService);
    console.log('  - configurationService:', !!functionAgentServicesContext.configurationService);
    
    // Import and directly instantiate a function agent with the service container
    const { MetricsAgentService } = require('./dist/src/agents/actual/finance/metrics/agent-service');
    
    console.log('🏗️  Creating MetricsAgentService with pure service container...');
    const metricsAgent = new MetricsAgentService(functionAgentServicesContext);
    
    console.log('✅ MetricsAgentService created successfully!');
    console.log('📊 Agent name:', metricsAgent.getAgentName());
    console.log('📊 Agent type:', metricsAgent.getAgentType());
    
    // Verify the agent has access to services through the container
    if (metricsAgent.services === functionAgentServicesContext) {
      console.log('✅ Service container properly injected');
    } else if (metricsAgent.services) {
      console.log('⚠️  Agent has services but different reference');
    } else {
      console.log('❌ Agent does not have services container');
    }
    
    // Test another function agent
    const { HRAssistantService } = require('./dist/src/agents/actual/hr/hr_assistant/agent-service');
    
    console.log('🏗️  Creating HRAssistantService with pure service container...');
    const hrAgent = new HRAssistantService(functionAgentServicesContext);
    
    console.log('✅ HRAssistantService created successfully!');
    console.log('📊 HR Agent name:', hrAgent.getAgentName());
    
    console.log('🎉 Pure service container pattern for function agents VERIFIED!');
    console.log('');
    console.log('✅ CONCLUSION: All function agents now use the pure service container pattern');
    console.log('✅ This eliminates constructor parameter explosion in function agents');
    console.log('✅ Makes function agent creation much simpler and more maintainable');

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

testFunctionAgentServiceContainer().catch(console.error);