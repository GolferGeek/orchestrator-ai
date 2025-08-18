import { Injectable, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { LLMService } from '@/llms/llm.service';
import { TaskStatusService } from '@/tasks/task-status.service';
import { TasksService } from '@/tasks/tasks.service';
import { DeliverablesService } from '@/deliverables/deliverables.service';
import { DeliverableVersionsService } from '@/deliverables/deliverable-versions.service';
import { TaskProgressGateway } from '@/websocket/task-progress.gateway';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { AuthService } from '@agents/base/sub-services/auth/auth.service';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';

/**
 * Service container specifically for function agents.
 * This eliminates constructor parameter explosion in function-based agents.
 */
@Injectable()
export class FunctionAgentServicesContext {
  constructor(
    // Core services that every function agent needs
    public readonly httpService: HttpService,
    public readonly llmService: LLMService,

    // Task-related services (required for function agents)
    public readonly taskProgressGateway: TaskProgressGateway,
    public readonly tasksService: TasksService,
    public readonly taskStatusService: TaskStatusService,
    public readonly deliverablesService: DeliverablesService,
    public readonly deliverableVersionsService: DeliverableVersionsService,

    // Agent framework services (optional)
    @Optional()
    public readonly agentRegistrationService?: AgentRegistrationService,
    @Optional() public readonly jsonRpcProtocolService?: JsonRpcProtocolService,
    @Optional() public readonly loggingService?: LoggingService,
    @Optional() public readonly authService?: AuthService,
    @Optional() public readonly configurationService?: ConfigurationService,
  ) {}
}
