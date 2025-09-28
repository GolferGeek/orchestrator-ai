# Legacy Agent-to-Agent Stack Stabilization PRD

**Project Name:** Legacy Agent-to-Agent Stack Stabilization  
**Version:** 0.2 (Draft)  
**Date:** 2025-01-16  
**Author:** Matt Weber (via Codex assistant)

## 1. Executive Summary

We will refactor the existing NestJS/TypeScript “A2A” stack so it is clean, spec-aware, and ready to coexist with the new database-first agent-to-agent controller. The goal is a codebase we can confidently present to partner engineering teams while we migrate traffic to the modern implementation.

## 2. Scope

**In scope**
- `A2AAgentBaseService` and all agent-type base classes (`context`, `function`, `python`, `external`, `orchestrator`).
- Supporting sub-services under `apps/api/src/agents/base/sub-services/` (JSON-RPC, logging, agent metadata, configuration, registry, task lifecycle, validation).
- `CentralizedRoutingService` and its direct dependencies (PII, sovereign policy, feature flags).
- `DynamicAgentsController` and any guards/pipes/providers it depends on.

**Out of scope**
- New database-backed agent-to-agent controller (covered by separate PRD).
- Frontend changes, orchestrator-specific UI features, non-agent modules.

## 3. Current Architecture (NestJS/TypeScript)

### 3.1 Base Service (`A2AAgentBaseService`)
- Injectable Nest provider with rich constructor dependencies (HTTP client, deliverable/task services, LLM service, registration, logging, auth, configuration).
- Implements `OnModuleInit` / `OnModuleDestroy` lifecycles to discover agent paths and unregister.
- Entry points: `processJsonRpcRequest`, `processTask`, `executeTask` (abstract), plus helpers (`normalizeAndExecute`, `extractUserMessage`, `emitProgress`, etc.).
- Generates agent card via `getAgentCard()` but currently emits only partial metadata.
- Supports “legacy direct” path when `DISABLE_LEGACY_A2A_DIRECT` flag permits it.

### 3.2 Sub-Services
- **JSON-RPC Protocol**: Validates requests, handles batch/notifications, builds success/error responses.
- **LoggingService**: Structured logging but mixes emoji tags and non-standard metadata.
- **AgentMetadataService**: Attempts to build agent cards using filesystem scanning.
- **ConfigurationService**: Parses YAML, substitutes env vars; unused validation scaffolding adds complexity.
- **AgentRegistrationService**: Self-registers agents with the internal pool.
- **Task lifecycle / Deliverable services**: Manage persistence in Supabase.

### 3.3 Centralized Routing
- Injected service orchestrating PII detection (`PIIService`), feature flags, sovereign policy, local model status, pseudonymization reversal.
- Returns routing decisions consumed by agents; logs extensively with custom debug output.
- Tightly coupled to Supabase service for metadata persistence.

### 3.4 Dynamic Agents Controller
- Nest controller at `/agents` guarded by `JwtAuthGuard`.
- Endpoints: debug listing, hierarchy, JSON-RPC task execution, `.well-known/agent.json`, health checks.
- Performs request normalization, speech transcription (audio detection), conversation namespace resolution, WebSocket event publishing.
- Hard couples Supabase user context to agent execution.

## 4. Target Architecture & Refactor Vision

### 4.1 Core Principles
1. **JSON-RPC Only** – Remove legacy direct paths; all execution flows through `processJsonRpcRequest`.
2. **Separation of Concerns** – Base service handles protocol and execution orchestration; specialized concerns move to dedicated services.
3. **Spec Awareness** – Even the legacy controller should emit spec-complete agent cards and responses so the code is convergent.
4. **Dependency Hygiene** – Constructor injections match NestJS DI best practices, with optional dependencies replaced by explicit interfaces or module imports.
5. **Logging Discipline** – Use structured logging (JSON or consistent key-value) via Nest logger; no emoji-based debug statements.
6. **Config & Secrets Clarity** – Environment access happens in configuration modules, not scattered across services.

### 4.2 Module Breakdown (NestJS)

| Module/Class | Action | Notes |
| --- | --- | --- |
| `A2AAgentBaseService` | Refactor | Remove legacy direct path, ensure card builder delegate, reduce optional injections, document abstract contract. |
| `ContextAgentBaseService` & peers | Refactor | Move context-specific helpers to separate utilities or private methods; remove debug logging; ensure they call super methods cleanly. |
| `JsonRpcProtocolService` | Keep (minor cleanup) | Ensure parameter validation options are documented; add unit tests for nested error cases. |
| `LoggingService` | Refactor | Provide consistent interface (`logRequest`, `logResponse`, `logError`) with structured metadata; remove emoji logs. |
| `AgentMetadataService` | Adapt | Change to DB-first metadata builder; drop filesystem caching if not needed for DB agents; expose TS interfaces for cards. |
| `ConfigurationService` | Simplify | Keep YAML/env parsing but remove unused validation hooks or move them into dedicated module. |
| `CentralizedRoutingService` | Modularize | Introduce smaller injected services (`RoutingPolicyService`, `PiiProcessingService`, `ModelSelector`) and lighten constructor; ensure TypeScript interfaces for routing decisions. |
| `DynamicAgentsController` | Split | Break into dedicated controllers/services: e.g., `AgentsTaskController`, `AgentsHierarchyController`, `AgentMetadataController`; keep Nest routing / guard structure. |
| Guards/Pipes | Review | `JwtAuthGuard` remains but ensure new services can be reused without it.

### 4.3 Data Flow (Legacy Path)
1. HTTP request hits `DynamicAgentsController` (or split controllers) under `/agents`.
2. Guard authenticates user (`SupabaseAuthUserDto`).
3. Controller normalizes request to JSON-RPC (`CreateTaskDto -> JsonRpcRequest`).
4. It resolves namespace; fetches agent instance via `AgentDiscoveryService` + `AgentFactoryService` + `AgentPoolService`.
5. Delegates to `processJsonRpcRequest`; base service handles logging, routing, task lifecycle, returns JSON-RPC response.
6. Controller unwraps result to HTTP response, optionally streams deliverables.

Refactor ensures every step is explicit, typed, and tested.

## 5. Workstreams & Tasks

### Workstream A: Core Base Services
- [ ] Remove legacy direct path from `A2AAgentBaseService.processTask`; log warning if invoked.
- [ ] Introduce `AgentCardBuilder` service injected into base service (instead of in-method YAML parsing).
- [ ] Annotate abstract members with TypeDoc-style comments; enforce TypeScript `override` keyword in subclasses.
- [ ] Add unit tests for `processJsonRpcRequest` coverings: success, method not found, invalid params, notification, batch, internal error.
- [ ] Collapse mode handling (conversation/plan/build) into `A2AAgentBaseService` so subclasses simply implement mode-specific helpers; remove redundant mode checks from context/function/api/external base classes.

### Workstream B: Sub-Service Cleanup
- [ ] Update `LoggingService` to use Nest `LoggerService` interface; ensure dependency injection via module.
- [ ] Refine `ConfigurationService` with explicit DTOs for YAML shapes; drop unused validator wrappers.
- [ ] Modify `AgentMetadataService` to accept DB DTOs (from `agent_configurations`) and output spec-ready cards (still consumed by legacy controller).
- [ ] Ensure `AgentRegistrationService` gracefully handles DB-first agents (no filesystem assumptions).
- [ ] Inventory and delete dead code (TODO blocks, unused fallback functions).

### Workstream C: Centralized Routing Modularization
- [ ] Define interface `IRoutingDecision` and `IRoutingPolicyService`.
- [ ] Extract PII pseudonymization reversal into `PiiPostProcessorService`.
- [ ] Guard Supabase-specific logic behind interfaces so new controllers can swap implementations.
- [ ] Add TypeScript types for routing request/response stored in `common/types/agent-execution.types.ts`.
- [ ] Increase unit test coverage around severe cases (PII block, local model failure, fallback).

### Workstream D: Controller & API Layer
- [ ] Create `AgentsTaskController` for `/agents/:namespace/:type/:name/tasks` with narrow responsibility.
- [ ] Move hierarchy endpoints into `AgentsHierarchyController` (uses `AgentDiscoveryService`).
- [ ] Provide `AgentMetadataController` for `.well-known/agent.json` (and ensure it calls shared builder).
- [ ] Ensure controllers use DI for `AgentExecutionGateway` service to reduce repeated logic.
- [ ] Replace speech transcription logic with dedicated service (injectable) or remove if not needed.
- [ ] Update DTOs (Nest `class-validator` decorated classes) for request bodies/responses.

### Workstream E: Testing, Linting, Docs
- [ ] Add Jest tests for base service + controllers (mocking dependencies via Nest testing module).
- [ ] Add integration tests hitting `/agents/.../tasks` with JSON-RPC payloads.
- [ ] Enforce ESLint/Prettier config (existing in repo) across touched files.
- [ ] Update README / developer docs explaining legacy vs new controller, module structure, and how to add new agents.

#### Test Suite Expectations
- **Unit**: JSON-RPC protocol edge cases, logging service format, configuration parsing, centralized routing decisions (including PII block, fallback routing, sovereign enforcement).
- **Integration**: End-to-end task execution (converse/plan), deliverable creation, human-in-loop pause/resume via existing APIs, audio transcription path (if retained), MCP/tool invocation stubs.
- **Regression**: Legacy UI flows (hierarchy retrieval, debug endpoints) to confirm behavior parity during refactor.
- **Performance Smoke**: Validate routing/agent execution under concurrent load using lightweight stress tests.

## 6. Deliverables & Exit Criteria
- Code compiles with TypeScript strict options; NestJS modules clearly separated.
- `npm run test` / `pnpm test` passes with new coverage targeting refactored modules.
- Lint passes without TypeScript warnings in touched areas.
- Legacy controller serves spec-compliant agent cards (even if access remains auth-guarded).
- All endpoints documented (OpenAPI or README-level) for internal stakeholders.
- Developer handoff doc summarizing migration path to new agent-to-agent controller.

## 7. Timeline (Indicative)
1. **Week 1:** Solidify base-service refactor & sub-service cleanup (Workstreams A & B).
2. **Week 2:** Centralized routing modularization (Workstream C) + start controller split (Workstream D).
3. **Week 3:** Finish controller split, testing, documentation (Workstream D & E).
4. **Week 4:** Stabilization, regression testing, prepare for new agent-to-agent integration.

## 8. Risks & Mitigations
- **Scope creep:** Keep new features out; focus on cleanup/stabilization. Mitigate via weekly check-ins.
- **Breaking UI flows:** Ensure existing controller endpoints keep behavior (just cleaner internals). Add regression tests.
- **Dependency drift:** Define clear interfaces for services we plan to share with the new controller.
- **Time pressure:** Prioritize base service/transport cleanup first; shipping those improvements gives immediate value.

## 9. Open Questions
- Confirm whether speech transcription is still required in backend or can move to front-end.
- Decide final agent card schema version/fields to match (align with new controller PRD).
- Determine if we keep debugging endpoints (`/.well-known/debug-agents`) in production; may move to dev-only module.
- Clarify Supabase dependency plan (long-term we may swap to other persistence).

## 10. References
- Legacy controller/source: `apps/api/src/agents/dynamic-agents.controller.ts`
- Base service: `apps/api/src/agents/base/implementations/base-services/a2a-base/a2a-agent-base.service.ts`
- Centralized routing: `apps/api/src/llms/centralized-routing.service.ts`
- Agent metadata service: `apps/api/src/agents/base/sub-services/agent-metadata/agent-metadata.service.ts`
- Tasks module: `apps/api/src/tasks`
