import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { LLMModule } from '@/llms/llm.module';
import { WebSocketModule } from './websocket/websocket.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MCPModule } from './mcp/mcp.module';
import { SovereignPolicyModule } from './config/sovereign-policy.module';
import { SystemModule } from './system/system.module';
import { AnalyticsController } from './analytics/analytics.controller';
import { SpeechModule } from './speech/speech.module';
import { Agent2AgentModule } from './agent2agent/agent2agent.module';
import { AgentPlatformModule } from './agent-platform/agent-platform.module';
import { AssetsModule } from './assets/assets.module';
import { AgentRegistryService } from './agent-platform/services/agent-registry.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '../../../.env'),
        '../../.env',
        join(process.cwd(), '.env'),
        '.env',
      ],
      expandVariables: true,
    }),
    // Core Infrastructure
    HttpModule,
    SupabaseModule,
    AuthModule,
    HealthModule,
    WebSocketModule,
    MCPModule,
    EventEmitterModule.forRoot(),

    // Main Modules (consolidated)
    LLMModule,              // Includes: providers, models, evaluation, cidafm, usage, langchain, pii
    Agent2AgentModule,      // Includes: conversations, tasks, deliverables, projects, context-optimization, orchestration
    AgentPlatformModule,    // Includes: database agents, registry, hierarchy

    // Standalone Features
    SovereignPolicyModule,
    SystemModule,
    SpeechModule,
    AssetsModule,
  ],
  controllers: [
    AppController,
    AnalyticsController,
  ],
  providers: [
    AppService,
    AgentRegistryService,
  ],
})
export class AppModule {}
