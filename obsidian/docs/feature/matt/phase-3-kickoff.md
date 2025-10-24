# Phase 3 — Agent Feature Parity Kickoff

Status: Ready to start
Owner: Codex with Matt

## Objectives
- Rebuild task lifecycle on the new runtime: creation → progress → completion/failure
- Deliverables: persistence, versioning, enhancement workflow
- Logging/PII: structured logs + pseudonymization/redaction integration
- Human-in-the-loop: gates, approvals, and run controls where applicable

## Workstreams
1) Task Lifecycle
- Normalize task model across A2A flows
- Progress updates via stream events (reuse AgentRuntimeStreamService)
- Failure codes and structured error envelopes

2) Deliverables
- Create/attach deliverables on build success (auto-create when conversationId/userId provided)
- Versioning API (promote/copy/enhance)
- Minimal UI hooks preserved via existing endpoints

3) PII/Pseudonymization
- Plug Dictionary/LLM redaction at dispatch boundaries where needed
- Preserve policy metadata on responses

4) Human-in-the-loop
- Gate build operations when `requiresHumanGate` is true
- Approval/continue hooks via gateway (no custom endpoints)

5) IO Normalization (Contracts)
- Enforce MIME-type based `input_modes`/`output_modes` with lightweight normalization before dispatch
- Honor optional `configuration.transforms` (expected/by_mode/adapters)
- For API agents, keep existing request/response transforms; ensure dotted field extraction and template variables are supported

## Milestones
- M3.1: Task lifecycle parity (A2A)
- M3.2: Deliverables persistence + versioning
- M3.3: PII/pseudonymization integrated in dispatch + logs
- M3.4: Human-in-the-loop gates + approvals

## Phase 4 (Preview)
- P4.1: Image Deliverables MVP — see `docs/feature/matt/phase-4-image-deliverables-kickoff.md`

## Success Criteria
- End-to-end parity scenarios pass on DB runtime without legacy base services
- Deliverables create + version reliably; errors are structured and discoverable
- No secrets in logs; PII policy metadata preserved
- IO contracts are explicit in agent YAML; normalization succeeds or fails with clear errors when `strict: true`
- Authoring policy enforced: all new/updated agents must follow `docs/agent-types/AUTHORING-STANDARDS.md`

---

Dependencies
- Phase 2 summary: `docs/feature/matt/phase-2-runtime-summary.md`
- Usage details: `apps/api/docs/external-api-agents-usage.md`

## Implementation Plan
1) Task model + progress events
- Map `tasks` statuses to lifecycle: `pending → running → completed|failed` with `progress` and `progress_message` updates
- Emit stream start/chunk/complete/error via `AgentRuntimeStreamService` and forward on websockets (`subscribe_stream`)
- Standardize error envelopes: `error_code`, `error_message` (redacted), `error_data`

2) Deliverables service integration
- Enforce `DELIVERABLES_REQUIRE_BUILD` (default true) so auto‑create/version only occurs in Build mode
- Auto‑create when `userId` and `conversationId` available; attach `task_id` to `deliverable_versions`
- Enhancement path: if `payload.deliverableId` present, create a new version instead of a new deliverable
- Optional agent hints: `configuration.deliverables.{title_template,type,format}` used when present

3) PII/redaction hooks
- Apply DB/org regex redaction to `userMessage` unless local bypass is explicitly set
- Always redact secrets in logs and error messages (tokens, Authorization)
- Preserve policy metadata on responses and in `tasks.response_metadata`

4) Human‑in‑the‑loop gates
- When `execution.requiresHumanGate` or step requires approval, create `human_approvals` row with pending status
- Return `approvalId` and set task/run state to pending/paused
- Resume execution on approve; short‑circuit on reject (structured failure)

5) IO contracts + normalization
- Require explicit `input_modes` and `output_modes` in agent definitions
- Support optional adapters under `configuration.transforms` for JSON↔Markdown as needed; fail clearly when `strict: true`
- Preserve `metadata.contentType` and `metadata.originalContentType` in dispatch payloads

## APIs & Data
- Task create: `POST /agent-to-agent/:org/:agent/tasks` (converse|plan|build)
- Streams: client subscribes via websocket `subscribe_stream` with `streamId` from task response metadata
- Approvals service: `GET /api/agent-approvals`, `POST /api/agent-approvals/:id/approve`, `POST /api/agent-approvals/:id/reject`, `POST /agent-to-agent/:org/:agent/approvals/:id/continue`
- Tables
  - `public.tasks` — lifecycle, error fields, and response metadata
  - `public.deliverables` + `public.deliverable_versions` — persistence + versioning
  - `public.human_approvals` — approval gating and decisions

## Acceptance Tests
- Task lifecycle
  - Create task → observe `pending → running → completed` and stream events; verify `progress` updates are emitted
  - Failure path returns structured error with redacted message; logs contain no secrets
- Deliverables
  - Build mode auto‑creates deliverable with `conversation_id`, `user_id`; version increments on enhance
  - `DELIVERABLES_REQUIRE_BUILD=true` prevents creation from Converse/Plan; `false` restores legacy
- Redaction/PII
  - DB patterns applied to `userMessage`; secrets redacted in errors/logs; policy block returns `blocked: true`
- Human‑in‑the‑loop
  - Pending approval pauses run and returns `approvalId` in assistant metadata; approve resumes; reject fails gracefully
- IO contracts
  - Mismatch with `strict: true` fails with clear error; adapters render/parse when configured

## Risks & Mitigations
- Deliverables churn from non‑build modes → default to `DELIVERABLES_REQUIRE_BUILD=true`, opt‑out per env
- Approval dead‑letters → index and periodically surface stale `pending` rows; admin list view via `/api/agent-approvals`
- Redaction gaps → keep denylist‑style secret masking in addition to org regex patterns
- Backward compatibility → legacy DynamicAgentsController remains until Phase 4 cutover completes

## Rollout
- Phase 3.1 ship behind feature flags (`DELIVERABLES_REQUIRE_BUILD`, card private metrics)
- Add integration specs for streams, approvals, and deliverables
- Enable dual‑run observation for 1–2 agents before global enable
