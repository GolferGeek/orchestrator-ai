# Tool Agent System — PRD (with Supabase Demo Agent)

## 1) Overview

- **Goal**: Implement a reliable Tool Agent system that wraps MCP tools and ships a working Supabase Tool Agent for the `demo` org.
- **Why**: Standardize MCP-powered capabilities with a consistent agent contract for orchestration and composition.
- **Initial Demo**: Supabase Tool Agent (read-only analytics flow) using the existing Supabase MCP server.

## 2) In Scope (MVP)
- Enhance the runner to execute namespaced MCP tools with configuration-driven behavior.
- Store the Supabase Tool Agent as a database agent in `agents` with embedded YAML config (string), seeded via JSON in `initial-agent-building/working`.
- Read-only database operations (schema, NL→SQL, safe execution, result analysis).

## 3) Out of Scope (MVP)
- Destructive SQL (DDL/DML).
- PLAN mode for tool agents (BUILD-only).
- UI/Agent Builder changes beyond existing admin endpoints.

## 4) Architecture

### 4.1 Components
- **ToolAgentRunnerService**: Executes configured tools, chains results, formats deliverables.
- **MCPService**: Namespaced tool discovery and routing (`supabase/*`, `slack/*`, `notion/*`).
- **Supabase MCP**: Implements tools: `get-schema`, `generate-sql`, `execute-sql`, `analyze-results`.

### 4.2 Execution Flow (BUILD)
1. Load agent definition (DB-based) and merge request overrides.
2. Validate configuration (fail-fast, no fallbacks).
3. Determine execution order (sequential/parallel) and `stopOnError` behavior.
4. Execute each tool via MCP (`MCPService.callTool`) with interpolated params.
5. Collect per-tool results (success/failure), format deliverable, and persist via `DeliverablesService`.

### 4.3 Namespacing
- All tools must be fully namespaced: `namespace/tool` (e.g., `supabase/get-schema`).
- The runner invokes tools exactly as provided; no implicit prefixing.

## 5) Configuration Contract (YAML embedded as string in `yaml` column)

### 5.1 Top-level keys
- `metadata`: { `name`, `displayName`, `description`, `version`, `type: "tool"` }
- `communication`: { `input_modes[]`, `output_modes[]` }
- `configuration`: object (details below)
- `context`: optional additional context and supported modes

### 5.2 `configuration` keys (authoritative)
- `prompt_prefix`: string
- `execution_capabilities`: { `supports_converse`: boolean, `supports_plan`: boolean, `supports_build`: boolean }
- `mcp`: { `server`: string } // informational; runner uses namespaced tool names
- `tools`: string[] // REQUIRED; fully namespaced, e.g., `supabase/generate-sql`
- `toolParams`: object // OPTIONAL; keyed by tool name, values are param objects
- `toolExecutionMode`: "sequential" | "parallel" // OPTIONAL; default "sequential"
- `stopOnError`: boolean // OPTIONAL; default true
- `security`: { `denied_operations`: string[], `allowed_tables`?: string[] }
- `deliverable`: { `format`: "json"|"markdown"|"text", `type`: string }

### 5.3 Parameter Interpolation
- Strings may reference request fields using `{{payload.*}}` or `{{metadata.*}}`.
- Non-strings are passed through as-is.

## 6) Validation (Fail-Fast, No Fallbacks)
- If `configuration.tools` is missing/empty → error: "No tools configured for this agent".
- If a tool name lacks a namespace → error: "Tool '<name>' must include namespace: expected 'namespace/tool'".
- If MCP server health is required and unavailable → error: "MCP server is not available" (include namespace if known).
- If required environment variables for Supabase are missing → error: "Required environment variable SUPABASE_URL (or key) is not set".
- If a tool call fails → record failure and stop immediately when `stopOnError = true`.

## 7) Security
- Deny destructive SQL operations in MVP: `DROP`, `TRUNCATE`, `ALTER`, `DELETE`, `UPDATE`.
- Enforce denylist in Supabase MCP and optionally in runner input validation.
- Optional allowlist of tables to restrict access scope.

## 8) Observability
- Runner logs: agent slug, tools executed, execution mode, stopOnError.
- Deliverable metadata: `toolsExecuted`, `successfulTools`, `failedTools`, `executionMode`, `stopOnError`, `toolsUsed[]`.

## 9) Database Agent Record (Agents table)
- Required fields for upsert: `organization_slug`, `slug`, `display_name`, `agent_type`, `mode_profile`, `status`, `yaml`.
- Optional: `description`, `context`, `plan_structure`, `deliverable_structure`, `io_schema`, `config`.

## 10) Demo Supabase Tool Agent — JSON for Seeding
- Location: `initial-agent-building/working/demo_supabase_agent.json`
- Note: the `yaml` field contains a JSON string for the agent descriptor.

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
  "yaml": "{\n  \"metadata\": {\n    \"name\": \"supabase-agent\",\n    \"displayName\": \"Supabase Tool Agent\",\n    \"description\": \"Wraps Supabase MCP for schema, SQL generation, safe execution, and results analysis.\",\n    \"version\": \"0.1.0\",\n    \"type\": \"tool\"\n  },\n  \"communication\": {\n    \"input_modes\": [\"text/plain\", \"application/json\"],\n    \"output_modes\": [\"application/json\", \"text/markdown\"]\n  },\n  \"configuration\": {\n    \"prompt_prefix\": \"You are a Supabase data specialist. Use MCP tools to safely inspect schema, craft SQL, execute read-only queries, and explain findings.\",\n    \"execution_capabilities\": {\n      \"supports_converse\": false,\n      \"supports_plan\": false,\n      \"supports_build\": true\n    },\n    \"mcp\": {\n      \"server\": \"supabase\"\n    },\n    \"tools\": [\n      \"supabase/get-schema\",\n      \"supabase/generate-sql\",\n      \"supabase/execute-sql\",\n      \"supabase/analyze-results\"\n    ],\n    \"toolParams\": {\n      \"supabase/generate-sql\": { \"tables\": [\"agent_conversations\"], \"max_rows\": 100 },\n      \"supabase/execute-sql\": { \"max_rows\": 1000 },\n      \"supabase/analyze-results\": { \"analysis_prompt\": \"Summarize for stakeholders\" }\n    },\n    \"toolExecutionMode\": \"sequential\",\n    \"stopOnError\": true,\n    \"security\": {\n      \"denied_operations\": [\"DROP\", \"TRUNCATE\", \"ALTER\", \"DELETE\", \"UPDATE\"],\n      \"allowed_tables\": [\"agent_conversations\", \"kpi_data\", \"kpi_metrics\", \"users\"]\n    },\n    \"deliverable\": {\n      \"format\": \"json\",\n      \"type\": \"tool-result\"\n    }\n  },\n  \"context\": {\n    \"input_modes\": [\"text/plain\", \"application/json\"],\n    \"output_modes\": [\"application/json\", \"text/markdown\"],\n    \"supported_modes\": [\"build\"]\n  }\n}"
}
```

## 11) Example BUILD Payload (Overrides Allowed)

```json
{
  "tools": [
    "supabase/get-schema",
    "supabase/generate-sql",
    "supabase/execute-sql",
    "supabase/analyze-results"
  ],
  "toolParams": {
    "supabase/generate-sql": {
      "query": "top 10 conversations by date",
      "tables": ["agent_conversations"],
      "max_rows": 10
    },
    "supabase/execute-sql": { "max_rows": 100 },
    "supabase/analyze-results": {
      "analysis_prompt": "Summarize main findings for stakeholders"
    }
  },
  "toolExecutionMode": "sequential",
  "stopOnError": true
}
```

## 12) Acceptance Criteria
- Runner executes configured MCP tools in BUILD mode and persists a deliverable with structured results.
- Supabase demo flow works end-to-end:
  - `supabase/get-schema` lists schema
  - `supabase/generate-sql` produces valid SQL against allowed tables
  - `supabase/execute-sql` runs read-only query and returns rows
  - `supabase/analyze-results` returns a concise stakeholder summary
- Proper error handling and messages for missing config, missing namespace, MCP unavailability, or tool failures.
- Parallel mode runs tools concurrently and returns per-tool results.

## 13) Test Strategy
- Unit tests: runner param interpolation, execution modes, error propagation.
- Integration tests: MCP tool invocation via `MCPService`, Supabase MCP read-only queries.
- E2E smoke: upsert agent via admin endpoint, BUILD execution with payload, deliverable created and includes metadata.

## 14) Risks & Mitigations
- Env misconfiguration → early validation; clear messages; docs in PRD.
- SQL safety → denylist enforced in server and runner inputs (MVP).
- Partial failures → `stopOnError` default true; document parallel semantics.

## 15) Implementation Notes
- Keep configuration explicit; never assume defaults for provider/model/endpoint.
- Namespacing is mandatory; runner does no implicit mapping from `mcp.server`.
- The `yaml` can be JSON-formatted for storage convenience (escaped string), consistent with existing examples.

## 16) Next (Plan to be drafted after PRD approval)
- Detailed task breakdown for runner enhancements, validation hooks, seed + verification scripts, and test coverage.
