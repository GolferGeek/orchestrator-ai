import { Injectable } from '@nestjs/common';
import { FunctionAgentBaseService } from '@agents/base/implementations/base-services/function';
import { FunctionAgentServicesContext } from '@agents/base/services/function-agent-services-context';

@Injectable()
export class MetricsAgentService extends FunctionAgentBaseService {
  constructor(
    // Pure service container pattern - only accepts FunctionAgentServicesContext
    services: FunctionAgentServicesContext,
  ) {
    super(services);

    // Set total steps for Enhanced Metrics Agent workflow
    this.setTotalSteps(5);
  }

  getAgentName(): string {
    return 'Enhanced Metrics Agent';
  }

  getAgentType(): 'finance' {
    return 'finance';
  }
}
