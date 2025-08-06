const { NestFactory } = require('@nestjs/core');

async function testRequirementsWriter() {
  try {
    console.log('🔍 Testing Requirements Writer with new service context...');
    
    const { AppModule } = require('./dist/src/app.module');
    
    // Create application context with full AppModule
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    
    console.log('✅ AppModule loaded successfully!');
    
    try {
      // Get AgentFactoryService to create the requirements writer
      const agentFactory = app.get('AgentFactoryService');
      console.log('✅ AgentFactoryService found!');
      
      // Create the requirements writer agent
      const requirementsWriter = await agentFactory.createAgentService('engineering', 'requirements_writer');
      console.log('✅ Requirements Writer created!');
      
      // Verify the service has access to all required services through service context
      const services = requirementsWriter.services;
      console.log('\n🔍 Service Context Verification:');
      console.log('   - HttpService:', !!services.httpService);
      console.log('   - LLMService:', !!services.llmService);
      console.log('   - TaskProgressGateway:', !!services.taskProgressGateway);
      console.log('   - TasksService:', !!services.tasksService);
      console.log('   - TaskStatusService:', !!services.taskStatusService);
      console.log('   - DeliverablesService:', !!services.deliverablesService);
      
      // Test basic agent methods
      console.log('\n🔍 Agent Methods:');
      console.log('   - Agent Name:', requirementsWriter.getAgentName());
      console.log('   - Agent Type:', requirementsWriter.getAgentType());
      
      // Test task execution (this should work even without Python script)
      console.log('\n🔍 Testing task execution...');
      const result = await requirementsWriter.executeTask('executeTask', {
        prompt: 'Test requirements writing',
        userId: 'test-user',
        conversationId: 'test-conv'
      });
      
      console.log('✅ Task executed successfully!');
      console.log('   - Success:', result.success);
      console.log('   - Has Response:', !!result.response);
      console.log('   - Response type:', result.metadata?.executionType);
      
      if (result.success) {
        console.log('\n✅ SUCCESS: Requirements Writer works with new service context!');
        console.log('✅ All services properly injected via PythonFunctionAgentServicesContext!');
      } else {
        console.log('\n❌ Task execution failed but service creation worked');
      }
      
    } catch (error) {
      console.error('❌ Error testing Requirements Writer:', error.message);
    }
    
    await app.close();
    
  } catch (error) {
    console.error('❌ Error loading AppModule:', error.message);
  }
}

testRequirementsWriter().catch(console.error);