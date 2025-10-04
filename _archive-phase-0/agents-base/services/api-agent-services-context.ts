import { Injectable, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { TaskStatusService } from '@/tasks/task-status.service';
import { TasksService } from '@/tasks/tasks.service';
import { AgentRegistrationService } from '../sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '../sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '../sub-services/logging/logging.service';
import { AuthService } from '../sub-services/auth/auth.service';
import { ConfigurationService } from '../sub-services/configuration/configuration.service';
import { LLMService } from '@/llms/llm.service';
import { LLMServiceFactory } from '@/llms/services/llm-service-factory';

/**
 * Service container for API agents using the pure service container pattern.
 *
 * This eliminates the constructor parameter explosion problem in API agents
 * by bundling all required and optional services into a single injectable container.
 *
 * Usage: API agents accept only this service container as their constructor parameter.
 */
@Injectable()
export class ApiAgentServicesContext {
  constructor(
    // Required services for API agents
    public readonly httpService: HttpService,
    public readonly llmService: LLMService,
    public readonly llmServiceFactory: LLMServiceFactory,
    public readonly taskStatusService: TaskStatusService,
    public readonly tasksService: TasksService,

    // Optional services - using @Optional() for all optional dependencies
    @Optional()
    public readonly agentRegistrationService?: AgentRegistrationService,
    @Optional() public readonly jsonRpcProtocolService?: JsonRpcProtocolService,
    @Optional() public readonly loggingService?: LoggingService,
    @Optional() public readonly authService?: AuthService,
    @Optional() public readonly configurationService?: ConfigurationService,
  ) {}
}
