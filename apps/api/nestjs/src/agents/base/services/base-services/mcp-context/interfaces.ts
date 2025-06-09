import { AgentSkill, AgentProvider } from '../a2a-base/interfaces';

/**
 * Interface for agent metadata extracted from context files
 */
export interface MCPAgentMetadata {
  name?: string;
  description?: string;
  version?: string;
  type?: string;
  capabilities?: string[];
  skills?: AgentSkill[];
  provider?: AgentProvider;
  contextFiles?: string[];
}

/**
 * Interface for context file information
 */
export interface ContextFile {
  path: string;
  type: 'metadata' | 'configuration' | 'data' | 'unknown';
  format: 'markdown' | 'json' | 'yaml' | 'txt' | 'unknown';
  content: string;
  lastModified: Date;
  size: number;
}

/**
 * Configuration for context loading
 */
export interface ContextConfig {
  enableMarkdown?: boolean;
  enableJson?: boolean;
  enableYaml?: boolean;
  enableTxt?: boolean;
  maxFileSize?: number; // in bytes
  excludePatterns?: string[];
}

/**
 * Context processing options
 */
export interface ContextProcessingOptions {
  includeMetadata?: boolean;
  includeContent?: boolean;
  formatAsMarkdown?: boolean;
  maxContextSize?: number;
}

/**
 * Context refresh result
 */
export interface ContextRefreshResult {
  success: boolean;
  filesLoaded: number;
  errors: string[];
  metadata: MCPAgentMetadata;
  lastUpdate: Date;
} 