import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AgentDiscoveryService } from './agent-discovery.service';
import { LLMService } from '@/llms/llm.service';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly agentDiscovery: AgentDiscoveryService, private readonly llmService: LLMService) {
    this.logger.log('🔥 AppService constructor - LLMService injected successfully!');
    this.logger.log(`LLMService available: ${!!this.llmService}`);
  }

  async onModuleInit() {
    this.logger.log('🔍 Agent system starting...');
    
    // Discover and instantiate all agents
    const discoveredAgents = await this.agentDiscovery.discoverAndInstantiateAgents();
    const agentInstances = this.agentDiscovery.getAgentInstances();
    
    if (discoveredAgents.length > 0) {
      this.logger.log(`✅ Discovered and instantiated ${discoveredAgents.length} agents:`);
      discoveredAgents.forEach(agent => {
        this.logger.log(`   • ${agent.type}: ${agent.name} (${agent.serviceClass?.name || 'Unknown'})`);
      });
      this.logger.log(`🚀 ${agentInstances.length} agent services are running and auto-registered`);
    } else {
      this.logger.warn('⚠️ No agent services discovered');
    }
  }

  getHello(): string {
    return 'NestJS A2A Agent Framework - Ready!';
  }

  getAgentStatus(): any {
    const discoveredAgents = this.agentDiscovery.getDiscoveredAgents();
    const agentInstances = this.agentDiscovery.getAgentInstances();
    
    return {
      status: 'running',
      discoveredAgents: discoveredAgents.length,
      runningInstances: agentInstances.length,
      agents: discoveredAgents.map(agent => ({
        name: agent.name,
        type: agent.type,
        serviceClass: agent.serviceClass?.name
      }))
    };
  }
}
