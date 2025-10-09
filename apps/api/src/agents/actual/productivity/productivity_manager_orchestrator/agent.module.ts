import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BaseSubServicesModule } from '../../../base/sub-services/base-sub-services.module';
import { OrchestratorModule } from '../../../base/implementations/base-services/orchestrator/orchestrator.module';
import { OrchestratorAgentServicesContextModule } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-services-context.module';
import { ProductivityManagerOrchestratorService } from './agent-service';

/**
 * Productivity Manager Orchestrator Module
 *
 * Provides the Productivity Manager Orchestrator agent with access to the full
 * orchestrator infrastructure for productivity planning and delegation.
 */
@Module({
  imports: [
    HttpModule, // Required for HTTP service
    BaseSubServicesModule, // Common agent services
    OrchestratorModule, // Complete orchestrator infrastructure
    OrchestratorAgentServicesContextModule, // Service container for orchestrator agents
  ],
  providers: [ProductivityManagerOrchestratorService],
  exports: [ProductivityManagerOrchestratorService],
})
export class ProductivityManagerOrchestratorModule {}
