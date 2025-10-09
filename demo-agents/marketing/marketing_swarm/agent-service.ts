import { Injectable } from '@nestjs/common';
import { ApiAgentBaseService } from '@agents/base/implementations/base-services/api/api-agent-base.service';
import { ApiAgentServicesContext } from '@agents/base/services/api-agent-services-context';

@Injectable()
export class MarketingSwarmService extends ApiAgentBaseService {
  constructor(
    // Pure service container pattern - only accepts ApiAgentServicesContext
    services: ApiAgentServicesContext,
  ) {
    super(services);
  }

  getAgentName(): string {
    return 'Marketing Swarm';
  }
}
