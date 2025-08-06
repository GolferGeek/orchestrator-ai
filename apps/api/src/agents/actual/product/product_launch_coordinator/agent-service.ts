import { Injectable, Logger } from '@nestjs/common';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';
import { AgentServicesContext } from '@agents/base/services/agent-services-context';

@Injectable()
export class ProductLaunchCoordinatorService extends ContextAgentBaseService {
  protected readonly logger = new Logger(ProductLaunchCoordinatorService.name);

  constructor(
    // Pure service container pattern - only accepts AgentServicesContext
    services: AgentServicesContext,
  ) {
    super(services);
  }

  getAgentName(): string {
    return 'product_launch_coordinator';
  }

  getAgentType(): 'product' {
    return 'product';
  }

  /**
   * Optional: Override to provide agent-specific context processing
   * For now, we'll rely on the base class implementation
   */
}
