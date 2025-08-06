import { Injectable } from '@nestjs/common';
import { FunctionAgentBaseService } from '@agents/base/implementations/base-services/function';
import { FunctionAgentServicesContext } from '@agents/base/services/function-agent-services-context';

@Injectable()
export class HRAssistantService extends FunctionAgentBaseService {
  constructor(
    // Pure service container pattern - only accepts FunctionAgentServicesContext
    services: FunctionAgentServicesContext,
  ) {
    super(services);

    // Set total steps for HR Assistant workflow
    this.setTotalSteps(2);
  }

  /**
   * Override the default name generation to return the correct agent name
   */
  getAgentName(): string {
    return 'HR Assistant';
  }
}
