import type { JsonObject, JsonValue } from '@orchestrator-ai/transport-types';

type JsonNullable<T extends JsonValue = JsonValue> = T | null;

// ============================================================================
// Database Record Types
// ============================================================================

export interface AgentRecord {
  id: string;
  organization_slug: string | null;
  slug: string;
  display_name: string;
  description: string | null;
  agent_type: string;
  mode_profile: string;
  version: string | null;
  status: string | null;
  yaml: string;
  function_code: string | null;
  agent_card: JsonObject | null;
  context: JsonObject | null;
  config: AgentConfigDefinition | null;
  plan_structure: JsonObject | null;
  deliverable_structure: JsonObject | null;
  io_schema: JsonObject | null;
  created_at: string;
  updated_at: string;
}

export interface AgentUpsertInput {
  organization_slug: string | null;
  slug: string;
  display_name: string;
  description?: string | null;
  agent_type: string;
  mode_profile: string;
  version?: string | null;
  status?: string | null;
  yaml: string;
  function_code?: string | null;
  context?: JsonObject | null;
  plan_structure?: string | JsonObject | null;
  deliverable_structure?: string | JsonObject | null;
  io_schema?: JsonObject | null;
  config?: AgentConfigDefinition | null;
}

export interface AgentUpsertRow {
  organization_slug: string | null;
  slug: string;
  display_name: string;
  description: string | null;
  agent_type: string;
  mode_profile: string;
  version: string | null;
  status: string | null;
  yaml: string;
  function_code: string | null;
  context: JsonObject | null;
  plan_structure?: string | JsonObject | null;
  deliverable_structure?: string | JsonObject | null;
  io_schema?: JsonObject | null;
  config?: AgentConfigDefinition | null;
  updated_at: string;
}

// ============================================================================
// Agent Definition Types
// ============================================================================

export interface AgentMetadataDefinition extends JsonObject {
  name?: string;
  displayName?: string;
  description?: string | null;
  category?: string | null;
  version?: string | null;
  type?: string | null;
  tags: string[];
  provider?: string | null;
  raw?: JsonNullable<JsonObject>;
  [key: string]: JsonValue | undefined;
}

export interface AgentHierarchyDefinition extends JsonObject {
  level?: string;
  reportsTo?: string;
  department?: string;
  team?: string[];
  path?: string;
  [key: string]: JsonValue | undefined;
}

export interface AgentSkillDefinition extends JsonObject {
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
  [key: string]: JsonValue | undefined;
}

export interface AgentCommunicationDefinition extends JsonObject {
  inputModes: string[];
  outputModes: string[];
  [key: string]: JsonValue | undefined;
}

export interface AgentExecutionDefinition extends JsonObject {
  modeProfile: string;
  canConverse: boolean;
  canPlan: boolean;
  canBuild: boolean;
  canOrchestrate: boolean;
  requiresHumanGate: boolean;
  executionProfile?: string | null;
  timeoutSeconds?: number | null;
  [key: string]: JsonValue | undefined;
}

export interface AgentTransportApiDefinition extends JsonObject {
  endpoint: string;
  method: string;
  timeout?: number;
  headers?: Record<string, string>;
  authentication?: JsonNullable<JsonObject>;
  requestTransform?: JsonNullable<JsonObject>;
  responseTransform?: JsonNullable<JsonObject>;
  queryParams?: JsonNullable<JsonObject>;
  body?: JsonNullable<JsonObject>;
  failOnError?: boolean;
  [key: string]: JsonValue | undefined;
}

export interface AgentTransportExternalDefinition extends JsonObject {
  endpoint: string;
  protocol?: string;
  timeout?: number;
  authentication?: JsonNullable<JsonObject>;
  retry?: JsonNullable<JsonObject>;
  expectedCapabilities?: string[];
  healthCheck?: JsonNullable<JsonObject>;
  [key: string]: JsonValue | undefined;
}

export interface AgentTransportFunctionDefinition extends JsonObject {
  handler: string;
  timeoutSeconds?: number;
  [key: string]: JsonValue | undefined;
}

export interface AgentTransportDefinition extends JsonObject {
  kind: 'api' | 'external' | 'function' | 'none';
  api?: AgentTransportApiDefinition;
  external?: AgentTransportExternalDefinition;
  function?: AgentTransportFunctionDefinition;
  raw?: JsonNullable<JsonObject>;
  [key: string]: JsonValue | undefined;
}

export interface AgentLLMDefinition extends JsonObject {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  raw?: JsonNullable<JsonObject>;
  [key: string]: JsonValue | undefined;
}

export interface AgentPromptDefinition extends JsonObject {
  system?: string;
  plan?: string;
  build?: string;
  human?: string;
  additional?: JsonNullable<JsonObject>;
  [key: string]: JsonValue | undefined;
}

export interface AgentConfigPlanDefinition extends JsonObject {
  format: 'json' | 'markdown' | 'yaml';
  schema?: JsonObject;
  template?: string;
  [key: string]: JsonValue | undefined;
}

export interface AgentConfigDeliverableDefinition extends JsonObject {
  format: 'json' | 'markdown' | 'html';
  type: string;
  schema?: JsonObject;
  sections?: string[];
  [key: string]: JsonValue | undefined;
}

export interface AgentLLMConfigDefinition extends JsonObject {
  provider?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  maxTokens?: number;
  system_prompt?: string;
  systemPrompt?: string;
  [key: string]: JsonValue | undefined;
}

export interface AgentConfigDefinition extends JsonObject {
  api?: AgentTransportApiDefinition;
  deliverable?: AgentConfigDeliverableDefinition;
  llm?: AgentLLMConfigDefinition;
  execution_capabilities?: JsonValue;
  executionCapabilities?: JsonValue;
  execution_profile?: string | null;
  executionProfile?: string | null;
  timeout_seconds?: number | null;
  timeoutSeconds?: number | null;
  plan_structure?: JsonValue;
  planStructure?: JsonValue;
  deliverable_structure?: JsonValue;
  deliverableStructure?: JsonValue;
  io_schema?: JsonValue;
  ioSchema?: JsonValue;
  [key: string]: JsonValue | undefined;
}

// ============================================================================
// Runtime Definition
// ============================================================================

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
  config: AgentConfigDefinition | null;
  agentCard?: JsonNullable<JsonObject>;
  rawDescriptor?: JsonNullable<JsonObject>;
  planStructure?: string | JsonNullable<JsonObject>;
  deliverableStructure?: string | JsonNullable<JsonObject>;
  ioSchema?: string | JsonNullable<JsonObject>;
  record: AgentRecord;
}
