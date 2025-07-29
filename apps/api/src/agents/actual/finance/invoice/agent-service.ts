import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { LLMService } from '@/llms/llm.service';
import { TaskStatusService } from '@/tasks/task-status.service';
import { TasksService } from '@/tasks/tasks.service';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';

@Injectable()
export class InvoiceAgentService extends ContextAgentBaseService {
  constructor(
    httpService: HttpService, 
    llmService: LLMService,
    agentRegistrationService?: any,
    jsonRpcProtocolService?: any,
    loggingService?: any,
    authService?: any,
    configurationService?: any,
    taskStatusService?: TaskStatusService,
    tasksService?: TasksService
  ) {
    super(httpService, llmService, agentRegistrationService, jsonRpcProtocolService, loggingService, authService, configurationService, taskStatusService, tasksService);
  }

  /**
   * Override the default name generation to return the correct agent name
   */
  getAgentName(): string {
    return 'Invoice Agent';
  }
}
