import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ExternalA2AAgentBaseService } from '@agents/base/implementations/base-services';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { EvaluationWrapperService } from '@agents/base/sub-services/evaluation-wrapper/evaluation-wrapper.service';

/**
 * Google Hello World External A2A Agent Service
 *
 * This service acts as a local proxy for Google's Hello World A2A agent.
 * It demonstrates the basic functionality of connecting to external A2A agents.
 */
@Injectable()
export class GoogleHelloWorldAgentService extends ExternalA2AAgentBaseService {
  constructor(
    httpService: HttpService,
    configurationService: ConfigurationService,
    agentRegistrationService: AgentRegistrationService,
    loggingService?: LoggingService,
    evaluationService?: EvaluationWrapperService,
  ) {
    super(
      httpService,
      configurationService,
      agentRegistrationService,
      loggingService,
      evaluationService,
    );
    this.logger.log(
      '🔗 Google Hello World External A2A Agent Service initialized',
    );
  }

  /**
   * Override getAgentName to provide a specific name for this agent
   */
  public getAgentName(): string {
    return 'google-hello-world';
  }

  /**
   * Override getAgentType to specify this is an external agent
   */
  public getAgentType(): string {
    return 'external';
  }

  /**
   * Optional: Custom initialization logic specific to Google Hello World agent
   */
  async onModuleInit(): Promise<void> {
    try {
      // Call parent initialization first
      await super.onModuleInit();

      this.logger.log('✅ Google Hello World Agent proxy ready');

      // Optional: Perform Google-specific initialization
      // For example, validate specific capabilities or perform health checks
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize Google Hello World Agent:',
        error,
      );
      throw error;
    }
  }

  /**
   * Optional: Override executeTask for Google-specific behavior
   * In most cases, the base class implementation should be sufficient
   */
  // async executeTask(method: string, params: any): Promise<any> {
  //   this.logger.debug(`🎯 Google Hello World executing: ${method}`);
  //   return super.executeTask(method, params);
  // }
}
