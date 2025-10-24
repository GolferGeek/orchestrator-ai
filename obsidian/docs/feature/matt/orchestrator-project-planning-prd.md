# Agent Orchestration Platform PRD

## Project Overview

**Project Name:** Agent Orchestration Platform & Execution
**Version:** 1.1
**Date:** January 2025
**Author:** Matt Weber

## Executive Summary

We are replacing the legacy "project" abstraction with database-backed, agent-scoped orchestrations that can be authored, versioned, executed, and observed end-to-end. Orchestrations unify plan generation, execution coordinates, and state tracking across the agent platform while removing filesystem-driven project storage. This PRD captures the new orchestrations-first workflow, the supporting Supabase schema, and the incremental rollout plan that keeps existing conversation planning features intact.

> **Implementation Status (January 2025):** Delivery is **on hold** until the greenfield Agent-to-Agent controller, database-backed agent services, and new agent mode runtime are in place. Schema scaffolding and API stubs landed during exploration should be treated as provisional and revisited once the core platform refresh is stable.

## Problem Statement

The current project-centric approach suffers from several gaps:
- Projects live outside of the agent platform data model, preventing reuse and versioning.
- Execution state is fragmented across temporary files and ad hoc caches, limiting observability and durability.
- Project templates are difficult to maintain or share because they are not attached to the agents that use them.
- Human checkpoints are bolted onto project runs rather than modeled as first-class orchestration steps.
- Migrating to database-backed agents leaves the project store disconnected from Supabase.

## Goals & Objectives

### Primary Goals
1. **Orchestration Authoring**: Persist orchestration definitions per agent (`organization_slug`, `agent_slug`, `slug`) with history, metadata, and prompt templates.
2. **Plan Integration**: Tie conversation plan outputs directly to saved orchestrations so approved plans can be replayed or iterated.
3. **Execution State**: Track orchestration runs, step state, prompt inputs, and human checkpoints inside Supabase for durability and analytics.
4. **Agent Alignment**: Centralize agent YAML, runtime config, and orchestration artifacts in the same platform tables.

### Secondary Goals
1. **Template Reuse**: Enable organizations to version, tag, and promote orchestrations across agents.
2. **Compliance & Auditability**: Store orchestration JSON, prompt templates, and execution trails for regulatory review.
3. **Operational Visibility**: Provide product and support teams with insight into orchestration health and bottlenecks.
4. **Migration Path**: Sunset project-run storage without disrupting in-flight customer workflows.

## Target Users

### Primary Users
- **Agent Platform Engineers**: Build and maintain orchestration runtime and storage.
- **Solution Developers**: Author orchestrations and deploy them alongside custom agents.
- **Operations & Support Teams**: Monitor orchestration runs, human checkpoints, and failures.

### Secondary Users
- **End Customers & Workspace Admins**: Consume orchestrations as reusable recipes for their agents.
- **Compliance & Audit**: Review stored orchestration definitions and execution history.

## Core Features

### 1. Orchestration Definition & Storage
- Author orchestrations as structured JSON (phases, steps, dependencies, checkpoints).
- Version orchestrations per agent with unique `(organization_slug, agent_slug, slug)` keys.
- Attach prompt templates and launch-time parameter metadata.
- Persist orchestration metadata (tags, status, created_by) for lifecycle management.

### 2. Conversation Plan Alignment
- Convert conversation plans into orchestration-ready structures.
- Reference the source plan on saved orchestrations for lineage and auditability.
- Allow orchestrations to launch directly from a plan approval or from saved templates.

### 3. Orchestration Execution Service
- Launch orchestration runs with captured prompt inputs and origin context (`plan`, `saved_orchestration`, `ad_hoc`).
- Persist run state: current step index, completed steps, step-specific metadata, and human checkpoint status.
- Provide resumable execution with durable storage replacing filesystem caches.

### 4. Credential & Agent Config Management
- Manage organization-scoped credentials required by orchestrations via `organization_credentials`.
- Keep agent runtime configuration (`agent_card`, `context`, `config`) co-located with orchestrations.
- Surface encryption metadata for secret rotation and audit.

### 5. Human-in-the-Loop Workflow
- Model human checkpoints as orchestration steps that pause runs until approval.
- Present checkpoint context, deliverables, and decisions through existing dashboards.
- Resume orchestration execution once approvals are recorded in Supabase.

### 6. Orchestration Modes
- Introduce explicit agent modes (`orchestrate_create`, `orchestrate_execute`, `orchestrate_continue`, `orchestrate_save_recipe`) to gate multi-call orchestration flows.
- Keep existing `plan`/`build` paths optimized for single-call work while routing orchestration traffic through the new modes.
- Attach orchestration-specific metadata (prompt templates, checkpoints, run identifiers) to these modes for API/UI handling.

## Technical Architecture

### 1. Domain Data Structures
```typescript
interface AgentOrchestration {
  id: string;
  organizationSlug: string | null;
  agentSlug: string;
  slug: string;
  displayName: string;
  description?: string;
  status: 'active' | 'inactive' | 'archived';
  orchestrationJson: OrchestrationDefinition;
  promptTemplates: PromptTemplate[];
  tags: string[];
  version?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrchestrationRun {
  id: string;
  planId: string;
  originType: 'plan' | 'saved_orchestration' | 'ad_hoc';
  originId?: string;
  orchestrationSlug?: string;
  organizationSlug: string | null;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentStepIndex?: number;
  completedSteps: StepResult[];
  stepState: Record<string, unknown>;
  promptInputs: Record<string, unknown>;
  humanCheckpointId?: string;
  metadata: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}
```

### 2. Supabase Schema Updates
- **`public.agents`**: Database-backed agent descriptors with YAML, context, and config JSON.
- **`public.organization_credentials`**: Encrypted credential store keyed by organization + alias.
- **`public.conversation_plans`**: Approved plan artifacts linked to conversations and agents.
- **`public.agent_orchestrations`**: Saved orchestration recipes with prompt templates and tags.
- **`public.orchestration_runs`**: Durable execution state for in-flight orchestrations.
- **`public.users`**: Extended with optional `organization_slug` to align user accounts.
- Legacy project tables are dropped as part of the migration (`agent_projects`, `project_runs`, etc.).

### 3. Runtime Workflow
1. Agent authors define orchestration JSON and prompt templates; the API persists them in Supabase.
2. Conversation planning mode produces `conversation_plans` records that can be saved as orchestrations.
3. Launching an orchestration creates an `orchestration_runs` row and streams execution updates.
4. Human checkpoints write decisions back to `step_state` and resume execution.
5. Completed runs feed analytics, deliverables, and agent memory systems.

## Success Metrics

### Primary Metrics
- **Orchestration Save Rate**: % of approved plans converted into reusable orchestrations.
- **Run Completion Rate**: % of orchestration runs that complete without manual remediation.
- **Checkpoint Latency**: Median time from human checkpoint creation to resolution.
- **Migration Coverage**: % of legacy project workflows retired in favor of orchestrations.

### Secondary Metrics
- **Template Reuse**: Count of orchestrations launched more than once in a given period.
- **Config Drift**: Number of agents running with outdated orchestration versions.
- **Credential Health**: Frequency of credential rotation events recorded in metadata.
- **Support Burden**: Volume of support tickets related to orchestration failures.

## Implementation Phases

> **Prerequisite:** Do not begin these phases until the Agent-to-Agent modernization (new controller/service stack) and Database Agents base services are complete. Orchestration delivery depends on the new runtime owning plan/build flows.

### Phase 1: Data Foundation (3-4 weeks)
- Ship Supabase migration introducing agents, conversation plans, orchestrations, and run tables.
- Remove legacy filesystem-backed project tables and references.
- Backfill existing agent YAML/config into the new `public.agents` table.

### Phase 2: Repository & API Layer (4-5 weeks)
- Build repositories for agents, orchestrations, conversation plans, and runs.
- Expose CRUD endpoints for orchestration definitions and prompt templates.
- Wire organization credential usage into orchestration execution configuration.
- Add new orchestration agent modes to the API contract (enums, routing, validation) while keeping UI wiring for a later slice.

### Phase 3: Execution Runtime (5-6 weeks)
- Replace project-run execution path with orchestration-run service.
- Persist step state transitions, prompt payloads, and human checkpoint pauses.
- Provide restart/resume semantics using Supabase state instead of filesystem caches.

### Phase 4: Human-in-the-Loop Experience (3-4 weeks)
- Update dashboards to reflect orchestration runs, checkpoints, and deliverables.
- Integrate approval actions with `orchestration_runs.step_state`.
- Deliver notifications and status updates tied to orchestration identifiers.

### Phase 5: Templates & Analytics (4-5 weeks)
- Enable tagging, version history, and promotion workflows for orchestrations.
- Surface orchestration health metrics and historical run analytics.
- Document migration playbooks for remaining legacy project use cases.

## Risks & Mitigation

### Technical Risks
- **Data Migration Complexity**: Moving from filesystem projects to Supabase tables may lose context.
  - *Mitigation*: Snapshot legacy data and build conversion scripts for high-value projects.
- **Runtime Regression**: New orchestration service must cover edge cases from project execution.
  - *Mitigation*: Shadow-run orchestrations alongside legacy workflows before cutover.
- **Schema Drift**: Multiple teams touching agent records could introduce conflicts.
  - *Mitigation*: Establish contract tests and clear ownership of Supabase migrations.

### Business Risks
- **Adoption Hesitation**: Teams accustomed to "projects" may resist terminology change.
  - *Mitigation*: Provide migration guides, updated UI copy, and cross-team training.
- **Operational Visibility**: Lack of dashboards during migration could hurt SLAs.
  - *Mitigation*: Prioritize basic run monitoring before deprecating legacy flows.
- **Credential Handling**: Centralizing secrets increases blast radius if compromised.
  - *Mitigation*: Enforce encryption metadata policies and audit logging.

## Dependencies

### Internal Dependencies
- Agent runtime services (planner, executor, human checkpoint dispatcher).
- Supabase infrastructure and migration tooling.
- MCP tool adapters that must read orchestration context.
- Front-end surfaces consuming orchestration lists and run status.

### External Dependencies
- LLM providers powering orchestration planning and execution.
- Secret management for encryption keys used by `organization_credentials`.
- Customer success teams coordinating legacy project sunset timelines.

## Future Considerations

### Potential Enhancements
- **Cross-Agent Orchestrations**: Coordinate orchestrations spanning multiple agents or organizations.
- **Dynamic Step Generation**: Allow runs to insert steps in response to real-time insights.
- **Marketplace Distribution**: Publish orchestrations for reuse across customer workspaces.
- **Automated Regression Testing**: Replay orchestrations against staging environments.

### Scalability Considerations
- **Run Volume**: Support thousands of concurrent orchestration runs with streaming updates.
- **Schema Evolution**: Maintain backwards compatibility for orchestration JSON schema changes.
- **Observability**: Integrate tracing/metrics for orchestration lifecycle events.
- **Multi-Tenant Isolation**: Ensure organization boundaries are enforced at the database and runtime layers.

## Conclusion

By grounding orchestrations in the agent platform data model we unlock reusable execution recipes, consistent plan integration, and production-grade observability. The phased migration retires brittle project infrastructure while giving teams a durable foundation for agent-driven work management. Once complete, orchestrations become the primary vehicle for deploying complex agent behaviors with confidence, compliance, and human oversight baked in.
