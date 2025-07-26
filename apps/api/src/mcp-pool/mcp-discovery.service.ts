/**
 * MCP Discovery Service
 * 
 * Automatically discovers MCP services by scanning the directory structure,
 * similar to how AgentDiscoveryService works. Finds MCP servers in the
 * codebase and registers them with the pool.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { MCPPoolService } from './mcp-pool.service';
import {
  MCPRegistration,
  MCPTool,
  MCPCapability,
  MCPDiscoveryResult,
} from './interfaces';
import * as fs from 'fs';
import * as path from 'path';

export interface DiscoveredMCPService {
  id: string;
  name: string;
  type: MCPRegistration['type'];
  path: string; // Relative path like "supabase"
  serverPath: string; // Full path to the server file
  url: string; // HTTP endpoint URL
  description: string;
  provider: string;
  tools: MCPTool[];
  capabilities: MCPCapability[];
  version: string;
  metadata: Record<string, any>;
}

@Injectable()
export class MCPDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(MCPDiscoveryService.name);
  private readonly discoveredMCPServices: DiscoveredMCPService[] = [];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly mcpPoolService: MCPPoolService,
  ) {}

  async onModuleInit() {
    this.logger.log('🔍 Starting MCP Discovery Service');
    await this.discoverMCPServices();
    await this.registerDiscoveredServices();
  }

  /**
   * Discover MCP services by scanning the directory structure
   */
  async discoverMCPServices(): Promise<void> {
    this.logger.log('🔍 Discovering MCP services from directory structure...');

    // Clear existing discovered services
    this.discoveredMCPServices.length = 0;

    // Get the MCP servers base path
    const mcpServersPath = path.join(process.cwd(), 'src', 'mcp', 'servers');
    
    await this.traverseMCPDirectory(mcpServersPath);

    this.logger.log(`✅ Discovered ${this.discoveredMCPServices.length} MCP services`);
  }

  /**
   * Recursively traverse MCP servers directory to find MCP server files
   */
  private async traverseMCPDirectory(dirPath: string): Promise<void> {
    try {
      if (!fs.existsSync(dirPath)) {
        this.logger.warn(`MCP servers directory does not exist: ${dirPath}`);
        return;
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip base directory as it's not an MCP service
          if (entry.name === 'base') {
            continue;
          }

          // Recursively traverse subdirectories
          await this.traverseMCPDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('-mcp.server.ts')) {
          // Found an MCP server file
          await this.processMCPServer(fullPath);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error traversing MCP directory ${dirPath}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Process discovered MCP server file
   */
  private async processMCPServer(serverPath: string): Promise<void> {
    try {
      this.logger.debug(`📁 Processing MCP server: ${serverPath}`);

      // Extract MCP information from path
      const pathParts = serverPath.split(path.sep);
      const serversIndex = pathParts.findIndex((part) => part === 'servers');

      if (serversIndex >= 0 && serversIndex < pathParts.length - 1) {
        // Get the MCP name from the directory name
        const mcpDirName = pathParts[serversIndex + 1];
        if (!mcpDirName) {
          this.logger.warn(`Could not extract MCP name from path: ${serverPath}`);
          return;
        }
        
        const mcpName = mcpDirName;
        const mcpId = `${mcpName}-mcp`;

        // Create base URL for this MCP service
        const baseUrl = this.configService.get<string>('API_BASE_URL', 'http://localhost:4000');
        const mcpUrl = `${baseUrl}/mcp/${mcpName}`;

        // Analyze the MCP service
        const mcpService = await this.analyzeMCPService(mcpName, serverPath, mcpUrl);

        if (mcpService) {
          this.discoveredMCPServices.push(mcpService);
          this.logger.log(`📁 Found MCP service: ${mcpId} at ${serverPath}`);
        }
      } else {
        this.logger.warn(`Invalid MCP server path structure: ${serverPath}`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Error processing MCP server ${serverPath}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Analyze MCP service to extract capabilities and tools
   */
  private async analyzeMCPService(
    mcpName: string,
    serverPath: string,
    mcpUrl: string,
  ): Promise<DiscoveredMCPService | null> {
    try {
      // Get tools directory for this MCP
      const mcpDir = path.dirname(serverPath);
      const toolsDir = path.join(mcpDir, 'tools');

      let tools: MCPTool[] = [];
      let capabilities: MCPCapability[] = [];

      // Scan tools directory if it exists
      if (fs.existsSync(toolsDir)) {
        tools = await this.discoverMCPTools(toolsDir, mcpName);
        capabilities = this.generateCapabilitiesFromTools(tools, mcpName);
      }

      // Determine MCP type and provider based on name
      const type = this.inferMCPType(mcpName);
      const provider = this.inferMCPProvider(mcpName);

      const mcpService: DiscoveredMCPService = {
        id: `${mcpName}-mcp`,
        name: this.generateMCPDisplayName(mcpName),
        type,
        path: mcpName,
        serverPath,
        url: mcpUrl,
        description: this.generateMCPDescription(mcpName, tools.length),
        provider,
        tools,
        capabilities,
        version: '1.0.0',
        metadata: {
          discoveredAt: new Date().toISOString(),
          discoveryMethod: 'directory-scan',
          serverPath,
          toolsCount: tools.length,
          capabilitiesCount: capabilities.length,
        },
      };

      return mcpService;
    } catch (error) {
      this.logger.error(
        `Error analyzing MCP service ${mcpName}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return null;
    }
  }

  /**
   * Discover tools in an MCP tools directory
   */
  private async discoverMCPTools(toolsDir: string, mcpName: string): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];

    try {
      const toolFiles = fs.readdirSync(toolsDir);

      for (const toolFile of toolFiles) {
        if (toolFile.endsWith('.tool.ts')) {
          const toolName = toolFile.replace('.tool.ts', '').replace('enhanced-', '');
          
          const tool: MCPTool = {
            name: toolName,
            description: this.generateToolDescription(toolName, mcpName),
            parameters: this.generateToolParameters(toolName),
            examples: this.generateToolExamples(toolName),
          };

          tools.push(tool);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error discovering tools in ${toolsDir}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }

    return tools;
  }

  /**
   * Generate capabilities from discovered tools
   */
  private generateCapabilitiesFromTools(tools: MCPTool[], mcpName: string): MCPCapability[] {
    const capabilities: MCPCapability[] = [];

    if (mcpName === 'supabase') {
      // Generate Supabase-specific capabilities
      if (tools.some(t => t.name.includes('schema'))) {
        capabilities.push({
          name: 'Database Schema Discovery',
          description: 'Discover and analyze database table structures, columns, and relationships',
          category: 'data',
          tools: tools.filter(t => t.name.includes('schema')).map(t => t.name),
          examples: ['Get all table schemas', 'Discover table relationships', 'Analyze column types'],
        });
      }

      if (tools.some(t => t.name.includes('generate-sql'))) {
        capabilities.push({
          name: 'SQL Query Generation',
          description: 'Generate SQL queries from natural language descriptions with Supabase constraints',
          category: 'data',
          tools: tools.filter(t => t.name.includes('generate-sql')).map(t => t.name),
          examples: ['Create queries from natural language', 'Generate Supabase-compatible SQL', 'Handle aggregate functions'],
        });
      }

      if (tools.some(t => t.name.includes('execute-sql'))) {
        capabilities.push({
          name: 'SQL Query Execution',
          description: 'Execute SQL queries safely with validation and result formatting',
          category: 'data',
          tools: tools.filter(t => t.name.includes('execute-sql')).map(t => t.name),
          examples: ['Run SELECT queries', 'Execute with safety checks', 'Get formatted results'],
        });
      }

      if (tools.some(t => t.name.includes('format') || t.name.includes('data'))) {
        capabilities.push({
          name: 'Data Formatting',
          description: 'Format query results for different output formats and use cases',
          category: 'data',
          tools: tools.filter(t => t.name.includes('format') || t.name.includes('data')).map(t => t.name),
          examples: ['Format as JSON', 'Create CSV output', 'Generate reports'],
        });
      }
    }

    return capabilities;
  }

  /**
   * Infer MCP type from service name
   */
  private inferMCPType(mcpName: string): MCPRegistration['type'] {
    const name = mcpName.toLowerCase();
    
    if (name.includes('supabase') || name.includes('database') || name.includes('sql')) {
      return 'database';
    }
    if (name.includes('file') || name.includes('storage') || name.includes('fs')) {
      return 'file';
    }
    if (name.includes('mail') || name.includes('gmail') || name.includes('message')) {
      return 'communication';
    }
    if (name.includes('api') || name.includes('rest') || name.includes('http')) {
      return 'api';
    }
    if (name.includes('compute') || name.includes('calc') || name.includes('math')) {
      return 'computation';
    }
    
    return 'external';
  }

  /**
   * Infer MCP provider from service name
   */
  private inferMCPProvider(mcpName: string): string {
    const name = mcpName.toLowerCase();
    
    if (name.includes('supabase')) return 'supabase';
    if (name.includes('google')) return 'google';
    if (name.includes('microsoft')) return 'microsoft';
    if (name.includes('github')) return 'github';
    if (name.includes('openai')) return 'openai';
    
    return 'internal';
  }

  /**
   * Generate display name for MCP service
   */
  private generateMCPDisplayName(mcpName: string): string {
    const formatted = mcpName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return `${formatted} MCP`;
  }

  /**
   * Generate description for MCP service
   */
  private generateMCPDescription(mcpName: string, toolCount: number): string {
    if (mcpName === 'supabase') {
      return `Model Context Protocol service for Supabase database operations including schema discovery, SQL generation, and query execution. Provides ${toolCount} tools with Supabase API constraint compatibility.`;
    }
    
    return `Model Context Protocol service for ${mcpName} operations. Provides ${toolCount} tools for various capabilities.`;
  }

  /**
   * Generate tool description
   */
  private generateToolDescription(toolName: string, mcpName: string): string {
    const descriptions: Record<string, string> = {
      'get-schema': 'Discover database schema including tables, columns, relationships, and business context analysis',
      'generate-sql': 'Generate Supabase-compatible SQL queries from natural language with constraint awareness',
      'execute-sql': 'Execute SQL queries safely with validation, aggregate function support, and formatted results',
      'format-data': 'Format query results into different output formats (JSON, CSV, tables) for various use cases',
      'query-and-format': 'Combined query generation and result formatting in one operation',
      'read-data': 'Read and retrieve data from database tables with filtering and pagination',
    }; 
    
    return descriptions[toolName] || `${mcpName} MCP tool: ${toolName}`;
  }

  /**
   * Generate tool parameters schema
   */
  private generateToolParameters(toolName: string): Record<string, any> {
    const parameters: Record<string, Record<string, any>> = {
      'get-schema': {
        type: 'object',
        properties: {
          table_names: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific table names to retrieve (optional, defaults to all tables)',
          },
          format: {
            type: 'string',
            enum: ['json', 'markdown', 'sql'],
            default: 'json',
            description: 'Output format for schema information',
          },
          refresh_cache: {
            type: 'boolean',
            default: false,
            description: 'Force refresh of cached schema information',
          },
        },
      },
      'generate-sql': {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: {
            type: 'string',
            description: 'Natural language description of the desired SQL query',
          },
          use_context: {
            type: 'boolean',
            default: true,
            description: 'Use context learning and schema information',
          },
          dry_run: {
            type: 'boolean',
            default: false,
            description: 'Generate SQL without execution',
          },
        },
      },
      'execute-sql': {
        type: 'object',
        required: ['sql'],
        properties: {
          sql: {
            type: 'string',
            description: 'SQL query to execute',
          },
          dry_run: {
            type: 'boolean',
            default: true,
            description: 'Validate query without execution',
          },
          max_rows: {
            type: 'integer',
            default: 1000,
            minimum: 1,
            maximum: 10000,
            description: 'Maximum number of rows to return',
          },
        },
      },
    };
    
    return parameters[toolName] || {};
  }

  /**
   * Generate tool examples
   */
  private generateToolExamples(toolName: string): string[] {
    const examples: Record<string, string[]> = {
      'get-schema': [
        'Get all table schemas with business context',
        'Discover specific table relationships',
        'Refresh schema cache and get updated structure',
      ],
      'generate-sql': [
        'Show me all users created in the last 30 days',
        'Find the average execution time of MCP tools',
        'Get department performance compared to KPI goals',
      ],
      'execute-sql': [
        'SELECT COUNT(*) FROM users WHERE status = \'active\'',
        'SELECT AVG(execution_time_ms) FROM mcp_executions',
        'SELECT * FROM departments ORDER BY name LIMIT 10',
      ],
    };
    
    return examples[toolName] || [];
  }

  /**
   * Register all discovered services with the MCP pool
   */
  private async registerDiscoveredServices(): Promise<void> {
    this.logger.log(`Registering ${this.discoveredMCPServices.length} discovered MCP services...`);

    let successCount = 0;
    let errorCount = 0;

    for (const discoveredService of this.discoveredMCPServices) {
      try {
        const registration: MCPRegistration = {
          id: discoveredService.id,
          name: discoveredService.name,
          type: discoveredService.type,
          url: discoveredService.url,
          description: discoveredService.description,
          capabilities: discoveredService.capabilities,
          tools: discoveredService.tools,
          version: discoveredService.version,
          provider: discoveredService.provider,
          status: 'online',
          discoveredAt: new Date(),
          healthEndpoint: `${discoveredService.url}/health`,
          discoveryEndpoint: `${discoveredService.url}/discover`,
          metadata: {
            ...discoveredService.metadata,
            autoDiscovered: true,
            discoverySource: 'directory-scan',
          },
        };

        await this.mcpPoolService.registerMCP(registration);
        successCount++;

        this.logger.log(`✅ Registered MCP service: ${discoveredService.id}`);

      } catch (error) {
        errorCount++;
        this.logger.error(`Failed to register MCP service ${discoveredService.id}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    this.logger.log(`MCP registration complete: ${successCount} successful, ${errorCount} failed`);
  }

  /**
   * Get all discovered services (for testing/debugging)
   */
  getDiscoveredServices(): DiscoveredMCPService[] {
    return [...this.discoveredMCPServices];
  }

  /**
   * Re-run discovery process
   */
  async rediscover(): Promise<MCPDiscoveryResult> {
    this.logger.log('Re-running MCP service discovery...');
    
    const startTime = new Date();
    
    await this.discoverMCPServices();
    await this.registerDiscoveredServices();

    return {
      discovered: this.discoveredMCPServices.map(service => ({
        id: service.id,
        name: service.name,
        type: service.type,
        url: service.url,
        description: service.description,
        capabilities: service.capabilities,
        tools: service.tools,
        version: service.version,
        provider: service.provider,
        status: 'online' as const,
        discoveredAt: new Date(),
        metadata: service.metadata,
      })),
      errors: [], // Would collect any errors during discovery
      discoveredAt: startTime,
      totalFound: this.discoveredMCPServices.length,
      successfulRegistrations: this.discoveredMCPServices.length,
    };
  }
}