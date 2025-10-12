export interface OrchestrationParameterDefinition {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  default?: any;
  enum?: any[];
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
  parameters?: Record<string, any>;
  inherit_conversation?: boolean;
  metadata?: Record<string, any>;
}

export interface OrchestrationStepDefinition {
  id: string;
  name: string;
  agent?: string;
  mode?: string;
  depends_on?: string[];
  input?: Record<string, any>;
  context?: Record<string, any>;
  output_mapping?: Record<string, any>;
  checkpoint_after?: OrchestrationCheckpointConfig;
  metadata?: Record<string, any>;
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
    error_handling?: Record<string, any>;
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
  rawDefinition: Record<string, any>;
}
