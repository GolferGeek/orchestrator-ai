import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LLMModule } from '@/llms/llm.module';
import { TasksModule } from '@/tasks/tasks.module';
import { WebSocketModule } from '@/websocket/websocket.module';
import { DeliverablesModule } from '@/deliverables/deliverables.module';
import { BaseSubServicesModule } from '@agents/base/sub-services/base-sub-services.module';
import { FunctionAgentServicesContext } from './function-agent-services-context';

/**
 * Module that provides FunctionAgentServicesContext with all necessary dependencies.
 * This simplifies function agent dependency injection by providing a single service container.
 */
@Module({
  imports: [
    HttpModule,
    LLMModule,
    TasksModule,
    WebSocketModule,
    DeliverablesModule,
    BaseSubServicesModule,
  ],
  providers: [FunctionAgentServicesContext],
  exports: [FunctionAgentServicesContext],
})
export class FunctionAgentServicesContextModule {}
