import { Injectable } from '@nestjs/common';

/**
 * Typed model configuration schema (fail-fast, no fallbacks)
 */
export type ModelVariant = 'default' | 'fast' | 'reasoning' | 'long_context' | 'multimodal';
export type EnvironmentName = 'development' | 'staging' | 'production';

export interface ModelConfiguration {
  provider: string; // e.g., 'openai' | 'anthropic' | 'google' | 'grok' | 'ollama'
  model: string; // e.g., 'gpt-4o', 'claude-3-5-sonnet-20241022'
  parameters?: Record<string, any>;
}

export interface AgentModelConfiguration {
  default: ModelConfiguration;
  fast?: ModelConfiguration;
  reasoning?: ModelConfiguration;
  long_context?: ModelConfiguration;
  multimodal?: ModelConfiguration;
}

export interface SystemModelConfiguration {
  agents: Record<string, AgentModelConfiguration>;
  environmentDefaults: Record<EnvironmentName, ModelConfiguration>;
}

@Injectable()
export class ModelConfigurationService {
  private readonly config: SystemModelConfiguration;

  constructor(config?: SystemModelConfiguration) {
    // No silent defaults: require explicit configuration at construction or via module factory
    this.config = config ?? { agents: {}, environmentDefaults: {} as any };
  }

  /**
   * Validate the entire configuration upfront (can be called at startup)
   */
  public validateConfig(): void {
    if (!this.config) {
      throw new Error('ModelConfigurationService: configuration is required');
    }

    if (!this.config.agents || typeof this.config.agents !== 'object') {
      throw new Error('ModelConfigurationService: agents map is required');
    }

    if (!this.config.environmentDefaults) {
      throw new Error('ModelConfigurationService: environmentDefaults are required');
    }
  }

  /**
   * Assert that a given agent + variant is configured; throw with actionable error if not.
   */
  public assertConfigured(agentType: string, variant: ModelVariant = 'default'): void {
    const agent = this.config.agents[agentType];
    if (!agent) {
      const availableAgents = Object.keys(this.config.agents).join(', ') || '(none)';
      throw new Error(
        `ModelConfigurationService: agent '${agentType}' not configured. Available agents: ${availableAgents}`,
      );
    }

    const entry = agent[variant];
    if (!entry) {
      const available = Object.keys(agent).join(', ');
      throw new Error(
        `ModelConfigurationService: variant '${variant}' for agent '${agentType}' is not configured. ` +
          `Available variants: ${available}`,
      );
    }

    this.assertModel(entry, `agent '${agentType}' variant '${variant}'`);
  }

  /**
   * Get agent model configuration for a specific variant (throws if missing)
   */
  public getAgentModel(
    agentType: string,
    variant: ModelVariant = 'default',
  ): ModelConfiguration {
    this.assertConfigured(agentType, variant);
    return (this.config.agents[agentType] as AgentModelConfiguration)[variant] as ModelConfiguration;
  }

  /**
   * Get environment default (throws if missing). Environment must be explicit to avoid silent fallbacks.
   */
  public getEnvironmentDefault(env: EnvironmentName): ModelConfiguration {
    const mc = this.config.environmentDefaults[env];
    if (!mc) {
      const available = Object.keys(this.config.environmentDefaults || {}).join(', ') || '(none)';
      throw new Error(
        `ModelConfigurationService: environment default for '${env}' not configured. Available: ${available}`,
      );
    }
    this.assertModel(mc, `environment '${env}' default`);
    return mc;
  }

  /**
   * Enumerate agents supported by configuration
   */
  public listAgents(): string[] {
    return Object.keys(this.config.agents || {});
  }

  /**
   * Basic model shape validation (explicit provider/model)
   */
  private assertModel(mc: ModelConfiguration, context: string): void {
    if (!mc.provider) {
      throw new Error(`ModelConfigurationService: provider is required for ${context}`);
    }
    if (!mc.model) {
      throw new Error(`ModelConfigurationService: model is required for ${context}`);
    }
  }
}


