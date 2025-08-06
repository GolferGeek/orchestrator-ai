import { Injectable, Logger } from '@nestjs/common';
import { AgentServicesContext } from './agents/base/services/agent-services-context';

/**
 * REFACTORED AgentFactoryService - Compare the instantiateAgent method
 * to see how much simpler this becomes!
 */
@Injectable()
export class AgentFactoryServiceRefactored {
  private readonly logger = new Logger(AgentFactoryServiceRefactored.name);

  constructor(
    // Just inject the service container instead of 15+ individual services!
    private readonly agentServices: AgentServicesContext,
  ) {
    this.logger.log('🏭 Refactored AgentFactoryService initialized with service container');
  }

  /**
   * Instantiate agent - MUCH simpler now!
   */
  private async instantiateAgent(ServiceClass: any, config: any): Promise<any> {
    const serviceName = ServiceClass.name;
    this.logger.debug(`🏗️ Instantiating ${serviceName} as type: ${config.type}`);

    try {
      switch (config.type) {
        case 'orchestrator': {
          // Orchestrators still handled by NestJS DI (no change needed)
          this.logger.debug(`🎯 Getting orchestrator agent from DI container: ${serviceName}`);
          // ... orchestrator logic stays the same
          break;
        }

        case 'function': {
          this.logger.debug(`⚙️ Creating TypeScript function agent`);
          // OLD WAY: 12+ parameters
          // return new ServiceClass(
          //   this.httpService, this.llmService, this.taskProgressGateway,
          //   this.tasksService, this.taskStatusService, this.deliverablesService,
          //   undefined, this.agentRegistrationService, undefined, undefined,
          //   undefined, this.configurationService
          // );
          
          // NEW WAY: Just pass the service container!
          return new ServiceClass(this.agentServices);
        }

        case 'context': {
          this.logger.debug(`📝 Creating context agent`);
          // OLD WAY: 10+ parameters  
          // return new ServiceClass(
          //   this.httpService, this.llmService, undefined, undefined,
          //   undefined, undefined, undefined, this.taskStatusService,
          //   this.tasksService, this.deliverablesService
          // );
          
          // NEW WAY: Just pass the service container!
          return new ServiceClass(this.agentServices);
        }

        case 'api': {
          this.logger.debug(`🌐 Creating API agent`);
          // OLD WAY: 8+ parameters
          // return new ServiceClass(
          //   this.httpService, undefined, undefined, undefined,
          //   undefined, this.configurationService, this.taskStatusService,
          //   this.tasksService
          // );
          
          // NEW WAY: Just pass the service container!
          return new ServiceClass(this.agentServices);
        }

        case 'python-function': {
          this.logger.debug(`🐍 Creating Python function agent`);
          // Could also be refactored to use the service container
          return new ServiceClass(
            this.agentServices.httpService,
            this.agentServices.llmService,
            this.agentServices.taskProgressGateway,
            this.agentServices.tasksService,
            this.agentServices.taskStatusService,
          );
        }

        case 'external': {
          this.logger.debug(`🔗 Creating external A2A agent`);
          return new ServiceClass(
            this.agentServices.httpService,
            this.agentServices.configurationService,
            this.agentServices.agentRegistrationService,
          );
        }

        default: {
          this.logger.warn(`❓ Unknown agent type: ${config.type}, using minimal dependencies`);
          return new ServiceClass(this.agentServices.httpService);
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to instantiate ${serviceName}:`, error.message);
      throw error;
    }
  }
}

/**
 * Benefits of this approach:
 * 
 * 1. ✅ Adding new services: Just add to AgentServicesContext, no changes needed in 20+ agent classes
 * 2. ✅ Constructor simplification: 1 parameter instead of 10-15
 * 3. ✅ Type safety: All services are still typed and available
 * 4. ✅ Flexibility: Can create partial contexts for different agent types
 * 5. ✅ Maintenance: Changes in one place instead of cascading through entire hierarchy
 * 6. ✅ Testing: Mock just the service container instead of individual services
 * 
 * When you need to add a new service:
 * 1. Add it to AgentServicesContext constructor and as a public property
 * 2. Update the createContextForAgentType method if needed
 * 3. That's it! No changes needed to base classes or individual agents.
 */