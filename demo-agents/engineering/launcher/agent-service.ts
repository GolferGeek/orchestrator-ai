import { Injectable } from '@nestjs/common';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';
import { AgentServicesContext } from '@agents/base/services/agent-services-context';

@Injectable()
export class LauncherAgentService extends ContextAgentBaseService {
  constructor(
    // Pure service container pattern - only accepts AgentServicesContext
    services: AgentServicesContext,
  ) {
    super(services);
  }
}
