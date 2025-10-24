# Agent Builder Orchestrator — Work Plan & Checklist

Owner: Codex with Matt
Status: Planning (ready to start)
Last Updated: 2025-10-01

Purpose
- Stand up an API-first Agent Builder that guides users to author new agents (function, context, API) safely and consistently.
- Keep all artifacts in DB via API (no direct SQL), with validation, dry-runs, and human approvals.
- Provide a wizard UI and a builder orchestrator that can run the same flow conversationally.

How to Use
- Check off tasks as they complete: [x]
- Each section has a “Next Action” line so we know where to resume.

---

## Recently Completed (for context)
- [x] Image providers added (OpenAI + Gemini) with local asset persistence and /assets streaming
- [x] Function agent runner + router integration for DB-backed function agents
- [x] Seeded my-org image agents (OpenAI/Google) + Image Orchestrator; hierarchy teams in place
- [x] Images tab (Plan/Document/Images) with generation modal and provider selection

Next Action (completed work): Proceed to Agent Builder endpoints + wizard

---

## Milestones
- M1 — Admin endpoints for agent upsert + validator (schema + dry-run)
- M2 — Builder Orchestrator (function agent) that guides and promotes
- M3 — Wizard UI (steps + live preview) with Admin endpoints
- M4 — Seed Blog Post (function) + HR Assistant (context) via API + smoke tests
- M5 — Orchestrator JSON hand-off smoke test (Hiverarchy/manager → child agents)

---

## M1 — Admin Endpoints

- [x] POST /api/admin/agents (upsert)
  - [x] Accepts: { organization_slug, slug, display_name, agent_type, mode_profile, yaml, context, config }
  - [x] Validates required fields by type; writes to public.agents
  - [x] Auth guard (admin only)
  - [x] Unit tests added
- [x] PATCH /api/admin/agents/:id
  - [x] UpdateAgentDto for type-safe config updates
  - [x] Validates merged payload after patch
  - [x] Removed duplicate update method
  - [x] Unit tests added
- [x] GET /api/admin/agents?type=function|context|api
  - [x] Filtering/ordering confirmed
  - [x] Unit tests added

Next Action: Proceed to M2 policy checks and M3 Builder Orchestrator

---

## M2 — Validator (Schema + Dry-Run)

- [x] JSON-schema per agent type (function|context|api|orchestrator|tool)
  - [x] Validate required metadata and presence checks
  - [x] function.code presence and timeouts (basic)
  - [ ] api_configuration transforms shape (todo)
  - [ ] tool.actions[] schema (name, version, inputSchema, outputSchema)
- [x] Policy checks against authoring standards
  - [x] IO contract (input_modes/output_modes)
  - [x] Context agents require system prompt
  - [x] Function agents timeout validation (<=30s)
  - [x] API agents require api_configuration
  - [x] Unit tests (15 tests passing)
- [x] Dry-run harness
  - [x] function: run handler(input, mock ctx.services) inside sandbox with timeout
  - [x] api: render request_transform + simulate field_extraction
  - [x] Unit tests for dry-run in controller
- [x] Endpoint: POST /api/admin/agents/validate (returns { ok, issues[], dryRun? })
- [x] Smoke tests for seed payloads (blog_post_writer, hr_assistant)

Next Action: Proceed to M3 Builder Orchestrator implementation

---

## M3 — Builder Orchestrator (Function Agent)

- [x] Design prompt flow (intent → type → IO → context → behavior → validate → approve → create)
  - [x] 7-step conversational flow implemented
  - [x] Supports function, context, and API agents
  - [x] State management for multi-turn conversations
- [x] Implement function agent: agent_builder_orchestrator.json
  - [x] Guides users through agent creation
  - [x] Collects requirements step-by-step
  - [x] Mock validation and approval flow
  - [x] 15 comprehensive tests covering full flow
- [x] Smoke tests and validation
  - [x] Payload validates against schema and policy
  - [x] Dry-run tests pass for all steps
  - [x] Full integration test from intent to creation
- [x] Real implementation
  - [x] Created AgentBuilderService with validate() and create() methods
  - [x] Injected into FunctionAgentRunnerService via ctx.services.agentBuilder
  - [x] Created agent_builder_orchestrator_v2.json using real services
  - [x] Agents now created with status='draft' for safety
- [ ] HITL approval gates (next phase)
  - [ ] Add human_approvals integration
  - [ ] Promotion path (status=draft → active) post approval
- [ ] Teaming with Context Author + API Adapter helpers (future)

Next Action: Add HITL approval workflow or proceed to M4 Wizard UI

---

## M4 — Wizard UI (Admin)

- [ ] Route: /app/admin/agent-builder
- [ ] Steps
  - [ ] 1. Intent + type (org, slug, display name, description, tags)
  - [ ] 2. IO + capabilities (input/output modes)
  - [ ] 3. Context editor (system prompt + “good plan pattern”), live preview
  - [ ] 4. Behavior
    - [ ] function: handler editor (timeout), dry-run
    - [ ] api: endpoint + transforms (request/response) preview
    - [ ] orchestrator: team selection + flow template
  - [ ] 5. Hierarchy (department, reports_to, team)
  - [ ] 6. Validate (schema + policy + dry-run)
  - [ ] 7. Create/Promote (HITL gate, smoke test)

Next Action: Scaffold page + stepper and wire to Admin endpoints

---

## M5 — Seed Agents via API (No migrations)

### Blog Post Writer (function)
- [x] Author config (metadata, capabilities, IO)
- [x] Context (tone/structure/SEO)
- [x] Function handler (compose markdown)
- [x] Upsert payload prepared: docs/feature/matt/payloads/blog_post_writer.json
- [x] Smoke test validation passed
- [x] Seeding script created

### HR Assistant (context)
- [x] Author config (conversation_only)
- [x] Context (coverage areas, tone, guardrails)
- [x] Upsert payload prepared: docs/feature/matt/payloads/hr_assistant.json
- [x] Smoke test validation passed
- [x] Seeding script created

### Agent Builder Orchestrator v2 (function)
- [x] Payload with real service integration
- [x] Uses ctx.services.agentBuilder for validation & creation
- [x] Included in seeding scripts

### Seeding Scripts
- [x] Bash script: apps/api/scripts/seed-agents.sh
- [x] TypeScript script: apps/api/scripts/seed-agents.ts
- [x] Validates before creating
- [x] Reports success/failure per agent

Next Action: Run `./apps/api/scripts/seed-agents.sh` to create agents, then test them

---

## M6 — Orchestrator JSON Hand-Off (Smoke Test)

- [ ] Use existing Hiverarchy manager or a small orchestrator
- [ ] Step A: produce JSON/Markdown (context)
- [ ] Step B: consume JSON in function/api agent (payload mapping)
- [ ] Verify dotted path extraction + normalization

Next Action: Draft minimal plan with 2 steps and run via A2A

---

## Backlog (Nice-to-have)

- [ ] Images tab: compare mode + inline Set Current
- [ ] Supabase storage adapter + signed URL endpoint (/assets/:id/signed)
- [ ] Admin UI: Context/API authoring editors similar to Function editor
- [ ] Agent card/test console: embedded A2A quick tests per agent

---

## Quick Links

- Platform plan: docs/feature/matt/feature-agent-platform-plan.md
- Authoring standards: docs/agent-types/AUTHORING-STANDARDS.md
- Function Agents editor: /app/admin/function-agents
- Image agents (my-org): image_openai_generator, image_google_generator, image_orchestrator

---

## Notes
- API-first creation only (no direct SQL) for blog_post and hr_assistant
- Sandbox function runner only exposes ctx.services.*; no require()
- HITL gates (human_approvals) for promotion as needed
