import { Injectable, Inject, forwardRef, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { FunctionAgentBaseService } from '@agents/base/implementations/base-services/function';
import { LLMService } from '@/llms/llm.service';
import { TaskProgressGateway } from '@/websocket/task-progress.gateway';
import { TasksService } from '@/tasks/tasks.service';
import { TaskStatusService } from '@/tasks/task-status.service';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { AuthService } from '@agents/base/sub-services/auth/auth.service';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { SupabaseToolsService } from '@/langchain/services/supabase-tools.service';
import { AgentFunctionParams, AgentFunctionResponse } from '@agents/base/implementations/base-services/a2a-base/interfaces';

@Injectable()
export class MetricsAgentService extends FunctionAgentBaseService {
  constructor(
    httpService: HttpService,
    llmService: LLMService,
    @Inject(forwardRef(() => TaskProgressGateway))
    taskProgressGateway: TaskProgressGateway | undefined,
    @Inject(forwardRef(() => TasksService))
    tasksService: TasksService | undefined,
    @Inject(forwardRef(() => TaskStatusService))
    taskStatusService: TaskStatusService | undefined,
    private readonly supabaseTools: SupabaseToolsService,
    agentRegistrationService?: AgentRegistrationService,
    jsonRpcProtocolService?: JsonRpcProtocolService,
    loggingService?: LoggingService,
    authService?: AuthService,
    configurationService?: ConfigurationService,
  ) {
    super(
      httpService,
      llmService,
      taskProgressGateway,
      tasksService,
      taskStatusService,
      undefined, // No longer using MCP client service
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService,
      configurationService,
    );

    // Set total steps for Enhanced Metrics Agent workflow
    this.setTotalSteps(5);
  }

  getAgentName(): string {
    return 'Enhanced Metrics Agent';
  }

  getAgentType(): 'finance' {
    return 'finance';
  }


}
