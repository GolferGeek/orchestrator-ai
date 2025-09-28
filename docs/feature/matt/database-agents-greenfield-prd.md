# Database Agent System Greenfield PRD

**Project Name:** Database-Based Agent Platform  
**Version:** 0.1 (Draft)  
**Date:** 2025-01-16  
**Author:** Matt Weber (via Codex assistant)

## 1. Objective
Design the next-generation agent system backed by database configuration (no filesystem YAML reliance) with explicit specifications for agent metadata, context files, plan/deliverable handling, human-in-the-loop (HITL), and multi-step orchestration. The new system must coexist with the legacy stack during migration but share no code.

## 2. Scope
- Database schema for agents, skills, context, plan templates, deliverables.
- YAML (or JSON) schema definition per agent type to populate the database.
- Context document structure per agent type (including plan rubrics).
- Runtime behaviors for each agent type across `converse`, `plan`, `build`/execution modes.
- HITL checkpoints, deliverable lifecycle, plan storage & UI integration.
- Test strategy ensuring full coverage of scenarios before handoff to QA.

## 3. High-Level Architecture
1. **Authoring pipeline**: YAML/JSON descriptors checked into source (for versioning) but loaded into database tables via migration/seed scripts. After migration, runtime reads from DB only.
2. **Agent Registry**: Database-driven discovery feeding the new agent-to-agent controller and legacy adapters during transition.
3. **Execution Engine**: `AgentToAgentBaseService` orchestrates mode handling; specialized services execute according to agent type.
4. **Conversation Store**: Supabase tables `conversations`, `tasks`, `deliverables`, plus new `conversation_plans` to track plan artifacts alongside deliverables.
5. **Plan & Project Engine**: Plans stored as structured documents; execution orchestrates via multi-step state machine referencing plan steps.

## 4. Database Schema Additions
### 4.1 Agent Configuration Tables
- `database_agents`
  - `id` (uuid PK)
  - `organization_id` (uuid FK → organizations.id, nullable for global agents)
  - `name`, `slug`, `display_name`
  - `agent_type` (`context`, `function`, `tool`, `orchestrator`, `external`)
  - `description`
  - `location` (`demo`, `my-org`, `saas`, etc.)
  - `version`
  - `config` (jsonb) – parsed YAML content (execution settings, capabilities)
  - `status` (`active`, `inactive`)
  - `created_at`, `updated_at`

- `database_agent_skills`
  - `id` (uuid PK)
  - `agent_id` (uuid FK)
  - `skill_id`, `name`, `description`, `tags` (jsonb)
  - `examples` (jsonb array)
  - `input_modes`, `output_modes`
  - `ordering`

- `database_agent_contexts`
  - `id` (uuid PK)
  - `agent_id` (uuid FK)
  - `context_type` (`system_prompt`, `plan_rubric`, `examples`, `rules`)
  - `content` (text)
  - `version`

- `database_agent_capabilities`
  - `id` (uuid PK)
  - `agent_id`
  - `capability` (text)
  - `details` (jsonb)

### 4.2 Plan & Execution Tables
- `conversation_plans`
  - `id` (uuid PK)
  - `conversation_id` (uuid FK)
  - `agent_id`
  - `version`
  - `status` (`draft`, `pending_approval`, `approved`, `in_execution`, `completed`, `aborted`)
  - `summary` (text)
  - `plan_json` (jsonb) – includes steps array, dependencies, risks, deliverables mapping, HITL checkpoints.
  - `created_by`, `approved_by`
  - `created_at`, `updated_at`

- `orchestration_runs`
  - `id` (uuid PK)
  - `plan_id` (nullable FK → conversation_plans)
  - `origin_type` (`plan`, `saved_orchestration`, `ad_hoc`)
  - `origin_id` (uuid referencing plan or orchestration recipe)
  - `orchestration_slug`
  - `prompt_inputs` (jsonb) – resolved parameter payload used for prompts
  - `current_step_index`
  - `completed_steps` (jsonb array)
  - `human_checkpoint_id` (nullable)
  - `metadata` (jsonb)
  - `started_at`, `completed_at`

- `agent_orchestrations`
  - `id` (uuid PK)
  - `organization_slug` (nullable for global recipes)
  - `agent_slug`
  - `slug`, `display_name`, `description`, `status`, `version`
  - `orchestration_json` (jsonb) – phases, steps, dependencies, checkpoints, deliverable expectations.
  - `prompt_templates` (jsonb) – array of templates with parameter metadata (name, description, required/default, model profile hints).
  - `tags` (text[])
  - `created_by`, `updated_by`, timestamps

Existing tables (`tasks`, `deliverables`, `deliverable_versions`) remain but add references to `plan_id` / `orchestration_run_id` where applicable.

## 5. YAML/JSON Specifications
YAML authoring templates drive DB content. Each type uses a dedicated schema validated before ingestion.

### 5.1 Common Structure
```yaml
metadata:
  name: "Marketing Swarm"
  slug: "marketing_swarm"
  display_name: "Marketing Swarm"
  type: "specialists"            # Human-readable category
  agent_type: "function"         # runtime type (context/function/tool/orchestrator/external)
  version: "1.0.0"
  description: "..."
  organization: "my-org"         # optional
  tags: ["marketing", "orchestration"]

hierarchy:
  level: specialist               # optional
  reports_to: marketing_manager_orchestrator
  department: marketing

capabilities:
  - content_orchestration
  - multi_agent_coordination

skills:
  - id: "content_campaign_creation"
    name: "Content Campaign Creation"
    description: "..."
    tags: ["campaign"]
    examples:
      - "Create a launch campaign"
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/markdown", "application/json"]

execution:
  default_mode: converse
  supported_modes: ["converse", "plan", "build"]
  mode_profile: "converse_only"         # aligns with AgentMode enum (converse_only, full_cycle, tool_call)
  requires_plan: true
  deliverable_types: ["campaign_spec", "content_bundle"]
  human_checkpoints:
    - id: "approve_plan"
      label: "Approve Plan"
      description: "Manager approval before execution"
    - id: "review_outputs"
      label: "Review Outputs"
  orchestration:
    enabled: true
    max_parallel_steps: 2

plan_template:
  success_criteria: "A good plan includes ..."
  phases:
    - id: "research"
      description: "Collect requirements"
      required_deliverables: ["research_summary"]
    - id: "content_creation"
      description: "Draft content"
  riskiest_steps: ["content_creation"]
  fallback_strategies:
    - "Re-run competitor analysis"

context_files:
  system_prompt: "path/to/system_prompt.md"
  plan_rubric: "path/to/plan_rubric.md"
  examples: "path/to/examples.md"
```

### 5.2 Agent Type Specifics
- **Context Agents**
  - `agent_type: context`
  - `supported_modes: ["converse", "plan"]`
  - `requires_plan: false`
  - Context files: `system_prompt`, `knowledge_base` (optional), `plan_rubric` (good plan pattern).
  - Execution: `converse` handles knowledge retrieval; `plan` produces structured plan suggestions if asked.

- **Function Agents**
  - `agent_type: function`
  - `supported_modes: ["converse", "plan", "build"]`
  - `requires_plan: true` for complex automations.
  - Additional YAML keys: `entry_point` (TS class/method), `dependencies` (node modules), `tool_access` (MCP aliases).
  - Context: `plan_rubric` describing ideal plan steps.

- **Tool Agents**
  - `agent_type: tool`
  - `supported_modes: ["call"]` (no converse).
  - YAML includes `tool_schema` (input/output definition), `rate_limits`, `auth_alias` references into `organization_credentials`.

- **External Agents**
  - Proxy to remote A2A/MCP endpoints.
  - YAML includes `remote_url`, `auth_strategy`, `capabilities` matching remote agent card.

- **Orchestrator Agents**
  - `agent_type: orchestrator`
  - `supported_modes: ["converse", "plan", "build"]`
  - YAML defines `managed_agents`, `delegation_rules`, `memory_strategy` (how plans/deliverables stored), `orchestration_templates` references.

## 6. Context Document Specification
Each agent has structured markdown (or JSON) stored in `database_agent_contexts` with sections:
1. **System Prompt** – persona, tone, guardrails.
2. **Critical Directives** – non-negotiable constraints.
3. **Good Plan Pattern** – explicit rubric describing what an excellent plan looks like for this agent (phases, deliverables, checkpoints, risks). Required for agents supporting `plan` mode.
4. **Capabilities** – what the agent can/cannot do.
5. **Reference Data** – sample data or reusable snippets.
6. **Example Interactions** – canonical conversations (for few-shot prompting).

## 7. Mode Behaviors
Agents declare a `mode_profile` mapped to the shared `AgentMode` enum:
- `converse_only` – supports conversational exchanges and optional planning suggestions, but never executes tasks.
- `full_cycle` – participates in the entire lifecycle (`converse`, `plan`, `build`).
- `tool_call` – invoked directly for tool execution without conversation context.
This enum will live in shared TypeScript so both controller and agents enforce valid combinations at compile time.

### 7.1 `converse`
- Purpose: dialogue, clarification, light tasks.
- Pipeline: conversation transcript (rolling window) + plan summary (if exists) fed to model → response → stored in `tasks` and conversation history.
- Agents may update conversation metadata (intent classification, suggested plan seeds).

### 7.2 `plan`
- Trigger: explicit user request or transition from conversation.
- Input: conversation summary + agent’s Good Plan Pattern rubric.
- Output: structured plan stored in `conversation_plans.plan_json` (steps, dependencies, deliverables, HITL points).
- Required tests: plan completeness, alignment with rubric, ability to regenerate/modify existing plan.

### 7.3 `build` / Execution
- Orchestrator reads approved plan and executes steps sequentially or in parallel as defined.
- Each step produces deliverables or intermediate notes; progress tracked in `orchestration_runs`.
- Human checkpoints pause execution until resolved via HITL UI/API.
- Failures trigger fallback strategy from plan; logs stored for audit.

### 7.4 Deliverable Lifecycle
- Deliverable metadata includes `plan_id`, `orchestration_run_id`, `step_id`, `version`, `format`.
- Users can request revisions; new versions linked to same deliverable ID.
- Integration with existing deliverable tables (Supabase) to maintain continuity until new system fully replaces legacy storage.

## 8. Legacy Coexistence Strategy
- Migration scripts populate database tables while legacy agents continue reading from filesystem (for limited time).
- Adapter layer exposes DB-backed agent data to legacy controllers via read-only service.
- Once new system stable, remove filesystem fallback and deprecate legacy modules.

## 9. Testing Strategy
- **Schema Validation**: Validate YAML against JSON Schema before DB ingestion.
- **Unit Tests**: YAML parser, context loader, plan generator, mode router, credential resolver.
- **Integration Tests**: Full conversation → plan → build flow; HITL pause/resume; multi-agent orchestration; credential usage.
- **Regression Tests**: Ensure legacy controller still operates (during coexistence) using adapter data.
- **E2E Scenario Tests**: Simulate multi-step orchestration (research → draft → review → publish) with human approvals and deliverable generation.

## 10. Open Questions
- Should plan templates be editable via UI, and how to version them? (Likely yes—needs design.)
- How do we handle cross-organization agent sharing (inherit plan rubrics or override per org)?
- Encryption strategy for `encrypted_value` (KMS, Supabase secrets?).
- Do we allow agent-specific code (TS/py files) in DB or keep code in repo while metadata in DB? (Recommendation: keep code in repo for auditability.)

## 11. Next Steps
1. Complete crawl of existing agents to capture required capabilities & context content.
2. Formalize JSON Schemas for each YAML template.
3. Draft migration plan to seed database from current files.
4. Align with frontend on plan/deliverable UI evolution.
5. Prepare implementation tickets referencing this PRD.

## 12. Legacy Codebase Crawl (Database Agent Focus)
Before implementation, conduct a structured audit of the existing filesystem-based agents:
- Catalogue every agent (context, function, tool, orchestrator) noting capabilities, dependencies, context prompts, and plan expectations.
- Identify “team” relationships—agents already delegating to others, MCP/tool usage, cross-department collaborations.
- Document patterns worth keeping (e.g., fallback strategies, hierarchy metadata) and debt to eliminate (hard-coded paths, redundant YAML, unused configs).
- Pay special attention to conversational vs plan vs deliverable behaviors so the new database schema captures real-world needs.

### 12.1 Universal Orchestrator Principle
Adopt a mindset that **every agent can orchestrate**:
- Even basic “context” agents may form lightweight teams, delegating to tool agents or non-hierarchy specialists when solving tasks.
- YAML/DB schema should allow agents to declare optional `supporting_agents` and `tool_dependencies` regardless of type.
- Execution engine must treat delegation as first-class: any agent can spawn subtasks, reference helper agents, and await their completion.
- Testing must include scenarios where a non-orchestrator agent leverages helper agents to complete multi-step work.
