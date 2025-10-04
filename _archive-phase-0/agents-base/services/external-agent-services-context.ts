import { Injectable, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { EvaluationWrapperService } from '@agents/base/sub-services/evaluation-wrapper/evaluation-wrapper.service';
import { LLMService } from '@/llms/llm.service';
import { LLMServiceFactory } from '@/llms/services/llm-service-factory';

/**
 * Pure Service Container for External Agents
 *
 * This service aggregates all dependencies needed by external agents into a single
 * injectable container, eliminating constructor parameter explosion and simplifying
 * dependency management.
 *
 * Core Pattern: Instead of injecting 5+ individual services into each external agent,
 * we inject this single service container that contains all dependencies.
 */
@Injectable()
export class ExternalAgentServicesContext {
  constructor(
    // Required services for external agents
    public readonly httpService: HttpService,
    public readonly configurationService: ConfigurationService,
    public readonly agentRegistrationService: AgentRegistrationService,

    // Optional LLM services - external agents may or may not need these
    @Optional() public readonly llmService?: LLMService,
    @Optional() public readonly llmServiceFactory?: LLMServiceFactory,

    // Optional services - using @Optional() for all optional dependencies
    @Optional() public readonly loggingService?: LoggingService,
    @Optional() public readonly evaluationService?: EvaluationWrapperService,
  ) {}
}
