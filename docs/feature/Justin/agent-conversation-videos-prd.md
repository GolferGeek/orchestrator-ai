# Agent Conversation Video Experience PRD

## TL;DR
Add contextual training/demo videos to agent conversations so users can launch a modal video viewer from within an agent thread. Each agent can declare one or more video IDs in its `context.md`; the UI surfaces those as buttons, falling back to a global default video when none are specified. The video library lives in `apps/web/src/data/videos.json`.

## Problem
- Currently, visitors only see curated videos on the marketing landing page.
- Inside the product, agent conversations offer no inline education or demo content.
- Agent context files do not encode multimedia references, so there is no structured way to discover or display videos per agent.

This leaves users without guided instruction on how to leverage each agent effectively and forces manual knowledge transfer.

## Goals & Non-Goals
- **Goals**
  - Provide at least one high-quality walkthrough video for every core agent in production, starting with: Metrics, Marketing Swarm, Requirements Writer, Golf Rules, Jokes, and (later) Hiverarchy.
  - Make video references discoverable in agent context metadata so frontend surfaces can render playable buttons.
  - Introduce a default "Agent Overview" video that shows wherever an agent has no specific assets.
  - Ensure the data flow reuses the existing landing-page video JSON source of truth.
- **Non-Goals**
  - Building a full video CMS; we stick with JSON + markdown-managed references.
  - Updating developer view until after agent conversations ship.
  - Solving for streaming/hosting (assume Loom/embed URLs remain standard).

## Users & Use Cases
- **Operators & Support reps**: Need quick orientation on how an agent works while they are reading the agent’s transcript.
- **Prospective customers**: During demos, sales can open relevant videos in-app to reduce context switching.
- **Internal team**: Content writers and PMs should be able to add/remove videos without code changes beyond markdown edits.

## Requirements

### Content Requirements
1. Produce/collect the following Loom videos (final URLs to be provided):
   - `agent-default-overview`: General overview of working with Orchestrator AI agents (acts as fallback).
   - `metrics-agent-walkthrough`: Finance Metrics agent.
   - `marketing-swarm-demo`: Marketing Swarm agent.
   - `requirements-writer-tutorial`: Requirements Writer agent.
   - `golf-rules-coach-demo`: Golf Rules specialist.
   - `jokes-agent-demo`: Jokes productivity agent.
   - `hiverarchy-external-briefing`: Hiverarchy external agent (can remain TODO until video ready).
2. Each video entry requires title, description, Loom embed URL, duration, createdAt, featured flag (as needed), and order.
3. Content team owns recording and uploading; engineering will consume the final metadata.

### Data & Configuration Requirements
1. Extend `apps/web/src/data/videos.json`:
   - Add a new top-level `agentDefaults` object mapping agent slugs to video ID arrays (e.g., `"finance/metrics": ["metrics-agent-walkthrough"]`).
   - Include the new agent video objects in an appropriate category (suggest new `"agents"` category or reuse `"demos"`).
   - Include `"agent-default-overview"` as either featured or part of an "Agents" category.
2. Update agent `context.md` files to reference their video IDs under a dedicated section:
   ```markdown
   ## Videos
   - metrics-agent-walkthrough
   ```
   Allow multiple entries per agent.
3. Hiverarchy agent context can add the reference when the external video is ready.

### Backend Requirements (Nest API)
1. Update `ContextLoaderService` to detect a `## Videos` (case-insensitive) section and emit an array of strings alongside `AgentContextContent` (new optional `videos?: string[]`).
2. Propagate the parsed video IDs through any downstream context metadata services (e.g., `AgentMetadataService`) so the frontend can request them via existing APIs.
3. Ensure no regressions for agents without a `## Videos` section; they should simply return `videos: []` or `undefined`.

### Frontend Requirements (Vue Web App)
1. Extend the agent conversation view to:
   - Request video IDs for the current agent (from context metadata API response).
   - Resolve IDs via `videoService.getVideoById`.
   - Render inline buttons (similar styling to landing page) that launch a modal player component.
2. If an agent supplies no IDs, fall back to `agent-default-overview` from the `agentDefaults` map.
3. Allow multiple video buttons per agent; order should follow the sequence in the context file.
4. Reuse the existing modal/video player components whenever possible to reduce duplicate logic.

### Analytics & Tracking
- Track video button clicks and modal opens per agent for future optimization (e.g., via existing analytics hooks).
- Optional: log which fallback videos were shown to identify agents missing dedicated content.

### Acceptance Criteria
- Visiting an agent conversation renders video buttons when IDs are defined in the agent’s context.
- Clicking a button opens an embedded video modal and plays the correct Loom clip.
- Agents with no video section display the default overview video button instead.
- Landing page video experience remains unchanged.

## Delivery Plan

### Phase 0 – Content Prep (Docs/Marketing)
- Script, record, and host the six required videos plus the default overview.
- Provide finalized metadata (title, description, URL, duration, createdAt).

### Phase 1 – Data Modeling (Frontend Platform)
- Update `videos.json` with new category and entries.
- Introduce `agentDefaults` map.
- Document JSON schema changes in `apps/web/src/data/README.md`.

### Phase 2 – Context Metadata (Backend)
- Update context loader to parse `## Videos` section.
- Extend API responses to include `videos` array for each agent where available.
- Add unit tests covering parsing success/fallback cases.

### Phase 3 – Frontend Integration
- Fetch video IDs in the agent conversation UI.
- Render buttons/modal player.
- Ensure responsive design matches existing style guide.
- Add minimal Cypress/unit coverage if available.

### Phase 4 – QA & Launch
- Verify each target agent displays correct video(s).
- Smoke test fallback agents.
- Confirm analytics events fire.

## Dependencies & Risks
- **Dependency**: Marketing/Content team must supply final Loom URLs; engineering blocked until metadata ready.
- **Dependency**: Agent context files maintained manually—need coordination with owners to add the `## Videos` section.
- **Risk**: JSON schema changes could break the landing page if not backward-compatible (mitigated by updating service/tests).
- **Risk**: Modal performance/loading; ensure lazy loading or use existing player component.

## Open Questions
1. Should we support per-agent video ordering beyond markdown list order (e.g., `order` property)?
2. Do we want to surface these videos in the developer console simultaneously?
3. Any compliance requirements for embedding Loom within authenticated app sections?

## Appendix
- Existing video data source: `apps/web/src/data/videos.json`
- Target agent context files live under `apps/api/src/agents/actual/.../context.md`
- Related services: `apps/web/src/services/videoService.ts`, `ContextLoaderService`
