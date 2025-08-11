import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EvaluationModule } from '@/evaluation/evaluation.module';

import { BaseSubServicesModule } from '@agents/base/sub-services/base-sub-services.module';
import { ExternalAgentServicesContext } from './external-agent-services-context';

/**
 * External Agent Services Context Module
 *
 * Provides the ExternalAgentServicesContext service container that aggregates
 * all dependencies needed by external agents.
 *
 * This eliminates the need for external agents to import multiple individual
 * service modules and manage complex dependency chains.
 */
@Module({
  imports: [
    HttpModule, // Provides HttpService
    BaseSubServicesModule, // Provides all other external agent services
    EvaluationModule, // Provides EvaluationWrapperService (optional)
  ],
  providers: [ExternalAgentServicesContext],
  exports: [ExternalAgentServicesContext],
})
export class ExternalAgentServicesContextModule {}
