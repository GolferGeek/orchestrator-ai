export interface OrchestrationDefinitionRecord {
  id: string;
  owner_agent_slug: string;
  organization_slug: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  definition: Record<string, any>;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface OrchestrationDefinitionCreateInput {
  owner_agent_slug: string;
  organization_slug: string;
  name: string;
  display_name: string;
  version?: string;
  description?: string | null;
  definition: Record<string, any>;
  status?: string;
  created_by?: string | null;
}

export interface OrchestrationDefinitionUpdateInput {
  display_name?: string;
  description?: string | null;
  definition?: Record<string, any>;
  status?: string;
  version?: string;
}
