import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { OrchestratorAgentBaseService } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-base.service';
import {
  IOrchestratorFacadeService,
} from '../../../../orchestration/orchestration.types';

@Injectable()
export class HRManagerOrchestratorService extends OrchestratorAgentBaseService {
  protected readonly logger = new Logger(HRManagerOrchestratorService.name);
  
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
    return 'hr_manager_orchestrator';
  }
}