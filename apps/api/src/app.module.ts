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
import { HierarchySimpleController } from './hierarchy-simple.controller';
import { IntentRecognitionService } from './agents/base/implementations/base-services/orchestrator/intent-recognition.service';
import { MarketingManagerOrchestratorModule } from './agents/actual/orchestrator/marketing_manager_orchestrator/agent.module';
import { CEOOrchestratorModule } from './agents/actual/orchestrator/ceo_orchestrator/agent.module';
import { MarketingManagerOrchestratorService } from './agents/actual/orchestrator/marketing_manager_orchestrator/agent-service';
import { CEOOrchestratorService } from './agents/actual/orchestrator/ceo_orchestrator/agent-service';
import { BaseSubServicesModule } from './agents/base/sub-services/base-sub-services.module';
import { ConfigurationService } from './agents/base/sub-services/configuration/configuration.service';
import { AgentRegistrationService } from './agents/base/sub-services/agent-registration/agent-registration.service';
import { ProvidersModule } from './providers/providers.module';
import { CIDAFMModule } from './cidafm/cidafm.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { UsageModule } from './usage/usage.module';
// import { OrchestratorModule } from './agents/actual/orchestrator/agent.module'; // TODO: Create when orchestrator agents are built
import { AgentConversationsModule } from './agent-conversations/agent-conversations.module';
import { TasksModule } from './tasks/tasks.module';
import { WebSocketModule } from './websocket/websocket.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LangChainModule } from './langchain/langchain.module';
import { HierarchyModule } from './hierarchy/hierarchy.module';
import { ProjectsModule } from './projects/projects.module';
import supabaseConfig from './supabase/supabase.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        // First try the root directory (where the .env file actually is)
        join(process.cwd(), '../../.env.local'),
        join(process.cwd(), '../../.env'),
        // Then try relative to current working directory
        join(process.cwd(), '.env.local'),
        join(process.cwd(), '.env'),
        // Try relative paths from apps/api
        '../../.env.local',
        '../../.env',
        // Local overrides
        '.env.local',
        '.env',
        // Compiled dist directory paths
        join(__dirname, '../../../.env.local'),
        join(__dirname, '../../../.env'),
        join(__dirname, '../../.env.local'),
        join(__dirname, '../../.env'),
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
    // OrchestratorModule, // TODO: Add when orchestrator agents are built
    MarketingManagerOrchestratorModule, // Marketing orchestrator with full DI
    CEOOrchestratorModule, // CEO orchestrator with full DI
    // Direct Agent Access Modules
    EventEmitterModule.forRoot(), // Event system for real-time updates
    AgentConversationsModule, // Agent conversation tracking
    TasksModule, // Task lifecycle management
    WebSocketModule, // Real-time WebSocket updates
    LangChainModule, // LangChain.js integration for agents
    HierarchyModule, // Agent hierarchy and discovery endpoints
    ProjectsModule, // Project lifecycle management and recovery
  ],
  controllers: [
    AppController,
    DynamicAgentsController,
    HierarchySimpleController,
  ],
  providers: [
    AppService,
    AgentDiscoveryService,
    AgentFactoryService,
    IntentRecognitionService, // Orchestrator service for testing
    ConfigurationService,
    AgentRegistrationService,
    // TODO: Dynamic agents will be instantiated via discovery service + factory
    // No need for hardcoded agent imports - everything is discovered and created dynamically
  ],
})
export class AppModule {}
