import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import * as path from 'path';

import { AgentInfo } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { ExternalAgentServicesContext } from '../../../services/external-agent-services-context';

export interface ExternalA2AConfiguration {
  endpoint: string;
  protocol: 'A2A';
  timeout?: number;
  authentication?: {
    type: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth' | 'login';
    key?: string;
    value?: string;
    header?: string;
    login_endpoint?: string;
    username?: string;
    password?: string;
  } | null;
  retry?: {
    attempts: number;
    delay: number;
    backoff: 'linear' | 'exponential';
  };
  capabilities?: string[];
  required_env_vars?: string[];
}

export interface ExternalAgentCard {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  inputModes: string[];
  outputModes: string[];
  version: string;
  metadata?: Record<string, any>;
}

export interface ExternalA2AParams {
  method: string;
  params: any;
  sessionId?: string;
  metadata?: any;
}

export interface ExternalA2AResponse {
  success: boolean;
  response: any;
  metadata?: any;
  error?: string;
}

/**
 * External A2A Agent Base Service - Lightweight proxy for external A2A agents
 *
 * This service acts as a local representative for remote A2A-compliant agents.
 * It handles configuration, discovery, registration, and request forwarding.
 * Unlike other agent base services, it does NOT extend A2AAgentBaseService
 * because the external agents already implement the full A2A protocol.
 */
@Injectable()
export class ExternalA2AAgentBaseService
  implements OnModuleInit, OnModuleDestroy
{
  protected readonly logger = new Logger(ExternalA2AAgentBaseService.name);

  // Configuration and discovery
  private externalConfig: ExternalA2AConfiguration | null = null;
  private remoteAgentCard: ExternalAgentCard | null = null;
  private agentPath: string | null = null;
  private agentName: string | null = null;

  // Registration state
  private isInitialized = false;
  private registrationResult: any = null;

  constructor(
    // Pure service container pattern - only accepts ExternalAgentServicesContext
    private readonly services: ExternalAgentServicesContext,
  ) {}

  /**
   * Initialize the external A2A agent proxy
   */
  async onModuleInit() {

    if (!this.agentPath) {

      return;
    }

    try {
      // Load local configuration from agent.yaml
      await this.loadLocalConfiguration();

      // Discover remote agent capabilities (optional)
      try {
        await this.discoverRemoteAgent();
      } catch (error) {

        // Create a minimal agent card for registration
        this.remoteAgentCard = {
          id: this.getAgentId(),
          name: this.getAgentName(),
          description: `External A2A agent: ${this.getAgentName()}`,
          capabilities: ['content_creation', 'blog_writing', 'article_writing'],
          inputModes: ['text'],
          outputModes: ['text'],
          version: '1.0.0',
        };
      }

      // Note: Agent registration is now handled by AppService via AgentFactoryService
      // No longer self-registering here to avoid conflicts

      this.isInitialized = true;

    } catch (error) {

      throw error;
    }
  }

  /**
   * Cleanup on module destruction
   */
  async onModuleDestroy() {
    if (this.registrationResult?.success) {
      try {
        await this.services.agentRegistrationService.unregisterAgent(
          this.getAgentId(),
        );

      } catch (error) {

      }
    }
  }

  /**
   * Set the agent path for discovery
   */
  setDiscoveredPath(path: string): void {
    this.agentPath = path;
    this.agentName = this.extractAgentNameFromPath(path);

  }

  /**
   * Get the agent name
   */
  getAgentName(): string {
    return this.agentName || 'unknown-external-agent';
  }

  /**
   * Get the agent ID
   */
  getAgentId(): string {
    return this.services.agentRegistrationService.generateAgentId(
      this.getAgentName(),
      'external',
    );
  }

  /**
   * Get the agent type
   */
  getAgentType(): string {
    return 'external';
  }

  /**
   * Get the external configuration (protected for derived classes)
   */
  protected getExternalConfig(): ExternalA2AConfiguration | null {
    return this.externalConfig;
  }

  /**
   * Execute a task by forwarding to the external A2A agent
   */
  async executeTask(method: string, params: any): Promise<any> {

    if (!this.isInitialized || !this.externalConfig) {
      throw new Error(
        `External A2A agent not properly initialized: ${this.getAgentName()}`,
      );
    }

    const requestParams: ExternalA2AParams = {
      method,
      params,
      sessionId: params.sessionId,
      metadata: {
        timestamp: new Date().toISOString(),
        agentName: this.getAgentName(),
        originalMethod: method,
      },
    };

    try {
      // Log the request if logging service is available
      if (this.services.loggingService) {
        this.services.loggingService.logRequest(method, requestParams, {
          agentName: this.getAgentName(),
          agentType: 'external-a2a',
          requestId: Date.now().toString(),
        });
      }

      // Record task start for evaluation metrics
      if (this.services.evaluationService) {
        this.services.evaluationService.recordTaskStart(
          Date.now().toString(),
          method,
        );
      }

      const startTime = Date.now();

      // Forward request to external A2A agent
      const response = await this.forwardToExternalAgent(requestParams);

      const responseTime = Date.now() - startTime;

      // Log the response if logging service is available
      if (this.services.loggingService) {
        this.services.loggingService.logResponse(
          method,
          response.success,
          responseTime,
          {
            agentName: this.getAgentName(),
            agentType: 'external-a2a',
            responseTime: `${responseTime}ms`,
          },
        );
      }

      // Record task completion for evaluation metrics
      if (this.services.evaluationService) {
        this.services.evaluationService.recordTaskCompletion(
          Date.now().toString(),
          method,
          responseTime,
          response.success,
          response.success ? undefined : response.error,
        );
      }

      return response;
    } catch (error) {

      // Log the error if logging service is available
      if (this.services.loggingService) {
        this.services.loggingService.logError(
          error instanceof Error ? error : String(error),
          {
            agentName: this.getAgentName(),
            agentType: 'external-a2a',
            method: method,
          },
        );
      }

      throw error;
    }
  }

  /**
   * Get the agent card (combines local config and remote capabilities)
   */
  async getAgentCard(): Promise<any> {
    if (!this.remoteAgentCard) {
      return {
        id: this.getAgentId(),
        name: this.getAgentName(),
        description: 'External A2A agent (capabilities not yet discovered)',
        capabilities: [],
        inputModes: ['text'],
        outputModes: ['text'],
        version: '1.0.0',
        metadata: {
          type: 'external',
          endpoint: this.externalConfig?.endpoint || 'unknown',
        },
      };
    }

    return {
      ...this.remoteAgentCard,
      id: this.getAgentId(),
      metadata: {
        ...this.remoteAgentCard.metadata,
        type: 'external',
        endpoint: this.externalConfig?.endpoint,
        localProxy: true,
      },
    };
  }

  /**
   * Load local configuration from agent.yaml
   */
  private async loadLocalConfiguration(): Promise<void> {

    if (!this.agentPath) {
      throw new Error('Agent path not set');
    }

    try {
      const agentDirectory = path.join(
        process.cwd(),
        'src/agents/actual',
        this.agentPath,
      );

      const yamlPath = path.join(agentDirectory, 'agent.yaml');

      const configResult =
        await this.services.configurationService.parseYamlFile<any>(yamlPath, {
          substituteEnvVars: true,
          strictEnvVars: false,
        });

      // Extract external A2A configuration
      this.externalConfig = this.extractExternalA2AConfig(configResult.data);

      if (!this.externalConfig) {
        throw new Error('No external A2A configuration found in agent.yaml');
      }

      // Validate configuration
      this.validateConfiguration(this.externalConfig);

    } catch (error) {

      throw error;
    }
  }

  /**
   * Discover remote agent capabilities from /.well-known/agent.json
   */
  private async discoverRemoteAgent(): Promise<void> {

    try {
      // Extract base URL from endpoint (remove path if present)
      const endpointUrl = new URL(this.externalConfig!.endpoint);
      const baseUrl = `${endpointUrl.protocol}//${endpointUrl.host}`;
      const wellKnownUrl = `${baseUrl}/.well-known/agent.json`;

      const response = await firstValueFrom(
        this.services.httpService.get(wellKnownUrl, {
          timeout: this.externalConfig!.timeout || 10000,
          headers: this.buildAuthHeaders(),
        }),
      );

      if (response.status !== 200) {
        throw new Error(`Failed to fetch agent card: HTTP ${response.status}`);
      }

      this.remoteAgentCard = response.data as ExternalAgentCard;

    } catch (error) {

      throw new Error(
        `Remote agent discovery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Register with local agent pool using remote agent's capabilities
   */
  private async registerWithAgentPool(): Promise<void> {

    try {
      const agentInfo: AgentInfo = {
        id: this.getAgentId(),
        name: this.getAgentName(),
        type: 'marketing', // External agents are now part of marketing organization
        path: this.agentPath!,
        url: this.buildAgentUrl(),
        description:
          this.remoteAgentCard?.description ||
          `External A2A agent: ${this.getAgentName()}`,
        capabilities: this.remoteAgentCard?.capabilities || [],
        skills: [], // External agents don't expose skills in the same format
        inputModes: this.remoteAgentCard?.inputModes || ['text'],
        outputModes: this.remoteAgentCard?.outputModes || ['text'],
        metadata: {
          type: 'external',
          endpoint: this.externalConfig!.endpoint,
          remoteAgentCard: this.remoteAgentCard,
          localProxy: true,
        },
      };

      this.registrationResult =
        await this.services.agentRegistrationService.registerAgent(agentInfo);

      if (!this.registrationResult.success) {
        throw new Error(
          `Registration failed: ${this.registrationResult.error}`,
        );
      }

    } catch (error) {

      throw error;
    }
  }

  /**
   * Forward request to external A2A agent
   */
  private async forwardToExternalAgent(
    params: ExternalA2AParams,
  ): Promise<ExternalA2AResponse> {

    const maxAttempts = this.externalConfig!.retry?.attempts || 3;
    const baseDelay = this.externalConfig!.retry?.delay || 1000;
    const backoffType = this.externalConfig!.retry?.backoff || 'linear';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await firstValueFrom(
          this.services.httpService.post(
            this.externalConfig!.endpoint,
            {
              method: params.method,
              params: params.params,
              id: Date.now().toString(),
              jsonrpc: '2.0',
            },
            {
              timeout: this.externalConfig!.timeout || 60000,
              headers: {
                'Content-Type': 'application/json',
                ...this.buildAuthHeaders(),
              },
            },
          ),
        );

        if (response.status >= 200 && response.status < 300) {
          return {
            success: true,
            response: response.data,
            metadata: {
              statusCode: response.status,
              attempt,
              timestamp: new Date().toISOString(),
            },
          };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {

        if (attempt === maxAttempts) {
          return {
            success: false,
            response: null,
            error: `All ${maxAttempts} attempts failed. Last error: ${error instanceof Error ? error.message : String(error)}`,
            metadata: {
              finalAttempt: attempt,
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Calculate delay for next attempt
        const delay =
          backoffType === 'exponential'
            ? baseDelay * Math.pow(2, attempt - 1)
            : baseDelay * attempt;

        await this.sleep(delay);
      }
    }

    // This should not be reached due to the loop logic above
    throw new Error('Unexpected end of retry loop');
  }

  /**
   * Build authentication headers
   */
  private buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.externalConfig?.authentication) {
      const auth = this.externalConfig.authentication;

      switch (auth.type) {
        case 'api_key':
          if (auth.header && auth.value) {
            headers[auth.header] = auth.value;
          }
          break;
        case 'bearer':
          if (auth.value) {
            headers['Authorization'] = `Bearer ${auth.value}`;
          }
          break;
        case 'basic':
          if (auth.key && auth.value) {
            const credentials = Buffer.from(
              `${auth.key}:${auth.value}`,
            ).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
        // oauth and none don't set headers directly
      }
    }

    return headers;
  }

  /**
   * Extract external A2A configuration from parsed YAML
   */
  private extractExternalA2AConfig(
    yamlData: any,
  ): ExternalA2AConfiguration | null {
    try {
      const config =
        yamlData.external_a2a_configuration || yamlData.external_configuration;

      if (!config) {

        return null;
      }

      return {
        endpoint: config.endpoint || '',
        protocol: 'A2A',
        timeout: config.timeout || 60000,
        authentication: config.authentication || null,
        retry: config.retry || { attempts: 3, delay: 1000, backoff: 'linear' },
        capabilities: config.capabilities || [],
        required_env_vars: config.required_env_vars || [],
      };
    } catch (error) {

      return null;
    }
  }

  /**
   * Validate external A2A configuration
   */
  private validateConfiguration(config: ExternalA2AConfiguration): void {
    if (!config.endpoint) {
      throw new Error('External A2A configuration missing required endpoint');
    }

    if (
      !config.endpoint.startsWith('http://') &&
      !config.endpoint.startsWith('https://')
    ) {
      throw new Error('External A2A endpoint must be a valid HTTP/HTTPS URL');
    }

    if (config.protocol !== 'A2A') {
      throw new Error('External A2A configuration must specify protocol: A2A');
    }

    // Validate required environment variables
    if (config.required_env_vars) {
      for (const envVar of config.required_env_vars) {
        if (!process.env[envVar]) {
          throw new Error(`Required environment variable not set: ${envVar}`);
        }
      }
    }
  }

  /**
   * Extract agent name from path
   */
  private extractAgentNameFromPath(agentPath: string): string {
    return path.basename(agentPath);
  }

  /**
   * Build agent URL for registration
   */
  private buildAgentUrl(): string {
          const baseUrl = process.env.AGENT_BASE_URL || `http://localhost:${process.env.WEB_PORT || '9001'}`;
    return `${baseUrl}/agents/external/${this.getAgentName()}`;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
