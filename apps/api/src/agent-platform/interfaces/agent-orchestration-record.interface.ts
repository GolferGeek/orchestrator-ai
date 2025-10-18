import type { JsonObject, JsonValue } from '@orchestrator-ai/transport-types';
import type { OrchestrationDefinitionSchema } from '../types/orchestration-definition.types';

export interface PromptParameterDefinition {
  key: string;
  label?: string;
  description?: string;
  required?: boolean;
  type?: string;
  enumValues?: string[];
  defaultValue?: JsonValue;
  metadata?: JsonObject;
}

export interface PromptTemplateDefinition {
  name: string;
  description?: string;
  template: string;
  modelProfile?: string;
  parameters?: PromptParameterDefinition[];
  metadata?: JsonObject;
}

export interface AgentOrchestrationRecord {
  id: string;
  organization_slug: string | null;
  agent_slug: string;
  slug: string;
  display_name: string;
  description: string | null;
  status: string;
  orchestration_json: OrchestrationDefinitionSchema;
  prompt_templates: PromptTemplateDefinition[];
  tags: string[];
  version: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentOrchestrationUpsertInput {
  organization_slug: string | null;
  agent_slug: string;
  slug: string;
  display_name: string;
  description?: string | null;
  status?: string;
  orchestration_json: OrchestrationDefinitionSchema;
  prompt_templates?: PromptTemplateDefinition[];
  tags?: string[];
  version?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface AgentOrchestrationQuery {
  organization_slug: string | null;
  agent_slug: string;
  slug: string;
}
