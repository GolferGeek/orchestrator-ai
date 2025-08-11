import { Injectable, Optional, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  IOrchestratorFacadeService,
  ISubprojectManagementService,
  ILangGraphStateManagementService,
  IIntentRecognitionService,
  IPlanningService,
  IPlanExecutionService,
  IDelegationService,
} from '../../../../../orchestration/orchestration.types';

/**
 * Service Container for Orchestrator Agents
 *
 * Aggregates all services needed by orchestrator agents to eliminate
 * constructor parameter explosion and provide clean dependency injection.
 * Follows the same pattern as PythonFunctionAgentServicesContext.
 */
@Injectable()
export class OrchestratorAgentServicesContext {
  constructor(
    // Core services that every orchestrator agent needs
    public readonly httpService: HttpService,
    @Inject('IOrchestratorFacadeService')
    public readonly orchestratorFacadeService: IOrchestratorFacadeService,

    // Core orchestrator services that the facade depends on
    @Inject('IIntentRecognitionService')
    public readonly intentRecognitionService: IIntentRecognitionService,
    @Inject('IPlanningService')
    public readonly planningService: IPlanningService,
    @Inject('IPlanExecutionService')
    public readonly planExecutionService: IPlanExecutionService,
    @Inject('IDelegationService')
    public readonly delegationService: IDelegationService,

    // Optional orchestrator services
    @Optional()
    @Inject('ISubprojectManagementService')
    public readonly subprojectManagementService?: ISubprojectManagementService,
    @Optional()
    @Inject('ILangGraphStateManagementService')
    public readonly langGraphStateManagementService?: ILangGraphStateManagementService,
  ) {}
}
