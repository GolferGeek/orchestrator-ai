import { Injectable } from '@nestjs/common';
import { ApiAgentBaseService } from '../../../base/implementations/base-services/api';
import { ApiAgentServicesContext } from '../../../base/services/api-agent-services-context';

@Injectable()
export class RulesOfGolfAgentService extends ApiAgentBaseService {
  constructor(
    // Pure service container pattern - only accepts ApiAgentServicesContext
    services: ApiAgentServicesContext,
  ) {
    super(services);
  }

  getAgentName(): string {
    return 'Rules Of Golf Agent';
  }

  getAgentType(): 'engineering' {
    return 'engineering';
  }

  // Minimal implementation - base service handles API configuration from agent.yaml
}
