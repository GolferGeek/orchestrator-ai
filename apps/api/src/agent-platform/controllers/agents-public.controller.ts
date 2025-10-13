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

    // Group agents by namespace
    for (const agent of agents) {
      const namespace = agent.organization_slug ?? 'global';
      if (!byNamespace.has(namespace)) {
        byNamespace.set(namespace, []);
      }
      byNamespace.get(namespace)!.push(agent);
    }

    const roots: any[] = [];

    // Build hierarchy for each namespace
    byNamespace.forEach((namespaceAgents, namespace) => {
      const agentMap = new Map<string, any>();

      // Create nodes for all agents
      for (const agent of namespaceAgents) {
        const node = {
          id: agent.id,
          name: agent.slug,
          displayName: agent.display_name,
          type: agent.agent_type,
          description: agent.description,
          status: agent.status,
          namespace: agent.organization_slug ?? 'global',
          metadata: {
            execution_profile: agent.config?.execution_profile,
            execution_capabilities: agent.config?.execution_capabilities,
          },
          children: [],
        };
        agentMap.set(agent.slug, node);
      }

      // Build parent-child relationships based on hierarchy.reportsTo or reports_to
      const topLevelNodes: any[] = [];
      
      for (const agent of namespaceAgents) {
        const node = agentMap.get(agent.slug);
        if (!node) continue;

        // Check both camelCase and snake_case
        const reportsTo = agent.config?.hierarchy?.reportsTo || agent.config?.hierarchy?.reports_to;
        
        if (reportsTo && agentMap.has(reportsTo)) {
          // This agent reports to another agent - add as child
          const parent = agentMap.get(reportsTo);
          if (parent && parent !== node) {
            parent.children.push(node);
          } else {
            // Parent not found or circular reference - add as top level
            topLevelNodes.push(node);
          }
        } else {
          // No reportsTo or parent not in this namespace - top level node
          topLevelNodes.push(node);
        }
      }

      // Add all top-level nodes as roots
      roots.push(...topLevelNodes);
    });

    return roots;
  }
}
