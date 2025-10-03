import { Module } from '@nestjs/common';
import { Agent2AgentController } from './agent2agent.controller';
import { AgentApprovalsActionsController } from './controllers/agent-approvals-actions.controller';
import { AgentPlatformModule } from '../agent-platform/agent-platform.module';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { AgentModeRouterService } from './services/agent-mode-router.service';
import { RoutingPolicyAdapterService } from './services/routing-policy-adapter.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { LLMModule } from '../llms/llm.module';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { Agent2AgentDeliverablesService } from './services/agent2agent-deliverables.service';
import { Agent2AgentTasksService } from './services/agent-tasks.service';
import { Agent2AgentTaskStatusService } from './services/agent-task-status.service';
import { Agent2AgentConversationsService } from './services/agent-conversations.service';

@Module({
  imports: [
    AgentPlatformModule,
    LLMModule,
    AuthModule,
    SupabaseModule,
  ],
  controllers: [Agent2AgentController, AgentApprovalsActionsController],
  providers: [
    AgentCardBuilderService,
    AgentExecutionGateway,
    AgentModeRouterService,
    RoutingPolicyAdapterService,
    ApiKeyGuard,
    Agent2AgentDeliverablesService,
    Agent2AgentTasksService,
    Agent2AgentTaskStatusService,
    Agent2AgentConversationsService,
  ],
  exports: [AgentExecutionGateway],
})
export class Agent2AgentModule {}
