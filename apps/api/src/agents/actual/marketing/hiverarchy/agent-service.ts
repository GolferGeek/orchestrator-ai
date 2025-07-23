import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExternalA2AAgentBaseService } from '@agents/base/implementations/base-services';
import { ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { EvaluationWrapperService } from '@agents/base/sub-services/evaluation-wrapper/evaluation-wrapper.service';

/**
 * Hiverarchy AI Orchestrator External A2A Agent Service
 *
 * This service acts as a local proxy for the Hiverarchy AI orchestrator.
 * It routes content writing requests to specialist agents with intelligent delegation
 * using LLM decision-making. Specializes in blog writing, article creation, and
 * hierarchical content development.
 *
 * Features:
 * - Dynamic JWT authentication with Hiverarchy service
 * - Automatic token refresh handling
 * - Parameter transformation for Hiverarchy's expected format
 */
@Injectable()
export class HiverarchyAgentService extends ExternalA2AAgentBaseService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private readonly customHttpService: HttpService;

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

    // Keep our own reference for custom authentication
    this.customHttpService = httpService;

    this.logger.log(
      '🔗 Hiverarchy AI Orchestrator Agent Service initialized with dynamic auth',
    );
  }

  /**
   * Override getAgentName to provide a specific name for this agent
   */
  public getAgentName(): string {
    return 'hiverarchy';
  }

  /**
   * Override getAgentType to specify this is an external agent
   */
  public getAgentType(): string {
    return 'external';
  }

  /**
   * Custom initialization logic specific to Hiverarchy AI orchestrator
   */
  async onModuleInit(): Promise<void> {
    try {
      // Call parent initialization first
      await super.onModuleInit();

      this.logger.log('✅ External agent proxy ready');

      // Test authentication on startup (non-blocking)
      try {
        await this.ensureAuthenticated();
        this.logger.log('🔐 External agent authentication verified on startup');
      } catch (authError) {
        this.logger.warn(
          '⚠️ External agent authentication failed during startup - will retry on first request:',
          authError,
        );
        // Don't throw - allow the agent to initialize but mark as unauthenticated
      }
    } catch (error) {
      this.logger.error('❌ Failed to initialize external agent:', error);
      throw error;
    }
  }

  /**
   * Process task by forwarding to the external Hiverarchy agent
   * This is the standard interface expected by the dynamic controller
   */
  async processTask(taskRequest: any): Promise<any> {
    this.logger.debug(`🎯 Hiverarchy AI Orchestrator processing task`);

    try {
      // Ensure we have a valid authentication token
      await this.ensureAuthenticated();

      // Transform the request to match Hiverarchy's expected format
      const hiverarchyParams = this.transformRequestParams(taskRequest);

      // Forward the task request to the external Hiverarchy agent
      return await this.executeTaskWithAuth('processTask', hiverarchyParams);
    } catch (error) {
      this.logger.error(`❌ Failed to process task via Hiverarchy:`, error);
      throw error;
    }
  }

  /**
   * Ensure we have a valid authentication token
   */
  private async ensureAuthenticated(): Promise<void> {
    // Check if token is still valid (with 5-minute buffer)
    if (
      this.accessToken &&
      this.tokenExpiry &&
      Date.now() < this.tokenExpiry - 300000
    ) {
      return;
    }

    this.logger.debug('🔐 Authenticating with Hiverarchy...');

    try {
      // Read authentication configuration from YAML
      const config = this.getExternalConfig();
      const authConfig = config?.authentication;
      if (!authConfig || authConfig.type !== 'login') {
        throw new Error('Login authentication not configured in YAML');
      }

      const loginUrl = authConfig.login_endpoint;
      const username = authConfig.username;
      const password = authConfig.password;

      if (!loginUrl || !username || !password) {
        throw new Error(
          'Missing authentication configuration: login_endpoint, username, or password',
        );
      }

      const response = await firstValueFrom(
        this.customHttpService.post(loginUrl, {
          email: username,
          password: password,
        }),
      );

      if (response.data?.access_token) {
        this.accessToken = response.data.access_token;
        // Token expires in 1 hour (3600 seconds)
        this.tokenExpiry =
          Date.now() + (response.data.expires_in || 3600) * 1000;
        this.logger.log('✅ Successfully authenticated with Hiverarchy');
      } else {
        throw new Error('No access token received from Hiverarchy');
      }
    } catch (error) {
      this.logger.error('❌ Failed to authenticate with Hiverarchy:', error);
      throw new Error(
        `Hiverarchy authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Transform request parameters to match Hiverarchy's expected format
   */
  private transformRequestParams(taskRequest: any): any {
    // Extract user message from various possible locations
    let userMessage = '';

    if (taskRequest?.userMessage) {
      userMessage = taskRequest.userMessage;
    } else if (taskRequest?.params?.userMessage) {
      userMessage = taskRequest.params.userMessage;
    } else if (taskRequest?.params?.user) {
      userMessage = taskRequest.params.user;
    } else if (taskRequest?.user) {
      userMessage = taskRequest.user;
    }

    this.logger.debug(`📝 Extracted user message: "${userMessage}"`);

    // Return in Hiverarchy's expected format (userMessage at top level)
    return {
      userMessage,
      ...taskRequest,
    };
  }

  /**
   * Execute task with authentication headers
   */
  private async executeTaskWithAuth(method: string, params: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No authentication token available');
    }

    try {
      const config = this.getExternalConfig();
      const endpoint = config?.endpoint;
      if (!endpoint) {
        throw new Error('External endpoint not configured in YAML');
      }

      const requestBody = {
        jsonrpc: '2.0',
        id: `external-hiverarchy-${Date.now()}`,
        method: 'handle_request',
        params: {
          message:
            params.userMessage || params.message || 'No message provided',
          sessionId: `external-session-${Date.now()}`,
          conversation_history: [],
          authToken: this.accessToken, // Pass our auth token like frontend does
          currentUser: null, // External call, no specific user
        },
      };

      this.logger.debug(`🚀 Sending request to Hiverarchy: ${endpoint}`);

      const response = await firstValueFrom(
        this.customHttpService.post(endpoint, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          timeout: 30000,
        }),
      );

      if (response.status >= 200 && response.status < 300) {
        this.logger.log('✅ Successfully received response from Hiverarchy');

        // Extract the actual response text from the JSON-RPC wrapper
        let actualResponse = response.data;
        if (response.data?.result?.response) {
          // JSON-RPC format response
          actualResponse = response.data.result.response;
        } else if (response.data?.response) {
          // Direct response format
          actualResponse = response.data.response;
        }

        return {
          success: true,
          response: actualResponse,
          metadata: {
            delegatedTo: 'Hiverarchy AI Orchestrator',
            statusCode: response.status,
            timestamp: new Date().toISOString(),
          },
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('❌ Failed to execute task with Hiverarchy:', error);
      throw error;
    }
  }
}
