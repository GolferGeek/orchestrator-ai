import { Injectable } from '@nestjs/common';
import { ContextAgentBaseServiceRefactored } from '@agents/base/implementations/base-services/context/context-agent-base-refactored.service';
import { AgentServicesContext } from '@agents/base/services/agent-services-context';

/**
 * REFACTORED Content Agent Service
 * 
 * Compare this to the original - instead of 10 constructor parameters,
 * we now have just 1!
 */
@Injectable()
export class ContentAgentServiceRefactored extends ContextAgentBaseServiceRefactored {
  constructor(
    // OLD WAY: 10+ parameters
    // httpService: HttpService,
    // llmService: LLMService,
    // agentRegistrationService?: any,
    // jsonRpcProtocolService?: any,
    // loggingService?: any,
    // authService?: any,
    // configurationService?: any,
    // taskStatusService?: TaskStatusService,
    // tasksService?: TasksService,
    // deliverablesService?: DeliverablesService,
    
    // NEW WAY: Just 1 parameter!
    services: AgentServicesContext,
  ) {
    // OLD WAY: Pass 10+ individual services to parent
    // super(
    //   httpService, llmService, agentRegistrationService,
    //   jsonRpcProtocolService, loggingService, authService,
    //   configurationService, taskStatusService, tasksService,
    //   deliverablesService
    // );
    
    // NEW WAY: Just pass the service container!
    super(services);
  }

  /**
   * Override the default name generation to return the correct agent name
   */
  getAgentName(): string {
    return 'Content Agent';
  }
}

/**
 * Benefits for this specific agent:
 * 
 * BEFORE (10 parameters):
 * - Had to list all 10 services in constructor
 * - Had to pass all 10 services to parent constructor 
 * - When adding new service, had to modify this file
 * 
 * AFTER (1 parameter):
 * - Just takes the service container
 * - Just passes container to parent
 * - When adding new service, no changes needed here!
 * 
 * The agent still has access to all services through:
 * - this.services.httpService
 * - this.services.llmService
 * - this.services.deliverablesService
 * - etc.
 */