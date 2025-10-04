import { Injectable, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

// Core base services
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { EvaluationWrapperService } from '@agents/base/sub-services/evaluation-wrapper/evaluation-wrapper.service';
import { JsonRpcProtocolService } from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { AuthService } from '@agents/base/sub-services/auth/auth.service';

// Task and deliverable services
import { TaskStatusService } from '../../../tasks/task-status.service';
import { DeliverablesService } from '../../../deliverables/deliverables.service';
import { DeliverableVersionsService } from '../../../deliverables/deliverable-versions.service';

/**
 * Universal Service Container for All Agent Types
 *
 * This service aggregates all core dependencies that any agent might need,
 * eliminating constructor parameter explosion across the entire agent system.
 *
 * All services are optional except HttpService, allowing different agent types
 * to use only what they need while maintaining a consistent injection pattern.
 */
@Injectable()
export class UniversalAgentServicesContext {
  constructor(
    // Required core service for HTTP operations
    public readonly httpService: HttpService,

    // Core agent infrastructure services (optional)
    @Optional() public readonly configurationService?: ConfigurationService,
    @Optional()
    public readonly agentRegistrationService?: AgentRegistrationService,
    @Optional() public readonly loggingService?: LoggingService,
    @Optional() public readonly evaluationService?: EvaluationWrapperService,
    @Optional() public readonly jsonRpcProtocolService?: JsonRpcProtocolService,
    @Optional() public readonly authService?: AuthService,

    // Task and deliverable services (optional)
    @Optional() public readonly taskStatusService?: TaskStatusService,
    @Optional() public readonly deliverablesService?: DeliverablesService,
    @Optional()
    public readonly deliverableVersionsService?: DeliverableVersionsService,
  ) {}
}
