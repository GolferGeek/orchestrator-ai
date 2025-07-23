import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { HealthModule } from './health/health.module';
import { AgentPoolModule } from './agent-pool/agent-pool.module';
import { LLMModule } from '@/llms/llm.module';
import { AgentDiscoveryService } from './agent-discovery.service';
import { AgentFactoryService } from './agent-factory.service';
import { DynamicAgentsController } from './agents/dynamic-agents.controller';
import { BaseSubServicesModule } from './agents/base/sub-services/base-sub-services.module';
import { ConfigurationService } from './agents/base/sub-services/configuration/configuration.service';
import { AgentRegistrationService } from './agents/base/sub-services/agent-registration/agent-registration.service';
import { ProvidersModule } from './providers/providers.module';
import { CIDAFMModule } from './cidafm/cidafm.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { UsageModule } from './usage/usage.module';
import { OrchestratorModule } from './agents/actual/orchestrator/agent.module';
import { AgentConversationsModule } from './agent-conversations/agent-conversations.module';
import { TasksModule } from './tasks/tasks.module';
import { WebSocketModule } from './websocket/websocket.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MCPModule } from './mcp/mcp.module';
import supabaseConfig from './supabase/supabase.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env.local',
        '.env',
        join(process.cwd(), '.env.local'),
        join(process.cwd(), '.env'),
        join(__dirname, '../../../.env.local'),
        join(__dirname, '../../../.env'),
      ],
      expandVariables: true,
      load: [supabaseConfig],
    }),
    HttpModule, // Add HttpModule for agent services
    LLMModule, // Add LLMModule for LLM and LangSmith services
    BaseSubServicesModule, // Add BaseSubServicesModule for agent sub-services
    SupabaseModule,
    AuthModule,
    SessionsModule,
    HealthModule,
    AgentPoolModule,
    // LLM Evaluation Enhancement Modules
    ProvidersModule, // LLM providers and models management
    CIDAFMModule, // AI Function Module behavior modification
    EvaluationModule, // Message evaluation and feedback
    UsageModule, // Usage analytics and cost tracking
    // Agent Modules
    OrchestratorModule, // Orchestrator agent with UI endpoints
    // Direct Agent Access Modules
    EventEmitterModule.forRoot(), // Event system for real-time updates
    AgentConversationsModule, // Agent conversation tracking
    TasksModule, // Task lifecycle management
    WebSocketModule, // Real-time WebSocket updates
    MCPModule, // Model Context Protocol servers and clients
  ],
  controllers: [AppController, DynamicAgentsController],
  providers: [
    AppService,
    AgentDiscoveryService,
    AgentFactoryService,
    ConfigurationService,
    AgentRegistrationService,
    // TODO: Dynamic agents will be instantiated via discovery service + factory
    // No need for hardcoded agent imports - everything is discovered and created dynamically
  ],
})
export class AppModule {}
