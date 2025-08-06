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
import { MarketingManagerOrchestratorModule } from './agents/actual/marketing/marketing_manager_orchestrator/agent.module';
import { CEOOrchestratorModule } from './agents/actual/orchestrator/ceo_orchestrator/agent.module';
import { EngineeringManagerOrchestratorModule } from './agents/actual/engineering/engineering_manager_orchestrator/agent.module';
import { OperationsManagerOrchestratorModule } from './agents/actual/operations/operations_manager_orchestrator/agent.module';
import { FinanceManagerOrchestratorModule } from './agents/actual/finance/finance_manager_orchestrator/agent.module';
import { HRManagerOrchestratorModule } from './agents/actual/hr/hr_manager_orchestrator/agent.module';
import { SalesManagerOrchestratorModule } from './agents/actual/sales/sales_manager_orchestrator/agent.module';
import { ProductManagerOrchestratorModule } from './agents/actual/product/product_manager_orchestrator/agent.module';
import { ResearchManagerOrchestratorModule } from './agents/actual/research/research_manager_orchestrator/agent.module';
import { SpecialistsManagerOrchestratorModule } from './agents/actual/specialists/specialists_manager_orchestrator/agent.module';
import { LegalManagerOrchestratorModule } from './agents/actual/legal/legal_manager_orchestrator/agent.module';
import { ProductivityManagerOrchestratorModule } from './agents/actual/productivity/productivity_manager_orchestrator/agent.module';
import { MarketingManagerOrchestratorService } from './agents/actual/marketing/marketing_manager_orchestrator/agent-service';
import { CEOOrchestratorService } from './agents/actual/orchestrator/ceo_orchestrator/agent-service';
import { EngineeringManagerOrchestratorService } from './agents/actual/engineering/engineering_manager_orchestrator/agent-service';
import { OperationsManagerOrchestratorService } from './agents/actual/operations/operations_manager_orchestrator/agent-service';
import { FinanceManagerOrchestratorService } from './agents/actual/finance/finance_manager_orchestrator/agent-service';
import { HRManagerOrchestratorService } from './agents/actual/hr/hr_manager_orchestrator/agent-service';
import { SalesManagerOrchestratorService } from './agents/actual/sales/sales_manager_orchestrator/agent-service';
import { ProductManagerOrchestratorService } from './agents/actual/product/product_manager_orchestrator/agent-service';
import { ResearchManagerOrchestratorService } from './agents/actual/research/research_manager_orchestrator/agent-service';
import { SpecialistsManagerOrchestratorService } from './agents/actual/specialists/specialists_manager_orchestrator/agent-service';
import { LegalManagerOrchestratorService } from './agents/actual/legal/legal_manager_orchestrator/agent-service';
import { ProductivityManagerOrchestratorService } from './agents/actual/productivity/productivity_manager_orchestrator/agent-service';
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
import { DeliverablesModule } from './deliverables/deliverables.module';
import { AgentServicesContextModule } from './agents/base/services/agent-services-context.module';
import { FunctionAgentServicesContextModule } from './agents/base/services/function-agent-services-context.module';
import { ApiAgentServicesContextModule } from './agents/base/services/api-agent-services-context.module';
import { PythonFunctionAgentServicesContextModule } from './agents/base/services/python-function-agent-services-context.module';
import { ExternalAgentServicesContextModule } from './agents/base/services/external-agent-services-context.module';
import { OrchestratorAgentServicesContextModule } from './agents/base/implementations/base-services/orchestrator/orchestrator-agent-services-context.module';
import { UniversalAgentServicesContextModule } from './agents/base/services/universal-agent-services-context.module';
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
    EngineeringManagerOrchestratorModule, // Engineering manager orchestrator
    OperationsManagerOrchestratorModule, // Operations manager orchestrator
    FinanceManagerOrchestratorModule, // Finance manager orchestrator
    HRManagerOrchestratorModule, // HR manager orchestrator
    SalesManagerOrchestratorModule, // Sales manager orchestrator
    ProductManagerOrchestratorModule, // Product manager orchestrator
    ResearchManagerOrchestratorModule, // Research manager orchestrator
    SpecialistsManagerOrchestratorModule, // Specialists manager orchestrator
    LegalManagerOrchestratorModule, // Legal manager orchestrator
    ProductivityManagerOrchestratorModule, // Productivity manager orchestrator
    // Direct Agent Access Modules
    EventEmitterModule.forRoot(), // Event system for real-time updates
    AgentConversationsModule, // Agent conversation tracking
    TasksModule, // Task lifecycle management
    WebSocketModule, // Real-time WebSocket updates
    LangChainModule, // LangChain.js integration for agents
    HierarchyModule, // Agent hierarchy and discovery endpoints
    ProjectsModule, // Project lifecycle management and recovery
    DeliverablesModule, // Deliverables persistence and management
    AgentServicesContextModule, // Service container for simplified context agent DI
    FunctionAgentServicesContextModule, // Service container for simplified function agent DI
    ApiAgentServicesContextModule, // Service container for simplified API agent DI
    PythonFunctionAgentServicesContextModule, // Service container for simplified Python function agent DI
    ExternalAgentServicesContextModule, // Service container for simplified external agent DI
    OrchestratorAgentServicesContextModule, // Service container for simplified orchestrator agent DI
    UniversalAgentServicesContextModule, // Universal service container for all agent types
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
