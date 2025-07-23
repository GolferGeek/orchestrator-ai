import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PythonFunctionAgentBaseService } from '@agents/base/implementations/base-services/function';
import { LLMService } from '../../../../llms/llm.service';
import { TaskProgressGateway } from '@/websocket/task-progress.gateway';
import { TasksService } from '@/tasks/tasks.service';
import { TaskStatusService } from '@/tasks/task-status.service';
import { MCPClientService } from '@/mcp/client/mcp-client.service';

@Injectable()
export class RequirementsWriterService extends PythonFunctionAgentBaseService {
  constructor(
    httpService: HttpService,
    llmService: LLMService,
    @Inject(forwardRef(() => TaskProgressGateway))
    taskProgressGateway: TaskProgressGateway | undefined,
    @Inject(forwardRef(() => TasksService))
    tasksService: TasksService | undefined,
    @Inject(forwardRef(() => TaskStatusService))
    taskStatusService: TaskStatusService | undefined,
    @Inject(forwardRef(() => MCPClientService))
    mcpClientService: MCPClientService | undefined,
  ) {
    super(
      httpService,
      llmService,
      taskProgressGateway,
      tasksService,
      taskStatusService,
      mcpClientService,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    // Python script path will be set by AgentDiscoveryService during discovery
  }

  getAgentName(): string {
    return 'Requirements Writer';
  }

  getAgentType(): 'engineering' {
    return 'engineering';
  }

  /**
   * Requirements Writer uses workflow steps - should be treated as ephemeral but with real-time progress
   */
  protected getTaskType(): 'ephemeral' | 'long_running' | 'swarm' {
    return 'ephemeral'; // Workflows complete in 18 seconds, so ephemeral
  }

  /**
   * Define status schema for workflow progress tracking
   */
  protected getStatusSchema(): Record<string, any> {
    return {
      currentStep: 'string',
      stepIndex: 'number',
      totalSteps: 'number',
      workflowSteps: {
        type: 'array',
        items: {
          stepName: 'string',
          stepIndex: 'number',
          status: 'string',
          message: 'string',
          timestamp: 'string',
        },
      },
    };
  }
}
