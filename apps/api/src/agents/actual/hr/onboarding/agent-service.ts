import { Injectable } from '@nestjs/common';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';
import { AgentServicesContext } from '@agents/base/services/agent-services-context';

@Injectable()
export class OnboardingAgentService extends ContextAgentBaseService {
  constructor(
    // Pure service container pattern - only accepts AgentServicesContext
    services: AgentServicesContext,
  ) {
    super(services);
  }

  /**
   * Override the default name generation to return the correct agent name
   */
  getAgentName(): string {
    return 'Onboarding Agent';
  }
}
