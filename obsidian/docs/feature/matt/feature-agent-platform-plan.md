# Feature: Agent Platform — Work Plan & Checklist

Owner: Codex with Matt
Status: Active
Last Updated: 2025-10-01

Purpose
- Single source of truth for current tasks, decisions, and progress.
- Checklist-driven so we can pick up work even if context is lost.
- Links to details (PRDs/specs) and code locations where relevant.

How to Use
- Mark checkboxes when tasks are complete: [x]
- Use the "Next Action" lines to set the precise next step before pausing work.
- Add short bullets to the "Notes" section if something blocks progress.

---

## Phase 3 — Agent Feature Parity (Done)

- [x] M3.1 Task lifecycle parity (streams + events)
  - Notes: Uses AgentRuntimeStreamService + TaskProgressGateway
- [x] M3.2 Deliverables persistence + versioning
  - Notes: Gated by `DELIVERABLES_REQUIRE_BUILD`; enhancement path via `payload.deliverableId`
- [x] M3.3 PII/Redaction integrated
  - Notes: Redacts userMessage per org policy; secrets masked in logs/errors
- [x] M3.4 Human-in-the-loop approvals
  - Notes: `human_approvals` table + list/approve/reject; approve-and-continue endpoint; UI status badge

Next Action (Phase 3): None — Complete

---

## Phase 4 — Image Deliverables MVP (In Progress)

Goals
- Persist images as first-class deliverable versions with file attachments
- Render thumbnails in chat and Deliverables; lightbox or new-tab view
- Support multi-provider fan-out and later refinement flows

Backlog Slices (MVP)
- [x] Runtime: accept `payload.images` and persist to `file_attachments.images`
  - Code: apps/api/src/agent-platform/services/agent-runtime-deliverables.adapter.ts
- [x] Web UI: thumbnails in Deliverables list + chat assistant bubbles
  - Code: apps/web/src/views/DeliverablesListPage.vue, apps/web/src/components/AgentTaskItem.vue
- [ ] Storage service: local disk + Supabase adapters; assets table; streaming endpoint
  - Code: apps/api/src/assets/* (new), DB migration (assets table)
  - Next Action: Scaffold AssetsController + storage adapters (local first)
- [ ] Images tab in Work Product pane (browse, compare, set current)
  - Code: apps/web/src/components/DeliverableDisplay.vue (images sub-tab)
  - Next Action: Add images sub-tab and grid sourced from file_attachments
- [ ] Image Orchestrator (fan-out providers) with provider metadata
  - Code: apps/api/src/agents/specialists/image_orchestrator/* (new)
  - Next Action: Define provider adapters and request DTO; write minimal OpenAI path
- [ ] Refinement flow (image+text → new version, track lineage)
  - Code: versions service + orchestrator; version.metadata.parentVersionId
  - Next Action: Add lineage fields to metadata and wire first provider
- [ ] Evaluations (auto metrics + human ranking UI)
  - Code: apps/api/src/evaluation/*, web Images tab UI
  - Next Action: Choose initial auto signals (CLIP aesthetic proxy or simple heuristic)

Notes
- Default backend = local storage; optional Supabase storage adapter
- Endpoint design: `GET /assets/:id` (auth), `GET /assets/:id/signed` (short TTL)
- Keep logs secret-safe (no presigned query params); mask external URLs in errors

---

## Phase 5 — Cutover & Orchestration Enablement (Deferred)

- [ ] Dual-run validation & telemetry comparison
- [ ] Flag-guarded enablement and legacy deprecation
- [ ] Orchestration UX reintroduction

Notes
- Legacy docs are archived under `docs/feature/matt/history/feature-agent-platform/`

---

## Quick Links

- M3 Kickoff: docs/feature/matt/phase-3-kickoff.md
- P4 Images: docs/feature/matt/phase-4-image-deliverables-kickoff.md
- Modernization Plan: docs/feature/matt/agent2agent-modernization-plan.md
- External transports guide: apps/api/docs/external-api-agents-usage.md

---

## Scratchpad (Decisions & TODOs)

- Storage default = local; add envs:
  - `ASSET_STORAGE_BACKEND=local|supabase`
  - `IMAGE_STORAGE_DIR=/var/lib/orchestrator/images`
  - `SUPABASE_STORAGE_BUCKET=orchestrator-images`
  - `ASSET_SIGNED_URL_TTL_SECONDS=900`
- Images tab: mirror Plan tab structure; support set current + compare overlay
- Orchestrator: provider list OpenAI + SDXL/Flux; unify request DTO + metadata capture

