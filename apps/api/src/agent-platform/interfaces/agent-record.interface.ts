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
  agent_card: Record<string, any> | null;
  context: Record<string, any> | null;
  config: Record<string, any> | null;
  plan_structure: Record<string, any> | null;
  deliverable_structure: Record<string, any> | null;
  io_schema: Record<string, any> | null;
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
  agent_card?: Record<string, any> | null;
  context?: Record<string, any> | null;
  config?: Record<string, any> | null;
  plan_structure?: Record<string, any> | null;
  deliverable_structure?: Record<string, any> | null;
  io_schema?: Record<string, any> | null;
}
