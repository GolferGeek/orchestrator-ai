# PRD: Tool Agents System + Demo Supabase Tool Agent

## Overview

- **Goal**: Implement a minimal-but-solid Tool Agent system that wraps MCP tools; ship a working Demo Supabase Tool Agent for the `demo` org that exercises the full flow end-to-end.
- **Why**: Standardize MCP-powered capabilities behind a consistent agent contract. Enable orchestrators to compose tool agents reliably.

## Scope

- Tool Agent runtime support in API (enhance existing `ToolAgentRunnerService`).
- Database-based agent record (Agents table) for the Supabase Tool Agent with embedded YAML config.
- JSON definition for easy loading via existing admin endpoints or seed scripts (placed in `initial-agent-building/working`).
- Read-only MVP for Supabase (schema introspection, SQL generation, safe execution, results analysis).

## Non-Goals (MVP)
- No destructive SQL (DDL/DML).
- No plan mode for tool agents (BUILD-only for MVP).
- No UI work beyond existing admin endpoints.

## Architecture

### Tool Agent Runner
- Extend `apps/api/src/agent2agent/services/tool-agent-runner.service.ts` to:
  - Accept tool lists and params from agent `config` or request payload.
  - Support namespaced MCP tools (e.g., `supabase/get-schema`, `supabase/execute-sql`).
  - Interpolate parameters with `{{payload.*}}`, `{{metadata.*}}`, etc.
  - Execute sequentially or in parallel with `stopOnError` semantics.
  - Normalize results and persist a deliverable (JSON or Markdown) via `DeliverablesService`.

### MCP Service
- Use existing `apps/api/src/mcp/mcp.service.ts` for namespaced tool discovery and execution.
- Supabase tools provided by `apps/api/src/mcp/services/supabase/*`.

## Security & Config
- Fail fast on missing configuration; do not use silent defaults.
- Deny destructive SQL operations in MVP: `DROP`, `TRUNCATE`, `ALTER`, `DELETE`, `UPDATE`.
- Reference environment variables in YAML; do not commit secrets.
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY` (read-only)
  - `SUPABASE_SERVICE_ROLE_KEY` (optional, not used in MVP)

## Agent Database Record

- Table: `agents` (via `AgentsRepository.upsert`)
- Required fields to populate: `organization_slug`, `slug`, `display_name`, `description`, `agent_type`, `mode_profile`, `status`, `yaml`, plus optional `context`, `config`, `plan_structure`, `deliverable_structure`, `io_schema`.

## YAML Expectations (embedded in JSON `yaml`)

- Structure (high-level):
  - `metadata`: name, displayName, description, version, type: `tool`
  - `communication`: input/output modes
  - `configuration`:
    - `mcp.server`: `supabase`
    - `mcp.tools`: `["get-schema", "generate-sql", "execute-sql", "analyze-results"]`
    - `security`: denied operations, optional table allowlist
    - `deliverable`: `{ format: "json" | "markdown", type: "tool-result" }`
    - `execution_capabilities`: flags for plan/build/converse support (MVP: build only)

## Demo Supabase Tool Agent JSON (to add under initial-agent-building/working)

```json
{
  "organization_slug": "demo",
  "slug": "supabase-agent",
  "display_name": "Supabase Tool Agent",
  "description": "Wraps the Supabase MCP to inspect schema, generate SQL, execute queries (read-only), and analyze results.",
  "agent_type": "tool",
  "mode_profile": "tool_full",
  "version": "0.1.0",
  "status": "active",
  "yaml": "{\n  \"metadata\": {\n    \"name\": \"supabase-agent\",\n    \"displayName\": \"Supabase Tool Agent\",\n    \"description\": \"Wraps Supabase MCP for schema, SQL generation, safe execution, and results analysis.\",\n    \"version\": \"0.1.0\",\n    \"type\": \"tool\"\n  },\n  \"communication\": {\n    \"input_modes\": [\"text/plain\", \"application/json\"],\n    \"output_modes\": [\"application/json\", \"text/markdown\"]\n  },\n  \"configuration\": {\n    \"prompt_prefix\": \"You are a Supabase data specialist. Use MCP tools to safely inspect schema, craft SQL, execute read-only queries, and explain findings.\",\n    \"execution_capabilities\": {\n      \"supports_converse\": false,\n      \"supports_plan\": false,\n      \"supports_build\": true\n    },\n    \"mcp\": {\n      \"server\": \"supabase\",\n      \"tools\": [\"get-schema\", \"generate-sql\", \"execute-sql\", \"analyze-results\"]\n    },\n    \"security\": {\n      \"denied_operations\": [\"DROP\", \"TRUNCATE\", \"ALTER\", \"DELETE\", \"UPDATE\"],\n      \"allowed_tables\": [\"agent_conversations\", \"kpi_data\", \"kpi_metrics\", \"users\"]\n    },\n    \"deliverable\": {\n      \"format\": \"json\",\n      \"type\": \"tool-result\"\n    }\n  },\n  \"context\": {\n    \"input_modes\": [\"text/plain\", \"application/json\"],\n    \"output_modes\": [\"application/json\", \"text/markdown\"],\n    \"supported_modes\": [\"build\"]\n  }\n}",
  "context": {
    "input_modes": ["text/plain", "application/json"],
    "output_modes": ["application/json", "text/markdown"],
    "supported_modes": ["build"]
  },
  "plan_structure": null,
  "deliverable_structure": null,
  "io_schema": null
}
```

Notes:
- The `yaml` value is a JSON string of the YAML-like config (escaped for JSON). The loader persists it as `yaml` in the DB.
- Tools are called via namespaced form: `supabase/get-schema`, etc., by the runner.
- Secrets are not included; rely on environment variables for Supabase connectivity.

## Acceptance Criteria
- Tool Agent runner executes configured MCP tools in BUILD mode and creates a deliverable with structured results.
- Supabase Demo Tool Agent can:
  - List schema (`get-schema`)
  - Generate SQL (`generate-sql`) for a basic prompt
  - Execute read-only SQL (`execute-sql`)
  - Analyze results (`analyze-results`) and return a concise summary
- Agent record upsert succeeds via admin controller, and the agent is selectable/executable.

## Validation Steps
1. Upsert the JSON to `agents` via `POST /api/admin/agents` with body from the snippet above.
2. Trigger a BUILD task with payload:
   ```json
   {
     "tools": ["supabase/get-schema", "supabase/generate-sql", "supabase/execute-sql", "supabase/analyze-results"],
     "toolParams": {
       "supabase/generate-sql": { "query": "top 10 conversations by date", "tables": ["agent_conversations"], "max_rows": 10 },
       "supabase/execute-sql": { "max_rows": 100 },
       "supabase/analyze-results": { "analysis_prompt": "Summarize main findings for stakeholders" }
     }
   }
   ```
3. Confirm deliverable is created with `format=json` and includes tool results.

## Risks & Mitigations
- Missing env vars → Fail fast with clear messages; document required variables.
- Tool errors mid-chain → Respect `stopOnError` and surface which tool failed.
- SQL safety → Deny destructive ops in server and runner checks.

## Follow-Ups (Post-MVP)
- Add PLAN mode support for tool agents.
- Parameter schema validation per tool.
- Optional service-role path with explicit approval gates.
