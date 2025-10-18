import type { JsonObject, JsonValue } from '@orchestrator-ai/transport-types';

export interface OrchestrationParameterDefinition extends JsonObject {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  default?: JsonValue;
  enum?: JsonValue[];
  [key: string]: JsonValue | undefined;
}

export interface OrchestrationCheckpointOption extends JsonObject {
  action: string;
  label: string;
  allows_modification?: boolean;
  [key: string]: JsonValue | undefined;
}

export interface OrchestrationCheckpointConfig extends JsonObject {
  question: string;
  required?: boolean;
  options?: OrchestrationCheckpointOption[];
  [key: string]: JsonValue | undefined;
}

export type OrchestrationStepType = 'agent' | 'orchestration';

export interface OrchestrationSubDefinition extends JsonObject {
  name: string;
  owner?: string;
  version?: string;
  parameters?: JsonObject;
  inherit_conversation?: boolean;
  metadata?: JsonObject;
  [key: string]: JsonValue | undefined;
}

export interface OrchestrationStepDefinition extends JsonObject {
  id: string;
  name: string;
  agent?: string;
  mode?: string;
  depends_on?: string[];
  input?: JsonObject;
  context?: JsonObject;
  output_mapping?: JsonObject;
  checkpoint_after?: OrchestrationCheckpointConfig;
  metadata?: JsonObject;
  type?: OrchestrationStepType;
  orchestration?: OrchestrationSubDefinition;
  [key: string]: JsonValue | undefined;
}

export interface OrchestrationDefinitionMetadata extends JsonObject {
  name?: string;
  displayName?: string;
  version?: string;
  description?: string;
  owner?: string;
  [key: string]: JsonValue | undefined;
}

export interface OrchestrationDefinitionBody extends JsonObject {
  steps: OrchestrationStepDefinition[];
  parameters?: OrchestrationParameterDefinition[];
  error_handling?: JsonObject;
  execution?: JsonObject;
  [key: string]: JsonValue | undefined;
}

export interface OrchestrationDefinitionSchema extends JsonObject {
  metadata?: OrchestrationDefinitionMetadata;
  orchestration: OrchestrationDefinitionBody;
  [key: string]: JsonValue | undefined;
}

export interface OrchestrationResolvedDefinition {
  recordId?: string;
  ownerAgentSlug: string;
  organizationSlug: string;
  name: string;
  displayName: string;
  version: string;
  description?: string | null;
  steps: OrchestrationStepDefinition[];
  parameters: OrchestrationParameterDefinition[];
  rawDefinition: JsonObject;
  execution?: OrchestrationExecutionConfig | null;
}

export interface OrchestrationConcurrencyConfig {
  maxParallel?: number | null;
  queueStrategy?: 'fifo' | 'dependency';
}

export interface OrchestrationCachingStepConfig {
  id: string;
  enabled?: boolean;
  ttlSeconds?: number | null;
}

export interface OrchestrationCachingConfig {
  enabled?: boolean;
  ttlSeconds?: number | null;
  strategy?: 'per_step' | 'definition';
  steps?: OrchestrationCachingStepConfig[];
}

export interface OrchestrationExecutionConfig {
  concurrency?: OrchestrationConcurrencyConfig | null;
  caching?: OrchestrationCachingConfig | null;
}
