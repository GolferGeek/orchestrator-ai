# Agent Platform Unified PRD (Agent-to-Agent + Database Agents)

**Project Name:** Agent Platform Modernization  
**Version:** 0.1 (Draft)  
**Date:** 2025-01-16  
**Author:** Matt Weber (via Codex assistant)

## 1. Executive Summary
We are rebuilding the NestJS agent platform from the ground up. This unified PRD captures:
- A full inventory of the existing API codebase with a keep/replace/remove mapping.
- Requirements for a greenfield agent-to-agent controller/transport layer.
- Requirements for a database-backed agent system (metadata, context, plan/deliverable handling, orchestration).
- Cross-cutting concerns: conversation/plan flow, universal orchestration (every agent can delegate), secure credential storage, testing, and migration.

Legacy code remains in place during transition but no existing implementation details are copied; only explicitly curated behaviors survive.

## 2. Current API Inventory & Gap Matrix
Comprehensive crawl summary of `apps/api/src`. Each row lists the current responsibilities, observed issues/technical debt, and the planned future-state mapping.

| Area | Key Files / Modules | Current Responsibilities | Debt / Observations | Future-State Mapping |
| --- | --- | --- | --- | --- |
| App bootstrap | `app.module.ts`, `app.service.ts`, `app.controller.ts` | Registers all modules (agents, LLM, deliverables, tasks, etc.), triggers agent discovery on startup, exposes `/agents` debug endpoints. | Monolithic module imports; agent discovery coupled to startup lifecycle; `/agents` endpoint requires auth and mixes concerns. | New `Agent2AgentModule` with isolated controller; startup loads agents from DB via new registry; legacy module kept only for UI traffic during migration. |
| Agent discovery & factory | `agent-discovery.service.ts`, `agent-factory.service.ts`, `agent-factory-pure.service.ts`, `agent-pool/*` | Crawls filesystem + DB, loads YAML, imports service classes, registers agents, maintains in-memory pool. | Heavy filesystem dependence, optional DI spaghetti, manual YAML parsing, verbose logging, discovery duplicates DB data. | Replace with `AgentRegistryService` (DB-first), `AgentActivator` for runtime wiring, lightweight pool keyed by organization; YAML used only as source-of-truth ingested into DB.
| Agent base services | `agents/base/implementations/...`, `a2a-agent-base.service.ts` | Provide JSON-RPC handling, logging, PII gating, deliverable/task integration. Subclasses (context/function/orchestrator/external) add execution logic. | Mode handling fragmented across subclasses; legacy direct-call path still present; spec-incomplete agent cards; TODO logging, fallbacks returning strings. | New `AgentToAgentBaseService` owns all mode routing (using explicit `mode` param and `AgentMode` enum). Subclasses implement only capability-specific handlers. Agent cards built by shared builder; legacy direct path removed. |
| Agent sub-services | `agents/base/sub-services/*` (json-rpc, logging, configuration, agent-metadata, validation) | JSON-RPC protocol, logging w/emoji, YAML parsing, metadata caching, auth context, task lifecycle helpers. | Duplicated environment parsing, caching tuned for filesystem, logging inconsistent, configuration validation unused. | Slim set of shared services in new module: `JsonRpcProtocolService`, `AgentCardBuilder`, `AgentLoggingService`, `ConfigResolver`. All DB-aware, structured logging only. |
| Agent implementations | `agents/demo/*`, `agents/my-org/*`, etc. | Large catalog of context/function/orchestrator agents with `agent.yaml`, context markdown, service classes. | Mixed quality, varying YAML keys, hard-coded orchestration rules, missing plan rubrics, some unused agents. | Inventory informs DB schema. YAML converted to JSON schema-backed descriptors stored in DB; each agent includes plan rubric and optional supporting agents (universal orchestration). |
| Agent conversations & state | `agent-conversations/*`, `tasks/*`, `deliverables/*`, `websocket/task-progress.gateway.ts` | Manage Supabase conversations, tasks, human loop, deliverable persistence, websocket progress. | PII logs with emojis, sparse tests, deliverables loosely coupled to plans, no native plan artifact support. | Extend schema with `conversation_plans` & plan tab; unify tasks/deliverables with plan IDs; add structured logging/tests; reuse for both legacy and new flows during coexistence. |
| LLM & routing | `llms/*` (centralized routing, local models, pseudonymization, memory manager) | Sovereign policy checks, provider selection, PII processing, pseudonymization, logging, metric controllers. | Complex constructor dependencies; Supabase coupling; multiple unused controllers; logging noise. | Retain a centralized routing service (PII + sovereign enforcement) invoked by `AgentToAgentBaseService`; service can short-circuit showstoppers and emit `human_response` guidance when policy blocks execution. |
| PII/CIDAFM | `cidafm/*`, `services/pii.service.ts`, `services/dictionary-pseudonymizer.service.ts` | Specialized privacy tooling (CIDAFM commands, pseudonym dictionary). | Scattered across modules, limited documentation, tests but some outdated. | Consolidate under privacy submodule; new platform injects sanitized interfaces. |
| MCP & tools | `mcp/*`, `agents/base/services/...` tool contexts | Hosts internal MCP server (Supabase, Slack, Notion tools) and generic client. | Hard-coded config, no org-specific credential isolation, controllers tied to legacy auth. | New credential store supplies secrets; tool agents declare aliases; controller exposes spec-compliant MCP endpoints. Agents can mark individual endpoints as public (no auth) for anonymous chat or integrations. |
| Orchestration & recipes | `orchestration/orchestration.types.ts`, `projects/*`, `agents/demo/.../orchestrator` | Defines orchestrator DTOs, legacy project APIs, sample orchestrator agents. | Orchestration logic scattered among demo agents; project service minimal. | Multi-step orchestration engine formalized; every agent can delegate via `supporting_agents`; execution tracked in `orchestration_runs` with optional saved recipes. |
| Supabase integration | `supabase.module.ts`, `supabase.service.ts`, `supabase.config.ts`, `supabase/utils/*` | Creates Supabase clients, helper functions for tables. | Secrets from `.env`, minimal error handling, direct use across services. | Add organization credential lookup (service-level). Supabase service becomes thin wrapper used by adapter during migration; new stack interacts via repository layer. |
| Auth & guards | `auth/*` | Supabase JWT guard, DTOs, roles. | Hardcoded to Supabase; no API-key support. | New agent-to-agent controller uses API key/mTLS; legacy guard remains for UI. |
| Config & feature flags | `config/*` | Feature flag API, sovereign policy endpoints, model configuration. | Some unused endpoints, manual JSON management. | Integrate with organization metadata & secrets, provide admin UI as needed. |
| Context optimization & usage analytics | `context-optimization/*`, `usage/*`, `analytics/*`, `evaluation/*` | Metrics, evaluation endpoints, usage reporting. | Mixed maturity; evaluation/analytics seldom used. | Keep as optional modules; ensure they ingest new plan/orchestration data for dashboards. |
| Speech & audio | `speech/*` | Deepgram/ElevenLabs integration, speech service. | Tightly coupled to dynamic controller audio path. | Move to dedicated service invoked only when speech is part of plan; remove from new agent-to-agent controller by default. |
| Websocket notifications | `websocket/task-progress.gateway.ts` | Task progress updates for frontend. | Lives inside Nest agents module; message format ad-hoc. | New gateway (or SSE) integrated with agent-to-agent controller; legacy gateway wraps new message bus until UI migrates. |

## 3. Future Architecture Overview
Two major pillars drive the greenfield rebuild.

### 3.1 Agent-to-Agent Controller & Transport
- **Module:** `Agent2AgentModule` (greenfield, no legacy imports).
- **Endpoints:**
  - `GET /agent-to-agent/:org/:agent/.well-known/agent.json` (public/spec compliant).
  - `POST /agent-to-agent/:org/:agent/tasks` (JSON-RPC 2.0 with explicit `mode`).
  - `GET /agent-to-agent/:org/:agent/health` (public health status).
- **Mode Routing:** Request includes `mode` (`converse`, `plan`, `build`, `human_response`). `AgentToAgentBaseService` validates capability via `AgentMode` enum and dispatches to handler. Tool agents are invoked through orchestrated steps rather than direct task submissions.

!!!! we need to add human_response and not sure we need tool_call since that will be from other agents-- do you agree?

!!!! our LLM service is currently working the flags and pseudonyms with PII.  But we need the controller or agent2agent base service to stop and respond to showstoppers (are we still going to have / need a CentralRoutingService or will this be part of the agent2agent service?)

- **Security:** API key per organization, optional mTLS/OAuth. Agents may flag certain endpoints as public (no auth) for anonymous chat integrations. Rate limiting and audit logging keyed by organization.

!!!! we will need to let an agent declare the endpoint to be public and not requiring authentication.  this is for outside apps that might want to hit an agent (like chat) anonymously

- **Agent Cards:** Built by `AgentCardBuilder` using DB metadata (protocol, version, capabilities, skills, security schemes). Supports authenticated extended cards.
- **Routing & PII:** Delegates to refactored `IRoutingPolicyService`, ensures PII metadata, streaming support, fallback decisions.
- **Deliverables & Plan Integration:** Responses include structured deliverable descriptors and plan references (`plan_id`, `step_id`).
- **Testing:**
  - Unit: controllers, guards, card builder, credential resolver, routing adapter.
  - Integration: JSON-RPC flows for `converse`, `plan`, `build`; streaming handshake; credential usage.
  - Compatibility: Feature flag toggles to compare legacy vs new controller.
  - Performance: High concurrency per org.

-### 3.2 Database-Based Agent Platform
- **Schema:** `agents` (core metadata, YAML, context/config), `agent_skills`, `conversation_plans`, `agent_orchestrations`, `orchestration_runs`, `organization_credentials`, plus `users.organization_id` (nullable until cutover).
- **Agents table columns (draft):**
  - `id` (uuid PK)
  - `organization_id` (uuid FK → organizations.id, nullable for shared agents)
  - `slug`, `display_name`, `description`, `agent_type`, `mode_profile`, `version`, `status`
  - `yaml` (text) – original descriptor stored for audit
  - `agent_card` (jsonb) – cached spec-compliant card served to clients
  - `context` (jsonb) – system prompt, good plan rubric, references, sample interactions
  - `config` (jsonb) – execution capabilities, supporting agents, human checkpoints, tool dependencies, plan template metadata
  - `created_at`, `updated_at`
- **YAML/JSON Templates:** Source-of-truth descriptors validated against JSON Schema before ingestion; ingested verbatim into the `yaml` column and decomposed into `agent_card`, `context`, and `config` fields for runtime.
- **Discovery Pipelines:**
  1. Legacy filesystem discovery (unchanged) continues to load file-based agents for existing controllers.
  2. New database discovery process reads from `agents` table, hydrates runtime registry, and powers the greenfield controller.

- **Context Documents:** Stored per agent with sections (system prompt, critical directives, good plan pattern, capabilities, reference data, examples); persisted in the `context` column for direct LLM consumption.
- **Universal Orchestration:** Every agent can list `supporting_agents`, `tool_dependencies`, and orchestrate helper teams even if not a traditional orchestrator. Execution engine supports delegation graph creation for any agent.
- **Modes & Plan Flow:**
  - Agents declare `mode_profile` (`converse_only`, `full_cycle`, `tool_call`).
  - Conversation mode maintains transcript and metadata.
  - Plan mode produces structured `plan_json` aligned with the agent’s plan rubric and `success_criteria`.
  - Build mode executes plan steps: when execution begins we instantiate an `orchestration_run` that references the plan or saved recipe and acts as the live orchestration record (orchestration → phases → steps) while honoring HITL checkpoints.
  - Plans displayed alongside deliverables (UI plan tab) using shared conversation store.
- **Plan Rubrics:** Each agent defines what a good plan looks like (phases, checkpoints, deliverables, fallback strategies). Stored in context and referenced during plan generation and validation.
- **Multi-Step Orchestrations:** Plans can spawn multi-step execution (orchestration → phases → steps) with dependencies, parallelism, fallback strategies, and deliverable mapping. Execution engine logs step events, handles human approvals, and can re-plan when steps fail. Each phase/step maintains its own conversation context.

- **Credential Management:** Secrets stored in `organization_credentials` (encrypted); YAML references aliases; runtime pulls via org-scoped resolver.
- **Testing:** Schema validation, unit tests (parsers, context loader, plan generator, mode router), integration tests (conversation→plan→build, HITL, multi-agent orchestration), regression tests for legacy adapters, E2E multi-step scenario tests.

## 4. Conversation, Plan, and Deliverable Flow
- **Conversation Transcript:** Rolling buffer + summary to support large context windows. Maintains metadata (intents, requested outputs, collaborator agents).
- **Plan Artifact:** Stored in `conversation_plans`. Versions track edits; statuses flow `draft → pending_approval → approved → in_execution → completed/aborted`. Each plan step also tracks its own status and references the agent responsible.
- **Deliverable Panel Integration:** UI can expose deliverables and plan in shared pane. API returns both deliverables and plan summary per conversation.
- **Human-in-the-Loop:** Plan template and execution steps specify checkpoints. HITL service coordinates approvals; tasks table stores pending state.

!!!! should it be the conversation that holds the status or the step?  is the step where the memory and storage are held?

- **Multi-Agent Collaboration:** Plan steps map to individual agents (including tool agents). Orchestrator logs dependencies and monitors progress via `orchestration_runs`.

## 5. Legacy Coexistence & Cleanup
- Legacy system remains untouched: existing file-based agents continue to use current controllers/endpoints until we choose to migrate them manually at the end of the project.
- New database-backed agents live entirely in the new module and call the new agent-to-agent controller. No adapters bridge the two worlds.
- Database columns introduced for new functionality remain nullable/optional so legacy flows are unaffected.
- Legacy filesystem YAML stays as-is for old agents; new agents store YAML within the `agents.yaml` column.

!!!! so not true.  no changes at all.  we don't care that these agents aren't conforming at all.  no changes to anything in the system (except for the plan / deliverable)

## 6. Testing & Quality Gates

!!!! let's put together a formal spot for all of our different testing efforts (in appropriate places of course)

- **Automated Test Suites**
  - Schema validation pipeline for YAML/JSON descriptors.

!!!! remember part of the agent table

!!!! don't forget that we need to agree on a large set of orchestration scenarios... these should all be tested (progressively more challenging) before i start my testing

## 6. Testing & Quality Gates
- **Agent Platform Test Suite Categories**
  1. **Schema & Config Validation** – Validate agent YAML/JSON against schema, ensure plan templates and context rubrics parse correctly, verify organization credential encryption metadata.
  2. **Unit Tests** – Base service mode routing (including `human_response` cases), routing policy integration, plan generator, credential resolver, deliverable persistence, orchestration-run state machine.
  3. **Integration Tests** – End-to-end conversation → plan → build flows, HITL pause/resume, multi-agent orchestration (supporting agents including tool agents), deliverable/version creation, large-context transcript summarization.
  4. **E2E Scenario Tests** – Progressive orchestration scenarios (simple single-agent, multi-agent with tool, complex multi-phase orchestration with human checkpoints). Scenarios agreed jointly before handoff.
  5. **Performance & Load Tests** – High concurrency per organization, plan regeneration under load, streaming updates.
  6. **Regression Tests** – Legacy controllers untouched; verify existing UI flows continue to function (plan/deliverable columns optional).
- **Manual QA Checklists**
  - Conversation to plan transition review (including plan tab in UI).
  - Plan editing + re-approval.
  - Build execution with manual checkpoint and multi-step progression.
- Supporting agents (including tool agent delegation) during execution.
- Credential rotation and API key revocation.

## 7. Implementation Path
1. **Codebase Inventory (in progress):** Documented above; continue fine-grained notes during refactor planning.
2. **Schema & Template Finalization:** Lock JSON Schemas, define ingestion pipeline; no migration of existing agents yet.
3. **Controller Implementation:** Build greenfield controller, card builder, routing adapter, API key auth.
4. **Agent Runtime:** Implement `AgentToAgentBaseService`, extend mode handlers to include orchestration-specific flows (`orchestrate_create`, `orchestrate_execute`, `orchestrate_continue`, `orchestrate_save_recipe`), and wire in the plan engine + orchestration runner.
5. **New Agent Onboarding:** Seed initial database-based agents using new schema; existing file-based agents remain untouched on legacy endpoints/controllers.
6. **UI Work:** Expose plan tab, approvals, multi-step progress (ensuring legacy flows unaffected) and surface the new orchestration modes once API support stabilizes.
7. **Cutover Planning:** Once new stack is validated, plan separate effort to migrate legacy agents and retire old codepaths.

## 8. Open Questions
- Do we provide a user-facing orchestration UI or continue using current UI? (Review existing project UI; likely keep user interactions centered on suggesting plan changes rather than editing raw templates.)
- Preferred strategy for encrypted secrets storage? (Standardize on Supabase infrastructure.)
- Scope of supporting agents: per organization (`my-org`, `demo`, or org-specific) or global?
- Observability: integrate new plan/orchestration events into existing `llm_usage` & `evaluations` telemetry rather than external stacks.

## 9. High-Level Architecture & File Layout

### 9.1 Directory Structure (proposed)
```
apps/api/src/
  agent2agent/
    agent2agent.module.ts
    agent2agent.controller.ts
    agent2agent.service.ts
    dto/
      task-request.dto.ts
      task-response.dto.ts
    guards/
      api-key.guard.ts
    interceptors/
      audit-logging.interceptor.ts
    middleware/
      rate-limit.middleware.ts
    services/
      agent-execution-gateway.service.ts
      agent-card-builder.service.ts
      agent-mode-router.service.ts
      agent-registry.service.ts
      routing-policy-adapter.service.ts
  agents-db/
    agents.module.ts
    repositories/
      agents.repository.ts
      agent-skills.repository.ts
      conversation-plans.repository.ts
      orchestration-runs.repository.ts
      agent-orchestrations.repository.ts
    entities/
      agent.entity.ts
      agent-skill.entity.ts
      conversation-plan.entity.ts
      orchestration-run.entity.ts
    mappers/
      agent.mapper.ts
    services/
      agent-ingestion.service.ts
      plan-template.service.ts
      supporting-agent.service.ts
  orchestration/
    orchestration-runner.service.ts
    plan-engine.service.ts
    step-executor.service.ts
  shared/
    enums/agent-mode.enum.ts
    interfaces/agent-context.interface.ts
    interfaces/plan.interface.ts
    utils/context-window.helper.ts
```

### 9.2 Core TypeScript Components (pseudocode)

**AgentToAgentController**
```ts
@Controller('agent-to-agent/:org/:agent')
export class AgentToAgentController {
  constructor(
    private readonly gateway: AgentExecutionGateway,
    private readonly cardBuilder: AgentCardBuilder,
  ) {}

  @Get('.well-known/agent.json')
  getAgentCard(@Param() params, @PublicEndpoint() isPublic: boolean) {
    return this.cardBuilder.build(params.org, params.agent, { isPublic });
  }

  @Post('tasks')
  @UseGuards(ApiKeyGuard)
  async handleTask(@Param() params, @Body() dto: TaskRequestDto) {
    return this.gateway.execute({
      orgSlug: params.org,
      agentSlug: params.agent,
      mode: dto.mode,
      payload: dto,
    });
  }
}
```

**AgentExecutionGateway**
```ts
@Injectable()
export class AgentExecutionGateway {
  constructor(
    private readonly registry: AgentRegistryService,
    private readonly modeRouter: AgentModeRouterService,
    private readonly routingPolicy: RoutingPolicyAdapterService,
    private readonly deliverables: DeliverableService,
  ) {}

  async execute(request: ExecutionRequest): Promise<TaskResponseDto> {
    const agent = await this.registry.resolve(request.orgSlug, request.agentSlug);
    const policyDecision = await this.routingPolicy.evaluate(request, agent);

    if (policyDecision.showstopper) {
      return TaskResponseDto.humanResponse(policyDecision.humanMessage);
    }

    const result = await this.modeRouter.execute(agent, request, policyDecision);
    await this.deliverables.persist(result.deliverables, request.context);
    return result;
  }
}
```

**AgentModeRouterService**
```ts
export class AgentModeRouterService {
  constructor(private readonly planEngine: PlanEngineService) {}

  async execute(agent: AgentRuntime, request: ExecutionRequest, policy: RoutingDecision) {
    switch (request.mode) {
      case AgentMode.CONVERSE:
        return agent.converse(request, policy);
      case AgentMode.PLAN:
        return this.planEngine.generatePlan(agent, request);
      case AgentMode.BUILD:
        return this.planEngine.executePlan(agent, request);
      case AgentMode.HUMAN_RESPONSE:
        return agent.escalateToHuman(request, policy);
      default:
        throw new BadRequestException('Unsupported mode');
    }
  }
}
```

**PlanEngineService**
```ts
@Injectable()
export class PlanEngineService {
  constructor(
    private readonly plansRepo: ConversationPlansRepository,
    private readonly orchestrationRunner: OrchestrationRunnerService,
  ) {}

  async generatePlan(agent: AgentRuntime, request: ExecutionRequest) {
    const rubric = agent.context.planRubric;
    const plan = await agent.plan(request.conversationContext, rubric);
    await this.plansRepo.saveDraft(plan, request.conversationId, agent.id);
    return TaskResponseDto.planDraft(plan);
  }

  async executePlan(agent: AgentRuntime, request: ExecutionRequest) {
    const plan = await this.plansRepo.loadApproved(request.planId);
    const run = await this.orchestrationRunner.startRun({
      planId: plan.id,
      organizationSlug: request.orgSlug,
      originType: 'plan',
      promptInputs: request.promptParameters,
    });
    return TaskResponseDto.buildStarted(run);
  }
}
```

**Agents Repository**
```ts
export class AgentsRepository {
  constructor(private readonly db: SupabaseService) {}

  async findBySlug(org: string, slug: string): Promise<AgentEntity> {
    return this.db.client
      .from('agents')
      .select('*')
      .eq('organization_slug', org)
      .eq('slug', slug)
      .single();
  }

  async save(agent: AgentEntity) {
    return this.db.client.from('agents').upsert(agent);
  }
}
```

### 9.3 Coding Conventions
- Small, focused services with clear DI boundaries; each file under ~200 lines.
- Shared interfaces/enums in `shared/` exported via barrel files.
- DTOs use `class-validator` for validation and Nest’s `ValidationPipe` to perform plain-to-class transformation (no reliance on `class-transformer` if strict mode is preferable).
- No deprecated legacy imports; utilities created anew or wrapped explicitly.
- All async flows return typed DTOs (no `any`).
- Extensive unit tests per service with Nest testing module.

## 10. References
- Legacy Refactor PRD (`legacy-a2a-refactor-prd.md`)
- Agent-to-Agent Controller PRD (`agent-to-agent-controller-prd.md`)
- Database Agents PRD (`database-agents-greenfield-prd.md`)
- This unified PRD supersedes individual documents for planning; detailed sections remain for implementation reference.
