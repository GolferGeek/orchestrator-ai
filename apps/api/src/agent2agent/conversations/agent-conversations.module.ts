import { Module } from '@nestjs/common';
import { AgentConversationsService } from './agent-conversations.service';
import { AgentConversationsController } from './agent-conversations.controller';
import { SupabaseModule } from '@/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [AgentConversationsService],
  controllers: [AgentConversationsController],
  exports: [AgentConversationsService],
})
export class AgentConversationsModule {}
