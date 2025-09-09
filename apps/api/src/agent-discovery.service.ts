/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';

export interface DiscoveredAgent {
  name: string;
  type: string;
  path: string;
  servicePath: string;
  functionPath?: string;
  pythonFunctionPath?: string;
  // Hierarchy fields
  reportsTo?: string;
  directReports?: DiscoveredAgent[];
  hierarchy?: {
    team?: string[];
    level?: string;
  };
  configPath?: string;
  metadata?: {
    displayName?: string;
    description?: string;
    category?: string;
    version?: string;
  };
}

export interface AgentHierarchy {
  id: string;
  name: string;
  displayName: string;
  type: string;
  path: string;
  metadata?: {
    description?: string;
    category?: string;
    version?: string;
  };
  children: AgentHierarchy[];
}

@Injectable()
export class AgentDiscoveryService {
  private readonly logger = new Logger(AgentDiscoveryService.name);
  private discoveredAgents: DiscoveredAgent[] = [];
  private agentHierarchy: AgentHierarchy[] = [];
  private hierarchyCache: Map<string, AgentHierarchy> = new Map();

  constructor() {

  }

  /**
   * Discover all agent services in the file system
   */
  async discoverAgents(): Promise<DiscoveredAgent[]> {

    // Handle both monorepo (apps/api/src) and standalone (src) structures
    const agentsBasePath = process.cwd().includes('/apps/api')
      ? join(process.cwd(), 'src', 'agents', 'actual')
      : join(process.cwd(), 'apps', 'api', 'src', 'agents', 'actual');
    this.discoveredAgents = [];

    await this.traverseDirectory(agentsBasePath);

    // Discover agent functions after service discovery
    this.discoverAgentFunctions();

    // Load agent configurations and build hierarchy
    await this.loadAgentConfigurations();
    this.buildAgentHierarchy();

    return this.discoveredAgents;
  }

  /**
   * Recursively traverse directory structure to find agent services
   */
  private async traverseDirectory(dirPath: string): Promise<void> {
    try {
      if (!fs.existsSync(dirPath)) {

        return;
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Check if we should skip external agents
          const isExternalDir =
            fullPath.includes('/external/') || fullPath.endsWith('/external');
          const enableExternalAgents =
            process.env.ENABLE_EXTERNAL_AGENTS !== 'false';

          if (isExternalDir && !enableExternalAgents) {

            continue;
          }

          // Recursively traverse subdirectories
          await this.traverseDirectory(fullPath);
        } else if (entry.isFile() && entry.name === 'agent-service.ts') {
          // Found an agent service file
          this.processAgentService(fullPath);
        }
      }
    } catch (error: any) {

    }
  }

  /**
   * Process discovered agent service file
   */
  private processAgentService(servicePath: string): void {
    try {

      // Extract agent information from path
      const pathParts = servicePath.split('/');
      const agentIndex = pathParts.findIndex((part) => part === 'agents');

      if (agentIndex >= 0 && agentIndex < pathParts.length - 2) {
        // Skip 'agents/actual' to get to the type/name structure
        const relevantParts = pathParts.slice(agentIndex + 2, -1); // Remove 'agents', 'actual', and 'agent-service.ts'

        if (relevantParts.length >= 1) {
          const agentType = relevantParts[0] || 'unknown'; // e.g., 'orchestrator', 'specialists'
          let agentName: string;

          if (relevantParts.length === 1) {
            // Single level agent (e.g., orchestrator)
            agentName = agentType;
          } else {
            // Multi-level agent (e.g., specialists/blog_post)
            agentName = relevantParts[relevantParts.length - 1] || 'unknown';
          }

          // Create agent path format for routing (e.g., "orchestrator/orchestrator", "specialists/blog_post")
          const agentPath = `${agentType}/${agentName}`;

          const agent: DiscoveredAgent = {
            name: agentName,
            type: agentType,
            path: agentPath,
            servicePath: servicePath,
          };

          this.discoveredAgents.push(agent);

        } else {

        }
      } else {

      }
    } catch (error: any) {

    }
  }

  /**
   * Discover agent functions (TypeScript and Python)
   */
  private discoverAgentFunctions(): void {

    for (const agent of this.discoveredAgents) {
      try {
        const agentDirectory = agent.servicePath.replace(
          '/agent-service.ts',
          '',
        );

        // Look for TypeScript function
        const functionPath = join(agentDirectory, 'agent-function.ts');
        if (fs.existsSync(functionPath)) {
          agent.functionPath = functionPath;

        }

        // Look for Python function
        const pythonFunctionPath = join(agentDirectory, 'agent-function.py');
        if (fs.existsSync(pythonFunctionPath)) {
          agent.pythonFunctionPath = pythonFunctionPath;

        }
      } catch (error: any) {

      }
    }

    const withFunctions = this.discoveredAgents.filter(
      (a) => a.functionPath || a.pythonFunctionPath,
    );

  }

  /**
   * Get all discovered agents
   */
  getDiscoveredAgents(): DiscoveredAgent[] {
    return this.discoveredAgents;
  }

  /**
   * Load agent configurations and parse metadata
   */
  private async loadAgentConfigurations(): Promise<void> {

    for (const agent of this.discoveredAgents) {
      try {
        const agentDirectory = agent.servicePath.replace(
          '/agent-service.ts',
          '',
        );

        // Look for agent.yaml, agent.yml, or agent.config.yaml
        const yamlPath = join(agentDirectory, 'agent.yaml');
        const ymlPath = join(agentDirectory, 'agent.yml');
        const configYamlPath = join(agentDirectory, 'agent.config.yaml');

        let configPath: string | undefined;
        if (fs.existsSync(yamlPath)) {
          configPath = yamlPath;
        } else if (fs.existsSync(ymlPath)) {
          configPath = ymlPath;
        } else if (fs.existsSync(configYamlPath)) {
          configPath = configYamlPath;
        }

        if (configPath) {
          agent.configPath = configPath;

          try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const parsed = yaml.parse(configContent);

            // Extract metadata
            const metadata = parsed.metadata || {};
            
            // Extract hierarchy information
            const hierarchy = parsed.hierarchy || {};
            if (hierarchy.reportsTo) {
              agent.reportsTo = hierarchy.reportsTo;
            }
            
            // Extract team information for team-based hierarchy
            if (hierarchy.team) {
              agent.hierarchy = agent.hierarchy || {};
              agent.hierarchy.team = hierarchy.team;
            }

            agent.metadata = {
              displayName: metadata.name || agent.name,
              description: metadata.description,
              category: metadata.category,
              version: metadata.version,
            };

          } catch (configError) {

          }
        } else {
          // Set default metadata
          agent.metadata = {
            displayName: agent.name,
            description: `${agent.type} agent`,
          };
        }
      } catch (error) {

      }
    }

    const withConfigs = this.discoveredAgents.filter((a) => a.configPath);

  }

  /**
   * Build agent hierarchy from discovered agents
   */
  private buildAgentHierarchy(): void {

    // Clear previous hierarchy
    this.agentHierarchy = [];
    this.hierarchyCache.clear();

    // Create hierarchy nodes for all agents
    const nodeMap = new Map<string, AgentHierarchy>();

    for (const agent of this.discoveredAgents) {
      const node: AgentHierarchy = {
        id: agent.path,
        name: agent.name,
        displayName: agent.metadata?.displayName || agent.name,
        type: agent.type,
        path: agent.path,
        metadata: agent.metadata,
        children: [],
      };

      nodeMap.set(agent.path, node);
      this.hierarchyCache.set(agent.path, node);
    }

    // Build parent-child relationships using team-based approach
    const rootNodes: AgentHierarchy[] = [];
    const assignedNodes = new Set<string>(); // Track which nodes have been assigned as children

    // First pass: Build parent-child relationships from team definitions
    for (const agent of this.discoveredAgents) {
      const node = nodeMap.get(agent.path)!;
      
      // Check if this agent has a team (is a manager/orchestrator)
      if (agent.hierarchy?.team && Array.isArray(agent.hierarchy.team)) {
        for (const teamMemberName of agent.hierarchy.team) {
          // Find the team member node by name
          const teamMemberNode = Array.from(nodeMap.values()).find(
            (n) => n.name === teamMemberName || n.name.toLowerCase() === teamMemberName.toLowerCase()
          );
          
          if (teamMemberNode) {
            node.children.push(teamMemberNode);
            assignedNodes.add(teamMemberNode.path);
          } else {
            this.logger.warn(`Team member not found: ${teamMemberName} for ${agent.name}`);
          }
        }
      }
    }

    // Second pass: Add unassigned nodes as root nodes
    for (const agent of this.discoveredAgents) {
      const node = nodeMap.get(agent.path)!;
      
      if (!assignedNodes.has(agent.path)) {
        rootNodes.push(node);
      }
      
    }

    // Sort children by type and name
    const sortHierarchy = (nodes: AgentHierarchy[]) => {
      nodes.sort((a, b) => {
        // Orchestrators first
        if (a.type === 'orchestrator' && b.type !== 'orchestrator') return -1;
        if (b.type === 'orchestrator' && a.type !== 'orchestrator') return 1;

        // Then by type
        if (a.type !== b.type) return a.type.localeCompare(b.type);

        // Then by name
        return a.displayName.localeCompare(b.displayName);
      });

      nodes.forEach((node) => sortHierarchy(node.children));
    };

    // Ensure CEO appears first in root nodes
    const ceoIndex = rootNodes.findIndex(node => node.name === 'ceo_orchestrator');
    if (ceoIndex > 0) {
      const [ceoNode] = rootNodes.splice(ceoIndex, 1);
      if (ceoNode) {
        rootNodes.unshift(ceoNode);
      }
    }
    
    sortHierarchy(rootNodes);
    this.agentHierarchy = rootNodes;

  }

  /**
   * Get agent hierarchy
   */
  getAgentHierarchy(): AgentHierarchy[] {
    return this.agentHierarchy;
  }

  /**
   * Find agent by path in hierarchy cache
   */
  findAgentInHierarchy(path: string): AgentHierarchy | undefined {
    return this.hierarchyCache.get(path);
  }

  /**
   * Generate agent ID for registration
   */
  generateAgentId(name: string, path: string): string {
    return `${path.replace('/', '_')}_${Date.now()}`;
  }

  /**
   * Build agent URL for registration
   */
  buildAgentUrl(agentPath: string, agentName: string): string {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    const agentType = this.determineAgentType(agentPath);
    const name = agentName.toLowerCase().replace(/\s+/g, '_');

    // Handle plural forms for agent types - keep singular for orchestrator
    const agentTypePlural =
      agentType === 'orchestrator' ? agentType : `${agentType}s`;
    return `${baseUrl}/agents/${agentTypePlural}/${name}/tasks`;
  }

  /**
   * Determine agent type from path
   */
  determineAgentType(
    agentPath: string,
  ):
    | 'orchestrator'
    | 'specialist'
    | 'marketing'
    | 'finance'
    | 'hr'
    | 'operations'
    | 'sales'
    | 'legal'
    | 'engineering'
    | 'product'
    | 'research' {
    // Check for orchestrator first (special case)
    if (agentPath.includes('orchestrator')) {
      return 'orchestrator';
    }

    // Check for organizational folders in file structure
    if (agentPath.includes('/marketing/')) return 'marketing';
    if (agentPath.includes('/finance/')) return 'finance';
    if (agentPath.includes('/hr/')) return 'hr';
    if (agentPath.includes('/operations/')) return 'operations';
    if (agentPath.includes('/sales/')) return 'sales';
    if (agentPath.includes('/legal/')) return 'legal';
    if (agentPath.includes('/engineering/')) return 'engineering';
    if (agentPath.includes('/product/')) return 'product';
    if (agentPath.includes('/research/')) return 'research';

    // Legacy structure fallbacks
    if (
      agentPath.includes('/specialists/') ||
      agentPath.includes('/specialist/')
    ) {
      return 'specialist';
    }
    if (agentPath.includes('/api/')) {
      return 'engineering'; // API agents belong to engineering
    }
    if (agentPath.includes('/external/')) {
      return 'marketing'; // Default external agents to marketing for now
    }

    // Default fallback
    return 'specialist';
  }
}
