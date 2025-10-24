# Agent Migration Plan (Filesystem → Database)

Status: Draft for review
Owner: Codex with Matt

## Goal
Move from filesystem-based agents to database-backed agents in a deliberate, low-risk sequence. Keep only what provides value, modernize what needs parity, and deprecate what’s obsolete.

## Decision Criteria
- Usage: recent invocations, owner demand, demo value
- Type: orchestrator, context, API/external, function
- Complexity to port: YAML-only vs code/function
- Dependencies: n8n/webhooks, external APIs, local files
- Parity Requirements: deliverables, PII, auth, streaming

## Buckets
- Keep & Migrate: high usage/value, low/medium effort
- Migrate Later: value but medium/high effort or dependencies
- Drop: obsolete, redundant, or superseded

## Migration Steps
1) Inventory filesystem agents (auto-generated report)
2) Classify into keep/migrate/drop buckets (this doc)
3) Recreate selected agents as DB agents (YAML + context + transport)
4) Validate on new A2A runtime (converse/plan/build)
5) Dual-run comparison where applicable
6) Cutover per agent (update registry, hide legacy path)
7) Remove legacy code after sign-off

## Agent IO Contract Standards (for migration and new agents)

Use explicit MIME types and optional transforms so agents compose reliably and humans get readable output.

- Declare input/output modes in YAML (top-level):
  - `input_modes`: e.g., `[application/json, text/markdown, text/plain]`
  - `output_modes`: e.g., `[text/markdown]` or `[application/json]`
- Prefer `application/json` for agent-to-agent (machine) steps; use `text/markdown` (or `text/plain`) for human-facing content.
- Optional strict expectations + adapters under `configuration.transforms`:
  - `expected.input.output`: default content types
  - `by_mode.converse|plan|build.input|output`: mode-specific expectations
  - `adapters.json_to_markdown.template`: render JSON into markdown when needed
  - `adapters.markdown_to_json.selector`: extract fenced JSON (e.g., ```json ... ```)
- API agents (already supported):
  - `api_configuration.request_transform` (template variables: `{{userMessage}}`, `{{prompt}}`, `{{sessionId}}`, `{{conversationId}}`, `{{agentSlug}}`, `{{organizationSlug}}`)
  - `api_configuration.response_transform` with dotted/bracket field paths (e.g., `data.items[0].text`)
- Orchestrator normalization policy:
  - If input type mismatches the agent’s expected `input_modes`, the runtime will adapt (JSON↔Markdown) or fail (when `strict: true`), preserving `metadata.contentType` and `metadata.originalContentType`.

### Migration Checklist (per agent)
- [ ] Set `input_modes` and `output_modes` (MIME types)
- [ ] Decide strict vs. permissive behavior and add `configuration.transforms` if needed
- [ ] For API agents, define request/response transforms
- [ ] Provide 1–2 sample payloads (JSON and/or Markdown) and verify normalization
- [ ] Confirm human-facing responses render in Markdown when appropriate
- [ ] Reference: Follow `docs/agent-types/AUTHORING-STANDARDS.md` and the type-specific guide before committing YAML or SQL inserts

## Coexistence Strategy
- Legacy route: `DynamicAgentsController` + filesystem
- New route: `Agent2AgentController` + DB runtime
- Both available until Phase 4 cutover

## Deliverables
- Migration inventory (report)
- Agent-by-agent migration checklists
- Final deprecation PR removing legacy code (scoped by directories)

## Notes
- API/External agents keep minimal prompt-only bodies; response extraction via YAML transform is supported
- Credential injection is optional and deferred
