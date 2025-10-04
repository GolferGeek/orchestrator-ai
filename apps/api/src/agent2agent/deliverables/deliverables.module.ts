import { Module, forwardRef } from '@nestjs/common';
import { DeliverablesService } from './deliverables.service';
import { DeliverablesController } from './deliverables.controller';
import { DeliverableVersionsService } from './deliverable-versions.service';
import { DeliverableVersionsController } from './deliverable-versions.controller';
import { SupabaseModule } from '@/supabase/supabase.module';
import { AgentConversationsModule } from '@/agent2agent/conversations/agent-conversations.module';
import { LLMModule } from '@/llms/llm.module';

@Module({
  imports: [
    SupabaseModule,
    AgentConversationsModule,
    forwardRef(() => LLMModule),
  ],
  controllers: [DeliverablesController, DeliverableVersionsController],
  providers: [DeliverablesService, DeliverableVersionsService],
  exports: [DeliverablesService, DeliverableVersionsService],
})
export class DeliverablesModule {}
