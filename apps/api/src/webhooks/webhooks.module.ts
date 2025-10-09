import { Module, forwardRef } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebSocketModule } from '../websocket/websocket.module';
import { TasksModule } from '../tasks/tasks.module';
import { DeliverablesModule } from '../deliverables/deliverables.module';

@Module({
  imports: [
    WebSocketModule,
    forwardRef(() => TasksModule),
    forwardRef(() => DeliverablesModule),
  ],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
