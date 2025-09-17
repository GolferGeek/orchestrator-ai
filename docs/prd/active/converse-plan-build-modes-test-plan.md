# Test Plan: Converse / Plan / Build Modes + Deliverable Gating

## Scope
Validates new chat modes (Converse, Plan, Build), deliverable gating (Build‑only), smart CTAs with natural acceptance, and orchestrator mapping. Ensures analytics events fire without breaking UX.

## Environments & Prerequisites
- Web and API running locally with authenticated user.
- Feature flag: `DELIVERABLES_REQUIRE_BUILD=true` (default) in API env.
- At least one context agent and one orchestrator agent available.
- Ability to inspect network requests in browser devtools.

## Test Data
- Create a fresh conversation for each major scenario to avoid cross‑mode contamination.

---
## 1) UI Controls
- Open any conversation.
- Verify a compact `LLM` button and a `Mode` dropdown (Converse/Plan/Build) in the chat header.
- Default mode shows `Converse` for new conversations.

Expected:
- Dropdown changes persist for the active conversation; switching tabs preserves each conversation’s mode.

---
## 2) Converse Mode (default)
Steps:
- With Mode = Converse, send small‑talk (“Hi, I’m Matt”).
- Observe assistant’s natural response.
- Confirm no deliverable callout appears for the assistant message.
- Inspect the task request payload (Network tab → POST `/agents/.../tasks`):
  - `method` = `converse`
  - `params.mode` = `converse`

Expected:
- No deliverable created (UI and DB).
- Conversation feels natural (no system/plan formatting).

---
## 3) Plan Mode (Single‑Action PRD)
Steps:
- Switch Mode to Plan and send a clear request (e.g., “Draft a product intro for X”).
- Inspect the request: `method` = `plan`, `params.mode` = `plan`.
- Review the assistant response.

Expected:
- Response contains a structured PRD (markdown) suitable for a single action.
- No deliverable is created (no deliverable callout; DB has no new deliverable).

Orchestrator variant:
- Using an orchestrator agent, repeat Plan.
- Expected: plan response maps to `explicit_create_project` (verify logs/metadata) and returns a human‑readable plan.

---
## 4) Build Mode (explicit deliverable)
Steps:
- Switch Mode to Build and send “Build it now” (or “Proceed to build the PRD”).
- Inspect request: `method` = `build`, `params.mode` = `build`.

Expected:
- Deliverable is created and linked to the assistant message (deliverable callout in UI).
- Backend gating respects `params.mode === 'build'`.

Orchestrator variant:
- With a project created (from Plan), Build should approve/start execution (maps to `approve_project_plan`; verify via logs/metadata). If no projectId, Build gracefully converses or delegates.

---
## 5) Smart CTAs (Plan/Build)
Detection:
- When an assistant message suggests planning or building, verify `Plan It` / `Build It` chips appear under the message.

CTA click → Plan:
- Click `Plan It`.
- Expected: mode flips (Plan), request is sent with `method=plan`, no deliverable created.

CTA click → Build:
- Click `Build It`.
- Expected: mode flips (Build), request sent with `method=build`, deliverable created.

Natural acceptance:
- After a CTA appears, reply “yes”, “sure”, “please”, or “ok”.
- Expected: pending action is accepted, mode flips accordingly, request auto‑sent; no duplicate user prompts required.

---
## 6) Deliverable Gating
Plan/Converse → Deliverable:
- With Mode = Plan or Converse, request content that looks like a document (headers, long body).
- Expected: no deliverable is created because `DELIVERABLES_REQUIRE_BUILD=true`.

Build → Deliverable:
- With Mode = Build, send a similar request.
- Expected: deliverable created and linked.

Flag off (optional):
- Temporarily set `DELIVERABLES_REQUIRE_BUILD=false` and restart API.
- Expected: legacy behavior—document‑like responses may create deliverables in any mode.

---
## 7) Analytics Events (non‑blocking)
Mode selection:
- Switch Mode; verify `mode_selected` posted to `/analytics/events`.

CTA clicks:
- Click `Plan It`/`Build It`; verify `plan_clicked` / `build_clicked` posted.

Natural acceptance:
- Reply “yes/sure/please”; verify `auto_accept_yes` posted.

Dispatch:
- When Plan/Build requests are actually sent, verify `plan_sent` / `build_sent` posted.

Expected:
- If analytics endpoint is not implemented, requests fail silently without impacting UX.

---
## 8) Execution Modes
- Try with different execution modes (immediate/websocket) to ensure mode/CTA features operate and progress updates appear.

Expected:
- Placeholders and progress updates render as before; Plan/Build semantics unchanged by execution mode.

---
## 9) Edge Cases
- Affirmative without pending CTA: reply “yes” in normal chat; should behave as regular input.
- Switch modes mid‑conversation: verify the new mode applies to subsequent requests only.
- Orchestrator Build without projectId: Build falls back gracefully (converse/delegate) without errors.

---
## 10) DB Validation (optional)
- Verify tasks table entries:
  - `method` matches mode, `params.mode` stored.
- Verify deliverables table entries:
  - Only created for Build tasks when flag is true; deliverable versions linked to tasks.

---
## Acceptance Criteria
- Default mode = Converse; small‑talk works; no deliverables in Converse/Plan.
- Plan produces a clear single‑action PRD.
- Build explicitly creates deliverables.
- Smart CTAs + natural acceptance switch modes and auto‑send correctly.
- Orchestrator: plan/build mapping behaves as specified.
- Analytics events fire and don’t block UX.

## Rollback Plan
- Revert the feature branch; set `DELIVERABLES_REQUIRE_BUILD=false` to restore legacy behavior quickly if needed.

## Notes
- Keep an eye on duplicate task handling and placeholder messages; ensure only one final assistant message per task.
