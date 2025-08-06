import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TasksModule } from '@/tasks/tasks.module';
import { BaseSubServicesModule } from '../sub-services/base-sub-services.module';
import { ApiAgentServicesContext } from './api-agent-services-context';

/**
 * Module that provides ApiAgentServicesContext for dependency injection.
 * 
 * This module ensures that the API agent service container can be properly
 * injected into API agents using the pure service container pattern.
 * 
 * It imports all necessary modules to provide the required dependencies.
 */
@Module({
  imports: [
    HttpModule,
    TasksModule, // Provides TaskStatusService and TasksService
    BaseSubServicesModule, // Provides all other base agent services
  ],
  providers: [ApiAgentServicesContext],
  exports: [ApiAgentServicesContext],
})
export class ApiAgentServicesContextModule {}