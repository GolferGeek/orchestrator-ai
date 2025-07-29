import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ApiAgentBaseService } from '../../../base/implementations/base-services/api';
import { AgentRegistrationService } from '../../../base/sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '../../../base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '../../../base/sub-services/logging/logging.service';
import { AuthService } from '../../../base/sub-services/auth/auth.service';
import { ConfigurationService } from '../../../base/sub-services/configuration/configuration.service';
import { TaskStatusService } from '@/tasks/task-status.service';
import { TasksService } from '@/tasks/tasks.service';

@Injectable()
export class RulesOfGolfAgentService extends ApiAgentBaseService {
  constructor(
    httpService: HttpService,
    agentRegistrationService?: AgentRegistrationService,
    jsonRpcProtocolService?: JsonRpcProtocolService,
    loggingService?: LoggingService,
    authService?: AuthService,
    configurationService?: ConfigurationService,
    taskStatusService?: TaskStatusService,
    tasksService?: TasksService,
  ) {
    super(
      httpService,
      taskStatusService,
      tasksService,
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService,
      configurationService,
    );
  }

  getAgentName(): string {
    return 'Rules Of Golf Agent';
  }

  getAgentType(): 'engineering' {
    return 'engineering';
  }

  // Minimal implementation - base service handles API configuration from agent.yaml
}
