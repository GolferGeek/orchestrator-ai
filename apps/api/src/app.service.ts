import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AgentDiscoveryService } from './agent-discovery.service';
import { AgentFactoryService } from './agent-factory.service';
import { AgentPoolService } from './agent-pool/agent-pool.service';
import { LLMService } from '@llm/llm.service';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private discoveredAgents: any[] = [];
  private agentInstances: any[] = [];

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

      this.discoveredAgents.forEach((agent, index) => {

      });

      this.agentInstances = [];

      for (const discoveredAgent of this.discoveredAgents) {
        try {

          const serviceInstance =
            await this.agentFactory.createAgent(discoveredAgent);

          // Step 3: Register with agent pool
          await this.registerAgentWithPool(serviceInstance, discoveredAgent);

          this.agentInstances.push(serviceInstance);

        } catch (error: any) {

          // Continue with other agents
        }
      }

      // Summary log
      if (this.discoveredAgents.length > 0) {

        this.discoveredAgents.forEach((agent) => {
          const status = agent.serviceInstance ? '✅' : '❌';

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
          discoveredAgent.path,
        ),
        name: agentCard?.name || discoveredAgent.name,
        type: this.agentDiscovery.determineAgentType(discoveredAgent.path),
        path: discoveredAgent.path,
        url: this.agentDiscovery.buildAgentUrl(
          discoveredAgent.path,
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
          agentPath: discoveredAgent.path,
          servicePath: discoveredAgent.servicePath,
          functionPath: discoveredAgent.functionPath,
          pythonFunctionPath: discoveredAgent.pythonFunctionPath,
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

  async getAgentStatus(): Promise<any> {
    // Get agent cards with execution modes information
    const agentsWithDetails = await Promise.all(
      this.discoveredAgents.map(async (agent) => {
        let agentCard = null;
        let executionModes = ['immediate']; // Default execution mode

        try {
          if (
            agent.serviceInstance &&
            typeof agent.serviceInstance.getAgentCard === 'function'
          ) {
            agentCard = await agent.serviceInstance.getAgentCard();

            // Extract execution modes from agent card configuration
            if (agentCard?.configuration?.execution_modes) {
              executionModes = agentCard.configuration.execution_modes;
            }
          }
        } catch (error) {

        }

        return {
          id: this.agentDiscovery.generateAgentId(agent.name, agent.path),
          // Preserve the discovered machine-friendly name so frontend matching works
          name: agent.name,
          // Expose human-friendly display name separately when available
          displayName: agentCard?.name || agent.name,
          type: agent.type,
          description:
            agentCard?.description ||
            `${agent.name} - A specialized agent for handling specific tasks`,
          serviceClass: agent.serviceClass?.name,
          hasInstance: !!agent.serviceInstance,
          execution_modes: executionModes,
        };
      }),
    );

    return {
      status: 'running',
      discoveredAgents: this.discoveredAgents.length,
      runningInstances: this.agentInstances.length,
      agents: agentsWithDetails,
    };
  }

  /**
   * Get discovered agents (for other services to access)
   */
  getDiscoveredAgents(): any[] {
    return this.discoveredAgents;
  }

  /**
   * Get agent instances (for other services to access)
   */
  getAgentInstances(): any[] {
    return this.agentInstances;
  }
}
