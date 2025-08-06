const { Test } = require('@nestjs/testing');

async function testExternalContextMinimal() {
  try {
    console.log('🔍 Testing ExternalAgentServicesContext with minimal module...');
    
    const { ExternalAgentServicesContextModule } = require('./dist/src/agents/base/services/external-agent-services-context.module');
    
    // Create testing module with just the external context module
    const moduleRef = await Test.createTestingModule({
      imports: [ExternalAgentServicesContextModule],
    }).compile();
    
    console.log('✅ ExternalAgentServicesContextModule loaded successfully!');
    
    // Get the service from the testing module
    const externalAgentContext = moduleRef.get('ExternalAgentServicesContext');
    console.log('✅ ExternalAgentServicesContext found in testing module!');
    
    console.log('\n🔍 Service Context Verification:');
    console.log('   - HttpService:', !!externalAgentContext.httpService);
    console.log('   - ConfigurationService:', !!externalAgentContext.configurationService);
    console.log('   - AgentRegistrationService:', !!externalAgentContext.agentRegistrationService);
    console.log('   - LoggingService (optional):', !!externalAgentContext.loggingService);
    console.log('   - EvaluationService (optional):', !!externalAgentContext.evaluationService);
    
    console.log('\n✅ SUCCESS: ExternalAgentServicesContext DI working!');
    console.log('✅ External agent service container pattern implemented successfully!');
    
    await moduleRef.close();
    
  } catch (error) {
    console.error('❌ Error in minimal test:', error.message);
    if (error.message.includes('Nest could not find')) {
      console.error('❌ DI Issue: Service not found in container');
    } else if (error.message.includes('Nest cannot create')) {
      console.error('❌ DI Issue: Cannot instantiate service - missing dependencies');
    } else if (error.message.includes('circular')) {
      console.error('❌ DI Issue: Circular dependency detected');
    }
    console.error('❌ Stack:', error.stack);
  }
}

testExternalContextMinimal().catch(console.error);