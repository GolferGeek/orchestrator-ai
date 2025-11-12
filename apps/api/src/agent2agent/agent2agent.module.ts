import { Module, forwardRef } from '@nestjs/common';
import { Agent2AgentController } from './agent2agent.controller';
import { AgentApprovalsActionsController } from './controllers/agent-approvals-actions.controller';
import { AgentPlatformModule } from '../agent-platform/agent-platform.module';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { AgentModeRouterService } from './services/agent-mode-router.service';
import { AgentRunnerRegistryService } from './services/agent-runner-registry.service';
import { ContextAgentRunnerService } from './services/context-agent-runner.service';
import { ToolAgentRunnerService } from './services/tool-agent-runner.service';
import { ApiAgentRunnerService } from './services/api-agent-runner.service';
import { ExternalAgentRunnerService } from './services/external-agent-runner.service';
import { OrchestratorAgentRunnerService } from './services/orchestrator-agent-runner.service';
import { RoutingPolicyAdapterService } from './services/routing-policy-adapter.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { LLMModule } from '../llms/llm.module';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { Agent2AgentDeliverablesService } from './services/agent2agent-deliverables.service';
import { Agent2AgentTasksService } from './services/agent-tasks.service';
import { Agent2AgentTaskStatusService } from './services/agent-task-status.service';
import { Agent2AgentConversationsService } from './services/agent-conversations.service';
import { AgentConversationsModule } from './conversations/agent-conversations.module';
import { TasksModule } from './tasks/tasks.module';
import { DeliverablesModule } from './deliverables/deliverables.module';
import { PlansModule } from './plans/plans.module';
import { ContextOptimizationModule } from './context-optimization/context-optimization.module';
import { MCPModule } from '../mcp/mcp.module';
import { HttpModule } from '@nestjs/axios';
import { StreamingService } from './services/streaming.service';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [
    forwardRef(() => AgentPlatformModule),
    LLMModule,
    AuthModule,
    SupabaseModule,
    MCPModule,
    HttpModule,
    ObservabilityModule,
    // Agent2Agent Sub-modules
    AgentConversationsModule,
    TasksModule,
    DeliverablesModule,
    PlansModule,
    ContextOptimizationModule,
  ],
  controllers: [Agent2AgentController, AgentApprovalsActionsController],
  providers: [
    AgentCardBuilderService,
    AgentExecutionGateway,
    AgentModeRouterService,
    AgentRunnerRegistryService,
    ContextAgentRunnerService,
    ToolAgentRunnerService,
    ApiAgentRunnerService,
    ExternalAgentRunnerService,
    OrchestratorAgentRunnerService,
    RoutingPolicyAdapterService,
    ApiKeyGuard,
    Agent2AgentDeliverablesService,
    Agent2AgentTasksService,
    Agent2AgentTaskStatusService,
    Agent2AgentConversationsService,
    StreamingService,
  ],
  exports: [
    AgentExecutionGateway,
    AgentModeRouterService,
    Agent2AgentConversationsService,
    StreamingService,
  ],
})
export class Agent2AgentModule {}
