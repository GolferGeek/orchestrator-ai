import { Module } from '@nestjs/common';
import { SupabaseModule } from '@/supabase/supabase.module';
import { AgentsRepository } from './repositories/agents.repository';
import { ConversationPlansRepository } from './repositories/conversation-plans.repository';
import { OrchestrationRunsRepository } from './repositories/orchestration-runs.repository';
import { OrganizationCredentialsRepository } from './repositories/organization-credentials.repository';
import { AgentOrchestrationsRepository } from './repositories/agent-orchestrations.repository';
import { PlanEngineService } from './services/plan-engine.service';
import { OrchestrationRunnerService } from './services/orchestration-runner.service';
import { AgentRegistryService } from './services/agent-registry.service';
import { AgentRuntimeDefinitionService } from './services/agent-runtime-definition.service';

@Module({
  imports: [SupabaseModule],
  providers: [
    AgentsRepository,
    ConversationPlansRepository,
    OrchestrationRunsRepository,
    OrganizationCredentialsRepository,
    AgentOrchestrationsRepository,
    PlanEngineService,
    OrchestrationRunnerService,
    AgentRegistryService,
    AgentRuntimeDefinitionService,
  ],
  exports: [
    AgentsRepository,
    ConversationPlansRepository,
    OrchestrationRunsRepository,
    OrganizationCredentialsRepository,
    AgentOrchestrationsRepository,
    PlanEngineService,
    OrchestrationRunnerService,
    AgentRegistryService,
    AgentRuntimeDefinitionService,
  ],
})
export class AgentPlatformModule {}
