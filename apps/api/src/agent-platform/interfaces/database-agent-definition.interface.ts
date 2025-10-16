import { AgentRecord } from './agent-record.interface';

export interface AgentMetadataDefinition {
  name?: string;
  displayName?: string;
  description?: string | null;
  category?: string | null;
  version?: string | null;
  type?: string | null;
  tags: string[];
  provider?: string | null;
  raw?: Record<string, any> | null;
}

export interface AgentHierarchyDefinition {
  level?: string;
  reportsTo?: string;
  department?: string;
  team?: string[];
  path?: string;
}

export interface AgentSkillDefinition {
  id?: string;
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
  skillOrder?: number;
  isPrimary?: boolean;
  metadata?: Record<string, any>;
}

export interface AgentCommunicationDefinition {
  inputModes: string[];
  outputModes: string[];
}

export interface AgentExecutionDefinition {
  modeProfile: string;
  canConverse: boolean;
  canPlan: boolean;
  canBuild: boolean;
  canOrchestrate: boolean;
  requiresHumanGate: boolean;
  executionProfile?: string | null;
  timeoutSeconds?: number | null;
}

export interface AgentTransportApiDefinition {
  endpoint: string;
  method: string;
  timeout?: number;
  headers?: Record<string, string>;
  authentication?: any;
  requestTransform?: Record<string, any>;
  responseTransform?: Record<string, any>;
}

export interface AgentTransportExternalDefinition {
  endpoint: string;
  protocol?: string;
  timeout?: number;
  authentication?: Record<string, any> | null;
  retry?: Record<string, any> | null;
  expectedCapabilities?: string[];
  healthCheck?: Record<string, any> | null;
}

export interface AgentTransportDefinition {
  kind: 'api' | 'external' | 'function' | 'none';
  api?: AgentTransportApiDefinition;
  external?: AgentTransportExternalDefinition;
  function?: Record<string, any>;
  raw?: Record<string, any> | null;
}

export interface AgentLLMDefinition {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  raw?: Record<string, any> | null;
}

export interface AgentPromptDefinition {
  system?: string;
  plan?: string;
  build?: string;
  human?: string;
  additional?: Record<string, any> | null;
}

export interface AgentConfigPlanDefinition {
  format: 'json' | 'markdown' | 'yaml';
  schema?: Record<string, any>;
  template?: string;
}

export interface AgentConfigDeliverableDefinition {
  format: 'json' | 'markdown' | 'html';
  type: string;
  schema?: Record<string, any>;
  sections?: string[];
}

export interface AgentRuntimeDefinition {
  id: string;
  slug: string;
  organizationSlug: string | null;
  displayName: string;
  description?: string | null;
  agentType: string;
  modeProfile: string;
  status?: string | null;
  metadata: AgentMetadataDefinition;
  hierarchy?: AgentHierarchyDefinition;
  capabilities: string[];
  skills: AgentSkillDefinition[];
  communication: AgentCommunicationDefinition;
  execution: AgentExecutionDefinition;
  transport?: AgentTransportDefinition;
  llm?: AgentLLMDefinition;
  prompts: AgentPromptDefinition;
  context: Record<string, any> | null;
  config: Record<string, any> | null;
  agentCard?: Record<string, any> | null;
  rawDescriptor?: Record<string, any> | null;
  planStructure?: string | Record<string, any> | null;
  deliverableStructure?: string | Record<string, any> | null;
  ioSchema?: string | Record<string, any> | null;
  record: AgentRecord;
}
