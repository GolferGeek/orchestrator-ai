import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  AgentRegistration,
  AgentHeartbeat,
  AgentCapabilitiesDocument,
} from './interfaces';

@Injectable()
export class AgentPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(AgentPoolService.name);
  private readonly agents = new Map<string, AgentRegistration>();
  private readonly heartbeatInterval = 60000; // 60 seconds
  private readonly heartbeatTimeout = 180000; // 180 seconds (3 missed heartbeats = offline)

  constructor() {}

  /**
   * Register an agent with the pool
   */
  async registerAgent(registration: AgentRegistration): Promise<void> {
    const agentId = registration.id;

    // Add/update agent registration
    this.agents.set(agentId, {
      ...registration,
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
      status: 'online',
    });
  }

  /**
   * Receive heartbeat from an agent
   */
  async receiveHeartbeat(heartbeat: AgentHeartbeat): Promise<void> {
    const agent = this.agents.get(heartbeat.agentId);

    if (!agent) {
      return;
    }

    // Update heartbeat timestamp and status
    agent.lastHeartbeat = new Date();
    agent.status = 'online';
    agent.metrics = heartbeat.metrics;
  }

  /**
   * Unregister an agent from the pool
   */
  async unregisterAgent(agentId: string): Promise<void> {
    if (this.agents.has(agentId)) {
      this.agents.delete(agentId);
    }
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get online agents only
   */
  getOnlineAgents(): AgentRegistration[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.status === 'online',
    );
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentRegistration | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agents by type (orchestrator, specialist, manager, external)
   */
  getAgentsByType(type: string): AgentRegistration[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.type === type,
    );
  }

  /**
   * Generate comprehensive capabilities document for the orchestrator
   */
  generateCapabilitiesDocument(): AgentCapabilitiesDocument {
    const onlineAgents = this.getOnlineAgents();

    const capabilitiesDoc: AgentCapabilitiesDocument = {
      generatedAt: new Date(),
      totalAgents: onlineAgents.length,
      agentsByType: {
        orchestrator: onlineAgents.filter((a) => a.type === 'orchestrator')
          .length,
        specialist: onlineAgents.filter((a) => a.type === 'specialist').length,
        marketing: onlineAgents.filter((a) => a.type === 'marketing').length,
        sales: onlineAgents.filter((a) => a.type === 'sales').length,
        hr: onlineAgents.filter((a) => a.type === 'hr').length,
        operations: onlineAgents.filter((a) => a.type === 'operations').length,
        finance: onlineAgents.filter((a) => a.type === 'finance').length,
        engineering: onlineAgents.filter((a) => a.type === 'engineering')
          .length,
        research: onlineAgents.filter((a) => a.type === 'research').length,
        product: onlineAgents.filter((a) => a.type === 'product').length,
        legal: onlineAgents.filter((a) => a.type === 'legal').length,
      },
      agents: onlineAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        path: agent.path,
        url: agent.url,
        description: agent.description,
        capabilities: agent.capabilities,
        skills: agent.skills,
        inputModes: agent.inputModes,
        outputModes: agent.outputModes,
        status: agent.status,
        lastHeartbeat: agent.lastHeartbeat,
        metadata: agent.metadata,
      })),
    };

    return capabilitiesDoc;
  }

  /**
   * Get orchestrator-friendly agent list for LLM prompts
   */
  getOrchestrationAgentList(): string {
    const specialists = this.getAgentsByType('specialist').filter(
      (a) => a.status === 'online',
    );
    const managers = this.getAgentsByType('manager').filter(
      (a) => a.status === 'online',
    );
    const externals = this.getAgentsByType('external').filter(
      (a) => a.status === 'online',
    );

    const agentDescriptions: string[] = [];

    // Add specialists
    if (specialists.length > 0) {
      agentDescriptions.push('**Specialist Agents:**');
      specialists.forEach((agent) => {
        agentDescriptions.push(
          `- **${agent.name}** (${agent.path}): ${agent.description}`,
        );
        if (agent.skills && agent.skills.length > 0) {
          agentDescriptions.push(
            `  Skills: ${agent.skills.map((s: any) => s.name).join(', ')}`,
          );
        }
      });
      agentDescriptions.push('');
    }

    // Add managers
    if (managers.length > 0) {
      agentDescriptions.push('**Manager Agents:**');
      managers.forEach((agent) => {
        agentDescriptions.push(
          `- **${agent.name}** (${agent.path}): ${agent.description}`,
        );
      });
      agentDescriptions.push('');
    }

    // Add externals
    if (externals.length > 0) {
      agentDescriptions.push('**External Agents:**');
      externals.forEach((agent) => {
        agentDescriptions.push(
          `- **${agent.name}** (${agent.path}): ${agent.description}`,
        );
      });
    }

    return agentDescriptions.join('\n');
  }

  /**
   * Check for stale agents and mark them offline
   */
  @Interval(60000) // Check every minute
  private checkAgentHealth(): void {
    const now = new Date();
    const staleAgents: string[] = [];

    for (const [agentId, agent] of this.agents.entries()) {
      if (!agent.lastHeartbeat) {
        continue; // Skip agents without heartbeat data
      }

      const timeSinceLastHeartbeat =
        now.getTime() - agent.lastHeartbeat.getTime();

      if (
        timeSinceLastHeartbeat > this.heartbeatTimeout &&
        agent.status === 'online'
      ) {
        agent.status = 'offline';
        staleAgents.push(agentId);
      }
    }

    if (staleAgents.length > 0) {
      // TODO: Implement cleanup for stale agents
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    const agents = Array.from(this.agents.values());
    return {
      total: agents.length,
      online: agents.filter((a) => a.status === 'online').length,
      offline: agents.filter((a) => a.status === 'offline').length,
      byType: {
        orchestrator: agents.filter((a) => a.type === 'orchestrator').length,
        specialist: agents.filter((a) => a.type === 'specialist').length,
        marketing: agents.filter((a) => a.type === 'marketing').length,
        sales: agents.filter((a) => a.type === 'sales').length,
        hr: agents.filter((a) => a.type === 'hr').length,
        operations: agents.filter((a) => a.type === 'operations').length,
        finance: agents.filter((a) => a.type === 'finance').length,
        engineering: agents.filter((a) => a.type === 'engineering').length,
        research: agents.filter((a) => a.type === 'research').length,
        product: agents.filter((a) => a.type === 'product').length,
        legal: agents.filter((a) => a.type === 'legal').length,
      },
    };
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    this.agents.clear();
  }
}
