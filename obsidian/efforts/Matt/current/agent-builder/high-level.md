# Agent Builder — High Level

This doc captures the initial concept for an in‑app “Agent Builder” that lets users add new agents to the system using our A2A (agent‑to‑agent) protocol. We’ll iterate here on flows, data model touchpoints, and integration details.

## Goals
- Let users add new agents through a guided form (optionally within a conversation, but not required).
- Capture all key attributes: ownership/reporting chain, type/class, context/purpose, YAML config, I/O contract, and any well‑known/task endpoints.
- Persist to `agents` table as the source of truth.
- Optionally write a generated definition file into the initial agents directory (TBD feasibility and permissions).

## User Flow (First Look)
- Entry: user hits a well‑known route (e.g., `/tasks/agent-builder` or `/well-known/agent-builder`).
- CTA: “Create New Agent”. Clicking opens a dedicated Agent Form (can be modal or full page; not necessarily tied to a chat thread).
- Guided form asks pointed questions to produce a complete agent spec.
- Review step shows a preview of the agent YAML, I/O schema, and registration metadata before saving.
- On submit, we write to the `agents` table and optionally emit an event/Socket to notify the system.

## Form Sections (Draft)
- Identity & Ownership
  - Agent name, description, owner/team, who it reports to (agent or role), visibility/scope.
- Type & Capabilities
  - Type/classification (e.g., tool‑using, router, worker, planner, data‑accessing), skills/tools, allowed providers.
- Context
  - Mission statement, operating constraints, prompt context, safety boundaries, and escalation rules.
- I/O Contract
  - Inputs (schema), outputs (schema), supported message types, error states and retries.
- A2A Protocol
  - Well‑known endpoints, supported tasks, routing keys, message headers/metadata.
- YAML / Config
  - Generated YAML preview (editable), env requirements, provider bindings.
- Persistence & Deployment
  - Flags for: persist to DB only, DB + file, require approval, notify channels (WS/Slack/etc.).

## Data Model Touchpoints
- `agents` table (min fields):
  - `id`, `name`, `type`, `description`, `owner_id`, `reports_to_id`, `visibility`, `context_yaml`, `io_schema_json`, `a2a_capabilities_json`, `config_yaml`, `created_by`, `created_at`, `updated_at`, `status`.
- Optional files under initial agents directory for bootstrap/infra:
  - `agents/<agent-slug>/agent.yaml` (authoritative spec)
  - `agents/<agent-slug>/io.schema.json` (explicit I/O)
  - `agents/<agent-slug>/README.md` (ops notes)

## A2A Considerations
- Well-known discovery: `/well-known/agents` returns agent descriptors (name, slug, tasks, capabilities).
- Task surface: `/tasks` includes builder-registered tasks; agents publish supported tasks via metadata.
- Messaging headers to include: `x-agent-id`, `x-task-type`, `x-trace-id`, versioning.
- Global availability: Agent Builder is registered under the global agent namespace (e.g., `/global/agent-builder`). Even though its persisted definitions live outside the DB, the global path ensures discovery without linking it to org-specific directories like `/demo` or `/my-org`.

## Positioning In A2A
- Official agent: Agent Builder is exposed as a first‑class A2A agent because it has well‑known tasks (`agent_builder.plan`, `agent_builder.build`) and communicates via a dedicated transport type.
- Not a new agent type: This does not introduce a novel agent “type/class”. It uses the same agent model; the only addition is a transport type plus task metadata that declares what it can do.
- Transport types: We will add the `agent-builder.v1` transport. Practically, this means defining the wire metadata (headers, payload shape, actions) and advertising it in the agent’s capabilities.
- Runner participation: By default, Agent Builder does not join the execution pool as a runner/worker. It is a service‑style agent invoked explicitly via its tasks or HTTP endpoints.
- Optional runner mode: We can opt‑in to pool participation if we want background planning/build jobs to scale horizontally using the same scheduling as other workers. That would require:
  - Registering it with the pool as a runnable task handler for `agent_builder.*`
  - Resource limits and concurrency controls
  - Access checks to ensure only authorized callers trigger builds
- Recommendation: Keep it as a service‑style A2A agent initially (simpler, clearer boundaries). Add runner participation later if we see sustained queue/backlog that benefits from worker autoscaling.

## Implementation Notes
- Backend (NestJS):
  - `POST /agents` to create agents; validate schemas; store YAML + JSON fields.
  - Optional file emission service that mirrors DB spec into repo/file system when permitted.
  - Socket.IO event `agent.created` to update UIs.
  - Agent Builder controller lives under `/global/agent-builder/*` so the service is discoverable as a global agent without writing an agent row.
- Frontend (Vue):
  - Wizard form with autosave draft; YAML editor with validation.
  - JSON schema builders for I/O; quick templates for common agent types.
- Security:
  - Require permissions/roles to create agents; redact secrets; validate provider keys.

## Open Questions
- Should file emission be automatic, opt‑in, or admin‑only? If the runtime agent can’t write to the repo, we can export a downloadable bundle or open a PR via a bot.
- Where does the YAML live “authoritatively” — DB or files? Proposed: DB as truth; file as optional artifact.
- Versioning strategy for agent specs (e.g., semver on `config_yaml` with migrations)?

## Next Steps
- Decide on the well‑known route shape and UI entry point.
- Lock a minimal create spec for `agents` table and validation.
- Prototype the form (static) and YAML/JSON previews.
- Implement `POST /agents` + schema validation and emit `agent.created`.
- Evaluate file‑write feasibility in our environment; design the fallback (export/PR).

---

Initial thought: this keeps creation simple (DB write) while enabling an optional file artifact for infra/bootstrapping. If you’re good with this direction, I’ll draft the minimal API DTO, DB fields, and a basic frontend wizard outline next.

## Plan/Build Flow and Transport

We support a two‑phase flow that users expect: first “plan” (flesh out + validate), then “build” (persist + emit artifacts). This runs over a dedicated transport to keep behavior explicit and versioned.

- Transport Type: `agent-builder` (no version suffix)
  - Purpose: carry partial agent drafts to a planner that normalizes, defaults, validates, and returns a fleshed‑out spec for review.
  - Headers (A2A):
    - `x-transport: agent-builder`
    - `x-action: plan|build`
    - `x-trace-id`, `x-org-id`, `x-requested-by`
    - Optional: `x-agent-draft-id` for idempotency

### HTTP Endpoints

- POST `/agent-builder/plan`
  - Input: `AgentDraft` (partial, user‑supplied)
  - Behavior: infer and default missing fields; validate; generate YAML + I/O schemas; ensure org and type are canonical; return `AgentPlan` for user review.
  - Response: `AgentPlan` with `validation`, `suggestions`, and a `diff` from draft → plan.

- POST `/agent-builder/build`
  - Input: `AgentPlan` (from prior step) or `plan_id`
  - Behavior: final validation; upsert into `agents` table; optionally emit artifacts (files/PR/export) per flags; emit `agent.created` socket event.
  - Response: created `Agent` record + artifact summary.

### Types (Draft)

AgentDraft
- `name?: string`
- `description?: string`
- `org?: { id?: string; slug?: string }`
- `reportsTo?: { agentId?: string; role?: string }`
- `type?: 'worker'|'router'|'planner'|'tool-user'|'data-access'|string`
- `context?: { mission?: string; constraints?: string[]; prompt?: string }`
- `io?: { inputSchema?: any; outputSchema?: any; messages?: string[] }`
- `tools?: string[]`
- `providers?: string[]`
- `configYaml?: string`
- `capabilities?: { tasks?: string[]; wellKnown?: string[] }`

AgentPlan
- `slug: string`
- `canonicalType: string`
- `org: { id: string; slug: string }`
- `reportsTo?: { agentId?: string; role?: string }`
- `contextYaml: string`
- `ioSchemaJson: any`
- `configYaml: string` (fully generated/merged)
- `capabilities: { tasks: string[]; wellKnown: string[] }`
- `defaultsApplied: Record<string, any>`
- `suggestions: string[]`
- `validation: { errors: string[]; warnings: string[] }`
- `diff: { draft: any; plan: any }` (high‑level changes)
- `planId: string`
- `version: 'v1'`

BuildResult
- `agentId: string`
- `status: 'created'|'updated'`
- `artifacts?: { files?: string[]; prUrl?: string; exportUrl?: string }`
- `warnings?: string[]`

### Planning Logic (Defaulting/Inference)
- Name/slug: generate slug if missing; ensure uniqueness.
- Type: map free‑text or rough type to canonical enum; warn on ambiguity.
- Org: resolve by `org.slug` or current context; error if not found.
- Context: synthesize mission/constraints from description; add safety and escalation defaults.
- I/O: generate minimal JSON Schemas from inferred tasks and example fields; include error shape.
- YAML: produce normalized agent YAML from plan; preserve user overrides.
- Tools/providers: validate availability and permissions; strip unknowns with warnings.

### Well‑Known Tasks (A2A)
- `agent_builder.plan`
  - Accepts: `AgentDraft`
  - Returns: `AgentPlan`
- `agent_builder.build`
  - Accepts: `AgentPlan | { planId }`
  - Returns: `BuildResult`

### Idempotency & Versioning
- We do not version transport types. Any evolution is handled via metadata and backwards‑compatible payloads.
- `planId` tags a specific planning output; keep stable per plan round‑trip.
- `build` with the same `planId` is idempotent; use `If-None-Match`/hash to avoid duplicate writes.

### UI Flow
- User completes minimal fields → calls Plan → reviews generated YAML/IO and suggestions.
- Iterate Plan as needed (back‑and‑forth) → when satisfied, press Build.
- Build persists and optionally emits file artifacts or PR/export.

## External A2A Runner Integration (Future)

Once we stand up an external A2A runner, any orchestrator could invoke Agent Builder to create agents via an external agent call. Design intent:

- Contract
  - Orchestrators call the same tasks: `agent_builder.plan` and `agent_builder.build` over `x-transport: agent-builder`.
  - Accepts/returns the same `AgentDraft`/`AgentPlan`/`BuildResult` payloads.

- AuthN/AuthZ
  - Use org‑scoped service tokens (JWT with `org_id`, `scopes: ['agent:plan','agent:build']`).
  - Enforce policy: who can create agents; per‑org quotas and rate limits.

- Safety/Controls
  - Validation gates (schema + policy) run server‑side regardless of caller.
  - Optional human‑in‑the‑loop approval before `build` for high‑privilege orgs.

- Observability
  - Emit `agent.created` and `agent.plan.completed` events with `x-trace-id` for cross‑orchestrator tracing.
  - Audit log entries containing caller, org, diff summary, and artifact results.

- Delivery modes
  - Sync: immediate response for `plan` and small `build`s.
  - Async: return `202` with `planId`/`jobId` and webhook/callback when long builds are enabled.

This lets any compliant orchestrator “self‑service” new agents while keeping the Builder centralized and policy‑enforced.
