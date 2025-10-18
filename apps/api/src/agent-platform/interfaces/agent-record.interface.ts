import type { JsonObject } from '@orchestrator-ai/transport-types';
import type { AgentConfigDefinition } from './database-agent-definition.interface';

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
