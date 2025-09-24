import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BaseSubServicesModule } from '../../../base/sub-services/base-sub-services.module';
import { OrchestratorModule } from '../../../base/implementations/base-services/orchestrator/orchestrator.module';
import { OrchestratorAgentServicesContextModule } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-services-context.module';
import { ResearchManagerOrchestratorService } from './agent-service';

/**
 * Research Manager Orchestrator Module
 *
 * Provides the Research Manager Orchestrator agent with access to the full
 * orchestrator infrastructure for research planning and delegation.
 */
@Module({
  imports: [
    HttpModule, // Required for HTTP service
    BaseSubServicesModule, // Common agent services
    OrchestratorModule, // Complete orchestrator infrastructure
    OrchestratorAgentServicesContextModule, // Service container for orchestrator agents
  ],
  providers: [ResearchManagerOrchestratorService],
  exports: [ResearchManagerOrchestratorService],
})
export class ResearchManagerOrchestratorModule {}
