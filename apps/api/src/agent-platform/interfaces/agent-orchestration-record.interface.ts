export interface PromptParameterDefinition {
  key: string;
  label?: string;
  description?: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'json' | 'enum' | string;
  enumValues?: string[];
  defaultValue?: any;
}

export interface PromptTemplateDefinition {
  name: string;
  description?: string;
  template: string;
  modelProfile?: string;
  parameters?: PromptParameterDefinition[];
}

export interface AgentOrchestrationRecord {
  id: string;
  organization_slug: string | null;
  agent_slug: string;
  slug: string;
  display_name: string;
  description: string | null;
  status: string;
  orchestration_json: Record<string, any>;
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
  orchestration_json: Record<string, any>;
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
