import { Injectable, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { LLMService } from '@/llms/llm.service';
import { TaskStatusService } from '@/tasks/task-status.service';
import { TasksService } from '@/tasks/tasks.service';
import { DeliverablesService } from '@/deliverables/deliverables.service';
import { TaskProgressGateway } from '@/websocket/task-progress.gateway';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { AuthService } from '@agents/base/sub-services/auth/auth.service';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';

/**
 * Service container that aggregates all commonly needed agent services.
 * This eliminates the need to pass 10+ individual parameters to every agent constructor.
 */
@Injectable()
export class AgentServicesContext {
  constructor(
    // Core services that every agent needs
    public readonly httpService: HttpService,
    public readonly llmService: LLMService,
    
    // Task and deliverable services
    @Optional() public readonly taskStatusService?: TaskStatusService,
    @Optional() public readonly tasksService?: TasksService,
    @Optional() public readonly deliverablesService?: DeliverablesService,
    @Optional() public readonly taskProgressGateway?: TaskProgressGateway,
    
    // Agent framework services
    @Optional() public readonly agentRegistrationService?: AgentRegistrationService,
    @Optional() public readonly jsonRpcProtocolService?: JsonRpcProtocolService,
    @Optional() public readonly loggingService?: LoggingService,
    @Optional() public readonly authService?: AuthService,
    @Optional() public readonly configurationService?: ConfigurationService,
  ) {}

  /**
   * Create a partial context with only the services needed for a specific agent type
   */
  createContextForAgentType(agentType: 'function' | 'context' | 'api' | 'external' | 'orchestrator'): Partial<AgentServicesContext> {
    const baseServices = {
      httpService: this.httpService,
      llmService: this.llmService,
      taskStatusService: this.taskStatusService,
      tasksService: this.tasksService,
      deliverablesService: this.deliverablesService,
    };

    switch (agentType) {
      case 'function':
        return {
          ...baseServices,
          taskProgressGateway: this.taskProgressGateway,
          agentRegistrationService: this.agentRegistrationService,
          configurationService: this.configurationService,
        };

      case 'context':
        return {
          ...baseServices,
          agentRegistrationService: this.agentRegistrationService,
          jsonRpcProtocolService: this.jsonRpcProtocolService,
          loggingService: this.loggingService,
          authService: this.authService,
          configurationService: this.configurationService,
        };

      case 'api':
        return {
          ...baseServices,
          configurationService: this.configurationService,
        };

      case 'external':
        return {
          httpService: this.httpService,
          configurationService: this.configurationService,
          agentRegistrationService: this.agentRegistrationService,
        };

      case 'orchestrator':
        // Orchestrators get injected via NestJS DI, so we don't manage their dependencies here
        return {};

      default:
        return baseServices;
    }
  }
}