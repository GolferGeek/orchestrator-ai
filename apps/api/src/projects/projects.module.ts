import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SupabaseModule } from '@/supabase/supabase.module';
import { WebSocketModule } from '@/websocket/websocket.module';

@Module({
  imports: [SupabaseModule, WebSocketModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}