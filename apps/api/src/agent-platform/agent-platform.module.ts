import { Module } from '@nestjs/common';
import { AgentsRepository } from './repositories/agents.repository';
import { ConversationPlansRepository } from './repositories/conversation-plans.repository';
import { ProjectRunsRepository } from './repositories/project-runs.repository';
import { OrganizationCredentialsRepository } from './repositories/organization-credentials.repository';

@Module({
  providers: [
    AgentsRepository,
    ConversationPlansRepository,
    ProjectRunsRepository,
    OrganizationCredentialsRepository,
  ],
  exports: [
    AgentsRepository,
    ConversationPlansRepository,
    ProjectRunsRepository,
    OrganizationCredentialsRepository,
  ],
})
export class AgentPlatformModule {}
