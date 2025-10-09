import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BaseSubServicesModule } from '../../../base/sub-services/base-sub-services.module';
import { OrchestratorModule } from '../../../base/implementations/base-services/orchestrator/orchestrator.module';
import { OrchestratorAgentServicesContextModule } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-services-context.module';
import { EngineeringManagerOrchestratorService } from './agent-service';

/**
 * Engineering Manager Orchestrator Module
 *
 * Provides the Engineering Manager Orchestrator agent with access to the full
 * orchestrator infrastructure for engineering project planning and delegation.
 */
@Module({
  imports: [
    HttpModule, // Required for HTTP service
    BaseSubServicesModule, // Common agent services
    OrchestratorModule, // Complete orchestrator infrastructure
    OrchestratorAgentServicesContextModule, // Service container for orchestrator agents
  ],
  providers: [EngineeringManagerOrchestratorService],
  exports: [EngineeringManagerOrchestratorService],
})
export class EngineeringManagerOrchestratorModule {}
