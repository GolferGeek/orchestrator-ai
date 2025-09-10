import { Module } from '@nestjs/common';
import { AgentCreatorService } from './agent-service';
import { AgentConfigurationService } from './services/agent-configuration.service';
import { VirtualAgentLoaderService } from './services/virtual-agent-loader.service';
import { SupabaseModule } from '../../../../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [
    AgentCreatorService,
    AgentConfigurationService,
    VirtualAgentLoaderService,
  ],
  exports: [
    AgentCreatorService,
    AgentConfigurationService,
    VirtualAgentLoaderService,
  ],
})
export class AgentCreatorModule {}