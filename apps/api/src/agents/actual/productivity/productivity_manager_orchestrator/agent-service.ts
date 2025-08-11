import { Injectable, Logger } from '@nestjs/common';
import { OrchestratorAgentBaseService } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-base.service';
import { OrchestratorAgentServicesContext } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-services.context';

@Injectable()
export class ProductivityManagerOrchestratorService extends OrchestratorAgentBaseService {
  protected readonly logger = new Logger(
    ProductivityManagerOrchestratorService.name,
  );

  constructor(services: OrchestratorAgentServicesContext) {
    super(services);
  }

  /**
   * Get agent identification
   */
  getAgentName(): string {
    return 'productivity_manager_orchestrator';
  }
}
