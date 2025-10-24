# PRD: Converse / Plan / Build Modes with Deliverable Gating

## Background

Our chat feels tasky and less conversational. Users need a clear, guided flow:
1) Converse to explore, 2) Plan to produce a clear single‑action PRD, 3) Build to execute and create deliverables. Today, deliverables can be auto‑created from any “document‑like” response, which is surprising. We want Build to be the explicit trigger for deliverables.

## Goals

- Make conversation feel natural again; default to Converse.
- Add a Mode control: Converse (default), Plan, Build.
- Plan returns a Single‑Action PRD (SAPRD) the current agent can execute in one shot (no orchestration).
- Build executes the SAPRD and creates deliverables; Converse/Plan do not.
- Nudge users with smart CTAs (“Plan it?” / “Build it now?”), and accept short affirmative replies to switch modes.
- Keep implementation incremental and low‑risk with feature flags.

## Non‑Goals

- No multi‑step orchestration for non‑orchestrator agents (future work).
- No new DB tables; use existing task/metadata.
- No redesign of LLM selection modal; only change its entry point.

## User Stories

- As a user, I can chat naturally and not create deliverables unless I choose Build.
- As a user, I can switch to Plan and get a clear SAPRD before executing.
- As a user, I can click a CTA or simply reply “yes/sure” to proceed to Plan/Build.
- As a user, when I Build, I see progress and end with a deliverable attached.

## Modes

### Converse
- Default mode for all conversations.
- No deliverables; agents respond conversationally (small‑talk friendly).
- Request: `method: 'converse'`, `params.mode = 'converse'`.

### Plan (Single‑Action PRD)
- Produces a SAPRD the current agent can execute in one shot (no chaining):
  - Title, Background, Objective
  - Scope: `single_action: true`, `action_type`
  - Inputs, Parameters, Assumptions
  - Exact Output spec (format/structure/length/tone)
  - Acceptance Criteria (checklist)
  - Constraints (privacy, model caps, timeouts)
  - Risks/Edge Cases (graceful fallback)
- No deliverables created.
- Request: `method: 'plan'`, `params.mode = 'plan'`.
- Response: PRD markdown in `response`, structured draft JSON in `responseMetadata.planDraft` (optional, but recommended).

### Build
- Explicit signal to execute and create deliverables.
- Auto‑trigger: switching to Build fires an event and immediately sends a Build task using the best available source (latest SAPRD > last assistant response > current input), with a one‑click confirm if unclear.
- Request: `method: 'build'`, `params.mode = 'build'`, include `planDraft` if present.
- Deliverables created (see Deliverable Gating).

## UI Requirements

- Chat header controls:
  - Compact `LLM` button that opens existing model modal (replaces full‑width selector).
  - `Mode` dropdown (Converse / Plan / Build) next to LLM button.
  - Persist selection per conversation.
- Smart CTAs after replies: render inline `[Plan It]` / `[Build It]` chips when agent suggests action.
- Natural acceptance: If user replies within a short window with “yes/sure/please”, treat as acceptance for the last CTA; flip mode and auto‑send.
- Progress indicators and Cancel for Build tasks.

## Request/Response Shape

- Frontend task payload additions:
  - `method`: `'converse' | 'plan' | 'build'`
  - `params.mode`: same value for backend branching.
  - Optional: `params.planDraft` for Build executing a prior Plan.
  - Continue sending `conversationId`, `llmSelection`, `conversationHistory`, `metadata`.

## Backend Mapping (Incremental)

- All agents: Accept `params.mode` and `method`. No behavior change required for Converse.
- Orchestrator agents:
  - `plan` → map to `explicit_create_project` (or `update_project_plan` if `projectId` exists) for full PlanDefinition and human‑readable plan in `response`.
  - `build` → if pending plan, `approve_project_plan` and start execution; otherwise delegate/do‑work path.
- Context/API/External agents:
  - `plan`: Return SAPRD as markdown and attach draft JSON in `responseMetadata.planDraft`. Do not create deliverables.
  - `build`: Execute once from SAPRD or best context; allow dry‑run confirmation for API agents when risky.

## Deliverable Gating (Important)

- Only create deliverables when `params.mode === 'build'`.
- Implement as a guard in deliverable auto‑persistence:
  - Check the originating task’s `params.mode` via task fetch; if not `'build'`, skip creation.
- Feature flag: `DELIVERABLES_REQUIRE_BUILD` (default `true` after rollout).

## Data & Persistence

- Plan artifacts:
  - Keep PRD markdown in `task.response` and structured draft in `task.response_metadata.planDraft`.
  - Do not create a deliverable for Plan.
- Conversation state: persist last selected mode client‑side; optionally reflect in conversation metadata later.

## Observability

- Counters: `mode_selected`, `cta_clicked`, `auto_accept_yes`, `build_sent`, `deliverable_created`.
- Log planDraft presence and size for diagnostics.

## Rollout Plan

1. Frontend Mode/LLM controls and request wiring (default Converse).
2. Smart CTAs and natural acceptance.
3. Backend deliverable gating behind `DELIVERABLES_REQUIRE_BUILD`.
4. Orchestrator Plan/Build mapping.
5. Enable gating by default; monitor metrics.

## Acceptance Criteria

- Default mode is Converse; small‑talk responses work again.
- Plan returns a SAPRD; no deliverable created.
- Switching to Build fires an event and auto‑sends a Build task.
- Deliverables are only created for tasks with `params.mode === 'build'`.
- Smart CTAs appear after suitable responses; “yes/sure/please” acceptance works.
- Mode and LLM are persisted per conversation in the UI.

## Risks & Mitigations

- False triggering of CTAs from generic affirmatives → use short‑lived pendingAction windows and pair with the last CTA only.
- Duplicate deliverables → existing dedupe by taskId; Build debounce and in‑flight guards on frontend.
- Legacy tasks without `params.mode` → treat as Converse unless gated flag is off for compatibility.

## Effort Estimate (engineering)

- Frontend (Vue/Pinia): 2–3 days
  - Header controls (LLM button + Mode dropdown), state persistence, task wiring.
  - Smart CTAs and affirmative acceptance.
- Backend: 0.5–1 day
  - Deliverable gating guard + FF; orchestrator Plan/Build method mapping glue.
- QA/Polish: 1 day
  - Conversational feel, CTA UX, gating verification, analytics sanity checks.

## Implementation Notes (files to touch)

- Frontend
  - Send `method` and `params.mode` in `tasksService.createAgentTask(...)` calls.
    - apps/web/src/services/tasksService.ts
  - Chat header UI for Mode + LLM button; persist per conversation (Pinia store).
    - Likely chat header component(s) in apps/web/src/views/HomePage.vue and related components.
  - CTA logic and pendingAction handling in chat message renderer.

- Backend
  - Deliverable gating in auto‑persistence (check originating task’s `params.mode`).
    - apps/api/src/agents/base/implementations/base-services/a2a-base/a2a-agent-base.service.ts
  - Orchestrator facade mapping for `plan`/`build` convenience (optional first pass).
    - apps/api/src/agents/base/implementations/base-services/orchestrator/orchestrator-facade.service.ts

