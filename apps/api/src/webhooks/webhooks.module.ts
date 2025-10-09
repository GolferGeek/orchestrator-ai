import { Module, forwardRef } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebSocketModule } from '../agent-platform/websocket/websocket.module';
import { TasksModule } from '../agent2agent/tasks/tasks.module';
import { DeliverablesModule } from '../agent2agent/deliverables/deliverables.module';

@Module({
  imports: [
    WebSocketModule,
    forwardRef(() => TasksModule),
    forwardRef(() => DeliverablesModule),
  ],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
