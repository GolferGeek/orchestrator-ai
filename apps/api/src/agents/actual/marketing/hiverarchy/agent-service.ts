import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExternalA2AAgentBaseService } from '@agents/base/implementations/base-services';
import { ExternalAgentServicesContext } from '@agents/base/services/external-agent-services-context';

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

  constructor(services: ExternalAgentServicesContext) {
    super(services);

    // Keep our own reference for custom authentication
    this.customHttpService = services.httpService;

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

      // Test authentication on startup (non-blocking)
      try {
        await this.ensureAuthenticated();

      } catch (authError) {

        // Don't throw - allow the agent to initialize but mark as unauthenticated
      }
    } catch (error) {

      throw error;
    }
  }

  /**
   * Process task by forwarding to the external Hiverarchy agent
   * This is the standard interface expected by the dynamic controller
   */
  async processTask(taskRequest: any): Promise<any> {

    try {
      // Ensure we have a valid authentication token
      await this.ensureAuthenticated();

      // Transform the request to match Hiverarchy's expected format
      const hiverarchyParams = this.transformRequestParams(taskRequest);

      // Forward the task request to the external Hiverarchy agent
      return await this.executeTaskWithAuth('processTask', hiverarchyParams);
    } catch (error) {

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

      if (response.data?.accessToken) {
        this.accessToken = response.data.accessToken;
        // Token expires in 1 hour (3600 seconds)
        this.tokenExpiry =
          Date.now() + (response.data.expiresIn || 3600) * 1000;

      } else {
        throw new Error('No access token received from Hiverarchy');
      }
    } catch (error) {

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

      // Use the exact format expected by the external hierarchy agent
      const requestBody = {
        jsonrpc: '2.0',
        method: 'processTask',
        params: {
          message:
            params.userMessage || params.message || 'No message provided',
          userMessage:
            params.userMessage || params.message || 'No message provided',
          sessionId: `external-session-${Date.now()}`,
          authToken: this.accessToken,
          conversation_history: [],
        },
        id: `external-hiverarchy-${Date.now()}`,
      };

      const response = await firstValueFrom(
        this.customHttpService.post(endpoint, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
          },
          timeout: 60000,
        }),
      );

      if (response.status >= 200 && response.status < 300) {

        // Handle the exact response format from external agent
        let actualResponse = response.data;
        let metadata: any = {
          delegatedTo: 'Hiverarchy AI Orchestrator',
          statusCode: response.status,
          timestamp: new Date().toISOString(),
          isExternalAgent: true,
          responseFormat: 'unknown',
        };

        if (response.data?.result) {
          // JSON-RPC 2.0 format response
          const result = response.data.result;
          actualResponse = result.response || result;
          metadata.responseFormat = 'jsonrpc';

          // Extract metadata from the result
          if (result.metadata) {
            metadata = { ...metadata, ...result.metadata };
          }
        } else if (response.data?.error) {
          // JSON-RPC error response
          throw new Error(
            `External agent error: ${response.data.error.message || 'Unknown error'}`,
          );
        } else if (response.data?.response) {
          // Direct response format
          actualResponse = response.data.response;
          metadata.responseFormat = 'direct';
        } else if (response.data?.statusCode === 500) {
          // Handle 500 error responses
          throw new Error(
            `External agent error: ${response.data.message || 'Internal server error'}`,
          );
        }

        return {
          success: true,
          response: actualResponse,
          metadata,
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {

      // Log more details about the error
      if (error.response) {

      }

      throw error;
    }
  }
}
