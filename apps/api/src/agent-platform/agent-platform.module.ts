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
import { AgentRuntimeDeliverablesAdapter } from './services/agent-runtime-deliverables.adapter';
import { DeliverablesModule } from '@/deliverables/deliverables.module';
import { AssetsModule } from '@/assets/assets.module';
import { AgentRuntimeNormalizationService } from './services/agent-runtime-normalization.service';
import { AgentRuntimeRedactionService } from './services/agent-runtime-redaction.service';
import { FunctionAgentRunnerService } from '@/agent2agent/services/function-agent-runner.service';
import { ImageAgentsModule } from '@/image-agents/image-agents.module';
import { HumanApprovalsRepository } from './repositories/human-approvals.repository';
import { RedactionPatternsRepository } from './repositories/redaction-patterns.repository';
import { AgentApprovalsController } from './controllers/agent-approvals.controller';
import { AgentsAdminController } from './controllers/agents-admin.controller';
import { AgentValidationService } from './services/agent-validation.service';
import { AgentDryRunService } from './services/agent-dry-run.service';
import { AgentPolicyService } from './services/agent-policy.service';
import { AgentBuilderService } from './services/agent-builder.service';

@Module({
  imports: [SupabaseModule, LLMModule, HttpModule, DeliverablesModule, AssetsModule, ImageAgentsModule],
  controllers: [AgentApprovalsController, AgentsAdminController],
  providers: [
    AgentsRepository,
    RedactionPatternsRepository,
    HumanApprovalsRepository,
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
    AgentRuntimeDeliverablesAdapter,
    AgentRuntimeNormalizationService,
    AgentRuntimeRedactionService,
    FunctionAgentRunnerService,
    AgentValidationService,
    AgentDryRunService,
    AgentPolicyService,
    AgentBuilderService,
  ],
  exports: [
    AgentsRepository,
    RedactionPatternsRepository,
    HumanApprovalsRepository,
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
    AgentRuntimeDeliverablesAdapter,
    AgentRuntimeNormalizationService,
    AgentRuntimeRedactionService,
    FunctionAgentRunnerService,
    AgentValidationService,
    AgentDryRunService,
    AgentPolicyService,
    AgentBuilderService,
  ],
})
export class AgentPlatformModule {}
