import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

// Base services
import { BaseSubServicesModule } from '../../../sub-services/base-sub-services.module';
import { LLMModule } from '../../../../../llms/llm.module';
import { SupabaseModule } from '../../../../../supabase/supabase.module';
import { TasksModule } from '../../../../../tasks/tasks.module';
import { WebSocketModule } from '../../../../../websocket/websocket.module';
import { AuthModule } from '../../../../../auth/auth.module';
import { AgentConversationsModule } from '../../../../../agent-conversations/agent-conversations.module';
import { CIDAFMModule } from '../../../../../cidafm/cidafm.module';
import { AgentDiscoveryService } from '../../../../../agent-discovery.service';
import { AgentFactoryService } from '../../../../../agent-factory.service';
import { AgentPoolModule } from '../../../../../agent-pool/agent-pool.module';
import { FormattersModule } from '../../../../../common/formatters/formatters.module';

// Orchestrator services
import { OrchestratorAgentBaseService } from './orchestrator-agent-base.service';
import { IntentRecognitionService } from './intent-recognition.service';
import { PlanningService } from './planning.service';
import { PlanExecutionService } from './plan-execution.service';
import { DelegationService } from './delegation.service';
import { SubprojectManagementService } from './subproject-management.service';
import { LangGraphStateManagementService } from './langgraph-state-management.service';
import { OrchestratorFacadeService } from './orchestrator-facade.service';

/**
 * Orchestrator Module - Wires together all orchestrator services
 *
 * Provides the complete orchestrator infrastructure following the
 * conversation + tasks paradigm with project enhancements.
 */
@Module({
  imports: [
    HttpModule,
    BaseSubServicesModule, // Common agent services
    LLMModule, // For LLM service access
    SupabaseModule, // For database access
    TasksModule, // Required for AgentFactoryService
    WebSocketModule, // Required for AgentFactoryService
    AuthModule, // Required for AgentFactoryService
    AgentConversationsModule, // Required for AgentFactoryService
    CIDAFMModule, // Required for AgentFactoryService
    AgentPoolModule, // Required for SubprojectManagementService
    FormattersModule, // For agent name formatting
  ],
  providers: [
    // Core services
    IntentRecognitionService,
    PlanningService,
    PlanExecutionService,
    DelegationService,
    SubprojectManagementService,
    LangGraphStateManagementService,
    AgentDiscoveryService, // Required for planning and delegation services
    AgentFactoryService, // Required for delegation service

    // Facade service (main coordinator)
    OrchestratorFacadeService,
    {
      provide: 'IOrchestratorFacadeService',
      useExisting: OrchestratorFacadeService,
    },

    // Service interfaces for dependency injection
    {
      provide: 'IIntentRecognitionService',
      useExisting: IntentRecognitionService,
    },
    {
      provide: 'IPlanningService',
      useExisting: PlanningService,
    },
    {
      provide: 'IPlanExecutionService',
      useExisting: PlanExecutionService,
    },
    {
      provide: 'IDelegationService',
      useExisting: DelegationService,
    },
    {
      provide: 'ISubprojectManagementService',
      useExisting: SubprojectManagementService,
    },
    {
      provide: 'ILangGraphStateManagementService',
      useExisting: LangGraphStateManagementService,
    },
  ],
  exports: [
    // Export services for external use
    IntentRecognitionService,
    PlanningService,
    PlanExecutionService,
    DelegationService,
    SubprojectManagementService,
    LangGraphStateManagementService,
    OrchestratorFacadeService,

    // Export interface tokens
    'IOrchestratorFacadeService',
    'IIntentRecognitionService',
    'IPlanningService',
    'IPlanExecutionService',
    'IDelegationService',
    'ISubprojectManagementService',
    'ILangGraphStateManagementService',
  ],
})
export class OrchestratorModule {}
