/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { LLMService } from '@llm/llm.service';
import { SessionsService } from './sessions/sessions.service';
import { SupabaseService } from './supabase/supabase.service';
import {
  AgentRegistrationService,
  AgentInfo,
} from './agents/base/sub-services/agent-registration/agent-registration.service';
import { AgentPoolService } from './agent-pool/agent-pool.service';
import * as fs from 'fs';

type ServiceClass = new (...args: any[]) => any;

type AgentFunction = (...args: any[]) => any;

export interface DiscoveredAgent {
  name: string;
  type: string;
  path: string;
  servicePath: string;
  functionPath?: string;
  pythonFunctionPath?: string;
}

@Injectable()
export class AgentDiscoveryService {
  private readonly logger = new Logger(AgentDiscoveryService.name);
  private discoveredAgents: DiscoveredAgent[] = [];

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
    await this.discoverAgentFunctions();

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
          // Recursively traverse subdirectories
          await this.traverseDirectory(fullPath);
        } else if (entry.isFile() && entry.name === 'agent-service.ts') {
          // Found an agent service file
          this.processAgentService(fullPath);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error traversing directory ${dirPath}:`, error.message);
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
      const agentIndex = pathParts.findIndex(part => part === 'agents');

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
          this.logger.warn(`Could not parse agent path structure from: ${servicePath}`);
        }
      } else {
        this.logger.warn(`Invalid agent path structure: ${servicePath}`);
      }
    } catch (error: any) {
      this.logger.error(`❌ Error processing agent service ${servicePath}:`, error);
    }
  }

  /**
   * Discover agent functions (TypeScript and Python)
   */
  private async discoverAgentFunctions(): Promise<void> {
    this.logger.debug('🔍 Discovering agent functions...');

    for (const agent of this.discoveredAgents) {
      try {
        const agentDirectory = agent.servicePath.replace('/agent-service.ts', '');

        // Look for TypeScript function
        const functionPath = join(agentDirectory, 'agent-function.ts');
        if (fs.existsSync(functionPath)) {
          agent.functionPath = functionPath;
          this.logger.debug(`📄 Found TypeScript function for ${agent.name}: ${functionPath}`);
        }

        // Look for Python function
        const pythonFunctionPath = join(agentDirectory, 'agent-function.py');
        if (fs.existsSync(pythonFunctionPath)) {
          agent.pythonFunctionPath = pythonFunctionPath;
          this.logger.debug(`🐍 Found Python function for ${agent.name}: ${pythonFunctionPath}`);
        }

      } catch (error: any) {
        this.logger.warn(`⚠️ Could not discover functions for ${agent.name}: ${error.message}`);
      }
    }

    const withFunctions = this.discoveredAgents.filter(a => a.functionPath || a.pythonFunctionPath);
    this.logger.log(`📄 Discovered ${withFunctions.length} agents with function files`);
  }

  /**
   * Get all discovered agents
   */
  getDiscoveredAgents(): DiscoveredAgent[] {
    return this.discoveredAgents;
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
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:4100';
    const agentType = this.determineAgentType(agentPath);
    const name = agentName.toLowerCase().replace(/\s+/g, '_');
    return `${baseUrl}/agents/${agentType}s/${name}/tasks`;
  }

  /**
   * Determine agent type from path
   */
  determineAgentType(agentPath: string): 'orchestrator' | 'specialist' | 'manager' | 'external' {
    if (agentPath.includes('orchestrator')) {
      return 'orchestrator';
    } else if (agentPath.includes('specialists')) {
      return 'specialist';
    } else if (agentPath.includes('api')) {
      return 'specialist'; // API agents are treated as specialists for routing
    } else if (agentPath.includes('external')) {
      return 'external';
    }
    return 'specialist';
  }
}
