import type { JsonObject, JsonValue } from '@orchestrator-ai/transport-types';
import { AgentRecord } from './agent-record.interface';

type JsonNullable<T extends JsonValue = JsonValue> = T | null;

export interface AgentMetadataDefinition {
  name?: string;
  displayName?: string;
  description?: string | null;
  category?: string | null;
  version?: string | null;
  type?: string | null;
  tags: string[];
  provider?: string | null;
  raw?: JsonNullable<JsonObject>;
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
  metadata?: JsonObject;
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
  authentication?: JsonNullable<JsonObject>;
  requestTransform?: JsonNullable<JsonObject>;
  responseTransform?: JsonNullable<JsonObject>;
}

export interface AgentTransportExternalDefinition {
  endpoint: string;
  protocol?: string;
  timeout?: number;
  authentication?: JsonNullable<JsonObject>;
  retry?: JsonNullable<JsonObject>;
  expectedCapabilities?: string[];
  healthCheck?: JsonNullable<JsonObject>;
}

export interface AgentTransportDefinition {
  kind: 'api' | 'external' | 'function' | 'none';
  api?: AgentTransportApiDefinition;
  external?: AgentTransportExternalDefinition;
  function?: JsonObject;
  raw?: JsonNullable<JsonObject>;
}

export interface AgentLLMDefinition {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  raw?: JsonNullable<JsonObject>;
}

export interface AgentPromptDefinition {
  system?: string;
  plan?: string;
  build?: string;
  human?: string;
  additional?: JsonNullable<JsonObject>;
}

export interface AgentConfigPlanDefinition {
  format: 'json' | 'markdown' | 'yaml';
  schema?: JsonObject;
  template?: string;
}

export interface AgentConfigDeliverableDefinition {
  format: 'json' | 'markdown' | 'html';
  type: string;
  schema?: JsonObject;
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
  context: JsonNullable<JsonObject>;
  config: JsonNullable<JsonObject>;
  agentCard?: JsonNullable<JsonObject>;
  rawDescriptor?: JsonNullable<JsonObject>;
  planStructure?: string | JsonNullable<JsonObject>;
  deliverableStructure?: string | JsonNullable<JsonObject>;
  ioSchema?: string | JsonNullable<JsonObject>;
  record: AgentRecord;
}
