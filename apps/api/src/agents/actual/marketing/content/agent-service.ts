import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { LLMService } from '@/llms/llm.service';
import { TaskStatusService } from '@/tasks/task-status.service';
import { TasksService } from '@/tasks/tasks.service';
import { DeliverablesService } from '@/deliverables/deliverables.service';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';

@Injectable()
export class ContentAgentService extends ContextAgentBaseService {
  constructor(
    httpService: HttpService,
    llmService: LLMService,
    agentRegistrationService?: any,
    jsonRpcProtocolService?: any,
    loggingService?: any,
    authService?: any,
    configurationService?: any,
    taskStatusService?: TaskStatusService,
    tasksService?: TasksService,
    deliverablesService?: DeliverablesService,
  ) {
    super(
      httpService,
      llmService,
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService,
      configurationService,
      taskStatusService,
      tasksService,
      deliverablesService,
    );
  }

  /**
   * Override the default name generation to return the correct agent name
   */
  getAgentName(): string {
    return 'Content Agent';
  }
}
