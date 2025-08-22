import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TaskStatusService } from './task-status.service';
import { TaskMessageService } from './task-message.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AgentConversationsModule } from '../agent-conversations/agent-conversations.module';
import { BaseSubServicesModule } from '../agents/base/sub-services/base-sub-services.module';
import { DeliverablesModule } from '../deliverables/deliverables.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    SupabaseModule,
    AgentConversationsModule,
    BaseSubServicesModule,
    DeliverablesModule,
    EventEmitterModule,
  ],
  providers: [TasksService, TaskStatusService, TaskMessageService],
  controllers: [TasksController],
  exports: [TasksService, TaskStatusService, TaskMessageService],
})
export class TasksModule {}
