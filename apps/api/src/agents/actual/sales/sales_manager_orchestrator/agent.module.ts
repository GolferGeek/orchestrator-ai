import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BaseSubServicesModule } from '../../../base/sub-services/base-sub-services.module';
import { OrchestratorModule } from '../../../base/implementations/base-services/orchestrator/orchestrator.module';
import { OrchestratorAgentServicesContextModule } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-services-context.module';
import { SalesManagerOrchestratorService } from './agent-service';

/**
 * Sales Manager Orchestrator Module
 *
 * Provides the Sales Manager Orchestrator agent with access to the full
 * orchestrator infrastructure for sales planning and delegation.
 */
@Module({
  imports: [
    HttpModule, // Required for HTTP service
    BaseSubServicesModule, // Common agent services
    OrchestratorModule, // Complete orchestrator infrastructure
    OrchestratorAgentServicesContextModule, // Service container for orchestrator agents
  ],
  providers: [SalesManagerOrchestratorService],
  exports: [SalesManagerOrchestratorService],
})
export class SalesManagerOrchestratorModule {}
