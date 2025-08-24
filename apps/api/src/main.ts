import { NestFactory } from '@nestjs/core';
import { Logger, LogLevel } from '@nestjs/common';
import { AppModule } from './app.module';
import { AgentPoolService } from './agent-pool/agent-pool.service';
import * as express from 'express';
import * as dotenv from 'dotenv';
import { join } from 'path';

async function bootstrap() {
  // Suppress punycode deprecation warning until dependencies are updated
  (process as any).noDeprecation = true;
  // Load custom environment file if ENV_FILE is specified
  if (process.env.ENV_FILE) {
    const envFilePath = process.env.ENV_FILE.startsWith('/')
      ? process.env.ENV_FILE
      : join(process.cwd(), process.env.ENV_FILE);
    
    try {
      dotenv.config({ path: envFilePath });

    } catch (error) {

      process.exit(1);
    }
  }

  const logger = new Logger('Bootstrap');

  // Parse command line arguments for --enable-external-agents
  const args = process.argv.slice(2);
  const enableExternalIdx = args.findIndex(
    (arg) => arg === '--enable-external-agents' || arg === '--enable-external',
  );
  if (enableExternalIdx !== -1) {
    process.env.ENABLE_EXTERNAL_AGENTS = 'true';

  }

  // Configure logging levels based on environment
  // 
  // Environment Variables for Logging:
  // LOG_LEVEL - Comma-separated list of levels: error,warn,log,debug,verbose
  // NODE_ENV - Environment: production, development, test
  //
  // Examples:
  // LOG_LEVEL=error,warn              (Production-like logging)
  // LOG_LEVEL=error,warn,log          (Info logging without debug)
  // LOG_LEVEL=error,warn,log,debug    (Full development logging - default in dev)
  // LOG_LEVEL=error                   (Minimal logging)
  //
  const logLevels = (() => {
    const nodeEnv = process.env.NODE_ENV;
    const logLevel = process.env.LOG_LEVEL;
    
    // Valid NestJS log levels
    const validLevels: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
    
    // If LOG_LEVEL is explicitly set, use it
    if (logLevel) {
      const levels = logLevel.toLowerCase().split(',').map(l => l.trim());
      return levels.filter(level => validLevels.includes(level as LogLevel)) as LogLevel[];
    }
    
    // Default levels based on environment
    if (nodeEnv === 'production') {
      return ['error', 'warn'] as LogLevel[]; // Only errors and warnings in production
    } else if (nodeEnv === 'test') {
      return ['error'] as LogLevel[]; // Only errors in test
    } else {
      return ['error', 'warn'] as LogLevel[]; // Development: minimal logging by default
    }
  })();

  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default body parser to configure custom limits
    logger: logLevels, // Configure logging levels
  });

  // Configure body parser with larger limits for conversation histories and metrics responses
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Enable CORS with more permissive settings for production
  const corsOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:9001',
    'http://127.0.0.1:9001',
    'http://localhost:3100',
    'http://127.0.0.1:3100',
    'http://localhost:3101',
    'http://127.0.0.1:3101',
    // Add more common development ports
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    // Production domains
    'https://app.orchestratorai.io',
    'https://api.orchestratorai.io',
    'http://app.orchestratorai.io',
    'http://api.orchestratorai.io',
    // CloudFlare variations
    'https://orchestratorai.io',
    'http://orchestratorai.io',
  ];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // Check if origin is in our list
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Log unrecognized origins for debugging

      // In production, you might want to be more restrictive
      // For now, let's allow all orchestratorai.io subdomains
      if (origin.includes('orchestratorai.io')) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Start the HTTP server
  const port = parseInt(process.env.API_PORT || '9000');

  await app.listen(port);

  // Ensure agent pool service is ready
  app.get(AgentPoolService);

  // Agent discovery and instantiation is now handled by AppService.onModuleInit()
  // No need for manual calls here - the AppService will handle:
  // 1. AgentDiscoveryService.discoverAgents()
  // 2. AgentFactoryService.createAgent() for each discovered agent
  // 3. Registration with agent pool

}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');

  process.exit(1);
});
