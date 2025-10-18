import { Module } from '@nestjs/common';
import { ContextOptimizationService } from './context-optimization.service';
import { ContextMetricsController } from './context-metrics.controller';
import { ContextMetricsListener } from './context-metrics.listener';
import { SupabaseModule } from '@/supabase/supabase.module';
import { AgentConversationsModule } from '../conversations/agent-conversations.module';
import { DeliverablesModule } from '../deliverables/deliverables.module';

@Module({
  imports: [SupabaseModule, AgentConversationsModule, DeliverablesModule],
  controllers: [ContextMetricsController],
  providers: [ContextOptimizationService, ContextMetricsListener],
  exports: [ContextOptimizationService],
})
export class ContextOptimizationModule {}
