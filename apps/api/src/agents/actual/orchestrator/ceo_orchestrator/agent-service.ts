import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { OrchestratorAgentBaseService } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-base.service';
import {
  IOrchestratorFacadeService,
} from '../../../../orchestration/orchestration.types';

/**
 * CEO Orchestrator Service
 *
 * Minimal orchestrator service - all functionality is in the base class.
 * This service only defines the agent name and passes services up.
 */
@Injectable()
export class CEOOrchestratorService extends OrchestratorAgentBaseService {
  protected readonly logger = new Logger(CEOOrchestratorService.name);

  constructor(
    httpService: HttpService,
    @Inject('IOrchestratorFacadeService')
    orchestratorFacadeService: IOrchestratorFacadeService,
  ) {
    super(httpService, orchestratorFacadeService);
  }

  /**
   * Get agent identification
   */
  getAgentName(): string {
    return 'ceo_orchestrator';
  }

  // All other functionality is implemented in OrchestratorAgentBaseService
}
