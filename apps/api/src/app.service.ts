import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LLMService } from '@llm/llm.service';
import { AgentRegistryService } from './agent-platform/services/agent-registry.service';
import { AgentRecord } from './agent-platform/interfaces/agent.interface';
import {
  DEFAULT_EXECUTION_CAPABILITIES,
  DEFAULT_EXECUTION_PROFILE,
  AgentExecutionProfile,
} from './agent-platform/types/agent-execution.types';
import { load as yamlLoad } from 'js-yaml';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private discoveredAgents: Array<{
    name: string;
    namespace: string;
    type?: string;
    path?: string;
    namespacedPath?: string;
    metadata?: unknown;
  }> = [];
  private agentInstances: unknown[] = [];
  private agentRecords: Array<{
    agent: {
      name: string;
      namespace?: string;
      type?: string;
      path?: string;
      namespacedPath?: string;
      serviceClass?: { name: string };
      metadata?: unknown;
    };
    instance: unknown;
  }> = [];

  constructor(
    private readonly llmService: LLMService,
    private readonly agentRegistry: AgentRegistryService,
  ) {}

  onModuleInit() {
    // Legacy file-based agent discovery removed
    // Now using agent-platform for all agent execution
    this.discoveredAgents = [];
    this.agentRecords = [];
    this.agentInstances = [];
  }

  getHello(): string {
    return 'NestJS A2A Agent Framework - Ready!';
  }

  async getAgentStatus(namespaces?: string[]): Promise<unknown> {
    const filteredRecords = namespaces?.length
      ? this.agentRecords.filter((record) =>
          record.agent?.namespace
            ? namespaces.includes(record.agent.namespace)
            : true,
        )
      : this.agentRecords;

    const agentsWithDetails = await Promise.all(
      filteredRecords.map(async ({ agent, instance }) => {
        let agentCard = null;
        let executionModes = ['immediate'];
        let executionProfile = DEFAULT_EXECUTION_PROFILE;
        let executionCapabilities = { ...DEFAULT_EXECUTION_CAPABILITIES };

        try {
          if (
            instance &&
            typeof (instance as Record<string, unknown>).getAgentCard ===
              'function'
          ) {
            const cardRaw: unknown = await (
              instance as { getAgentCard: () => Promise<unknown> }
            ).getAgentCard();
            agentCard = cardRaw as Record<string, unknown>;

            const config = agentCard?.configuration as
              | Record<string, unknown>
              | undefined;
            if (config?.execution_modes) {
              const modes: unknown = config.execution_modes;
              if (Array.isArray(modes)) {
                executionModes = modes as string[];
              }
            }

            const execution = agentCard?.execution as
              | Record<string, unknown>
              | undefined;
            if (execution?.profile) {
              const profile: unknown = execution.profile;
              if (typeof profile === 'string') {
                executionProfile = profile as AgentExecutionProfile;
              }
            }

            if (execution?.capabilities) {
              const capabilities: unknown = execution.capabilities;
              if (
                capabilities &&
                typeof capabilities === 'object' &&
                !Array.isArray(capabilities)
              ) {
                executionCapabilities = {
                  ...executionCapabilities,
                  ...(capabilities as Record<string, unknown>),
                };
              }
            }
          }
        } catch {
          // Swallow agent-card errors; continue building status
        }

        const displayNameRaw: unknown = agentCard?.name;
        const descriptionRaw: unknown = agentCard?.description;

        return {
          id: this.generateAgentId(
            agent.name,
            agent.namespacedPath || agent.path || '',
          ),
          name: agent.name,
          displayName: displayNameRaw || agent.name,
          type: agent.type,
          namespace: agent.namespace ?? undefined,
          description:
            descriptionRaw ||
            `${agent.name} - A specialized agent for handling specific tasks`,
          serviceClass: agent.serviceClass?.name,
          hasInstance: !!instance,
          execution_modes: executionModes,
          execution_profile: executionProfile,
          execution_capabilities: executionCapabilities,
          metadata: agent.metadata,
        };
      }),
    );

    const databaseAgents = await this.loadDatabaseAgents(namespaces);
    const databaseAgentStatuses = databaseAgents.map((record) =>
      this.mapDatabaseAgent(record),
    );

    const existingKeys = new Set(
      agentsWithDetails.map((agent) =>
        this.normalizeAgentIdentifier(agent.namespace ?? null, agent.name),
      ),
    );

    const mergedAgents = [...agentsWithDetails];
    for (const agent of databaseAgentStatuses) {
      const key = this.normalizeAgentIdentifier(
        agent.namespace ?? null,
        agent.name,
      );
      if (existingKeys.has(key)) {
        const index = mergedAgents.findIndex(
          (existing) =>
            this.normalizeAgentIdentifier(
              existing.namespace ?? null,
              existing.name,
            ) === key,
        );
        if (index >= 0) {
          mergedAgents[index] = agent;
        }
        continue;
      }

      mergedAgents.push(agent);
      existingKeys.add(key);
    }

    const totalDiscovered = mergedAgents.length;
    const runningInstances = mergedAgents.filter(
      (agent) => agent.hasInstance,
    ).length;

    return {
      status: 'running',
      discoveredAgents: totalDiscovered,
      runningInstances,
      agents: mergedAgents,
    };
  }

  /**
   * Get discovered agents (for other services to access)
   */
  getDiscoveredAgents(): Array<{
    name: string;
    namespace: string;
    type?: string;
    path?: string;
    namespacedPath?: string;
    metadata?: unknown;
  }> {
    return this.discoveredAgents;
  }

  getDiscoveredAgentsByNamespaces(namespaces?: string[]): Array<{
    name: string;
    namespace: string;
    type?: string;
    path?: string;
    namespacedPath?: string;
    metadata?: unknown;
  }> {
    if (!namespaces || namespaces.length === 0) {
      return this.discoveredAgents;
    }

    const allowed = new Set(namespaces);
    return this.discoveredAgents.filter((agent) =>
      allowed.has(agent.namespace),
    );
  }

  /**
   * Get agent instances (for other services to access)
   */
  getAgentInstances(): unknown[] {
    return this.agentInstances;
  }

  getAgentInstancesByNamespaces(namespaces?: string[]): unknown[] {
    if (!namespaces || namespaces.length === 0) {
      return this.agentInstances;
    }

    const allowed = new Set(namespaces);
    const filtered: unknown[] = [];

    this.discoveredAgents.forEach((agent, index) => {
      if (allowed.has(agent.namespace)) {
        filtered.push(this.agentInstances[index] || null);
      }
    });

    return filtered;
  }

  private async loadDatabaseAgents(
    namespaces?: string[],
  ): Promise<AgentRecord[]> {
    if (namespaces && namespaces.length > 0) {
      const normalized = namespaces
        .map((ns) => (ns && ns.trim().length ? ns.trim() : null))
        .map((ns) => (ns === 'global' ? null : ns));
      return this.agentRegistry.listAgentsForNamespaces(normalized);
    }

    return this.agentRegistry.listAllAgents();
  }

  private mapDatabaseAgent(record: AgentRecord) {
    const agentCategory = record.config?.agent_category as string | undefined;
    const isTool = agentCategory === 'tool';

    const supportedModesRaw = Array.isArray(record.context?.supported_modes)
      ? (record.context.supported_modes as string[])
      : [];

    const supportedModes = supportedModesRaw.length
      ? supportedModesRaw
      : record.agent_type === 'orchestrator'
        ? ['converse', 'plan', 'build']
        : ['converse', 'build'];

    const executionCapabilities = {
      can_converse: supportedModes.includes('converse'),
      can_plan: supportedModes.includes('plan'),
      can_build: supportedModes.includes('build'),
      requires_human_gate:
        record.config?.requires_human_gate === true ||
        record.config?.human_gate === true,
    };

    const executionModes = this.extractExecutionModes(record);

    const metadata = {
      organization_slug: record.organization_slug,
      source: 'database',
      agent_type: record.agent_type,
      mode_profile: record.mode_profile,
      version: record.version,
      status: record.status,
      config: record.config,
      context: record.context,
      agent_category: agentCategory,
      execution_modes: executionModes,
    };

    return {
      id: record.id,
      name: record.slug,
      displayName: record.display_name,
      type: isTool ? 'tool' : record.agent_type,
      namespace: record.organization_slug ?? undefined,
      description: record.description ?? record.display_name,
      serviceClass: undefined,
      hasInstance: true,
      execution_modes: executionModes,
      execution_profile: this.deriveExecutionProfile(record.mode_profile),
      execution_capabilities: executionCapabilities,
      metadata,
      status: record.status ?? 'active',
      registeredAt: new Date(record.created_at),
      lastHeartbeat: new Date(record.updated_at),
    };
  }

  private extractExecutionModes(record: AgentRecord): string[] {
    const modes = new Set<string>();

    const config = record.config as
      | (Record<string, unknown> & {
          execution_modes?: unknown;
          executionModes?: unknown;
        })
      | null
      | undefined;

    const configModes = config?.execution_modes ?? config?.executionModes;
    if (Array.isArray(configModes)) {
      for (const mode of configModes) {
        if (typeof mode === 'string' && mode.trim().length > 0) {
          modes.add(mode);
        }
      }
    }

    if (record.yaml) {
      try {
        const parsed = yamlLoad(record.yaml) as Record<string, unknown>;
        const configuration = parsed?.configuration as
          | (Record<string, unknown> & {
              execution_modes?: unknown;
              executionModes?: unknown;
            })
          | undefined;

        const yamlModes =
          configuration?.execution_modes ?? configuration?.executionModes;

        if (Array.isArray(yamlModes)) {
          for (const mode of yamlModes) {
            if (typeof mode === 'string' && mode.trim().length > 0) {
              modes.add(mode);
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to parse YAML for agent ${record.slug}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    if (modes.size === 0) {
      modes.add('immediate');
    }

    return Array.from(modes);
  }

  private normalizeAgentIdentifier(
    namespace: string | null,
    name: string,
  ): string {
    const normalizedNamespace = namespace?.trim().length
      ? namespace.trim().toLowerCase()
      : 'global';
    const normalizedName = (name ?? '').toLowerCase().replace(/[\s_-]+/g, '_');
    return `${normalizedNamespace}::${normalizedName}`;
  }

  private deriveExecutionProfile(
    modeProfile: string | null,
  ):
    | 'conversation_only'
    | 'autonomous_build'
    | 'human_gate'
    | 'conversation_with_gate' {
    if (!modeProfile) {
      return 'conversation_only';
    }

    if (modeProfile.includes('orchestrator')) {
      return 'autonomous_build';
    }

    if (modeProfile.includes('human')) {
      return 'human_gate';
    }

    return 'conversation_only';
  }

  private generateAgentId(name: string, path: string): string {
    const normalizedName = (name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');
    const normalizedPath = (path ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');
    return `${normalizedPath}_${normalizedName}`;
  }
}
