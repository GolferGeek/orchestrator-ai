import { Injectable, Logger } from '@nestjs/common';
import { OrchestratorAgentBaseService } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-base.service';
import { OrchestratorAgentServicesContext } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-services.context';

/**
 * CEO Orchestrator Service
 *
 * Minimal orchestrator service - all functionality is in the base class.
 * This service only defines the agent name and passes services up.
 */
@Injectable()
export class CEOOrchestratorService extends OrchestratorAgentBaseService {
  protected readonly logger = new Logger(CEOOrchestratorService.name);

  constructor(services: OrchestratorAgentServicesContext) {
    super(services);
  }

  /**
   * Get agent identification
   */
  getAgentName(): string {
    return 'ceo_orchestrator';
  }

  // All other functionality is implemented in OrchestratorAgentBaseService
}
