import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LLMModule } from '@/llms/llm.module';
import { TasksModule } from '@/tasks/tasks.module';
import { WebSocketModule } from '@/websocket/websocket.module';
import { DeliverablesModule } from '@/deliverables/deliverables.module';
import { BaseSubServicesModule } from '@agents/base/sub-services/base-sub-services.module';
import { PythonFunctionAgentServicesContext } from './python-function-agent-services-context';

/**
 * Module that provides PythonFunctionAgentServicesContext with all necessary dependencies.
 * This simplifies Python function agent dependency injection by providing a single service container.
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
  providers: [PythonFunctionAgentServicesContext],
  exports: [PythonFunctionAgentServicesContext],
})
export class PythonFunctionAgentServicesContextModule {}
