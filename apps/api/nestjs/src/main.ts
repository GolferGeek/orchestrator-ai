import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { AgentDiscoveryService } from './agent-discovery.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.API_PORT || process.env.PORT || '3000';
  await app.listen(port);
  
  const logger = new Logger('Bootstrap');
  logger.log(`🌐 Application is running on: http://localhost:${port}`);
  logger.log(`📊 Agent Pool endpoints: http://localhost:${port}/agent-pool`);
  
  // Wait for agent pool to be ready, then start agent discovery
  await waitForAgentPoolReady(logger, port);
  
  try {
    const agentDiscoveryService = app.get(AgentDiscoveryService);
    logger.log('🔍 Starting agent discovery after agent pool is ready...');
    await agentDiscoveryService.discoverAndInstantiateAgents();
    logger.log('✅ Agent discovery completed');
  } catch (error) {
    logger.error('❌ Failed to start agent discovery:', error);
  }
}

async function waitForAgentPoolReady(logger: Logger, port: string): Promise<void> {
  const maxRetries = 10;
  const retryDelay = 1000; // 1 second
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/agent-pool/agents`);
      if (response.ok) {
        logger.log('✅ Agent pool is ready');
        return;
      }
    } catch (error) {
      // Pool not ready yet
    }
    
    logger.log(`⏳ Waiting for agent pool to be ready... (${i + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  
  throw new Error('Agent pool failed to become ready within timeout');
}

bootstrap().catch(error => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start application:', error);
  process.exit(1);
});
