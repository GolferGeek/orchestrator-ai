import { Controller, Get, Logger } from '@nestjs/common';
import { AgentDiscoveryService } from '../agent-discovery.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('hierarchy')
export class HierarchyController {
  private readonly logger = new Logger(HierarchyController.name);

  constructor(private readonly agentDiscovery: AgentDiscoveryService) {}

  /**
   * Test endpoint
   * Route: GET /hierarchy/test
   */
  @Get('test')
  @Public()
  async testHierarchy() {
    return {
      message: 'Hierarchy controller working',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get agent hierarchy
   * Route: GET /hierarchy/agents
   */
  @Get('agents')
  @Public()
  async getAgentHierarchy() {

    try {
      // Ensure agents are discovered and hierarchy is built
      await this.agentDiscovery.discoverAgents();

      const hierarchy = this.agentDiscovery.getAgentHierarchy();

      return {
        success: true,
        data: hierarchy,
        metadata: {
          totalAgents: this.agentDiscovery.getDiscoveredAgents().length,
          rootNodes: hierarchy.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        metadata: {
          totalAgents: 0,
          rootNodes: 0,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
