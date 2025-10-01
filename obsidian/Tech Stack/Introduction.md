# Tech Stack — Introduction

This vault documents the core architecture and components that power Orchestrator AI. It’s a high‑level map meant to help new contributors orient quickly and give the team shared language as we evolve the platform.

## System Overview

- API: NestJS monolith in `apps/api` with modular services.
- Web: Vue 3 + Ionic app in `apps/web` consuming the API and WebSocket streams.
- Data: Supabase (Postgres) for agents, plans, orchestrations, and run state.
- LLM: Pluggable provider layer (Anthropic, OpenAI, Google, Grok, local/Ollama) via `LLMService`.
- Streaming: WebSocket gateway broadcasting agent stream chunks and orchestration updates.
- Agent Runtime: New Agent‑to‑Agent (A2A) controller with database‑backed runtime services.

## Back End (apps/api)

- Agent2Agent surface
  - `agent2agent/*`: REST controller + `AgentExecutionGateway` routes requests by `mode` (converse/plan/build/orchestrate_*).
  - `AgentModeRouterService`: Orchestrates prompt building, dispatch, and streaming for “converse” flows.
  - DTOs: `TaskRequestDto`/`TaskResponseDto` define API contract and metadata.

- Agent Platform runtime
  - Definition: Builds runtime definitions from agent records and descriptors.
  - Prompt: Normalizes conversation context and prompt payloads.
  - Dispatch: Calls providers through `LLMService`, supports async streaming.
  - Stream: `AgentRuntimeStreamService` issues `streamId` and emits `agent.stream.*` events.

- Orchestration & plans
  - Plan Engine: Generates plan drafts aligned to conversations and agents.
  - Orchestration Runner: Starts and updates orchestration runs; persists state in Supabase.
  - Repositories: Access agent orchestrations, orchestration runs, and conversation plans.

- Legacy orchestrator agents (compat layer)
  - Existing “orchestrator” base services follow the conversation + tasks pattern.
  - Phase 2 migrates capabilities to the database‑backed runtime; legacy paths remain for stability.

## Front End (apps/web)

- Vue + Ionic SPA for chat and orchestration UX.
- WebSocket integration subscribes to `stream:{streamId}` rooms for live token streams and run updates.
- State stores manage conversations, stream message assembly, and run status.

## Data & Configuration

- Supabase tables (representative):
  - Agents, conversation plans, agent orchestrations, orchestration runs, organization credentials.
- Config and environments:
  - `.env` and `apps/api` provider configuration manage LLM keys and routing behavior.
  - Dev scripts: `npm run dev`, `start-dev-local.sh`, and PM2 ecosystem scripts for production ops.

## Streaming Model

- Client opts into streaming on request; backend creates a session with a `streamId`.
- Gateway emits `agent.stream.start|chunk|complete|error` and mirrors to WebSocket rooms:
  - `stream:{streamId}`, `conversation:{id}`, and `run:{id}` as appropriate.
- Responses include `metadata.streamId` so the UI can immediately subscribe.

## Where We’re Headed (Phase 2)

- Finish database‑backed agent runtime coverage for plan/build/orchestrate modes.
- Consolidate legacy orchestrator flows onto the new gateway and repositories.
- Expand repository endpoints and tighten validation for saved orchestrations and run updates.

If you want a deeper drill‑down next, see: back‑end runtime modules, data schema notes, and streaming event taxonomy.
