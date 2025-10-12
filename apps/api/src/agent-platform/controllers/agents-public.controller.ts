import { Controller, Get, Headers } from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { AgentRegistryService } from '../services/agent-registry.service';

@Controller('agents')
export class AgentsPublicController {
  constructor(private readonly agentRegistry: AgentRegistryService) {}

  /**
   * Frontend compatibility endpoint for agent hierarchy
   * Route: GET /agents/.well-known/hierarchy
   */
  @Get('.well-known/hierarchy')
  @Public()
  async getAgentHierarchy(
    @Headers('x-agent-namespace') namespaceHeader?: string,
  ) {
    const namespaces = namespaceHeader
      ? namespaceHeader
          .split(',')
          .map((ns) => ns.trim())
          .filter(Boolean)
      : undefined;

    try {
      // Get agents from database registry
      const agents = namespaces?.length
        ? await this.agentRegistry.listAgentsForNamespaces(
            namespaces.map((ns) => (ns === 'global' ? null : ns)),
          )
        : await this.agentRegistry.listAllAgents();

      // Build hierarchy from flat agent list grouped by namespace
      const hierarchy = this.buildHierarchyFromAgents(agents);
      const totalAgents = agents.length;

      return {
        success: true,
        data: hierarchy,
        metadata: {
          totalAgents,
          rootNodes: hierarchy.length,
          namespaces: namespaces ?? 'all',
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
          namespaces: namespaces ?? 'all',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private buildHierarchyFromAgents(agents: any[]): any[] {
    const byNamespace = new Map<string, any[]>();

    for (const agent of agents) {
      const namespace = agent.organization_slug ?? 'global';
      if (!byNamespace.has(namespace)) {
        byNamespace.set(namespace, []);
      }
      byNamespace.get(namespace)!.push({
        id: agent.id,
        name: agent.slug,
        displayName: agent.display_name,
        type: agent.agent_type,
        description: agent.description,
        status: agent.status,
      });
    }

    return Array.from(byNamespace.entries()).map(([namespace, agentList]) => ({
      namespace,
      agents: agentList,
    }));
  }
}
