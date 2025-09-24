import { Module } from '@nestjs/common';
import { AgentCreatorService } from './agent-service';
import { AgentConfigurationService } from './services/agent-configuration.service';
import { VirtualAgentLoaderService } from './services/virtual-agent-loader.service';
import { SupabaseModule } from '../../../../supabase/supabase.module';
import { AgentServicesContextModule } from '../../../base/services/agent-services-context.module';
import { TasksModule } from '../../../../tasks/tasks.module';
import { DeliverablesModule } from '../../../../deliverables/deliverables.module';

@Module({
  imports: [
    SupabaseModule, 
    AgentServicesContextModule,
    TasksModule,
    DeliverablesModule,
  ],
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