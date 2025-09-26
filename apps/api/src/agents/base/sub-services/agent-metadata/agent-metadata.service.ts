import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ContextLoaderService } from '../context-loader/context-loader.service';

/**
 * Agent Metadata Interfaces
 */
export interface AgentCard {
  name: string;
  type?: string;
  description: string;
  url: string;
  provider?: AgentProvider;
  iconUrl?: string;
  version: string;
  documentationUrl?: string;
  capabilities: AgentCapabilities;
  securitySchemes?: Record<string, SecurityScheme>;
  security?: Array<Record<string, string[]>>;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
  supportsAuthenticatedExtendedCard?: boolean;
}

export interface AgentProvider {
  organization: string;
  url: string;
}

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
  extensions?: AgentExtension[];
}

export interface AgentExtension {
  uri: string;
  required?: boolean;
  description?: string;
  params?: Record<string, any>;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect' | 'mutualTLS';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, any>;
  openIdConnectUrl?: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface AgentCardConfig {
  card?: Partial<Omit<AgentCard, 'url' | 'capabilities'>>;
  capabilitiesOverride?: Partial<AgentCapabilities>;
  enableAuthenticatedExtendedCard?: boolean;
  authenticatedSkills?: AgentSkill[];
  authenticatedSecuritySchemes?: Record<string, SecurityScheme>;
}

export interface AgentMetadata {
  name: string;
  type: string;
  description: string;
  version: string;
  capabilities: string[];
  skills: AgentSkill[];
  provider?: AgentProvider;
  uptime?: number;
  pid?: number;
  nodeVersion?: string;
  videos?: string[]; // Video IDs from context.md
  [key: string]: any;
}

export interface AgentStructure {
  hasContextFile: boolean;
  hasFunctionFile: boolean;
  hasPythonFunction: boolean;
  hasServiceFile: boolean;
  contextPath?: string;
  functionPath?: string;
  pythonFunctionPath?: string;
  servicePath?: string;
  agentType: 'context' | 'function' | 'python-function' | 'hybrid' | 'unknown';
}

export interface DirectoryAnalysisResult {
  agentName: string;
  agentPath: string;
  structure: AgentStructure;
  metadata?: AgentMetadata;
}

export interface MetadataCacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  updateAgeOnGet?: boolean;
}

/**
 * Service responsible for handling agent metadata operations including
 * card generation, capability detection, directory analysis, and caching.
 */
@Injectable()
export class AgentMetadataService {
  private readonly logger = new Logger(AgentMetadataService.name);
  private readonly metadataCache: Map<string, AgentMetadata>;
  private readonly cardCache: Map<string, AgentCard>;
  private readonly structureCache: Map<string, AgentStructure>;
  private readonly startTime = Date.now();

  constructor(
    private readonly contextLoaderService: ContextLoaderService
  ) {
    const options = {
      maxSize: 100,
      ttl: 5 * 60 * 1000, // 5 minutes default
      updateAgeOnGet: true,
    };

    this.metadataCache = new Map<string, AgentMetadata>();
    this.cardCache = new Map<string, AgentCard>();
    this.structureCache = new Map<string, AgentStructure>();

  }

  /**
   * Generate an agent card from configuration and metadata
   */
  async generateAgentCard(
    agentConfig: any,
    baseUrl: string,
    config?: Partial<AgentCardConfig>,
  ): Promise<AgentCard> {
    const cacheKey = `card:${agentConfig.name || 'unknown'}:${baseUrl}`;
    const cached = this.cardCache.get(cacheKey);
    if (cached) {

      return cached;
    }

    const capabilities = {
      ...this.getDefaultCapabilities(),
      ...config?.capabilitiesOverride,
    };

    const card: AgentCard = {
      name: agentConfig.name || 'Unknown Agent',
      type: agentConfig.type || 'general',
      description:
        agentConfig.description ||
        `${agentConfig.name || 'Unknown Agent'} - A2A Protocol compliant agent`,
      url: baseUrl,
      provider: agentConfig.provider || this.getDefaultProvider(),
      version: agentConfig.version || '1.0.0',
      capabilities,
      securitySchemes: this.getDefaultSecuritySchemes(),
      security: this.getDefaultSecurityRequirements(),
      defaultInputModes: this.getDefaultInputModes(),
      defaultOutputModes: this.getDefaultOutputModes(),
      skills: await this.getAgentSkills(agentConfig),
      supportsAuthenticatedExtendedCard:
        config?.enableAuthenticatedExtendedCard ?? false,
    };

    // Apply any card overrides from config
    if (config?.card) {
      Object.assign(card, config.card);
    }

    // Cache the generated card
    this.cardCache.set(cacheKey, card);

    return card;
  }

  /**
   * Generate an authenticated extended agent card with additional features
   */
  async generateAuthenticatedAgentCard(
    agentConfig: any,
    baseUrl: string,
    config?: Partial<AgentCardConfig>,
  ): Promise<AgentCard> {
    const baseCard = await this.generateAgentCard(agentConfig, baseUrl, config);

    // Add authenticated-only skills
    if (config?.authenticatedSkills) {
      baseCard.skills.push(...config.authenticatedSkills);
    }

    // Add authenticated-only security schemes
    if (config?.authenticatedSecuritySchemes) {
      baseCard.securitySchemes = {
        ...baseCard.securitySchemes,
        ...config.authenticatedSecuritySchemes,
      };
    }

    return baseCard;
  }

  /**
   * Detect capabilities based on agent type and configuration
   */
  detectCapabilities(agentType: string, agentConfig: any): string[] {
    const capabilities: string[] = [];

    // Base capabilities for all agents
    capabilities.push('general_assistance');

    // Type-specific capabilities
    switch (agentType.toLowerCase()) {
      case 'orchestrator':
        capabilities.push(
          'task_delegation',
          'agent_coordination',
          'workflow_management',
        );
        break;
      case 'specialist':
        capabilities.push('domain_expertise', 'specialized_processing');
        break;
      case 'context':
        capabilities.push('context_processing', 'document_analysis');
        break;
      case 'function':
        capabilities.push('function_execution', 'code_processing');
        break;
      case 'python-function':
        capabilities.push(
          'python_execution',
          'script_processing',
          'data_analysis',
        );
        break;
      default:
        capabilities.push('general_processing');
    }

    // Configuration-based capabilities
    if (agentConfig.streaming) {
      capabilities.push('streaming_support');
    }
    if (agentConfig.pushNotifications) {
      capabilities.push('push_notifications');
    }
    if (agentConfig.authentication) {
      capabilities.push('authenticated_access');
    }
    if (agentConfig.fileProcessing) {
      capabilities.push('file_processing');
    }

    // Add any explicitly configured capabilities
    if (Array.isArray(agentConfig.capabilities)) {
      capabilities.push(...agentConfig.capabilities);
    }

    // Remove duplicates and return
    return [...new Set(capabilities)];
  }

  /**
   * Analyze directory structure to determine agent type and files
   */
  async analyzeDirectoryStructure(
    directoryPath: string,
  ): Promise<AgentStructure> {
    const cacheKey = `structure:${directoryPath}`;
    const cached = this.structureCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const structure: AgentStructure = {
        hasContextFile: false,
        hasFunctionFile: false,
        hasPythonFunction: false,
        hasServiceFile: false,
        agentType: 'unknown',
      };

      // Check for various agent files
      const contextPath = path.join(directoryPath, 'agent-context.md');
      const functionPath = path.join(directoryPath, 'agent-function.ts');
      const pythonFunctionPath = path.join(directoryPath, 'agent-function.py');
      const servicePath = path.join(directoryPath, 'agent-service.ts');

      // Check file existence
      structure.hasContextFile = await fs.pathExists(contextPath);
      structure.hasFunctionFile = await fs.pathExists(functionPath);
      structure.hasPythonFunction = await fs.pathExists(pythonFunctionPath);
      structure.hasServiceFile = await fs.pathExists(servicePath);

      // Set file paths if they exist
      if (structure.hasContextFile) structure.contextPath = contextPath;
      if (structure.hasFunctionFile) structure.functionPath = functionPath;
      if (structure.hasPythonFunction)
        structure.pythonFunctionPath = pythonFunctionPath;
      if (structure.hasServiceFile) structure.servicePath = servicePath;

      // Determine agent type based on files present
      if (structure.hasPythonFunction) {
        structure.agentType = structure.hasContextFile
          ? 'hybrid'
          : 'python-function';
      } else if (structure.hasFunctionFile) {
        structure.agentType = structure.hasContextFile ? 'hybrid' : 'function';
      } else if (structure.hasContextFile) {
        structure.agentType = 'context';
      } else if (structure.hasServiceFile) {
        structure.agentType = 'unknown'; // Custom service implementation
      }

      // Cache the result
      this.structureCache.set(cacheKey, structure);

      return structure;
    } catch (error) {

      return {
        hasContextFile: false,
        hasFunctionFile: false,
        hasPythonFunction: false,
        hasServiceFile: false,
        agentType: 'unknown',
      };
    }
  }

  /**
   * Analyze a directory and extract complete agent information
   */
  async analyzeAgentDirectory(
    directoryPath: string,
  ): Promise<DirectoryAnalysisResult> {
    const agentName = path.basename(directoryPath);
    const structure = await this.analyzeDirectoryStructure(directoryPath);

    let metadata: AgentMetadata | undefined;

    // Try to extract metadata from context file if available
    if (structure.hasContextFile && structure.contextPath) {
      try {
        metadata = await this.extractMetadataFromContext(structure.contextPath);
      } catch (error) {

      }
    }

    return {
      agentName,
      agentPath: directoryPath,
      structure,
      metadata,
    };
  }

  /**
   * Get cached metadata for an agent
   */
  getCachedMetadata(agentId: string): AgentMetadata | null {
    return this.metadataCache.get(agentId) || null;
  }

  /**
   * Cache metadata for an agent
   */
  cacheMetadata(agentId: string, metadata: AgentMetadata): void {
    this.metadataCache.set(agentId, metadata);

  }

  /**
   * Get video IDs for an agent by analyzing its context.md file
   */
  async getAgentVideoIds(agentDirectory: string): Promise<string[] | undefined> {
    try {
      const contextContent = await this.contextLoaderService.loadContextFile(agentDirectory);
      return contextContent?.videos;
    } catch (error) {
      this.logger.error(`Error loading video IDs for agent ${agentDirectory}:`, error);
      return undefined;
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.metadataCache.clear();
    this.cardCache.clear();
    this.structureCache.clear();

  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      metadata: {
        size: this.metadataCache.size,
      },
      cards: {
        size: this.cardCache.size,
      },
      structures: {
        size: this.structureCache.size,
      },
    };
  }

  /**
   * Validate an agent card structure
   */
  validateAgentCard(card: AgentCard): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!card.name?.trim()) {
      errors.push('Agent card must have a non-empty name');
    }

    if (!card.description?.trim()) {
      errors.push('Agent card must have a non-empty description');
    }

    if (!card.url?.trim()) {
      errors.push('Agent card must have a valid URL');
    }

    if (!card.version?.trim()) {
      errors.push('Agent card must have a version');
    }

    if (!Array.isArray(card.skills) || card.skills.length === 0) {
      errors.push('Agent card must have at least one skill');
    }

    if (
      !Array.isArray(card.defaultInputModes) ||
      card.defaultInputModes.length === 0
    ) {
      errors.push('Agent card must specify default input modes');
    }

    if (
      !Array.isArray(card.defaultOutputModes) ||
      card.defaultOutputModes.length === 0
    ) {
      errors.push('Agent card must specify default output modes');
    }

    // Validate skills
    card.skills?.forEach((skill, index) => {
      if (!skill.id?.trim()) {
        errors.push(`Skill at index ${index} must have a non-empty ID`);
      }
      if (!skill.name?.trim()) {
        errors.push(`Skill at index ${index} must have a non-empty name`);
      }
      if (!skill.description?.trim()) {
        errors.push(
          `Skill at index ${index} must have a non-empty description`,
        );
      }
      if (!Array.isArray(skill.tags)) {
        errors.push(`Skill at index ${index} must have tags array`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Private helper methods

  private async extractMetadataFromContext(
    contextPath: string,
  ): Promise<AgentMetadata> {
    const content = await fs.readFile(contextPath, 'utf-8');

    // Use ContextLoaderService to parse the full context including videos
    const agentDirectory = path.dirname(contextPath);
    const contextContent = await this.contextLoaderService.loadContextFile(agentDirectory);

    // Basic metadata extraction from markdown content
    const metadata: AgentMetadata = {
      name: this.extractFromContent(content, /^#\s+(.+)$/m) || 'Unknown Agent',
      type: this.extractFromContent(content, /Type:\s*(.+)$/im) || 'general',
      description:
        this.extractFromContent(content, /Description:\s*(.+)$/im) || '',
      version:
        this.extractFromContent(content, /Version:\s*(.+)$/im) || '1.0.0',
      capabilities: this.extractCapabilitiesFromContent(content),
      skills: await this.extractSkillsFromContent(content),
      videos: contextContent?.videos, // Add video IDs from ContextLoaderService
    };

    return metadata;
  }

  private extractFromContent(content: string, regex: RegExp): string | null {
    const match = content.match(regex);
    return match ? match[1]?.trim() || '' : '';
  }

  private extractCapabilitiesFromContent(content: string): string[] {
    const capabilitiesMatch = content.match(
      /Capabilities:\s*([\s\S]*?)(?=\n\n|\n#|$)/im,
    );
    if (!capabilitiesMatch) return ['general_assistance'];

    const capabilitiesText = capabilitiesMatch[1] || '';
    const capabilities = capabilitiesText
      .split(/[,\n]/)
      .map((cap) => cap.trim().replace(/^[-*]\s*/, ''))
      .filter((cap) => cap.length > 0);

    return capabilities.length > 0 ? capabilities : ['general_assistance'];
  }

  private async extractSkillsFromContent(
    content: string,
  ): Promise<AgentSkill[]> {
    // Extract skills from markdown content
    const skillsSection = content.match(/Skills:\s*([\s\S]*?)(?=\n\n|\n#|$)/im);
    if (!skillsSection) {
      return this.getDefaultSkills();
    }

    const skillsText = skillsSection[1] || '';
    const skillBlocks = skillsText
      ?.split(/\n\s*[-*]\s*/)
      .filter((block) => block.trim());

    const skills: AgentSkill[] = [];

    for (const block of skillBlocks) {
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line);
      if (lines.length > 0) {
        const name = lines[0]?.replace(/^\*\*(.+)\*\*$/, '$1').trim() || '';
        const description = lines.slice(1).join(' ').trim() || name;

        skills.push({
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name,
          description,
          tags: ['general'],
          examples: [`Use ${name.toLowerCase()}`],
        });
      }
    }

    return skills.length > 0 ? skills : this.getDefaultSkills();
  }

  private getDefaultCapabilities(): AgentCapabilities {
    return {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
      extensions: [],
    };
  }

  private getDefaultProvider(): AgentProvider {
    return {
      organization: 'Orchestra AI',
      url: 'https://orchestra-ai.com',
    };
  }

  private getDefaultSecuritySchemes(): Record<string, SecurityScheme> {
    return {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Bearer token authentication',
      },
    };
  }

  private getDefaultSecurityRequirements(): Array<Record<string, string[]>> {
    return [{ bearerAuth: [] }];
  }

  private getDefaultInputModes(): string[] {
    return ['text/plain', 'application/json'];
  }

  private getDefaultOutputModes(): string[] {
    return ['text/plain', 'application/json'];
  }

  private async getAgentSkills(agentConfig: any): Promise<AgentSkill[]> {
    // Use configured skills if available
    if (Array.isArray(agentConfig.skills) && agentConfig.skills.length > 0) {
      return agentConfig.skills;
    }

    return this.getDefaultSkills();
  }

  private getDefaultSkills(): AgentSkill[] {
    return [
      {
        id: 'basic-communication',
        name: 'Basic Communication',
        description:
          'Handle basic agent-to-agent communication and task processing',
        tags: ['communication', 'tasks', 'a2a'],
        examples: [
          'Process incoming agent requests',
          'Handle task delegation',
          'Provide agent status information',
        ],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
      },
    ];
  }
}
