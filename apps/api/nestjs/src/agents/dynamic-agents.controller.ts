import { Controller, Post, Get, Body, Param, Logger, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';
import { AgentDiscoveryService } from '../agent-discovery.service';

@Controller('agents')
export class DynamicAgentsController {
  private readonly logger = new Logger(DynamicAgentsController.name);

  constructor(private readonly agentDiscovery: AgentDiscoveryService) {}

  /**
   * Handle tasks for any discovered agent
   * Route: POST /agents/:agentType/:agentName/tasks
   */
  @Post(':agentType/:agentName/tasks')
  @HttpCode(HttpStatus.OK)
  async handleTasks(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string,
    @Body() taskRequest: any
  ) {
    this.logger.debug(`Processing task for ${agentType}/${agentName}`);
    
    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Process the task using the agent's processTask method
    return agentInstance.processTask(taskRequest);
  }

  /**
   * Get agent card for any discovered agent
   * Route: GET /agents/:agentType/:agentName/.well-known/agent.json
   */
  @Get(':agentType/:agentName/.well-known/agent.json')
  async getAgentCard(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string
  ) {
    this.logger.debug(`Getting agent card for ${agentType}/${agentName}`);
    
    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Get the agent card
    return agentInstance.getAgentCard();
  }

  /**
   * Health check for any discovered agent
   * Route: GET /agents/:agentType/:agentName/health
   */
  @Get(':agentType/:agentName/health')
  async getAgentHealth(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string
  ) {
    this.logger.debug(`Getting health status for ${agentType}/${agentName}`);
    
    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Get the health status if available
    if (agentInstance.getHealthStatus) {
      return agentInstance.getHealthStatus();
    }
    
    return { status: 'healthy', message: 'Agent is running' };
  }

  /**
   * Find an agent instance by type and name
   */
  private findAgentInstance(agentType: string, agentName: string): any {
    const discoveredAgents = this.agentDiscovery.getDiscoveredAgents();
    
    // Match the agent by type and name logic
    const agent = discoveredAgents.find(a => {
      const expectedName = this.normalizeAgentName(a.name);
      const providedName = this.normalizeAgentName(agentName);
      return a.type === agentType && expectedName === providedName;
    });
    
    return agent?.serviceInstance;
  }

  /**
   * Normalize agent name for comparison (handle underscores, spaces, etc.)
   */
  private normalizeAgentName(name: string): string {
    return name.toLowerCase().replace(/[\\s_-]+/g, '_');
  }
} 