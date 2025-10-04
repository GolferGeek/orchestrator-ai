import { Injectable, Logger } from '@nestjs/common';
import { OrchestratorAgentBaseService } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-base.service';
import { OrchestratorAgentServicesContext } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-services.context';

@Injectable()
export class LegalManagerOrchestratorService extends OrchestratorAgentBaseService {
  protected readonly logger = new Logger(LegalManagerOrchestratorService.name);

  constructor(services: OrchestratorAgentServicesContext) {
    super(services);
  }

  /**
   * Get agent identification
   */
  getAgentName(): string {
    return 'legal_manager_orchestrator';
  }
}
