import { Controller, Get, Headers, Logger } from '@nestjs/common';
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
    execution_profile?: string | null;
    execution_capabilities?: unknown;
    execution_modes?: string[];
  };
  children: HierarchyNode[];
}

interface YamlAgentData {
  reports_to?: string | null;
  reportsTo?: string | null;
  [key: string]: unknown;
}

@Controller('hierarchy')
export class HierarchyController {
  private readonly logger = new Logger(HierarchyController.name);

  constructor(private readonly agentRegistry: AgentRegistryService) {}

  /**
   * Test endpoint
   * Route: GET /hierarchy/test
   */
  @Get('test')
  @Public()
  testHierarchy() {
    return {
      message: 'Hierarchy controller working',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get agent hierarchy
   * Route: GET /hierarchy/agents
   * Also available at: GET /agents/.well-known/hierarchy (for frontend compatibility)
   */
  @Get('agents')
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

  /**
   * Frontend compatibility endpoint
   * Route: GET /.well-known/hierarchy
   */
  @Get('.well-known/hierarchy')
  @Public()
  async getAgentHierarchyWellKnown(
    @Headers('x-agent-namespace') namespaceHeader?: string,
  ) {
    return this.getAgentHierarchy(namespaceHeader);
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
        let executionModes: string[] = ['immediate']; // default
        
        if (agent.yaml) {
          try {
            // Parse the YAML string (yamlLoad handles both YAML and JSON)
            const yamlConfig = yamlLoad(agent.yaml) as Record<string, any>;
            const modes = yamlConfig?.configuration?.execution_modes;
            
            if (Array.isArray(modes) && modes.length > 0) {
              executionModes = modes.filter(
                (mode): mode is string => typeof mode === 'string',
              );
            }
            
          } catch (error) {
            // If parsing fails, keep the default
            this.logger.warn(
              `Failed to parse YAML for agent ${agent.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }

        const node = {
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
            const yamlData = yamlLoad(agent.yaml) as YamlAgentData;
            reportsTo = yamlData?.reports_to || yamlData?.reportsTo || null;
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
