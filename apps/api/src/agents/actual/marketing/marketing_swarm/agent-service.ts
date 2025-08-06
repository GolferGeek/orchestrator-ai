import { Injectable } from '@nestjs/common';
import { FunctionAgentBaseService } from '@agents/base/implementations/base-services/function';
import { FunctionAgentServicesContext } from '@agents/base/services/function-agent-services-context';

@Injectable()
export class MarketingSwarmService extends FunctionAgentBaseService {
  constructor(
    // Pure service container pattern - only accepts FunctionAgentServicesContext
    services: FunctionAgentServicesContext,
  ) {
    super(services);

    // Set total steps for Marketing Swarm workflow
    this.setTotalSteps(5);
  }

  getAgentName(): string {
    return 'Marketing Swarm';
  }
}
