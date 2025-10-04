import { Module } from '@nestjs/common';
import { HierarchyController } from './hierarchy.controller';
import { AgentRegistryService } from '../services/agent-registry.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { SupabaseModule } from '@/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [HierarchyController],
  providers: [AgentRegistryService, AgentsRepository],
  exports: [],
})
export class HierarchyModule {}
