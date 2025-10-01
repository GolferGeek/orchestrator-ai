import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SupabaseModule } from '@/supabase/supabase.module';
import { LLMModule } from '@/llms/llm.module';
import { AgentsRepository } from './repositories/agents.repository';
import { ConversationPlansRepository } from './repositories/conversation-plans.repository';
import { OrchestrationRunsRepository } from './repositories/orchestration-runs.repository';
import { OrganizationCredentialsRepository } from './repositories/organization-credentials.repository';
import { AgentOrchestrationsRepository } from './repositories/agent-orchestrations.repository';
import { PlanEngineService } from './services/plan-engine.service';
import { OrchestrationRunnerService } from './services/orchestration-runner.service';
import { AgentRegistryService } from './services/agent-registry.service';
import { AgentRuntimeDefinitionService } from './services/agent-runtime-definition.service';
import { AgentRuntimeExecutionService } from './services/agent-runtime-execution.service';
import { AgentRuntimePromptService } from './services/agent-runtime-prompt.service';
import { AgentRuntimeDispatchService } from './services/agent-runtime-dispatch.service';
import { AgentRuntimeStreamService } from './services/agent-runtime-stream.service';
import { AgentRegistryInvalidationService } from './services/agent-registry-invalidation.service';
import { AgentRuntimeMetricsService } from './services/agent-runtime-metrics.service';
import { AgentRuntimeLifecycleService } from './services/agent-runtime-lifecycle.service';

@Module({
  imports: [SupabaseModule, LLMModule, HttpModule],
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
    AgentRuntimeExecutionService,
    AgentRuntimePromptService,
    AgentRuntimeDispatchService,
    AgentRuntimeStreamService,
    AgentRegistryInvalidationService,
    AgentRuntimeMetricsService,
    AgentRuntimeLifecycleService,
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
    AgentRuntimeExecutionService,
    AgentRuntimePromptService,
    AgentRuntimeDispatchService,
    AgentRuntimeStreamService,
    AgentRegistryInvalidationService,
    AgentRuntimeMetricsService,
    AgentRuntimeLifecycleService,
  ],
})
export class AgentPlatformModule {}
