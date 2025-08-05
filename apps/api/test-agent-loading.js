const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');

async function testAgentDiscoveryAndLoading() {
  try {
    console.log('🔍 Testing agent discovery and loading...');
    const app = await NestFactory.createApplicationContext(AppModule);
    
    const discoveryService = app.get('AgentDiscoveryService');
    const factoryService = app.get('AgentFactoryService');
    
    // Discover agents
    console.log('📋 Discovering agents...');
    const agents = await discoveryService.discoverAgents();
    console.log('✅ Discovered ' + agents.length + ' agents');
    
    // Focus on orchestrator agents
    const orchestrators = agents.filter(a => a.type === 'orchestrator');
    console.log('🎯 Found ' + orchestrators.length + ' orchestrator agents:');
    orchestrators.forEach(orch => {
      console.log('  - ' + orch.name + ' at ' + orch.path);
    });
    
    // Try to load one manager orchestrator
    const marketingManager = orchestrators.find(a => a.name.includes('marketing_manager'));
    if (marketingManager) {
      console.log('\n🔧 Testing agent loading for: ' + marketingManager.name);
      try {
        const instance = await factoryService.createAgent(marketingManager);
        const hasInstance = !!instance;
        console.log('✅ Successfully loaded ' + marketingManager.name + ': ' + hasInstance);
        if (instance) {
          console.log('   - Agent type: ' + (instance.getAgentType ? instance.getAgentType() : 'unknown'));
          console.log('   - Agent name: ' + (instance.getAgentName ? instance.getAgentName() : 'unknown'));
        }
      } catch (loadError) {
        console.log('❌ Failed to load ' + marketingManager.name + ': ' + loadError.message);
        console.log('   Error details: ' + loadError.stack);
      }
    } else {
      console.log('❌ No marketing manager orchestrator found');
    }
    
    await app.close();
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAgentDiscoveryAndLoading().catch(console.error);