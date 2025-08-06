import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentServicesContext } from './agent-services-context';
import { LLMModule } from '@/llms/llm.module';
import { TasksModule } from '@/tasks/tasks.module';
import { DeliverablesModule } from '@/deliverables/deliverables.module';
import { WebSocketModule } from '@/websocket/websocket.module';
import { BaseSubServicesModule } from '@agents/base/sub-services/base-sub-services.module';

/**
 * Module that provides the AgentServicesContext with all dependencies
 */
@Module({
  imports: [
    HttpModule,
    LLMModule,
    TasksModule,
    DeliverablesModule,
    WebSocketModule,
    BaseSubServicesModule,
  ],
  providers: [AgentServicesContext],
  exports: [AgentServicesContext],
})
export class AgentServicesContextModule {}

/**
 * Usage in your main modules:
 * 
 * @Module({
 *   imports: [
 *     AgentServicesContextModule,  // Import this instead of all individual services
 *     // ... other modules
 *   ],
 *   providers: [
 *     ContentAgentService,  // Your agents that use AgentServicesContext
 *     // ... other providers
 *   ],
 * })
 * export class SomeAgentModule {}
 */