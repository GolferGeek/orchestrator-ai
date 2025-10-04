import { Module, Global } from '@nestjs/common';
import { TaskProgressGateway } from './task-progress.gateway';
import { SupabaseModule } from '@/supabase/supabase.module';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [TaskProgressGateway],
  exports: [TaskProgressGateway],
})
export class WebSocketModule {}
