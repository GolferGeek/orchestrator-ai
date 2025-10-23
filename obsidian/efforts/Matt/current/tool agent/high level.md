## Supabase Tool Agent — Discussion Scratchpad

- **What it is**
  - Tool agent for the demo org that wraps the `supabase` MCP server and exposes its tools as skills.

- **How it runs**
  - Uses the existing MCP client and the tool-agent runner to invoke MCP tools.
  - Configuration lives in agent YAML; secrets come from environment variables (not committed).

- **Environment variables (references)**
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY` (read-only, MVP)
  - `SUPABASE_SERVICE_ROLE_KEY` (optional later if we enable writes)
  - Note: default schema is `public`.

- **MCP tool coverage (initial)**
  - `get-schema`
  - `generate-sql`
  - `execute-sql`
  - `analyze-results`

- **Security/guardrails**
  - Read-only in MVP; deny DDL and destructive ops (`DROP`, `TRUNCATE`, `ALTER`, `DELETE/UPDATE`).
  - Optional allowlist of tables for demo scope.
  - No hidden fallbacks; fail fast with clear errors if config/server is missing.

- **Inputs/outputs**
  - Input: natural language or structured query params.
  - Output: JSON payload (e.g., `{ sql, rows, summary, meta }`) plus optional short Markdown summary.

- **Open questions**
  - Final table allowlist?
  - Do we include service-role paths in v1 or keep read-only?
  - Where to emit traces (logs vs progress callbacks)?
  - Any additional MCP tools we should expose?

- **Useful references in repo**
  - `demo-agents/finance/metrics/*` (existing MCP-driven metrics agent)
  - `apps/api/src/mcp/services/supabase/*` (Supabase MCP server/service)
  - `apps/api/src/agent2agent/services/tool-agent-runner.service.ts` (runner)

- **Next (when we PRD this)**
  - Define the agent YAML fields (metadata, communication, `configuration.mcp`, security/env refs).
  - Outline acceptance criteria and a simple SELECT test flow.
