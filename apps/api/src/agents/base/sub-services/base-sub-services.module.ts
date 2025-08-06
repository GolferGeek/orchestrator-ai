import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigurationService } from './configuration/configuration.service';
import { AgentRegistrationService } from './agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from './json-rpc-protocol/json-rpc-protocol.service';
import { TaskLifecycleService } from './task-lifecycle/task-lifecycle.service';
import { AgentMetadataService } from './agent-metadata/agent-metadata.service';
import { EvaluationWrapperService } from './evaluation-wrapper/evaluation-wrapper.service';
import { HealthService } from './health/health.service';
import { LoggingService } from './logging/logging.service';
import { AuthService } from './auth/auth.service';
import { DeliverablesModule } from '../../../deliverables/deliverables.module';
// MCPModule removed - replaced with LangChain module

/**
 * Module that provides all base sub-services for agent implementations.
 * These services handle common functionality like configuration parsing,
 * agent registration, and other utility operations.
 */
@Module({
  imports: [HttpModule, DeliverablesModule],
  providers: [
    ConfigurationService,
    AgentRegistrationService,
    JsonRpcProtocolService,
    TaskLifecycleService,
    AgentMetadataService,
    EvaluationWrapperService,
    HealthService,
    LoggingService,
    AuthService,
  ],
  exports: [
    ConfigurationService,
    AgentRegistrationService,
    JsonRpcProtocolService,
    TaskLifecycleService,
    AgentMetadataService,
    EvaluationWrapperService,
    HealthService,
    LoggingService,
    AuthService,
  ],
})
export class BaseSubServicesModule {}
