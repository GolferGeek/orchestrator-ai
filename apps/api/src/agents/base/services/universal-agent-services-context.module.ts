import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BaseSubServicesModule } from '../sub-services/base-sub-services.module';
import { TasksModule } from '../../../tasks/tasks.module';
import { DeliverablesModule } from '../../../deliverables/deliverables.module';
import { UniversalAgentServicesContext } from './universal-agent-services-context';

/**
 * Module that provides UniversalAgentServicesContext with all necessary dependencies.
 * This simplifies agent dependency injection by providing a single service container
 * that works for all agent types (orchestrator, external, python function, etc.)
 */
@Module({
  imports: [
    HttpModule,
    BaseSubServicesModule, // Provides core agent infrastructure services
    TasksModule, // Provides TaskStatusService
    DeliverablesModule, // Provides DeliverablesService
  ],
  providers: [UniversalAgentServicesContext],
  exports: [UniversalAgentServicesContext],
})
export class UniversalAgentServicesContextModule {}