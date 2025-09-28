import { Module } from '@nestjs/common';
import { AgentsRepository } from './repositories/agents.repository';
import { ConversationPlansRepository } from './repositories/conversation-plans.repository';
import { ProjectRunsRepository } from './repositories/project-runs.repository';
import { OrganizationCredentialsRepository } from './repositories/organization-credentials.repository';
import { PlanEngineService } from './services/plan-engine.service';
import { ProjectRunnerService } from './services/project-runner.service';

@Module({
  providers: [
    AgentsRepository,
    ConversationPlansRepository,
    ProjectRunsRepository,
    OrganizationCredentialsRepository,
    PlanEngineService,
    ProjectRunnerService,
  ],
  exports: [
    AgentsRepository,
    ConversationPlansRepository,
    ProjectRunsRepository,
    OrganizationCredentialsRepository,
    PlanEngineService,
    ProjectRunnerService,
  ],
})
export class AgentPlatformModule {}
