import { Controller, Get, Headers } from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { AgentRegistryService } from '../services/agent-registry.service';
import { load as yamlLoad } from 'js-yaml';
import type { AgentRecord } from '../interfaces/agent.interface';

interface HierarchyNode {
  id: string;
  name: string;
  displayName: string;
  type: string;
  description: string | null;
  status: string | null;
  namespace: string;
  execution_modes?: string[];
  metadata: {
    execution_profile?: unknown;
    execution_capabilities?: unknown;
    execution_modes?: string[];
  };
  children: HierarchyNode[];
}

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

  private buildHierarchyFromAgents(agents: AgentRecord[]): HierarchyNode[] {
    const byNamespace = new Map<string, AgentRecord[]>();

    // Group agents by namespace
    for (const agent of agents) {
      const namespace = agent.organization_slug ?? 'global';
      if (!byNamespace.has(namespace)) {
        byNamespace.set(namespace, []);
      }
      byNamespace.get(namespace)!.push(agent);
    }

    const roots: HierarchyNode[] = [];

    // Build hierarchy for each namespace
    byNamespace.forEach((namespaceAgents, _namespace) => {
      const agentMap = new Map<string, HierarchyNode>();

      // Create nodes for all agents
      for (const agent of namespaceAgents) {
        // Extract execution_modes from YAML configuration
        let executionModes: string[] = ['immediate'];
        if (agent.yaml) {
          try {
            const yamlConfig = JSON.parse(agent.yaml);
            const configExecutionModes =
              yamlConfig?.configuration?.execution_modes;
            if (Array.isArray(configExecutionModes)) {
              executionModes = configExecutionModes.filter(
                (mode): mode is string => typeof mode === 'string',
              );
            }
          } catch (error) {
            // If YAML parsing fails, fall back to default
          }
        }

        const node: HierarchyNode = {
          id: agent.id,
          name: agent.slug,
          displayName: agent.display_name,
          type: agent.agent_type,
          description: agent.description,
          status: agent.status,
          namespace: agent.organization_slug ?? 'global',
          execution_modes: executionModes,
          metadata: {
            execution_profile: agent.config?.execution_profile,
            execution_capabilities: agent.config?.execution_capabilities,
            execution_modes: executionModes,
          },
          children: [],
        };
        agentMap.set(agent.slug, node);
      }

      // Build parent-child relationships based on reports_to
      const topLevelNodes: HierarchyNode[] = [];

      for (const agent of namespaceAgents) {
        const node = agentMap.get(agent.slug);
        if (!node) continue;

        // Get reports_to from YAML
        let reportsTo: string | null = null;

        // Parse YAML to get reports_to
        if (agent.yaml) {
          try {
            const yamlData = yamlLoad(agent.yaml) as Record<string, unknown>;
            const reportsToValue = yamlData?.reports_to || yamlData?.reportsTo;
            reportsTo =
              typeof reportsToValue === 'string' ? reportsToValue : null;
          } catch {
            // YAML parse error - reportsTo remains null
          }
        }

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
