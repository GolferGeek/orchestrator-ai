import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LLMService } from '@llm/llm.service';
import { AgentRegistryService } from './agent-platform/services/agent-registry.service';
import { AgentRecord } from './agent-platform/interfaces/agent.interface';
import {
  DEFAULT_EXECUTION_CAPABILITIES,
  DEFAULT_EXECUTION_PROFILE,
} from './agent-platform/types/agent-execution.types';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private discoveredAgents: any[] = [];
  private agentInstances: any[] = [];
  private agentRecords: Array<{ agent: any; instance: any }> = [];

  constructor(
    private readonly llmService: LLMService,
    private readonly agentRegistry: AgentRegistryService,
  ) {}

  async onModuleInit() {
    // Legacy file-based agent discovery removed
    // Now using agent-platform for all agent execution
    this.discoveredAgents = [];
    this.agentRecords = [];
    this.agentInstances = [];
  }

  getHello(): string {
    return 'NestJS A2A Agent Framework - Ready!';
  }

  async getAgentStatus(namespaces?: string[]): Promise<any> {
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
          if (instance && typeof instance.getAgentCard === 'function') {
            agentCard = await instance.getAgentCard();

            if (agentCard?.configuration?.execution_modes) {
              executionModes = agentCard.configuration.execution_modes;
            }

            if (agentCard?.execution?.profile) {
              executionProfile = agentCard.execution.profile;
            }

            if (agentCard?.execution?.capabilities) {
              executionCapabilities = {
                ...executionCapabilities,
                ...agentCard.execution.capabilities,
              };
            }
          }
        } catch {
          // Swallow agent-card errors; continue building status
        }

        return {
          id: this.generateAgentId(
            agent.name,
            agent.namespacedPath || agent.path,
          ),
          name: agent.name,
          displayName: agentCard?.name || agent.name,
          type: agent.type,
          namespace: agent.namespace,
          description:
            agentCard?.description ||
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
  getDiscoveredAgents(): any[] {
    return this.discoveredAgents;
  }

  getDiscoveredAgentsByNamespaces(namespaces?: string[]): any[] {
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
  getAgentInstances(): any[] {
    return this.agentInstances;
  }

  getAgentInstancesByNamespaces(namespaces?: string[]): any[] {
    if (!namespaces || namespaces.length === 0) {
      return this.agentInstances;
    }

    const allowed = new Set(namespaces);
    const filtered: any[] = [];

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

    const supportedModesRaw = Array.isArray(record.config?.supported_modes)
      ? (record.config.supported_modes as string[])
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
    };

    return {
      id: record.id,
      name: record.slug,
      displayName: record.display_name,
      type: isTool ? 'tool' : record.agent_type,
      namespace: record.organization_slug ?? null,
      description: record.description ?? record.display_name,
      serviceClass: null,
      hasInstance: true,
      execution_modes: ['immediate'],
      execution_profile: this.deriveExecutionProfile(record.mode_profile),
      execution_capabilities: executionCapabilities,
      metadata,
      status: record.status ?? 'active',
      registeredAt: new Date(record.created_at),
      lastHeartbeat: new Date(record.updated_at),
    };
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
