# Agent Authoring Standards (Mandatory Reference)

Status: Living policy. Use this document every time we create or update an agent — whether inserting directly via SQL (seeds/migrations) or using the Agent Builder.

## Policy
- All agents MUST follow the type-specific guides in this folder:
  - Context: `context-agent.md`
  - API: `api-agent.md`
  - External (A2A): `external-agent.md`
  - Tool: `tool-agent.md`
- IO contracts MUST be explicit using MIME types in `input_modes` and `output_modes`.
- If strict behavior is desired, specify `configuration.transforms.expected/by_mode` so the runtime can normalize or fail clearly.
- A2A endpoints MUST remain spec-aligned (card, tasks, health). Any ops data goes into private metadata (feature-flagged), not new routes.

## When to Consult
- Before adding an agent record via SQL/seed or Agent Builder.
- When migrating filesystem agents to DB.
- Whenever changing IO, transport, or deliverables behavior.

## Builder Checklist (copy/paste)
- [ ] Set `agent_type`, `mode_profile`, `status`, `display_name`, `slug`.
- [ ] Provide `input_modes` (e.g., application/json, text/markdown) and `output_modes`.
- [ ] (Optional) `configuration.transforms` with `expected` and `by_mode` + any adapters.
- [ ] Transport section per type:
  - Context: none
  - API: `api_configuration` with `request_transform`/`response_transform` (variables + dotted paths)
  - External: `external_a2a_configuration` (endpoint, protocol, timeout, auth headers)
  - Tool: `function` (language/module/handler) or `mcp` definition
- [ ] Execution capabilities/profile/timeouts
- [ ] Deliverables (optional): `title_template`, `type`, `format`
- [ ] Security: header allowlist, logging/redaction notes
- [ ] Testing: provide a sample JSON and/or Markdown and expected result

## References
- Agent types index: `docs/agent-types/README.md`
- Phase 3 kickoff: `docs/feature/matt/phase-3-kickoff.md`
- Migration plan: `docs/feature/matt/agent-migration-plan.md`
