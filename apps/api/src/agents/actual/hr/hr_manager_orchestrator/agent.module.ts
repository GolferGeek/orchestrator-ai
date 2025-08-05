import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BaseSubServicesModule } from '../../../base/sub-services/base-sub-services.module';
import { OrchestratorModule } from '../../../base/implementations/base-services/orchestrator/orchestrator.module';
import { HRManagerOrchestratorService } from './agent-service';

/**
 * HR Manager Orchestrator Module
 *
 * Provides the HR Manager Orchestrator agent with access to the full
 * orchestrator infrastructure for HR planning and delegation.
 */
@Module({
  imports: [
    HttpModule, // Required for HTTP service
    BaseSubServicesModule, // Common agent services
    OrchestratorModule, // Complete orchestrator infrastructure
  ],
  providers: [HRManagerOrchestratorService],
  exports: [HRManagerOrchestratorService],
})
export class HRManagerOrchestratorModule {}