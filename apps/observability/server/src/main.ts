import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as express from 'express';

async function bootstrap() {
  // Load environment variables
  dotenv.config();

  const app = await NestFactory.create(AppModule, {
    cors: true,
    bodyParser: false, // Disable default body parser to configure manually
  });

  // Configure body parser with larger limits for hook payloads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  const port = parseInt(process.env.SERVER_PORT || '4100');
  await app.listen(port);

  console.log(`✅ Observability server running on http://localhost:${port}`);
  console.log(`📊 WebSocket endpoint: ws://localhost:${port}/stream`);
  console.log(`📮 POST events to: http://localhost:${port}/events`);
  console.log(`🔗 POST hooks to: http://localhost:${port}/hooks`);
}

bootstrap();
