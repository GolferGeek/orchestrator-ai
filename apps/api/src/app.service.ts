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
    this.logger.log(
      '🔥 AppService constructor - Services injected successfully!',
    );
    this.logger.log(`LLMService available: ${!!this.llmService}`);
    this.logger.log(`AgentFactoryService available: ${!!this.agentFactory}`);
  }

  async onModuleInit() {
    this.logger.log('🔍 Agent system starting...');

    try {
      // Step 1: Discover all agents
      this.logger.log('📁 Step 1: Discovering agents...');
      this.discoveredAgents = await this.agentDiscovery.discoverAgents();

      if (this.discoveredAgents.length === 0) {
        this.logger.warn('⚠️ No agent services discovered');
        return;
      }

      this.logger.log(`✅ Discovered ${this.discoveredAgents.length} agents`);

      // Step 2: Create agent instances using factory
      this.logger.log('🏭 Step 2: Creating agent instances...');
      this.agentInstances = [];

      for (const discoveredAgent of this.discoveredAgents) {
        try {
          this.logger.debug(`🔧 Creating agent: ${discoveredAgent.name}`);
          const serviceInstance = await this.agentFactory.createAgent(discoveredAgent);
          
          // Step 3: Register with agent pool
          await this.registerAgentWithPool(serviceInstance, discoveredAgent);
          
          this.agentInstances.push(serviceInstance);

          this.logger.log(`✅ Successfully created and registered: ${discoveredAgent.name}`);
        } catch (error: any) {
          this.logger.error(`❌ Failed to create agent ${discoveredAgent.name}:`, error.message);
          // Continue with other agents
        }
      }

      this.logger.log(`🚀 ${this.agentInstances.length} agent services are running and registered`);

      // Summary log
      if (this.discoveredAgents.length > 0) {
        this.logger.log('✅ Agent system startup complete:');
        this.discoveredAgents.forEach((agent) => {
          const status = agent.serviceInstance ? '✅' : '❌';
          this.logger.log(`   ${status} ${agent.type}: ${agent.name}`);
        });
      }

    } catch (error: any) {
      this.logger.error('❌ Failed to initialize agent system:', error.message);
      throw error;
    }
  }

  /**
   * Register agent with internal agent pool
   */
  private async registerAgentWithPool(serviceInstance: any, discoveredAgent: any): Promise<void> {
    try {
      this.logger.debug(`📝 Registering ${discoveredAgent.name} with agent pool...`);

      // Get agent card information from the service instance (includes YAML description)
      let agentCard = null;
      try {
        if (serviceInstance && typeof serviceInstance.getAgentCard === 'function') {
          agentCard = await serviceInstance.getAgentCard();
        }
      } catch (error) {
        this.logger.warn(`Failed to get agent card for ${discoveredAgent.name}:`, error);
      }

      // Build agent registration object
      const agentRegistration = {
        id: this.agentDiscovery.generateAgentId(discoveredAgent.name, discoveredAgent.path),
        name: agentCard?.name || discoveredAgent.name,
        type: this.agentDiscovery.determineAgentType(discoveredAgent.path),
        path: discoveredAgent.path,
        url: this.agentDiscovery.buildAgentUrl(discoveredAgent.path, discoveredAgent.name),
        description: agentCard?.description || `${discoveredAgent.name} - A specialized agent for handling specific tasks`,
        capabilities: agentCard?.capabilities || [], // Will be enhanced by individual agents if needed
        skills: agentCard?.skills || [], // Will be enhanced by individual agents if needed
        inputModes: agentCard?.inputModes || ['text/plain', 'application/json'],
        outputModes: agentCard?.outputModes || ['text/plain', 'application/json'],
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

      this.logger.debug(`✅ Successfully registered ${discoveredAgent.name} with agent pool`);

    } catch (error: any) {
      this.logger.error(`❌ Failed to register ${discoveredAgent.name} with agent pool:`, error.message);
      throw error;
    }
  }

  getHello(): string {
    return 'NestJS A2A Agent Framework - Ready!';
  }

  getAgentStatus(): any {
    return {
      status: 'running',
      discoveredAgents: this.discoveredAgents.length,
      runningInstances: this.agentInstances.length,
      agents: this.discoveredAgents.map((agent) => ({
        name: agent.name,
        type: agent.type,
        serviceClass: agent.serviceClass?.name,
        hasInstance: !!agent.serviceInstance,
      })),
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
