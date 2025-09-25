import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AgentDiscoveryService } from './agent-discovery.service';
import { AgentFactoryService } from './agent-factory.service';
import { AgentPoolService } from './agent-pool/agent-pool.service';
import { LLMService } from '@llm/llm.service';
import {
  DEFAULT_EXECUTION_CAPABILITIES,
  DEFAULT_EXECUTION_PROFILE,
} from './common/types/agent-execution.types';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private discoveredAgents: any[] = [];
  private agentInstances: any[] = [];
  private agentRecords: Array<{ agent: any; instance: any | null }> = [];

  constructor(
    private readonly agentDiscovery: AgentDiscoveryService,
    private readonly agentFactory: AgentFactoryService,
    private readonly agentPoolService: AgentPoolService,
    private readonly llmService: LLMService,
  ) {

  }

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
          const status = instance ? '✅' : '❌';

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
      } catch (error) {

      }

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
        } catch (error) {

        }

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

    return {
      status: 'running',
      discoveredAgents: filteredRecords.length,
      runningInstances: filteredRecords.filter((record) => !!record.instance).length,
      agents: agentsWithDetails,
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
}
