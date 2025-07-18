import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PythonFunctionAgentBaseService } from '@agents/base/implementations/base-services/function/python-function-agent-base.service';
import { LLMService } from '../../../../llms/llm.service';
import { TaskProgressGateway } from '@/websocket/task-progress.gateway';
import { TasksService } from '@/tasks/tasks.service';

@Injectable()
export class RequirementsWriterService extends PythonFunctionAgentBaseService {
  constructor(
    httpService: HttpService,
    llmService: LLMService,
    @Inject(forwardRef(() => TaskProgressGateway))
    taskProgressGateway: TaskProgressGateway | undefined,
    @Inject(forwardRef(() => TasksService))
    tasksService: TasksService | undefined,
  ) {
    super(httpService, llmService, taskProgressGateway, tasksService);
    // Python script path will be set by AgentDiscoveryService during discovery
  }

  getAgentName(): string {
    return 'requirements_writer';
  }

  getAgentType(): 'engineering' {
    return 'engineering';
  }
}
