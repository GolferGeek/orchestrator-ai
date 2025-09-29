/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {
  AgentConfigurationService,
  AgentConfigurationData,
} from './agents/demo/specialists/agent_creator/services/agent-configuration.service';

export interface DiscoveredAgent {
  name: string;
  type: string;
  namespace: string;
  relativePath: string;
  namespacedPath: string;
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
  // Database agent fields
  isDatabaseAgent?: boolean;
  databaseId?: string;
  agentConfiguration?: AgentConfigurationData;
}

export interface AgentHierarchy {
  id: string;
  name: string;
  displayName: string;
  type: string;
  path: string;
  relativePath?: string;
  namespace?: string;
  namespacedPath?: string;
  metadata?: {
    description?: string;
    category?: string;
    version?: string;
  };
  children: AgentHierarchy[];
}

interface AgentNamespaceConfig {
  key: string;
  relativePath: string;
  absolutePath: string;
}

@Injectable()
export class AgentDiscoveryService {
  private readonly logger = new Logger(AgentDiscoveryService.name);
  private discoveredAgents: DiscoveredAgent[] = [];
  private agentHierarchy: AgentHierarchy[] = [];
  private hierarchyCache: Map<string, AgentHierarchy> = new Map();
  private namespaceConfigs: AgentNamespaceConfig[] = [];

  constructor(private agentConfigService?: AgentConfigurationService) {
    this.logger.log('🔍 AgentDiscoveryService initialized');
    this.namespaceConfigs = this.parseNamespaceConfigs();
  }

  /**
   * Discover all agent services from both filesystem and database
   */
  async discoverAgents(): Promise<DiscoveredAgent[]> {
    this.logger.log('🔍 Starting hybrid agent discovery...');

    // Refresh namespace configuration in case env changed
    this.namespaceConfigs = this.parseNamespaceConfigs();

    this.discoveredAgents = [];

    // First, discover filesystem agents
    await this.discoverFilesystemAgents();

    // Then, discover database agents
    await this.discoverDatabaseAgents();

    // Load agent configurations and build hierarchy
    await this.loadAgentConfigurations();
    this.buildAgentHierarchy();

    const filesystemCount = this.discoveredAgents.filter(
      (a) => !a.isDatabaseAgent,
    ).length;
    const databaseCount = this.discoveredAgents.filter(
      (a) => a.isDatabaseAgent,
    ).length;

    this.logger.log(
      `✅ Discovered ${this.discoveredAgents.length} agents (${filesystemCount} filesystem, ${databaseCount} database)`,
    );
    return this.discoveredAgents;
  }

  /**
   * Discover filesystem-based agents
   */
  private parseNamespaceConfigs(): AgentNamespaceConfig[] {
    const sourceRoot = this.resolveSourceRoot();
    const configs: AgentNamespaceConfig[] = [];
    const seen = new Set<string>();

    const addConfig = (key: string, relativePath: string) => {
      if (!key || seen.has(key)) {
        return;
      }

      const normalizedRelativePath = relativePath
        .replace(/^\.\//, '')
        .replace(/^\//, '')
        .replace(/\/+/g, '/');

      const absolutePath = join(sourceRoot, normalizedRelativePath);
      configs.push({ key, relativePath: normalizedRelativePath, absolutePath });
      seen.add(key);
    };

    // Allow explicit overrides via env if provided
    const rawConfig = process.env.AGENT_NAMESPACES;
    if (rawConfig && rawConfig.trim().length > 0) {
      const entries = rawConfig
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

      for (const entry of entries) {
        const [key, relativePath] = entry
          .split(':')
          .map((part) => part?.trim());
        if (!key || !relativePath) {
          this.logger.warn(`⚠️ Invalid AGENT_NAMESPACES entry: "${entry}"`);
          continue;
        }
        addConfig(key, relativePath);
      }
    }

    // Always include the canonical namespaces
    addConfig('demo', 'agents/demo');
    addConfig('my-org', 'agents/my-org');
    addConfig('saas', 'agents/saas');

    this.logger.log(
      `🧭 Namespaces configured: ${configs
        .map((config) => `${config.key} → ${config.relativePath}`)
        .join(', ')}`,
    );

    return configs;
  }

  private resolveSourceRoot(): string {
    const cwd = process.cwd();
    const candidates = [join(cwd, 'src'), join(cwd, 'apps', 'api', 'src')];

    for (const candidate of candidates) {
      if (fs.existsSync(join(candidate, 'agents'))) {
        return candidate;
      }
    }

    // Default to first candidate even if directory does not exist yet
    return candidates[0] ?? cwd;
  }

  private async discoverFilesystemAgents(): Promise<void> {
    this.logger.log('🗂️ Discovering filesystem agents...');

    for (const namespaceConfig of this.namespaceConfigs) {
      this.logger.debug(
        `🗂️ Namespace ${namespaceConfig.key} mapped to ${namespaceConfig.relativePath}`,
      );

      await this.traverseDirectory(
        namespaceConfig.absolutePath,
        namespaceConfig.key,
      );
    }

    // Discover agent functions after service discovery
    this.discoverAgentFunctions();
  }

  /**
   * Discover database-based agents
   */
  private async discoverDatabaseAgents(): Promise<void> {
    if (!this.agentConfigService) {
      this.logger.debug(
        '⏭️ AgentConfigurationService not available, skipping database agents',
      );
      return;
    }

    try {
      this.logger.log('🗄️ Discovering database agents...');

      const databaseAgents =
        await this.agentConfigService.listAgentConfigurations();

      for (const agentConfig of databaseAgents) {
        const namespaceKey =
          (agentConfig.metadata?.namespace as string) || 'database';
        const relativePath = `${agentConfig.department}/${agentConfig.agentId}`;
        const agent: DiscoveredAgent = {
          name: agentConfig.agentId,
          type: agentConfig.department,
          namespace: namespaceKey,
          relativePath,
          namespacedPath: `${namespaceKey}/${relativePath}`,
          path: relativePath,
          servicePath: `virtual://database/${agentConfig.agentId}`, // Virtual path for database agents
          isDatabaseAgent: true,
          databaseId: agentConfig.agentId,
          agentConfiguration: agentConfig,
          metadata: {
            displayName: agentConfig.displayName,
            description: agentConfig.primaryPurpose,
            category: agentConfig.department,
            version: '1.0.0',
          },
        };

        this.discoveredAgents.push(agent);
        this.logger.debug(`🗄️ Found database agent: ${agent.path}`);
      }

      this.logger.log(`🗄️ Discovered ${databaseAgents.length} database agents`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to discover database agents:', error);
    }
  }

  /**
   * Recursively traverse directory structure to find agent services
   */
  private async traverseDirectory(
    dirPath: string,
    namespaceKey: string,
  ): Promise<void> {
    try {
      if (!fs.existsSync(dirPath)) {
        this.logger.debug(
          `ℹ️ Namespace ${namespaceKey}: path not found (${dirPath}), skipping`,
        );
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
          await this.traverseDirectory(fullPath, namespaceKey);
        } else if (entry.isFile() && entry.name === 'agent-service.ts') {
          // Found an agent service file
          this.processAgentService(fullPath, namespaceKey);
        }
      }
    } catch (error: any) {}
  }

  /**
   * Process discovered agent service file
   */
  private processAgentService(servicePath: string, namespaceKey: string): void {
    try {
      // Extract agent information from path
      const pathParts = servicePath.split('/');
      const agentIndex = pathParts.findIndex((part) => part === 'agents');

      if (agentIndex >= 0 && agentIndex < pathParts.length - 2) {
        // Skip 'agents/demo' to get to the type/name structure
        const relevantParts = pathParts.slice(agentIndex + 2, -1); // Remove 'agents', 'demo', and 'agent-service.ts'

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
          const relativePath = `${agentType}/${agentName}`;
          const namespacedPath = `${namespaceKey}/${relativePath}`;

          const agent: DiscoveredAgent = {
            name: agentName,
            type: agentType,
            namespace: namespaceKey,
            relativePath,
            namespacedPath,
            path: relativePath,
            servicePath: servicePath,
          };

          this.discoveredAgents.push(agent);
        } else {
        }
      } else {
      }
    } catch (error: any) {}
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
      } catch (error: any) {}
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

  getDiscoveredAgentsForNamespaces(namespaces: string[]): DiscoveredAgent[] {
    if (!namespaces.length) {
      return this.discoveredAgents;
    }

    return this.discoveredAgents.filter((agent) =>
      namespaces.includes(agent.namespace),
    );
  }

  /**
   * Get agent by path (supports both filesystem and database agents)
   */
  getAgentByPath(
    agentPath: string,
    namespace?: string,
  ): DiscoveredAgent | undefined {
    return this.discoveredAgents.find((agent) => {
      const pathMatches =
        agent.path === agentPath || agent.relativePath === agentPath;

      if (namespace) {
        return pathMatches && agent.namespace === namespace;
      }

      return pathMatches;
    });
  }

  /**
   * Check if an agent is stored in the database
   */
  isDatabaseAgent(agentPath: string, namespace?: string): boolean {
    const agent = this.getAgentByPath(agentPath, namespace);
    return agent?.isDatabaseAgent || false;
  }

  /**
   * Get database configuration for an agent
   */
  getDatabaseConfiguration(
    agentPath: string,
    namespace?: string,
  ): AgentConfigurationData | undefined {
    const agent = this.getAgentByPath(agentPath, namespace);
    return agent?.agentConfiguration;
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
            const parsed = yaml.load(configContent) as any;

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
          } catch (configError) {}
        } else {
          // Set default metadata
          agent.metadata = {
            displayName: agent.name,
            description: `${agent.type} agent`,
          };
        }
      } catch (error) {}
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
        id: agent.namespacedPath,
        name: agent.name,
        displayName: agent.metadata?.displayName || agent.name,
        type: agent.type,
        path: agent.path,
        relativePath: agent.relativePath,
        namespace: agent.namespace,
        namespacedPath: agent.namespacedPath,
        metadata: agent.metadata,
        children: [],
      };

      nodeMap.set(agent.namespacedPath, node);
      this.hierarchyCache.set(agent.namespacedPath, node);
    }

    // Build parent-child relationships using team-based approach
    const rootNodes: AgentHierarchy[] = [];
    const assignedNodes = new Set<string>(); // Track which nodes have been assigned as children

    // First pass: Build parent-child relationships from team definitions
    for (const agent of this.discoveredAgents) {
      const node = nodeMap.get(agent.namespacedPath)!;

      // Check if this agent has a team (is a manager/orchestrator)
      if (agent.hierarchy?.team && Array.isArray(agent.hierarchy.team)) {
        for (const teamMemberName of agent.hierarchy.team) {
          // Find the team member node by name
          const teamMemberNode = Array.from(nodeMap.values()).find(
            (n) =>
              n.name === teamMemberName ||
              n.name.toLowerCase() === teamMemberName.toLowerCase(),
          );

          if (teamMemberNode) {
            node.children.push(teamMemberNode);
            assignedNodes.add(
              teamMemberNode.namespacedPath ||
                `${node.namespace}/${teamMemberNode.path}`,
            );
          } else {
            this.logger.warn(
              `Team member not found: ${teamMemberName} for ${agent.name}`,
            );
          }
        }
      }
    }

    // Second pass: Add unassigned nodes as root nodes
    for (const agent of this.discoveredAgents) {
      const node = nodeMap.get(agent.namespacedPath)!;

      if (!assignedNodes.has(agent.namespacedPath)) {
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
    const ceoIndex = rootNodes.findIndex(
      (node) => node.name === 'ceo_orchestrator',
    );
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
  getAgentHierarchy(namespaces?: string[]): AgentHierarchy[] {
    if (!namespaces || namespaces.length === 0) {
      return this.agentHierarchy;
    }

    return this.filterHierarchyByNamespaces(new Set(namespaces));
  }

  private filterHierarchyByNamespaces(
    allowedNamespaces: Set<string>,
  ): AgentHierarchy[] {
    const allowedAgentPaths = new Set(
      this.discoveredAgents
        .filter((agent) => allowedNamespaces.has(agent.namespace))
        .map((agent) => agent.namespacedPath || agent.path),
    );

    const cloneAndFilter = (nodes: AgentHierarchy[]): AgentHierarchy[] => {
      return nodes
        .filter((node) => allowedAgentPaths.has(node.id))
        .map((node) => ({
          ...node,
          children: cloneAndFilter(node.children),
        }));
    };

    return cloneAndFilter(this.agentHierarchy);
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
    return `${path.replace(/\//g, '_')}_${Date.now()}`;
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
