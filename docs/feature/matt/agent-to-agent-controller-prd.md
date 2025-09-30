# Agent-to-Agent Controller & Transport PRD

**Project Name:** Agent-to-Agent Controller Refresh  
**Version:** 0.1 (Draft)  
**Date:** 2025-01-16  
**Author:** Matt Weber (via Codex assistant)

## 1. Context & External Protocol Snapshot

- Per Google developer sitemap review (2025-01-16), there are no newly published Agent-to-Agent documents beyond the previously referenced 2024 specification. Public-facing pages still resolve to the same JS-driven documentation shell and do not expose a newer dated spec.  
- We therefore assume the latest requirements remain:
  - Agents expose a public `/.well-known/agent.json` descriptor conforming to the Google Agent-to-Agent schema (`protocol`, `version`, `url`, `defaultInputModes`, `defaultOutputModes`, `capabilities`, `skills`, `securitySchemes`, etc.).
  - Transport is JSON-RPC 2.0 over HTTPS with support for notifications, batch requests, and streaming callbacks (via WebSocket or long polling) where declared in the agent card.
  - Tasks execute via `POST /tasks` with JSON-RPC payloads; responses include success or structured error per the spec.
  - Optional features—push notifications, deliverable download links, state transition history—are advertised through capabilities metadata in the card.

If Google publishes an updated schema we will refresh this PRD; for now we are grounding the work on the above contract.

## 2. Current File-Based Implementation Summary

| Area | How It Works Today | Compliance Gap |
| --- | --- | --- |
| Discovery & registry | `AgentDiscoveryService` crawls filesystem and the `agent_configurations` table, then `AgentFactoryService` instantiates classes. | Works but assumes file-based paths; agent metadata is incomplete for A2A card. |
| API surface | `DynamicAgentsController` (and legacy `BaseController`) expose `/agents/:type/:name/tasks` and `/.well-known/agent.json`, gated by Supabase auth. | External callers cannot reach protected endpoints; spec requires public descriptor and task ingress. |
| Agent card | `A2AAgentBaseService.getAgentCard()` returns a minimal object (`name`, `type`, `status`, `metadata`). | Missing required schema (`protocol`, `version`, `url`, `defaultInputModes`, `defaultOutputModes`, `skills`, `securitySchemes`, etc.). |
| Transport | JSON-RPC 2.0 pipeline normalizes requests via `JsonRpcProtocolService`; centralized routing/PII gating are injected before `executeTask`. | Core JSON-RPC compliance is good, but we conflate product auth (Supabase JWT) with protocol-level access. |
| Deliverables | Task responses can emit deliverable metadata; some flows still persist outside JSON-RPC responses. | Not fully spec-compliant for deliverable descriptors; needs consolidation in new design. |

## 3. Goals for the Database-Backed Agent-to-Agent Controller

1. **Spec-Compliant Public Surface**
   - Provide unauthenticated (or API-key authenticated) `GET /.well-known/agent.json`, `GET /health`, and `POST /tasks` endpoints for each deployed agent namespace.
   - Support HTTPS-only transport with JSON-RPC 2.0 request/response semantics identical to the Google spec, including batch requests, notifications, and standard error codes.
   - Advertise streaming capabilities (real-time WebSocket / long-polling) through the agent card and honor them in transport.

2. **Database-First Registry & Configuration**
   - Treat `agent_configurations` as the canonical source for agent metadata, capabilities, and credential aliases.
   - Introduce `organizations` (and optional `organization_credentials`) tables to partition agent access and secret storage by tenant.
   - Allow legacy file-based agents to coexist by migrating discovery into a hybrid loader that first consults the database.

3. **Centralized Routing & Policy Enforcement**
   - Reuse `CentralizedRoutingService` for PII gating, sovereign routing and model selection, but expose it via the new controller without requiring Supabase session context.
   - Support per-organization routing overrides (model allowlists, quick-mode preferences) stored alongside organization metadata.

4. **Observability & Governance**
   - Emit structured audit logs for all inbound agent-to-agent calls (method, organization, agent id, auth context, routing decision, response code).
   - Provide metrics hooks (success/error counts, latency histograms, streaming session duration) for platform dashboards.
   - Rate-limit public endpoints and surface API keys / OAuth tokens through the new credential store, not environment variables.

5. **Upgrade Path**
   - Legacy product experiences continue to use `DynamicAgentsController` + Supabase auth until migrated.
   - The new agent-to-agent controller can proxy to the same task execution path (`processJsonRpcRequest`) to avoid duplicate business logic.

## 4. Requirements Breakdown

### 4.1 Public Controller & Transport Layer
- `AgentToAgentController` (working name) mounted at `/agent-to-agent/:namespace/:agent` (exact routing TBD) with:
  - `GET /.well-known/agent.json` → returns fully compliant card.
  - `GET /health` → simple health probe (status + metadata).
  - `POST /tasks` → accepts JSON-RPC request; enforces request size limits, rate limits, optional API-key header (`X-Agent-Api-Key`). Keys are fetched from `organization_credentials`, cached in-memory with configurable TTL, and rate-limited per org/key pair (default: 120 requests / 60s). Structured logs capture requestId, org, agent, mode, and JSON-RPC metadata for observability.
    - The controller MUST accept both raw DTO payloads (legacy callers) and JSON-RPC 2.0 envelopes. When `jsonrpc` is present it:
      - Maps `method` → `TaskRequestDto.mode` using the translation table below; absence of a resolvable mode causes a `-32602 (Invalid params)` error.
      - Promotes `params` into the DTO, persisting the original `id`/`method` under `metadata.jsonrpc` so downstream services can correlate responses and telemetry.
      - Returns `{ jsonrpc: '2.0', id, result }` where `result` is the normalized `TaskResponseDto`. Future slices will also wrap structured errors (`error`) with the same `id`.
    - Error mapping SHOULD align Nest exceptions to JSON-RPC error codes (e.g., `UnauthorizedException` → `-32001`, rate-limit (HTTP 429) → `-32042`, validation issues → `-32602`).
    - Method → mode translation:

      | JSON-RPC method | Mode dispatched |
      | --- | --- |
      | `converse`, `agent.converse`, `tasks.converse` | `converse` |
      | `plan`, `agent.plan`, `tasks.plan` | `plan` |
      | `build`, `agent.build`, `tasks.build` | `build` |
      | `orchestrate_create`, `agent.orchestrate_create`, `orchestrate.create` | `orchestrate_create` |
      | `orchestrate_execute`, `agent.orchestrate_execute`, `orchestrate.execute` | `orchestrate_execute` |
      | `orchestrate_continue`, `agent.orchestrate_continue`, `orchestrate.continue` | `orchestrate_continue` |
      | `orchestrate_save_recipe`, `agent.orchestrate_save_recipe`, `orchestrate.save_recipe` | `orchestrate_save_recipe` |

    - Batch requests and JSON-RPC notifications remain out of scope for the first launch but should be revisited once streaming is in place.
  - Optional: `POST /notifications` or WebSocket upgrade endpoint for streaming callbacks if declared in card.
- Controller composes these services:
  - `AgentRegistryService` (new) to resolve agent config by namespace/id from database, falling back to filesystem.
  - `AgentCardBuilder` (refactored from `AgentMetadataService`) to compose spec-complete cards (see §4.2).
  - `AgentExecutionGateway` that forwards normalized requests into existing task pipeline (reuse `AgentFactoryService` outputs).

### 4.1.1 Greenfield Implementation Mandate
- The new agent-to-agent controller, registry, execution gateway, and related services WILL be implemented in a fresh NestJS module tree (`apps/api/src/agent2agent/**/*`).
- No classes or utilities from the legacy `agents` module may be imported into the new module except for well-defined interfaces (e.g., shared DTOs or type definitions). Reuse happens by re-implementing or wrapping functionality behind explicit interfaces.
- During migration we may temporarily proxy requests from the new controller to legacy execution via an adapter, but adapters must live in the new module and should be trivial to remove when the legacy stack is retired.

### 4.2 Agent Card Builder
- Build from `agent_configurations` row + runtime metadata (status, health, URL).
- Required fields:
  - `protocol`: `"google/a2a"` (or updated identifier when spec changes).
  - `version`: spec version we target (currently `"2024-08-07"`, update when docs refresh).
  - `url`: base URL for the agent (public domain + controller route).
  - `defaultInputModes` / `defaultOutputModes`: derive from agent type (text/plain, application/json, audio/wav, etc.).
  - `capabilities`: streaming support, push notifications, state transition history, deliverables, extensions list.
  - `skills`: map `agent_skills` table entries or YAML metadata; ensure at least one skill per spec.
  - `securitySchemes` & `security` arrays: describe API key, OAuth, or anonymous access strategy.
  - `provider`: organization name from `organizations` table; fallback to Orchestrator AI default.
- Support optional authenticated extensions: if an organization wants advanced fields, expose `supportsAuthenticatedExtendedCard` and provide `GET /.well-known/agent.json?auth=true` variant requiring API key.

### 4.3 Execution & Policy Integration
- Normalize incoming JSON-RPC requests through `JsonRpcProtocolService`.
- Inject per-request context:
  - Organization ID (from API key or Host header mapping).
  - Credential bundle (from credential store) to pass to downstream MCP/tool agents.
  - Routing preferences (model allowlist, quick path, sovereign mode) loaded from organization settings.
- Route through existing `AgentPoolService`/`AgentFactoryService`; ensure they can operate with database-sourced agents without filesystem path assumptions.
- Reconcile deliverables: unify on JSON-RPC response metadata with deliverable descriptors (URL, content type, checksum) rather than separate persistence flows.
- Task requests will always include an explicit `mode` (`converse`, `plan`, `build`, etc.); `AgentToAgentBaseService` owns mode routing so specialized agents only implement the behaviors they truly support (e.g., tool agents skip converse).

### 4.4 Security & Access Control
- API key table keyed by organization; hashed at rest, rotated via admin UI.
- Rate limiting per organization and per IP.
- Optional mTLS or OAuth 2.0 client credentials for enterprise tenants (documented but not v1 scope).
- Logging & alerting on auth failures, unusual request spikes.

### 4.4.1 Organization & Credential Schema
We will extend the database with the following tables. Column names align with Supabase/PostgreSQL conventions; `uuid` columns use `uuid_generate_v4()`.

**Table: organizations**
- `id` (`uuid`, PK)
- `slug` (`text`, unique) – lowercase identifier used in namespaces/routes
- `display_name` (`text`, not null)
- `status` (`text`, default `active`) – enum: `active`, `suspended`
- `metadata` (`jsonb`, default `{}`) – organization-level settings (routing overrides, logging preferences)
- `created_at` (`timestamptz`, default `now()`)
- `updated_at` (`timestamptz`, default `now()`)

**Table: organization_credentials**
- `id` (`uuid`, PK)
- `organization_id` (`uuid`, FK → organizations.id` on delete cascade)
- `alias` (`text`, not null) – referenced by agents (e.g., `supabase.default`)
- `type` (`text`, not null) – `api_key`, `supabase_service_key`, `slack_bot_token`, etc.
- `encrypted_value` (`bytea`, not null) – ciphertext produced by backend KMS wrapper
- `encryption_metadata` (`jsonb`, default `{}`) – stores nonce, key version
- `rotated_at` (`timestamptz`)
- `created_at` (`timestamptz`, default `now()`)
- `updated_at` (`timestamptz`, default `now()`)
- Unique constraint `(organization_id, alias)`

**Table: organization_members** (lightweight link until we decide on multi-org strategy)
- `id` (`uuid`, PK)
- `organization_id` (`uuid`, FK → organizations.id` on delete cascade)
- `user_id` (`uuid`, FK → auth.users.id`)
- `role` (`text`, default `member`) – `member`, `admin`
- `created_at` (`timestamptz`, default `now()`)

**users table change**
- Add nullable column `organization_id` (`uuid`, FK → organizations.id`). During migration it remains optional; once all users belong to an org we can enforce `NOT NULL`.

All new tables will be created via Supabase migration scripts; access will be mediated through new Nest repositories/services in the agent-to-agent module. Secrets will be retrieved server-side only—never exposed to clients.

### 4.5 Migration & Coexistence
- Maintain existing `DynamicAgentsController` for UI traffic.
- Introduce feature flag to allow certain namespaces to opt into the new controller while others remain legacy.
- Provide compatibility shim: old controller can internally call the new card builder once available (so we only have one source of truth for metadata).
- Document steps for migrating an agent namespace: ensure agent row populated, credential aliases resolved, tests pass, flip routing flag.

## 5. What We Reuse vs. Rebuild

| Keep | Adapt | Rebuild |
| --- | --- | --- |
| `JsonRpcProtocolService`, `CentralizedRoutingService`, `TaskStatusService`, `DeliverablesService` | `AgentDiscoveryService` (favor DB-first, drop filesystem assumptions), `AgentFactoryService` (support database config + dependency injection), `AgentMetadataService` (becomes spec-compliant builder) | Controller layer (new public endpoints), Credential storage, Organization-aware access model, API key auth, Public health/ping endpoints |

## 6. Open Questions / Follow-Ups
- Confirm latest official spec version identifier (update once Google publishes non-404 page).  
- Decide on base domain & routing structure for public agent-to-agent traffic (e.g., dedicated subdomain vs existing API host).  
- Determine minimum viable authentication (anonymous read of card but API-key-protected tasks?).  
- Define streaming transport (do we launch with server-sent events, WebSockets, or polling?).  
- Clarify deliverable persistence format (binary blobs vs presigned URLs).  
- Establish deprecation timeline for file-based agents.

## 7. Milestones (Draft)
1. **Infrastructure foundation (2 weeks)**: schema for organizations & credentials, API key issuance, feature flag toggles.
2. **Controller & card builder (3 weeks)**: new controller endpoints, spec-compliant card generation, integration tests against JSON-RPC contract.
3. **Execution integration (3 weeks)**: route normalization, policy injection, streaming hooks, deliverable response unification.
4. **Migration tooling (2 weeks)**: namespace opt-in flow, monitoring dashboards, docs for onboarding SaaS tenants.
5. **Sunset plan (TBD)**: retire legacy controller once all namespaces migrate.

## 8. Acceptance Criteria
- External caller can fetch `https://<public-host>/agent-to-agent/<namespace>/<agent>/.well-known/agent.json` without Supabase auth and receive spec-compliant document.
- JSON-RPC call to `POST /agent-to-agent/<namespace>/<agent>/tasks` completes end-to-end, including centralized routing, deliverable metadata, and proper error codes.
- Agent card reflects database metadata (skills, capabilities, security schemes) and updates when configuration changes.
- Audit logs capture organization, agent id, method, routing decision, latency, and outcome for each request.
- Legacy product experiences remain unaffected until explicitly migrated.

## 9. Testing Strategy
- **Unit Tests**
  - Controller DTO validation, request guards, and error handling.
  - Agent card builder ensuring every required field (protocol/version/url/skills/security) is present.
  - Credential resolver (organization alias lookup, encryption metadata parsing).
  - Routing adapter to centralized routing (PII block, sovereign overrides, fallback handling).
  - API key guard and rate limiter decisions per organization.
- **Integration Tests**
  - JSON-RPC flows for `converse`, `plan`, and `build` including deliverable creation and human-in-loop checkpoints.
  - Multi-step project execution scenario validating orchestration across agents.
  - Streaming transport (WebSocket or SSE) handshake and message flow if enabled.
  - Credential retrieval from encrypted storage and hand-off to MCP/tool agents.
- **Compatibility Tests**
  - Namespace opt-in: toggling feature flag to swap legacy/new controller without regressions.
- **Performance/Smoke Tests**
  - High-concurrency task submissions per organization to validate throttling and logging under load.
