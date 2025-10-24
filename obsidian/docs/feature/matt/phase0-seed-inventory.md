# Phase 0 Seed Inventory

This inventory captures the deterministic data loaded by `apps/api/supabase/seed.sql` after the Phase 0 reset. It is the baseline that future phases and tester suites can rely on.

## Auth & Users
- Demo auth user (`demo.user@playground.com`) with matching record in `public.users` (roles `["user","admin"]`).
- User ID: `b29a590e-b07f-49df-a25b-574c956b5035` (referenced by seeded conversations, deliverables, tasks, and metrics).

## Organizations & Namespaces
- No dedicated `public.organizations` table; namespaces are inferred from `organization_slug` columns.
- Existing namespaces from seed: `demo`, `my-org`, and new Phase 0 baseline namespace `global`.

## Agents (public.agents)
Baseline agents inserted for Phase 0 smoke testing (alongside legacy demo agents):
| Organization | Slug | Type | Purpose |
|--------------|------|------|---------|
| `demo` | `orchestrator` | orchestrator | Demo orchestrator from legacy seed |
| `my-org` | `requirements-specialist` | specialist | Legacy requirements specialist |
| `global` | `context-baseline` | context | Summarization helper for orchestration tests |
| `global` | `api-baseline` | api | Calls echo endpoint to validate API runner |
| `global` | `tool-baseline` | tool | Wraps sandbox MCP `noop` tool |
| `global` | `function-baseline` | function | Executes trivial JS echo for function runner |

Each baseline agent includes:
- Minimal JSON configuration in `agents.yaml` with execution capabilities aligned to its runner.
- `agents.config` entries capturing supported modes/outputs for quick smoke assertions.

## Sample Data
- 10 conversations with deliverables, tasks, and LLM usage metrics tied to the demo user (for analytics regression tests).
- KPI tables (`revenue`, `expenses`, `kpi_definitions`, etc.) populated with synthetic monthly data.
- `plans` / `plan_versions` tables empty by default (ready for Phase 1 orchestration work).

## Conversation Templates
- No dedicated template records yet; conversation scaffolding relies on sample conversations above. A reusable orchestration step template remains a follow-up item for a later phase.

## Notes for Testers
- Baseline agents give Claude immediate coverage to exercise each runner without waiting for Phase 4 agent implementations.
- Echo endpoint for `api-baseline` expects a local mock at `http://host.docker.internal:8055/echo`; adjust or mock in tests if unavailable.
- MCP sandbox server referenced by `tool-baseline` currently assumes a no-op tool; tester can stub responses as needed.
