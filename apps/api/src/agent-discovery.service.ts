/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';

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
    this.logger.log('🔍 AgentDiscoveryService initialized');
  }

  /**
   * Discover all agent services in the file system
   */
  async discoverAgents(): Promise<DiscoveredAgent[]> {
    this.logger.log('🔍 Starting agent discovery...');

    const agentsBasePath = join(process.cwd(), 'src', 'agents', 'actual');
    this.discoveredAgents = [];

    await this.traverseDirectory(agentsBasePath);

    // Discover agent functions after service discovery
    this.discoverAgentFunctions();
    
    // Load agent configurations and build hierarchy
    await this.loadAgentConfigurations();
    this.buildAgentHierarchy();

    this.logger.log(`✅ Discovered ${this.discoveredAgents.length} agents`);
    return this.discoveredAgents;
  }

  /**
   * Recursively traverse directory structure to find agent services
   */
  private async traverseDirectory(dirPath: string): Promise<void> {
    try {
      if (!fs.existsSync(dirPath)) {
        this.logger.warn(`Directory does not exist: ${dirPath}`);
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
            this.logger.log(
              `⏭️  Skipping external agents directory (ENABLE_EXTERNAL_AGENTS=false)`,
            );
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
      this.logger.error(
        `Error traversing directory ${dirPath}:`,
        error.message,
      );
    }
  }

  /**
   * Process discovered agent service file
   */
  private processAgentService(servicePath: string): void {
    try {
      this.logger.debug(`📁 Processing agent service: ${servicePath}`);

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
          this.logger.log(`📁 Found agent: ${agentPath} at ${servicePath}`);
        } else {
          this.logger.warn(
            `Could not parse agent path structure from: ${servicePath}`,
          );
        }
      } else {
        this.logger.warn(`Invalid agent path structure: ${servicePath}`);
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error processing agent service ${servicePath}:`,
        error,
      );
    }
  }

  /**
   * Discover agent functions (TypeScript and Python)
   */
  private discoverAgentFunctions(): void {
    this.logger.debug('🔍 Discovering agent functions...');

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
          this.logger.debug(
            `📄 Found TypeScript function for ${agent.name}: ${functionPath}`,
          );
        }

        // Look for Python function
        const pythonFunctionPath = join(agentDirectory, 'agent-function.py');
        if (fs.existsSync(pythonFunctionPath)) {
          agent.pythonFunctionPath = pythonFunctionPath;
          this.logger.debug(
            `🐍 Found Python function for ${agent.name}: ${pythonFunctionPath}`,
          );
        }
      } catch (error: any) {
        this.logger.warn(
          `⚠️ Could not discover functions for ${agent.name}: ${error.message}`,
        );
      }
    }

    const withFunctions = this.discoveredAgents.filter(
      (a) => a.functionPath || a.pythonFunctionPath,
    );
    this.logger.log(
      `📄 Discovered ${withFunctions.length} agents with function files`,
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
    this.logger.debug('🔍 Loading agent configurations...');
    
    for (const agent of this.discoveredAgents) {
      try {
        const agentDirectory = agent.servicePath.replace('/agent-service.ts', '');
        
        // Look for agent.yaml or agent.yml
        const yamlPath = join(agentDirectory, 'agent.yaml');
        const ymlPath = join(agentDirectory, 'agent.yml');
        
        let configPath: string | undefined;
        if (fs.existsSync(yamlPath)) {
          configPath = yamlPath;
        } else if (fs.existsSync(ymlPath)) {
          configPath = ymlPath;
        }
        
        if (configPath) {
          agent.configPath = configPath;
          
          try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            // Parse YAML-like content (basic parsing for metadata)
            const lines = configContent.split('\n');
            
            let inMetadata = false;
            const metadata: any = {};
            
            for (const line of lines) {
              const trimmed = line.trim();
              
              if (trimmed === 'metadata:') {
                inMetadata = true;
                continue;
              }
              
              if (inMetadata && trimmed && !trimmed.startsWith('#')) {
                if (trimmed.startsWith('  ')) {
                  // Metadata field
                  const match = trimmed.match(/^\s*(\w+):\s*"?([^"]+)"?$/);
                  if (match && match[1] && match[2]) {
                    metadata[match[1]] = match[2].replace(/"/g, '');
                  }
                } else {
                  // End of metadata section
                  break;
                }
              }
              
              // Look for reportsTo field anywhere in config
              const reportsToMatch = trimmed.match(/^\s*reportsTo:\s*"?([^"]+)"?$/);
              if (reportsToMatch && reportsToMatch[1]) {
                agent.reportsTo = reportsToMatch[1].replace(/"/g, '');
              }
            }
            
            agent.metadata = {
              displayName: metadata.name || agent.name,
              description: metadata.description,
              category: metadata.category,
              version: metadata.version,
            };
            
            this.logger.debug(`📄 Loaded config for ${agent.name}: ${configPath}`);
          } catch (configError) {
            this.logger.warn(`⚠️ Failed to parse config for ${agent.name}: ${configError instanceof Error ? configError.message : 'Unknown error'}`);
          }
        } else {
          // Set default metadata
          agent.metadata = {
            displayName: agent.name,
            description: `${agent.type} agent`,
          };
        }
      } catch (error) {
        this.logger.warn(`⚠️ Could not load config for ${agent.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    const withConfigs = this.discoveredAgents.filter(a => a.configPath);
    this.logger.log(`📄 Loaded configurations for ${withConfigs.length} agents`);
  }

  /**
   * Build agent hierarchy from discovered agents
   */
  private buildAgentHierarchy(): void {
    this.logger.debug('🏗️ Building agent hierarchy...');
    
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
    
    // Build parent-child relationships
    const rootNodes: AgentHierarchy[] = [];
    
    for (const agent of this.discoveredAgents) {
      const node = nodeMap.get(agent.path)!;
      
      if (agent.reportsTo) {
        // Find parent node
        const parentNode = Array.from(nodeMap.values()).find(n => 
          n.name.toLowerCase() === agent.reportsTo!.toLowerCase() || 
          n.displayName.toLowerCase() === agent.reportsTo!.toLowerCase() ||
          n.path.includes(agent.reportsTo!.toLowerCase())
        );
        
        if (parentNode) {
          parentNode.children.push(node);
          this.logger.debug(`📊 ${node.name} reports to ${parentNode.name}`);
        } else {
          this.logger.warn(`⚠️ Parent not found for ${agent.name} (reportsTo: ${agent.reportsTo})`);
          rootNodes.push(node);
        }
      } else {
        // Root level agent
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
      
      nodes.forEach(node => sortHierarchy(node.children));
    };
    
    sortHierarchy(rootNodes);
    this.agentHierarchy = rootNodes;
    
    this.logger.log(`🏗️ Built hierarchy with ${rootNodes.length} root nodes and ${this.discoveredAgents.length} total agents`);
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
