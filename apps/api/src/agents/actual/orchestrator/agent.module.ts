import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OrchestratorService } from './agent-service';
import { OrchestratorController } from './orchestrator.controller';
import { LLMModule } from '@/llms/llm.module';
import { SessionsModule } from '../../../sessions/sessions.module';
import { SupabaseModule } from '../../../supabase/supabase.module';
import { TasksModule } from '../../../tasks/tasks.module';

// Import the new modular services
import { ConversationContextService } from './services/conversation-context.service';
import { DelegationService } from './services/delegation.service';
import { ResponseGenerationService } from './services/response-generation.service';

@Module({
  imports: [HttpModule, LLMModule, SessionsModule, SupabaseModule, TasksModule],
  controllers: [OrchestratorController],
  providers: [
    OrchestratorService,
    ConversationContextService,
    DelegationService,
    ResponseGenerationService,
  ],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
