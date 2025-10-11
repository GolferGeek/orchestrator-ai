import { Injectable, Logger } from '@nestjs/common';
import { IAgentRunner } from '../interfaces/agent-runner.interface';

/**
 * Registry service for agent runners.
 *
 * Maps agent types to their corresponding runner implementations.
 * This allows the router to dynamically select the appropriate runner
 * based on the agent's type.
 *
 * @example
 * ```typescript
 * const runner = this.registry.getRunner('context');
 * const result = await runner.execute(definition, request, organizationSlug);
 * ```
 */
@Injectable()
export class AgentRunnerRegistryService {
  private readonly logger = new Logger(AgentRunnerRegistryService.name);
  private readonly runners: Map<string, IAgentRunner>;

  constructor(
    // Runners will be injected as they're implemented
    // For now, registry is set up but empty
  ) {
    this.runners = new Map();
    this.logger.log('AgentRunnerRegistry initialized');
  }

  /**
   * Register a runner for a specific agent type.
   *
   * @param agentType - The agent type (e.g., 'context', 'tool', 'api')
   * @param runner - The runner instance
   */
  registerRunner(agentType: string, runner: IAgentRunner): void {
    if (this.runners.has(agentType)) {
      this.logger.warn(
        `Runner for agent type '${agentType}' is being overwritten`,
      );
    }

    this.runners.set(agentType, runner);
    this.logger.log(`Registered runner for agent type: ${agentType}`);
  }

  /**
   * Get the runner for a specific agent type.
   *
   * @param agentType - The agent type
   * @returns The runner instance, or null if not found
   */
  getRunner(agentType: string): IAgentRunner | null {
    const runner = this.runners.get(agentType);

    if (!runner) {
      this.logger.warn(`No runner found for agent type: ${agentType}`);
      return null;
    }

    return runner;
  }

  /**
   * Check if a runner is registered for an agent type.
   *
   * @param agentType - The agent type
   * @returns True if a runner is registered
   */
  hasRunner(agentType: string): boolean {
    return this.runners.has(agentType);
  }

  /**
   * Get all registered agent types.
   *
   * @returns Array of agent type strings
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.runners.keys());
  }

  /**
   * Get the count of registered runners.
   *
   * @returns Number of registered runners
   */
  getRunnerCount(): number {
    return this.runners.size;
  }
}
