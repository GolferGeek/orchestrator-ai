import { Injectable, Optional, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  IOrchestratorFacadeService,
  ISubprojectManagementService,
  ILangGraphStateManagementService,
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
    @Inject('IOrchestratorFacadeService') public readonly orchestratorFacadeService: IOrchestratorFacadeService,
    
    // Optional orchestrator services
    @Optional() @Inject('ISubprojectManagementService') public readonly subprojectManagementService?: ISubprojectManagementService,
    @Optional() @Inject('ILangGraphStateManagementService') public readonly langGraphStateManagementService?: ILangGraphStateManagementService,
  ) {}
}