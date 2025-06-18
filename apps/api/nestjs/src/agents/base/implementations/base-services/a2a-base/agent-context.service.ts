import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
  inputModes: string[];
  outputModes: string[];
}

export interface AgentContext {
  name: string;
  type: string;
  description: string;
  capabilities: string[];
  skills: AgentSkill[];
  inputModes: string[];
  outputModes: string[];
  url?: string;
  domain?: string;
  endpoint?: string;
  version?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AgentContextService {
  private readonly logger = new Logger(AgentContextService.name);
  private agentDirectory: string | null = null;

  // Public properties - set after initialization
  public name: string = 'Unknown Agent';
  public type: string = 'specialist';
  public description: string = '';
  public capabilities: string[] = [];
  public skills: AgentSkill[] = [];
  public inputModes: string[] = ['text/plain', 'application/json'];
  public outputModes: string[] = ['text/plain', 'application/json'];
  public url: string = '';
  public domain: string = '';
  public endpoint: string = '';
  public version: string = '1.0.0';
  public metadata: Record<string, any> = {};
  public isLoaded: boolean = false;

  /**
   * Initialize the context by loading and parsing the agent.yaml file
   */
  async initialize(agentDirectory: string): Promise<void> {
    this.agentDirectory = agentDirectory;
    const context = await this.loadContext();
    
    if (context) {
      this.name = context.name;
      this.type = context.type;
      this.description = context.description;
      this.capabilities = context.capabilities;
      this.skills = context.skills;
      this.inputModes = context.inputModes;
      this.outputModes = context.outputModes;
      this.url = context.url || '';
      this.domain = context.domain || '';
      this.endpoint = context.endpoint || '';
      this.version = context.version || '1.0.0';
      this.metadata = context.metadata || {};
      this.isLoaded = true;
    } else {
      // Set fallback values
      this.name = this.getFallbackName();
      this.description = `You are ${this.name}`;
      this.isLoaded = false;
    }
  }

  /**
   * Load and parse the agent context from YAML file
   */
  private async loadContext(): Promise<AgentContext | null> {
    if (!this.agentDirectory) {
      this.logger.warn('No agent directory set, cannot load context');
      return null;
    }

    const yamlPath = path.join(this.agentDirectory, 'agent.yaml');
    
    if (!fs.existsSync(yamlPath)) {
      this.logger.warn(`No agent.yaml found at: ${yamlPath}`);
      return null;
    }

    try {
      const yamlContent = fs.readFileSync(yamlPath, 'utf8');
      this.logger.debug(`Loaded YAML content length: ${yamlContent.length}`);
      
      const parsed = yaml.load(yamlContent) as any;
      
      if (!parsed) {
        this.logger.warn('Failed to parse YAML content');
        return null;
      }

      const context: AgentContext = {
        name: parsed.metadata?.name || 'Unknown Agent',
        type: parsed.metadata?.type || 'specialist', 
        description: parsed.metadata?.description || '',
        capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : [],
        skills: this.parseSkills(parsed.skills || []),
        inputModes: Array.isArray(parsed.inputModes) ? parsed.inputModes : ['text/plain', 'application/json'],
        outputModes: Array.isArray(parsed.outputModes) ? parsed.outputModes : ['text/plain', 'application/json'],
        url: this.buildAgentUrl(parsed),
        domain: parsed.domain || parsed.metadata?.domain || '',
        endpoint: parsed.endpoint || parsed.metadata?.endpoint || '/tasks',
        version: parsed.metadata?.version || '1.0.0',
        metadata: parsed.metadata || {}
      };

      this.logger.debug(`Parsed context: name=${context.name}, type=${context.type}, capabilities=${context.capabilities.length}, skills=${context.skills.length}`);
      
      return context;
    } catch (error) {
      this.logger.error(`Failed to load agent context from ${yamlPath}:`, error);
      return null;
    }
  }

  /**
   * Parse skills array from YAML with proper typing and validation
   */
  private parseSkills(skillsData: any[]): AgentSkill[] {
    if (!Array.isArray(skillsData)) {
      return [];
    }

    return skillsData.map((skill: any) => ({
      id: skill.id || '',
      name: skill.name || '',
      description: skill.description || '',
      tags: Array.isArray(skill.tags) ? skill.tags : [],
      examples: Array.isArray(skill.examples) ? skill.examples : [],
      inputModes: Array.isArray(skill.inputModes) ? skill.inputModes : ['text/plain', 'application/json'],
      outputModes: Array.isArray(skill.outputModes) ? skill.outputModes : ['text/plain', 'application/json']
    }));
  }

  /**
   * Build the complete agent URL from environment and YAML configuration
   */
  private buildAgentUrl(parsed: any): string {
    // If URL is explicitly provided in YAML, use it directly
    const explicitUrl = parsed.url || parsed.metadata?.url;
    if (explicitUrl) {
      return explicitUrl;
    }

    // Otherwise, build URL from environment base + YAML endpoint
    const baseUrl = process.env.AGENT_BASE_URL || 'http://localhost:4000';
    const endpoint = parsed.endpoint || parsed.metadata?.endpoint || '/tasks';
    
    // Ensure baseUrl doesn't end with slash and endpoint starts with slash
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    return `${cleanBaseUrl}${cleanEndpoint}`;
  }

  /**
   * Generate fallback name from directory structure
   */
  private getFallbackName(): string {
    if (!this.agentDirectory) {
      return 'Unknown Agent';
    }

    const dirName = path.basename(this.agentDirectory);
    return dirName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
} 