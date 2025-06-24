import { AgentSkill, AgentProvider } from '../a2a-base/interfaces';

/**
 * Agent base types - determines what files and services are expected
 */
export type AgentBaseType =
  | 'context'
  | 'function'
  | 'python-function'
  | 'api'
  | 'external';

/**
 * Interface for agent metadata extracted from context files
 */
export interface ContextAgentMetadata {
  name?: string;
  description?: string;
  version?: string;
  type?: AgentBaseType; // Updated to use strict typing
  capabilities?: string[];
  skills?: AgentSkill[];
  provider?: AgentProvider;
  contextFiles?: string[];
}

/**
 * Interface for the new clean YAML structure
 */
export interface CleanAgentMetadata {
  metadata: {
    name: string;
    category: string;
    version: string;
    description: string;
  };
  type: AgentBaseType;
  capabilities: string[];
  skills: AgentSkill[];
  inputModes: string[];
  outputModes: string[];
  configuration?: Record<string, any>;
}

/**
 * Interface for context.md content structure
 */
export interface AgentContextContent {
  systemPrompt: string;
  instructions?: string;
  examples?: Array<{
    query: string;
    response: string;
  }>;
  knowledgeBase?: string;
  rawContent: string; // Full markdown content
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
  metadata: ContextAgentMetadata;
  lastUpdate: Date;
}
