import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';
import { AgentServicesContext } from '@agents/base/services/agent-services-context';
import { AgentConfigurationService, AgentConfigurationData } from './agent-configuration.service';

/**
 * Virtual agent class that loads behavior from database-stored configuration
 */
class VirtualDatabaseAgent extends ContextAgentBaseService {
  protected readonly logger = new Logger('VirtualDatabaseAgent');
  
  private agentConfig: AgentConfigurationData;
  private contextContent: string;

  constructor(
    services: AgentServicesContext,
    agentConfig: AgentConfigurationData
  ) {
    super(services);
    this.agentConfig = agentConfig;
    this.contextContent = agentConfig.contextContent;
  }

  /**
   * Override to return the database agent's display name
   */
  getAgentName(): string {
    return this.agentConfig.displayName;
  }

  /**
   * Override to load context from database instead of filesystem
   */
  async loadContextContent(): Promise<string> {
    return this.contextContent;
  }

  /**
   * Override processTask to inject database-specific behavior
   */
  async processTask(taskRequest: any): Promise<any> {
    try {
      // Inject agent identity and capabilities into the task context
      const enhancedRequest = {
        ...taskRequest,
        agentContext: {
          agentId: this.agentConfig.agentId,
          displayName: this.agentConfig.displayName,
          department: this.agentConfig.department,
          primaryPurpose: this.agentConfig.primaryPurpose,
          capabilities: this.agentConfig.capabilities,
          communicationStyle: this.agentConfig.communicationStyle,
          limitations: this.agentConfig.limitations
        }
      };

      return await super.processTask(enhancedRequest);
    } catch (error) {
      this.logger.error(`Virtual agent ${this.agentConfig.agentId} task failed:`, error);
      return {
        message: `I apologize, but I encountered an error while processing your request. As a ${this.agentConfig.displayName}, I'm here to help with ${this.agentConfig.primaryPurpose}. Could you please try rephrasing your request?`,
        metadata: {
          agentName: this.agentConfig.displayName,
          error: error instanceof Error ? error.message : 'Unknown error',
          isVirtualAgent: true
        }
      };
    }
  }
}

@Injectable()
export class VirtualAgentLoaderService {
  private readonly logger = new Logger(VirtualAgentLoaderService.name);
  private agentInstanceCache = new Map<string, VirtualDatabaseAgent>();

  constructor(
    private moduleRef: ModuleRef,
    private agentConfigService: AgentConfigurationService
  ) {}

  /**
   * Create a virtual agent instance from database configuration
   */
  async createVirtualAgent(agentId: string): Promise<VirtualDatabaseAgent | null> {
    try {
      // Check cache first
      if (this.agentInstanceCache.has(agentId)) {
        this.logger.debug(`Returning cached virtual agent: ${agentId}`);
        return this.agentInstanceCache.get(agentId)!;
      }

      // Load configuration from database
      const agentConfig = await this.agentConfigService.getAgentConfiguration(agentId);
      if (!agentConfig) {
        this.logger.warn(`Agent configuration not found: ${agentId}`);
        return null;
      }

      // Get required services
      const services = await this.getAgentServicesContext();
      if (!services) {
        this.logger.error('Could not obtain AgentServicesContext');
        return null;
      }

      // Create virtual agent instance
      const virtualAgent = new VirtualDatabaseAgent(services, agentConfig);
      
      // Cache the instance
      this.agentInstanceCache.set(agentId, virtualAgent);
      
      this.logger.log(`Created virtual agent: ${agentId} (${agentConfig.displayName})`);
      return virtualAgent;
      
    } catch (error) {
      this.logger.error(`Failed to create virtual agent: ${agentId}`, error);
      return null;
    }
  }

  /**
   * Get an existing virtual agent instance
   */
  getVirtualAgent(agentId: string): VirtualDatabaseAgent | null {
    return this.agentInstanceCache.get(agentId) || null;
  }

  /**
   * Check if a virtual agent exists for the given ID
   */
  async hasVirtualAgent(agentId: string): Promise<boolean> {
    if (this.agentInstanceCache.has(agentId)) {
      return true;
    }

    try {
      const config = await this.agentConfigService.getAgentConfiguration(agentId);
      return config !== null;
    } catch {
      return false;
    }
  }

  /**
   * Remove virtual agent from cache (useful for hot-reloading)
   */
  invalidateVirtualAgent(agentId: string): void {
    this.agentInstanceCache.delete(agentId);
    this.logger.debug(`Invalidated virtual agent cache: ${agentId}`);
  }

  /**
   * Clear all cached virtual agents
   */
  clearCache(): void {
    this.agentInstanceCache.clear();
    this.logger.log('Cleared virtual agent cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedAgents: this.agentInstanceCache.size,
      agentIds: Array.from(this.agentInstanceCache.keys())
    };
  }

  /**
   * List all available virtual agents from database
   */
  async listVirtualAgents(): Promise<string[]> {
    try {
      const configs = await this.agentConfigService.listAgentConfigurations();
      return configs.map(config => config.agentId);
    } catch (error) {
      this.logger.error('Failed to list virtual agents:', error);
      return [];
    }
  }

  /**
   * Hot-reload a virtual agent with updated configuration
   */
  async reloadVirtualAgent(agentId: string): Promise<VirtualDatabaseAgent | null> {
    this.invalidateVirtualAgent(agentId);
    return await this.createVirtualAgent(agentId);
  }

  /**
   * Get agent services context from dependency injection
   */
  private async getAgentServicesContext(): Promise<AgentServicesContext | null> {
    try {
      const services = await this.moduleRef.get(AgentServicesContext, { strict: false });
      return services;
    } catch (error) {
      this.logger.error('Could not resolve AgentServicesContext:', error);
      return null;
    }
  }

  /**
   * Validate virtual agent configuration
   */
  private validateAgentConfig(config: AgentConfigurationData): boolean {
    const required = ['agentId', 'displayName', 'agentType', 'contextContent', 'primaryPurpose'];
    
    for (const field of required) {
      if (!config[field as keyof AgentConfigurationData]) {
        this.logger.warn(`Agent configuration missing required field: ${field}`);
        return false;
      }
    }

    return true;
  }
}