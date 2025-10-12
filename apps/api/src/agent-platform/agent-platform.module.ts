import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SupabaseModule } from '@/supabase/supabase.module';
import { LLMModule } from '@/llms/llm.module';
import { AgentsRepository } from './repositories/agents.repository';
import { ConversationPlansRepository } from './repositories/conversation-plans.repository';
import { OrchestrationRunsRepository } from './repositories/orchestration-runs.repository';
import { OrchestrationDefinitionsRepository } from './repositories/orchestration-definitions.repository';
import { OrchestrationStepsRepository } from './repositories/orchestration-steps.repository';
import { OrganizationCredentialsRepository } from './repositories/organization-credentials.repository';
import { AgentOrchestrationsRepository } from './repositories/agent-orchestrations.repository';
import { PlanEngineService } from './services/plan-engine.service';
import { OrchestrationRunnerService } from './services/orchestration-runner.service';
import { OrchestrationCheckpointService } from './services/orchestration-checkpoint.service';
import { OrchestrationDefinitionService } from './services/orchestration-definition.service';
import { OrchestrationStateService } from './services/orchestration-state.service';
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
import { AgentRuntimePlansAdapter } from './services/agent-runtime-plans.adapter';
import { DeliverablesModule } from '@/agent2agent/deliverables/deliverables.module';
import { PlansModule } from '@/agent2agent/plans/plans.module';
import { AssetsModule } from '@/assets/assets.module';
import { AgentRuntimeNormalizationService } from './services/agent-runtime-normalization.service';
import { AgentRuntimeRedactionService } from './services/agent-runtime-redaction.service';
import { FunctionAgentRunnerService } from '@/agent2agent/services/function-agent-runner.service';
import { HumanApprovalsRepository } from './repositories/human-approvals.repository';
import { RedactionPatternsRepository } from './repositories/redaction-patterns.repository';
import { AgentApprovalsController } from './controllers/agent-approvals.controller';
import { AgentsAdminController } from './controllers/agents-admin.controller';
import { OrchestrationsController } from './controllers/orchestrations.controller';
import { AgentValidationService } from './services/agent-validation.service';
import { AgentDryRunService } from './services/agent-dry-run.service';
import { AgentPolicyService } from './services/agent-policy.service';
import { AgentBuilderService } from './services/agent-builder.service';
import { AgentPromotionService } from './services/agent-promotion.service';
import { HierarchyModule } from './hierarchy/hierarchy.module';
import { OrchestrationExecutionService } from './services/orchestration-execution.service';
import { OrchestrationCheckpointEventsService } from './services/orchestration-checkpoint-events.service';
import { OrchestrationEventsService } from './services/orchestration-events.service';
import { OrchestrationProgressEventsService } from './services/orchestration-progress-events.service';
import { TasksModule } from '@/agent2agent/tasks/tasks.module';
import { OrchestrationStatusService } from './services/orchestration-status.service';
import { OrchestrationOutputMapper } from './services/orchestration-output-mapper.service';

@Module({
  imports: [
    SupabaseModule,
    LLMModule,
    HttpModule,
    DeliverablesModule,
    PlansModule,
    AssetsModule,
    // Agent Platform Sub-modules
    HierarchyModule,
    TasksModule,
  ],
  controllers: [
    AgentApprovalsController,
    AgentsAdminController,
    OrchestrationsController,
  ],
  providers: [
    AgentsRepository,
    RedactionPatternsRepository,
    HumanApprovalsRepository,
    ConversationPlansRepository,
    OrchestrationDefinitionsRepository,
    OrchestrationRunsRepository,
    OrchestrationStepsRepository,
    OrganizationCredentialsRepository,
    AgentOrchestrationsRepository,
    PlanEngineService,
    OrchestrationDefinitionService,
    OrchestrationStateService,
    OrchestrationRunnerService,
    OrchestrationCheckpointService,
    OrchestrationEventsService,
    OrchestrationCheckpointEventsService,
    OrchestrationProgressEventsService,
    OrchestrationExecutionService,
    OrchestrationStatusService,
    OrchestrationOutputMapper,
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
    AgentRuntimePlansAdapter,
    AgentRuntimeNormalizationService,
    AgentRuntimeRedactionService,
    FunctionAgentRunnerService,
    AgentValidationService,
    AgentDryRunService,
    AgentPolicyService,
    AgentBuilderService,
    AgentPromotionService,
  ],
  exports: [
    AgentsRepository,
    RedactionPatternsRepository,
    HumanApprovalsRepository,
    ConversationPlansRepository,
    OrchestrationDefinitionsRepository,
    OrchestrationRunsRepository,
    OrchestrationStepsRepository,
    OrganizationCredentialsRepository,
    AgentOrchestrationsRepository,
    PlanEngineService,
    OrchestrationDefinitionService,
    OrchestrationStateService,
    OrchestrationRunnerService,
    OrchestrationCheckpointService,
    OrchestrationEventsService,
    OrchestrationCheckpointEventsService,
    OrchestrationProgressEventsService,
    OrchestrationExecutionService,
    OrchestrationStatusService,
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
    AgentRuntimePlansAdapter,
    AgentRuntimeNormalizationService,
    AgentRuntimeRedactionService,
    FunctionAgentRunnerService,
    AgentValidationService,
    AgentDryRunService,
    AgentPolicyService,
    AgentBuilderService,
    AgentPromotionService,
    OrchestrationOutputMapper,
  ],
})
export class AgentPlatformModule {}
