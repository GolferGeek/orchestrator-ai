import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AgentPoolService } from './agent-pool/agent-pool.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3100',
      'http://127.0.0.1:3100',
      'http://localhost:3101',
      'http://127.0.0.1:3101',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  });

  // Start the HTTP server
  const port = parseInt(process.env.API_PORT || '4100');
  logger.log('🚀 Starting NestJS API server...');
  await app.listen(port);
  logger.log(`✅ NestJS API server is running on http://localhost:${port}`);

  // Ensure agent pool service is ready
  const agentPoolService = app.get(AgentPoolService);
  logger.log('🔧 Agent pool service is ready');

  // Agent discovery and instantiation is now handled by AppService.onModuleInit()
  // No need for manual calls here - the AppService will handle:
  // 1. AgentDiscoveryService.discoverAgents()
  // 2. AgentFactoryService.createAgent() for each discovered agent
  // 3. Registration with agent pool
  logger.log('✅ Agent system initialization delegated to AppService');

  logger.log('🎉 Application startup complete!');
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start application:', error);
  process.exit(1);
});
