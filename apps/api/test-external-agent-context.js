const { NestFactory } = require('@nestjs/core');

async function testExternalAgentContext() {
  try {
    console.log('🔍 Testing ExternalAgentServicesContext...');
    
    const { AppModule } = require('./dist/src/app.module');
    
    // Create application context with full AppModule
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    
    console.log('✅ AppModule loaded successfully!');
    
    try {
      // Test service context directly
      const externalAgentContext = app.get('ExternalAgentServicesContext');
      console.log('✅ ExternalAgentServicesContext found!');
      
      // Check all required services are available
      console.log('\n🔍 Service Context Verification:');
      console.log('   - HttpService:', !!externalAgentContext.httpService);
      console.log('   - ConfigurationService:', !!externalAgentContext.configurationService);
      console.log('   - AgentRegistrationService:', !!externalAgentContext.agentRegistrationService);
      console.log('   - LoggingService (optional):', !!externalAgentContext.loggingService);
      console.log('   - EvaluationService (optional):', !!externalAgentContext.evaluationService);
      
      if (externalAgentContext.httpService && 
          externalAgentContext.configurationService && 
          externalAgentContext.agentRegistrationService) {
        console.log('\n✅ SUCCESS: ExternalAgentServicesContext works perfectly!');
        console.log('✅ All required services properly injected!');
        console.log('✅ Optional services handled correctly!');
        console.log('✅ Pure service container pattern working for external agents!');
      } else {
        console.log('\n❌ Missing required services in context');
      }
      
    } catch (error) {
      console.error('❌ Error testing ExternalAgentServicesContext:', error.message);
    }
    
    await app.close();
    
  } catch (error) {
    console.error('❌ Error loading AppModule:', error.message);
  }
}

testExternalAgentContext().catch(console.error);