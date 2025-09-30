import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  AgentRegistration,
  AgentHeartbeat,
  AgentMetrics,
  AgentSkill,
} from '@agent-pool/interfaces';
import { AgentType } from '../../../../common/types/agent-conversations.types';

export interface RegistrationConfig {
  /**
   * Base URL for the agent pool service
   */
  agentPoolBaseUrl?: string;

  /**
   * Heartbeat interval in milliseconds (default: 30000 = 30 seconds)
   */
  heartbeatInterval?: number;

  /**
   * Whether to automatically register on service initialization
   */
  autoRegister?: boolean;

  /**
   * Whether to automatically start heartbeat after registration
   */
  autoHeartbeat?: boolean;

  /**
   * Maximum number of registration retry attempts
   */
  maxRetryAttempts?: number;

  /**
   * Delay between retry attempts in milliseconds
   */
  retryDelay?: number;

  /**
   * Custom agent pool endpoints
   */
  endpoints?: {
    register?: string;
    unregister?: string;
    heartbeat?: string;
  };
}

export interface AgentInfo {
  id: string;
  name: string;
  type: AgentType;
  path: string;
  url: string;
  description: string;
  capabilities: string[];
  skills: AgentSkill[];
  inputModes: string[];
  outputModes: string[];
  metadata: Record<string, any>;
}

export interface RegistrationResult {
  success: boolean;
  agentId: string;
  message?: string;
  error?: string;
  retryCount?: number;
}

export interface HeartbeatResult {
  success: boolean;
  message?: string;
  error?: string;
}

@Injectable()
export class AgentRegistrationService implements OnModuleDestroy {
  private readonly logger = new Logger(AgentRegistrationService.name);

  // Configuration
  private config: Required<RegistrationConfig>;

  // Registration state
  private isRegistered = false;
  private registeredAgentId: string | null = null;
  private registrationAttempts = 0;

  // Heartbeat management
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeatTime: Date | null = null;

  // Metrics tracking
  private registrationTime: Date | null = null;
  private heartbeatCount = 0;
  private failedHeartbeats = 0;

  constructor(private readonly httpService: HttpService) {
    // Set default configuration
    this.config = {
      agentPoolBaseUrl: this.getDefaultAgentPoolUrl(),
      heartbeatInterval: 30000, // 30 seconds
      autoRegister: false,
      autoHeartbeat: true,
      maxRetryAttempts: 3,
      retryDelay: 5000, // 5 seconds
      endpoints: {
        register: '/register',
        unregister: '/agents',
        heartbeat: '/heartbeat',
      },
    };
  }

  /**
   * Configure the registration service
   */
  configure(config: Partial<RegistrationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      endpoints: {
        ...this.config.endpoints,
        ...config.endpoints,
      },
    };
  }

  /**
   * Register an agent with the agent pool
   */
  async registerAgent(agentInfo: AgentInfo): Promise<RegistrationResult> {
    const registration: AgentRegistration = {
      ...agentInfo,
      status: 'online',
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
    };

    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetryAttempts; attempt++) {
      try {
        this.registrationAttempts = attempt;

        const url = `${this.config.agentPoolBaseUrl}${this.config.endpoints.register}`;

        const _response = await this.httpService.axiosRef.post(
          url,
          registration,
        );

        if (response.status === 201) {
          this.isRegistered = true;
          this.registeredAgentId = agentInfo.id;
          this.registrationTime = new Date();

          // Start heartbeat if configured
          if (this.config.autoHeartbeat) {
            this.startHeartbeat(agentInfo);
          }

          return {
            success: true,
            agentId: agentInfo.id,
            message: `Agent registered successfully on attempt ${attempt}`,
            retryCount: attempt - 1,
          };
        } else {
          lastError = `Unexpected response status: ${response.status}`;
        }
      } catch (error: any) {
        lastError = error.message || String(error);

        if (attempt < this.config.maxRetryAttempts) {
          await this.delay(this.config.retryDelay);
        }
      }
    }

    // All attempts failed

    return {
      success: false,
      agentId: agentInfo.id,
      error: lastError || 'Registration failed after all retry attempts',
      retryCount: this.config.maxRetryAttempts,
    };
  }

  /**
   * Unregister an agent from the agent pool
   */
  async unregisterAgent(agentId?: string): Promise<RegistrationResult> {
    const targetAgentId = agentId || this.registeredAgentId;

    if (!targetAgentId) {
      return {
        success: false,
        agentId: '',
        error: 'No agent ID provided and no registered agent found',
      };
    }

    try {
      // Stop heartbeat first
      this.stopHeartbeat();

      const url = `${this.config.agentPoolBaseUrl}${this.config.endpoints.unregister}/${targetAgentId}`;

      await this.httpService.axiosRef.delete(url);

      // Update state
      this.isRegistered = false;
      this.registeredAgentId = null;
      this.registrationTime = null;
      this.registrationAttempts = 0;

      return {
        success: true,
        agentId: targetAgentId,
        message: 'Agent unregistered successfully',
      };
    } catch (error: any) {
      const errorMessage = error.message || String(error);

      return {
        success: false,
        agentId: targetAgentId,
        error: errorMessage,
      };
    }
  }

  /**
   * Send a heartbeat to the agent pool
   */
  async sendHeartbeat(
    agentId: string,
    metrics?: AgentMetrics,
  ): Promise<HeartbeatResult> {
    if (!this.isRegistered) {
      return {
        success: false,
        error: 'Agent is not registered',
      };
    }

    try {
      const heartbeat: AgentHeartbeat = {
        agentId,
        timestamp: new Date(),
        metrics,
        status: 'online',
      };

      const url = `${this.config.agentPoolBaseUrl}${this.config.endpoints.heartbeat}`;
      await this.httpService.axiosRef.post(url, heartbeat);

      this.lastHeartbeatTime = new Date();
      this.heartbeatCount++;

      return {
        success: true,
        message: 'Heartbeat sent successfully',
      };
    } catch (error: any) {
      this.failedHeartbeats++;
      const errorMessage = error.message || String(error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Start periodic heartbeat for an agent
   */
  startHeartbeat(agentInfo: AgentInfo, getMetrics?: () => AgentMetrics): void {
    if (this.heartbeatInterval) {
      this.stopHeartbeat();
    }

    this.heartbeatInterval = setInterval(async () => {
      const metrics = getMetrics ? getMetrics() : undefined;
      await this.sendHeartbeat(agentInfo.id, metrics);
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop periodic heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get registration status and statistics
   */
  getRegistrationStatus(): {
    isRegistered: boolean;
    agentId: string | null;
    registrationTime: Date | null;
    registrationAttempts: number;
    heartbeatCount: number;
    failedHeartbeats: number;
    lastHeartbeatTime: Date | null;
    uptime: number | null;
  } {
    return {
      isRegistered: this.isRegistered,
      agentId: this.registeredAgentId,
      registrationTime: this.registrationTime,
      registrationAttempts: this.registrationAttempts,
      heartbeatCount: this.heartbeatCount,
      failedHeartbeats: this.failedHeartbeats,
      lastHeartbeatTime: this.lastHeartbeatTime,
      uptime: this.registrationTime
        ? Date.now() - this.registrationTime.getTime()
        : null,
    };
  }

  /**
   * Check if agent is currently registered
   */
  isAgentRegistered(): boolean {
    return this.isRegistered;
  }

  /**
   * Get the registered agent ID
   */
  getRegisteredAgentId(): string | null {
    return this.registeredAgentId;
  }

  /**
   * Generate a consistent agent ID based on agent info
   */
  generateAgentId(name: string, type: string): string {
    const cleanName = name.toLowerCase().replace(/\s+/g, '_');
    return `${type}_${cleanName}`;
  }

  /**
   * Build agent URL based on configuration
   */
  buildAgentUrl(agentPath: string, baseUrl?: string): string {
    const apiHost = process.env.API_HOST || 'localhost';
    const apiPort = process.env.API_PORT || '4000';
    const base = baseUrl || `http://${apiHost}:${apiPort}`;
    return `${base}/agents/${agentPath}/tasks`;
  }

  /**
   * Validate agent information before registration
   */
  validateAgentInfo(agentInfo: AgentInfo): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!agentInfo.id || agentInfo.id.trim() === '') {
      errors.push('Agent ID is required');
    }

    if (!agentInfo.name || agentInfo.name.trim() === '') {
      errors.push('Agent name is required');
    }

    if (
      !['orchestrator', 'specialist', 'manager', 'external'].includes(
        agentInfo.type,
      )
    ) {
      errors.push(
        'Agent type must be one of: orchestrator, specialist, manager, external',
      );
    }

    if (!agentInfo.path || agentInfo.path.trim() === '') {
      errors.push('Agent path is required');
    }

    if (!agentInfo.url || agentInfo.url.trim() === '') {
      errors.push('Agent URL is required');
    }

    if (!Array.isArray(agentInfo.capabilities)) {
      errors.push('Agent capabilities must be an array');
    }

    if (!Array.isArray(agentInfo.skills)) {
      errors.push('Agent skills must be an array');
    }

    if (!Array.isArray(agentInfo.inputModes)) {
      errors.push('Agent input modes must be an array');
    }

    if (!Array.isArray(agentInfo.outputModes)) {
      errors.push('Agent output modes must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    // Stop heartbeat
    this.stopHeartbeat();

    // Unregister if registered
    if (this.isRegistered && this.registeredAgentId) {
      await this.unregisterAgent(this.registeredAgentId);
    }
  }

  /**
   * Get default agent pool URL from environment variables
   */
  private getDefaultAgentPoolUrl(): string {
    const apiHost = process.env.API_HOST || 'localhost';
    const apiPort = process.env.API_PORT || '4000';
    return `http://${apiHost}:${apiPort}/agent-pool`;
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
