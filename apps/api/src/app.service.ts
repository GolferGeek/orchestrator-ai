import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AgentDiscoveryService } from './agent-discovery.service';
import { AgentFactoryService } from './agent-factory.service';
import { AgentPoolService } from './agent-pool/agent-pool.service';
import { LLMService } from '@llm/llm.service';
import { AgentRegistryService } from './agent-platform/services/agent-registry.service';
import { AgentRecord } from './agent-platform/interfaces/agent-record.interface';
import {
  DEFAULT_EXECUTION_CAPABILITIES,
  DEFAULT_EXECUTION_PROFILE,
} from './common/types/agent-execution.types';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private discoveredAgents: any[] = [];
  private agentInstances: any[] = [];
  private agentRecords: Array<{ agent: any; instance: any }> = [];

  constructor(
    private readonly agentDiscovery: AgentDiscoveryService,
    private readonly agentFactory: AgentFactoryService,
    private readonly agentPoolService: AgentPoolService,
    private readonly llmService: LLMService,
    private readonly agentRegistry: AgentRegistryService,
  ) {}

  async onModuleInit() {
    try {
      // Step 1: Discover all agents

      this.discoveredAgents = await this.agentDiscovery.discoverAgents();

      if (this.discoveredAgents.length === 0) {
        return;
      }

      // Step 2: Create agent instances using factory

      this.agentRecords = [];
      this.agentInstances = [];

      for (const discoveredAgent of this.discoveredAgents) {
        try {
          const serviceInstance =
            await this.agentFactory.createAgent(discoveredAgent);

          discoveredAgent.serviceInstance = serviceInstance;

          this.agentRecords.push({
            agent: discoveredAgent,
            instance: serviceInstance,
          });

          // Step 3: Register with agent pool
          await this.registerAgentWithPool(serviceInstance, discoveredAgent);

          this.agentInstances.push(serviceInstance);
        } catch (error: any) {
          this.agentRecords.push({
            agent: discoveredAgent,
            instance: null,
          });

          // Continue with other agents
          this.agentInstances.push(null);
        }
      }

      // Summary log
      if (this.discoveredAgents.length > 0) {
        this.agentRecords.forEach(({ agent, instance }) => {
          const _status = instance ? '✅' : '❌';
        });
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Register agent with internal agent pool
   */
  private async registerAgentWithPool(
    serviceInstance: any,
    discoveredAgent: any,
  ): Promise<void> {
    try {
      // Get agent card information from the service instance (includes YAML description)
      let agentCard = null;
      try {
        if (
          serviceInstance &&
          typeof serviceInstance.getAgentCard === 'function'
        ) {
          agentCard = await serviceInstance.getAgentCard();
        }
      } catch (_error) {}

      // Build agent registration object
      const agentRegistration = {
        id: this.agentDiscovery.generateAgentId(
          discoveredAgent.name,
          discoveredAgent.namespacedPath || discoveredAgent.path,
        ),
        name: agentCard?.name || discoveredAgent.name,
        type: this.agentDiscovery.determineAgentType(
          discoveredAgent.namespacedPath || discoveredAgent.path,
        ),
        path: discoveredAgent.namespacedPath || discoveredAgent.path,
        url: this.agentDiscovery.buildAgentUrl(
          discoveredAgent.namespacedPath || discoveredAgent.path,
          discoveredAgent.name,
        ),
        description:
          agentCard?.description ||
          `${discoveredAgent.name} - A specialized agent for handling specific tasks`,
        capabilities: agentCard?.capabilities || [], // Will be enhanced by individual agents if needed
        skills: agentCard?.skills || [], // Will be enhanced by individual agents if needed
        inputModes: agentCard?.inputModes || ['text/plain', 'application/json'],
        outputModes: agentCard?.outputModes || [
          'text/plain',
          'application/json',
        ],
        metadata: {
          version: '1.0.0',
          agentPath: discoveredAgent.namespacedPath || discoveredAgent.path,
          servicePath: discoveredAgent.servicePath,
          functionPath: discoveredAgent.functionPath,
          pythonFunctionPath: discoveredAgent.pythonFunctionPath,
          namespace: discoveredAgent.namespace,
        },
        status: 'online' as const,
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
      };

      // Register with internal agent pool
      await this.agentPoolService.registerAgent(agentRegistration);
    } catch (error: any) {
      throw error;
    }
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
        } catch (_error) {}

        return {
          id: this.agentDiscovery.generateAgentId(
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
        `${agent.namespace ?? 'global'}::${agent.name}`,
      ),
    );

    const mergedAgents = [...agentsWithDetails];
    for (const agent of databaseAgentStatuses) {
      const key = `${agent.namespace ?? 'global'}::${agent.name}`;
      if (existingKeys.has(key)) {
        const index = mergedAgents.findIndex(
          (existing) =>
            (existing.namespace ?? 'global') ===
              (agent.namespace ?? 'global') && existing.name === agent.name,
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
    const runningInstances = mergedAgents.filter((agent) => agent.hasInstance)
      .length;

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
    const supportedModesRaw = Array.isArray(record.config?.supported_modes)
      ? (record.config!.supported_modes as string[])
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
    };

    return {
      id: record.id,
      name: record.slug,
      displayName: record.display_name,
      type: record.agent_type,
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

  private deriveExecutionProfile(
    modeProfile: string | null,
  ): 'conversation_only' | 'autonomous_build' | 'human_gate' | 'conversation_with_gate' {
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
}
