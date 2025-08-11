import { Injectable, Logger } from '@nestjs/common';
import { AgentServicesContext } from './agents/base/services/agent-services-context';

/**
 * PURE Service Container Version - Agent Factory Service
 *
 * This version demonstrates how the AgentFactoryService becomes much simpler
 * when using the pure service container approach.
 */
@Injectable()
export class AgentFactoryServicePure {
  private readonly logger = new Logger(AgentFactoryServicePure.name);

  constructor(
    // Instead of injecting 15+ individual services, just inject the container
    private readonly agentServices: AgentServicesContext,

    // Orchestrators still handled by NestJS DI (they have complex dependencies)
    // @Optional() private readonly marketingManagerOrchestratorService?: MarketingManagerOrchestratorService,
    // ... other orchestrators
  ) {
    this.logger.log(
      '🏭 Pure AgentFactoryService initialized with service container',
    );
  }

  /**
   * Instantiate agent - MUCH simpler now!
   */
  private async instantiateAgent(ServiceClass: any, config: any): Promise<any> {
    const serviceName = ServiceClass.name;
    this.logger.debug(
      `🏗️ Instantiating ${serviceName} as type: ${config.type}`,
    );

    try {
      switch (config.type) {
        case 'orchestrator': {
          // Orchestrators still handled by NestJS DI (no change needed)
          this.logger.debug(
            `🎯 Getting orchestrator agent from DI container: ${serviceName}`,
          );
          // ... orchestrator logic stays the same (return from DI container)
          break;
        }

        case 'function': {
          this.logger.debug(`⚙️ Creating TypeScript function agent`);
          // For function agents, you could create a FunctionAgentServicesContext too
          return new ServiceClass(this.agentServices);
        }

        case 'context': {
          this.logger.debug(
            `📝 Creating context agent with pure service container`,
          );

          // 🎉 THE MAGIC: No matter how many services you add to AgentServicesContext,
          // this line never changes! All context agents get all services automatically.
          return new ServiceClass(this.agentServices);
        }

        case 'api': {
          this.logger.debug(`🌐 Creating API agent`);
          // For API agents, you could create an ApiAgentServicesContext
          return new ServiceClass(this.agentServices);
        }

        case 'python-function': {
          this.logger.debug(`🐍 Creating Python function agent`);
          // Python agents might need different services
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
          this.logger.warn(
            `❓ Unknown agent type: ${config.type}, using minimal dependencies`,
          );
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
 * 🚀 BENEFIT DEMONSTRATION:
 *
 * Current Problem (what you described):
 * When you add a new service, you need to modify:
 * ❌ AgentFactoryService constructor (add parameter)
 * ❌ AgentFactoryService instantiation logic (add parameter to each agent type)
 * ❌ ContextAgentBaseService constructor (add parameter)
 * ❌ ContentAgentService constructor (add parameter)
 * ❌ BlogPostService constructor (add parameter)
 * ❌ CompetitorsService constructor (add parameter)
 * ❌ MarketResearchService constructor (add parameter)
 * ❌ ... 15+ other context agents
 *
 * Pure Service Container Solution:
 * When you add a new service, you modify:
 * ✅ AgentServicesContext constructor (add 1 line)
 * ✅ AgentServicesContext property (add 1 line)
 * ✅ That's it! 🎉
 *
 * All agents automatically get the new service with ZERO code changes!
 */
