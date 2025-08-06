import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BaseSubServicesModule } from '../../../sub-services/base-sub-services.module';
import { OrchestratorModule } from './orchestrator.module';
import { OrchestratorAgentServicesContext } from './orchestrator-agent-services.context';

/**
 * Module that provides OrchestratorAgentServicesContext with all necessary dependencies.
 * This simplifies orchestrator agent dependency injection by providing a single service container.
 * Follows the same pattern as PythonFunctionAgentServicesContextModule.
 */
@Module({
  imports: [
    HttpModule,
    BaseSubServicesModule,
    OrchestratorModule, // Provides all orchestrator-specific services
  ],
  providers: [OrchestratorAgentServicesContext],
  exports: [OrchestratorAgentServicesContext],
})
export class OrchestratorAgentServicesContextModule {}