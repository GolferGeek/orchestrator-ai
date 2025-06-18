import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AgentDiscoveryService } from './agent-discovery.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('A2A Agent Framework API')
    .setDescription('NestJS A2A Agent Framework with Supabase Authentication')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for referencing in controllers
    )
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  const port = process.env.API_PORT || process.env.PORT || '4000';
  await app.listen(port);
  
  const logger = new Logger('Bootstrap');
  logger.log(`🌐 Application is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger API docs: http://localhost:${port}/api`);
  logger.log(`🔐 Auth endpoints: http://localhost:${port}/auth`);
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
