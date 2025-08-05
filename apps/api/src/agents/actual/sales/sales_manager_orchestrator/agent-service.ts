import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { OrchestratorAgentBaseService } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-base.service';
import {
  IOrchestratorFacadeService,
} from '../../../../orchestration/orchestration.types';

@Injectable()
export class SalesManagerOrchestratorService extends OrchestratorAgentBaseService {
  protected readonly logger = new Logger(SalesManagerOrchestratorService.name);
  
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
    return 'sales_manager_orchestrator';
  }
}