import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

// Base services
import { BaseSubServicesModule } from '../../../sub-services/base-sub-services.module';

// Orchestrator services
import { OrchestratorAgentBaseService } from './orchestrator-agent-base.service';
import { IntentRecognitionService } from './intent-recognition.service';
import { PlanningService } from './planning.service';
import { PlanExecutionService } from './plan-execution.service';
import { DelegationService } from './delegation.service';
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
  ],
  providers: [
    // Core services
    IntentRecognitionService,
    PlanningService,
    PlanExecutionService,
    DelegationService,
    
    // Facade service (main coordinator)
    {
      provide: 'IOrchestratorFacadeService',
      useClass: OrchestratorFacadeService,
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
  ],
  exports: [
    // Export base class for orchestrator agents
    OrchestratorAgentBaseService,
    
    // Export services for external use
    IntentRecognitionService,
    PlanningService,
    PlanExecutionService,
    DelegationService,
    OrchestratorFacadeService,
    
    // Export interface tokens
    'IOrchestratorFacadeService',
    'IIntentRecognitionService',
    'IPlanningService',
    'IPlanExecutionService',
    'IDelegationService',
  ],
})
export class OrchestratorModule {}