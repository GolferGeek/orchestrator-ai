import type {
  JsonObject,
  JsonValue,
} from '@orchestrator-ai/transport-types';

export interface OrchestrationParameterDefinition {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  default?: JsonValue;
  enum?: JsonValue[];
}

export interface OrchestrationCheckpointOption {
  action: string;
  label: string;
  allows_modification?: boolean;
}

export interface OrchestrationCheckpointConfig {
  question: string;
  required?: boolean;
  options?: OrchestrationCheckpointOption[];
}

export type OrchestrationStepType = 'agent' | 'orchestration';

export interface OrchestrationSubDefinition {
  name: string;
  owner?: string;
  version?: string;
  parameters?: JsonObject;
  inherit_conversation?: boolean;
  metadata?: JsonObject;
}

export interface OrchestrationStepDefinition {
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
}

export interface OrchestrationDefinitionSchema {
  metadata?: {
    name?: string;
    displayName?: string;
    version?: string;
    description?: string;
    owner?: string;
  };
  orchestration: {
    steps: OrchestrationStepDefinition[];
    parameters?: OrchestrationParameterDefinition[];
    error_handling?: JsonObject;
    execution?: JsonObject;
  };
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
