# Agent Builder — Product Requirements Document (PRD)

## 1. Summary
Agent Builder enables admins and builders to create and edit agents through a prompt-driven, AI-assisted workflow exposed as both UI and A2A tasks. Users provide an initial prompt describing what the agent should do, and Agent Builder generates editable context, plan structure, and output structure. Type-specific configuration (Function, API, External, Tool, Orchestrator) is collected as needed. The workflow supports both creation and editing of agents, with lifecycle management through draft/active/archived states. It is an official A2A agent (service-style), not a new agent type, and uses a dedicated transport `agent-builder` with tasks `agent_builder.plan` and `agent_builder.build`. The agent is advertised globally under the `/global/agent-builder` namespace rather than an org-scoped or demo path.

## 2. Goals
- Prompt-driven, low-code interface to create agents without technical knowledge of YAML/schemas.
- AI-assisted generation of context, plan structure, and output structure from natural language.
- Support for 6 agent types: Context, Function, API, External, Tool, Orchestrator.
- "Plan" phase to generate and validate agent configuration with AI.
- "Build" phase to persist agents (create or update) and optionally emit artifacts.
- Lifecycle management: draft → active → archived with proper permissions.
- Support both creation and editing workflows through same interface.
- Expose the same behavior over HTTP and A2A for internal and external orchestrators.
- Strong validation, policy enforcement, and auditability.

## 3. Non‑Goals
- Real‑time streaming UX for planning/building (may add in Phase 2+).
- Introducing a new agent type; Agent Builder is a service agent.
- Complex artifact pipelines; initial support is optional files/PR/export.
- Exposing YAML/JSON Schema editors to users (AI generates these behind the scenes).
- Complex orchestration capabilities in Phase 1 (Orchestrator type can be created but delegation/chains come later).
- Hard delete of agents in Phase 1 (soft delete via archive only; hard delete is admin-only in Phase 2+).

## 4. Personas
- Admin/Owner: can create agents across the org, governs policy and approvals.
- Builder/Engineer: drafts agents, iterates during plan, requests build.
- Orchestrator (external): invokes plan/build via A2A for self‑service.

## 5. User Stories
- As a builder, I can describe what I want an agent to do in plain English and get a complete agent configuration to review.
- As a builder, I can edit the generated context, plan structure, and output structure before creating the agent.
- As a builder, I can create different types of agents (Function, API, External, Tool, Orchestrator) with type-specific configuration.
- As a builder, I can edit existing agents to update their configuration, context, or reporting structure.
- As a creator, I can archive my own agents when they're no longer needed, and restore them later.
- As an admin, I can see and manage all agents in my org, including archived ones.
- As an admin, I can activate agents from draft to production status.
- As an admin, I can restrict who can build agents and require approval for certain scopes.
- As a builder, I can opt to generate file artifacts or a PR/export when building.
- As an orchestrator, I can call plan/build over A2A with org‑scoped credentials.

## 6. UX Overview

### 6.1 Create Agent Flow

**Step 1: Initial Prompt**
- User enters natural language description of what the agent should do
- Example: "I need an agent that triages incoming support emails and tags them by priority"
- Click "Generate Plan" to invoke AI

**Step 2: Review & Edit Generated Plan**
Agent Builder returns three editable sections:

1. **Context** (editable text)
   - Mission statement
   - Constraints (bulleted list)
   - Escalation rules

2. **Plan Structure** (editable bulleted list)
   - Sections the agent should use when building its internal plan
   - Example: "Research findings", "Approach options", "Recommended solution", "Risks"
   - Stored in `plan_structure` column

3. **Output Structure** (editable bulleted list)
   - Sections/fields the agent's final deliverable should contain
   - Example: "Priority level", "Recommended tags", "Issue summary", "Next steps"
   - Stored in `deliverable_structure` column

**Step 3: Agent Type & Configuration**
- **Agent Type dropdown**: Context, Function, API, External, Tool, Orchestrator
- **Reports To dropdown**: Select parent agent from org hierarchy
- **Type-specific configuration** (conditional on type):
  - **Function**: Describe function logic (AI generates JavaScript code)
  - **API**: Provide endpoint URL + authentication details
  - **External**: Provide agent card URL + authentication
  - **Tool**: Select from pre-configured MCP servers
  - **Context/Orchestrator**: No additional config

**Step 4: Create**
- Click "Regenerate Plan" to re-run AI with edits
- Click "Create Agent" to persist
- Agent created with `status='draft'`

### 6.2 Edit Agent Flow

- Navigate to agent detail page → "Edit" button
- Loads existing agent data into same form as create flow
- All fields editable: Context, Plan Structure, Output Structure, Type, Reports To, type-specific config
- Click "Update Agent" to save changes
- Can change agent type (with warnings about data loss)

### 6.3 Agent List & Management

**Regular User View:**
```
My Agents                    [+ Create New Agent]

☐ Show archived

┌─ 📝 Email Triage (DRAFT) ─────────────────┐
│ Type: Context                              │
│ Reports to: Support Lead                   │
│ [Edit] [Activate] [Archive]                │
└────────────────────────────────────────────┘

┌─ Invoice Parser ──────────────────────────┐
│ Type: Function                             │
│ Reports to: Finance Lead                   │
│ [Edit] [Archive]                           │
└────────────────────────────────────────────┘

(With "Show archived" checked - creator sees own archived agents:)
┌─ 🗄️ Old Email Bot ────────────────────────┐
│ Archived 2025-10-15                        │
│ Type: Context                              │
│ [Restore]                                  │
└────────────────────────────────────────────┘
```

**Admin View:**
```
All Agents (Org)             [+ Create New Agent]

☑ Show archived

┌─ 🗄️ Marketing Campaign Bot ───────────────┐
│ Archived 2025-10-20 by @john               │
│ Type: API                                  │
│ [Restore] [Delete] ← admin only            │
└────────────────────────────────────────────┘
```

### 6.4 Lifecycle State Transitions

```
[Create] → DRAFT
             ↓
      [Activate] (creator or admin)
             ↓
          ACTIVE
             ↓
      [Archive] (creator or admin)
             ↓
         ARCHIVED
             ↓
      [Restore] (creator or admin)
             ↓
          ACTIVE
```

### 6.5 Archive Behavior

- **Archiving an agent**: Sets `status='archived'`, adds `archivedAt` and `archivedBy` to YAML metadata
- **Archiving an Orchestrator**: Direct reports' `reportsTo` field updated to point to the archived orchestrator's parent (or null if orphaned)
- **Visibility**:
  - Regular users: archived agents hidden unless "Show archived" checked (only see own archived agents)
  - Admins: can see all archived agents with "Show archived" checked
- **Restore**: Sets `status='active'`, removes archive metadata from YAML

### 6.6 Hidden from User

- YAML generation (happens automatically behind the scenes)
- JSON Schema generation from Output Structure
- Transport/task configuration
- Agent type canonicalization
- Tool/provider selection (automated based on type)

## 7. Transport & Tasks
- Transport type: `agent-builder` (no version suffix).
- Tasks:
  - `agent_builder.plan`: accepts AgentDraft, returns AgentPlan.
  - `agent_builder.build`: accepts AgentPlan or planId, returns BuildResult.
- Headers (A2A): `x-transport: agent-builder`, `x-action: plan|build`, `x-trace-id`, `x-org-id`, `x-requested-by`, optional `x-agent-draft-id`.
- Namespace: exposed as a global agent (`/global/agent-builder`) so callers resolve it without relying on org/demo directories. Registration lives in well-known metadata, not in the agents DB table.

## 8. HTTP API

### 8.1 Plan Endpoint
```
POST /global/agent-builder/plan
```
**Purpose**: Generate agent configuration from natural language prompt or regenerate from edited draft.

**Request Body**: AgentDraft
```json
{
  "prompt": "Create an agent that triages support emails",
  "agentId": "optional - for editing existing agent",
  "context": "optional - user-edited context",
  "planStructure": "optional - user-edited plan structure",
  "deliverableStructure": "optional - user-edited output structure",
  "type": "optional - context|function|api|external|tool|orchestrator",
  "reportsTo": "optional - agent ID"
}
```

**Response**: AgentPlan (200)
```json
{
  "planId": "pln_123",
  "context": {
    "mission": "Triage incoming support emails",
    "constraints": ["No external API calls", "PII-safe"],
    "escalation": "Route urgent to on-call"
  },
  "planStructure": ["Research", "Options", "Solution", "Risks"],
  "deliverableStructure": ["Priority", "Tags", "Summary", "Next steps"],
  "type": "context",
  "slug": "email-triage",
  "displayName": "Email Triage Agent",
  "validation": {
    "errors": [],
    "warnings": []
  },
  "suggestions": ["Consider adding tag normalization"]
}
```

**Errors**:
- 400: validation errors
- 403: unauthorized
- 429: rate limit

### 8.2 Build Endpoint
```
POST /global/agent-builder/build
```
**Purpose**: Create new agent or update existing agent from plan.

**Request Body**:
```json
{
  "planId": "pln_123",
  "agentId": "optional - for updates",
  "typeConfig": {
    // Type-specific configuration
    // For Function type:
    "functionDescription": "Parse email headers...",

    // For API type:
    "endpoint": "https://api.example.com/webhook",
    "auth": { "type": "bearer", "tokenEnvVar": "API_TOKEN" },

    // For External type:
    "agentCardUrl": "https://external.com/.well-known/agent.json",
    "auth": { "type": "oauth2", "tokenEnvVar": "EXTERNAL_TOKEN" },

    // For Tool type:
    "mcpServer": "obsidian-mcp"
  },
  "reportsTo": "agent_456",
  "activateImmediately": false // If true, set status='active' instead of 'draft'
}
```

**Response**: BuildResult (200 for update, 201 for create)
```json
{
  "agentId": "agt_789",
  "status": "created", // or "updated"
  "agentStatus": "draft", // or "active"
  "slug": "email-triage",
  "artifacts": {
    "files": ["agents/email-triage/agent.yaml"],
    "prUrl": null
  },
  "warnings": []
}
```

**Errors**:
- 400: validation errors
- 403: unauthorized
- 409: duplicate slug
- 422: approval required
- 429: rate limit

### 8.3 Agent Management Endpoints

```
GET /global/agent-builder/agents/:agentId
```
**Purpose**: Load existing agent for editing.

**Response**: Agent (200)
```json
{
  "id": "agt_789",
  "slug": "email-triage",
  "displayName": "Email Triage",
  "type": "context",
  "status": "draft",
  "context": { "mission": "...", "constraints": [...] },
  "planStructure": [...],
  "deliverableStructure": [...],
  "reportsTo": "agent_456",
  "createdBy": "usr_123",
  "typeConfig": { ... }
}
```

```
PATCH /global/agent-builder/agents/:agentId/activate
```
**Purpose**: Move agent from draft to active (creator or admin only).

**Response**: 200

```
PATCH /global/agent-builder/agents/:agentId/archive
```
**Purpose**: Archive agent (creator or admin only).

**Response**: 200

```
PATCH /global/agent-builder/agents/:agentId/restore
```
**Purpose**: Restore archived agent to active (creator or admin only).

**Response**: 200

```
DELETE /global/agent-builder/agents/:agentId
```
**Purpose**: Hard delete agent (admin only, Phase 2+).

**Response**: 204

```
GET /global/agent-builder/agents?org=acme&include_archived=true
```
**Purpose**: List agents (filtered by permissions).

**Query params**:
- `org`: organization slug (required)
- `include_archived`: boolean (default false, shows archived agents)
- `status`: filter by draft|active|archived
- `type`: filter by agent type

**Response**: Agent[] (200)

## 9. Types

### 9.1 AgentDraft (Request to /plan)
```typescript
{
  prompt: string;                    // Natural language description
  agentId?: string;                  // For editing existing agent
  context?: {
    mission: string;
    constraints: string[];
    escalation?: string;
  };
  planStructure?: string[];          // Sections for agent's internal plan
  deliverableStructure?: string[];   // Sections for agent's output
  type?: 'context' | 'function' | 'api' | 'external' | 'tool' | 'orchestrator';
  reportsTo?: string;                // Agent ID
  orgSlug?: string;
}
```

### 9.2 AgentPlan (Response from /plan)
```typescript
{
  planId: string;                    // Unique plan identifier
  slug: string;                      // Generated agent slug
  displayName: string;               // Human-readable name
  type: 'context' | 'function' | 'api' | 'external' | 'tool' | 'orchestrator';
  context: {
    mission: string;
    constraints: string[];
    escalation?: string;
  };
  planStructure: string[];           // AI-generated or user-edited
  deliverableStructure: string[];    // AI-generated or user-edited
  validation: {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  };
  suggestions: string[];             // AI suggestions for improvement
  defaultsApplied: Record<string, any>; // What the AI filled in
  planSchemaVersion: 'v1';
}
```

### 9.3 BuildRequest (Request to /build)
```typescript
{
  planId: string;
  agentId?: string;                  // For updates
  reportsTo?: string;                // Agent ID
  typeConfig?: FunctionConfig | ApiConfig | ExternalConfig | ToolConfig;
  activateImmediately?: boolean;     // If true, status='active', else 'draft'
}

// Type-specific configs
interface FunctionConfig {
  functionDescription: string;       // AI generates code from this
}

interface ApiConfig {
  endpoint: string;
  auth?: {
    type: 'bearer' | 'oauth2' | 'api-key' | 'basic';
    tokenEnvVar: string;             // Name of env variable
    authUrl?: string;                // For oauth2
  };
}

interface ExternalConfig {
  agentCardUrl: string;              // Well-known agent card URL
  auth?: {
    type: 'bearer' | 'oauth2' | 'api-key';
    tokenEnvVar: string;
    authUrl?: string;
  };
}

interface ToolConfig {
  mcpServer: string;                 // Name of pre-configured MCP
}
```

### 9.4 BuildResult (Response from /build)
```typescript
{
  agentId: string;
  status: 'created' | 'updated';
  agentStatus: 'draft' | 'active';
  slug: string;
  artifacts?: {
    files?: string[];
    prUrl?: string;
    exportUrl?: string;
  };
  warnings?: string[];
}
```

### 9.5 Agent Types

**Context**: Standard LLM agent using context/prompt with providers (OpenAI, Anthropic, etc.)

**Function**: Executes generated JavaScript code (e.g., image generation, simple utilities)
- Stores code in `function_code` column
- AI generates code from `functionDescription`

**API**: Calls external HTTP webhooks (e.g., n8n, external services)
- Standard payload: `{ taskId, conversationId, userId, userMessage, provider, model }`
- Auth config in YAML, credentials in .env

**External**: Calls other A2A agents via well-known agent card
- Fetches and validates agent card
- Auth config in YAML, credentials in .env

**Tool**: Integrates with MCP servers
- Links to pre-configured MCP
- No code generation

**Orchestrator**: Manages hierarchies and delegations
- Phase 1: Can be created, context + reporting structure
- Phase 2+: Delegation, chains, concurrent sub-orchestrations

### 9.6 Agent Lifecycle Status
```typescript
type AgentStatus = 'draft' | 'active' | 'archived';

// Transitions:
// draft → active (via activate endpoint or activateImmediately flag)
// active → archived (via archive endpoint)
// archived → active (via restore endpoint)
```

Note: Transport is unversioned; `planSchemaVersion` is an internal schema rev for migrations/contract tests.

## 10. Validation & Defaulting
- Name/slug: generate slug; enforce uniqueness.
- Type: canonicalize or warn on ambiguity.
- Org: resolve by slug or context; error if not found.
- Context: synthesize mission/constraints; add safety/escalation defaults.
- I/O: generate minimal JSON Schemas; include error schema; align tasks to I/O.
- YAML: generate from plan; preserve user overrides.
- Tools/providers: verify availability and perms; drop unknowns with warnings.

## 11. Data Model

### 11.1 agents Table (Current Schema)

**Existing columns** (no migration required for Agent Builder Phase 1):

```sql
id                    uuid PRIMARY KEY
organization_slug     text
slug                  text UNIQUE (per org)
display_name          text NOT NULL
description           text
agent_type            text NOT NULL        -- maps to: context, function, api, external, tool, orchestrator
mode_profile          text NOT NULL
version               text
status                text DEFAULT 'active' -- Update to support: draft, active, archived
yaml                  text NOT NULL        -- Generated config (hidden from user)
context               jsonb                -- User-editable: mission, constraints, escalation
created_at            timestamp DEFAULT now()
updated_at            timestamp DEFAULT now()
function_code         text                 -- For function type: AI-generated JavaScript
plan_structure        jsonb                -- User-editable: sections for agent's internal plan
deliverable_structure jsonb                -- User-editable: sections for agent's output
io_schema             jsonb                -- Generated from deliverable_structure
```

**Indexes**:
- `agents_pkey`: PRIMARY KEY on `id`
- `agents_slug_unique`: UNIQUE on `(organization_slug, slug)`
- `idx_agents_org_slug`: on `organization_slug`
- `idx_agents_slug`: on `slug`

### 11.2 YAML Structure (Metadata in `yaml` column)

Agent Builder stores additional metadata in the `yaml` column that doesn't warrant separate DB columns:

```yaml
metadata:
  name: "Email Triage Agent"
  displayName: "Email Triage"
  description: "Sort and tag incoming support emails"
  version: "0.1.0"
  type: "context"
  createdBy: "usr_123"          # User ID who created
  reportsTo: "agent_456"        # Parent agent ID (for hierarchy)
  archivedAt: "2025-10-23"      # When archived (only when status='archived')
  archivedBy: "usr_789"         # Who archived (only when status='archived')

configuration:
  providers:
    - openai
  tools: []
  # ... rest of generated config
```

### 11.3 Required Changes for Agent Builder

**Update status constraint**:
```sql
-- Migration needed:
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_status_check;
ALTER TABLE agents
  ADD CONSTRAINT agents_status_check
  CHECK (status IN ('draft', 'active', 'archived'));

ALTER TABLE agents ALTER COLUMN status SET DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
```

### 11.4 Agent Type Mapping

| UI Type       | `agent_type` value | Additional Storage |
|---------------|--------------------|--------------------|
| Context       | `context`          | None               |
| Function      | `function`         | `function_code`    |
| API           | `api`              | YAML (endpoint, auth) |
| External      | `external`         | YAML (agent card URL, auth) |
| Tool          | `tool`             | YAML (MCP server name) |
| Orchestrator  | `orchestrator`     | YAML (delegation config - Phase 2+) |

### 11.5 Archive Cascade Behavior

When archiving an agent with `reports_to` relationships:

**If agent is Orchestrator type**:
1. Find all agents where `yaml.metadata.reportsTo = archived_agent_id`
2. Update their YAML to set `reportsTo` to the archived agent's `reportsTo` (or null if orphaned)
3. Set archived agent's `status = 'archived'`
4. Add `archivedAt` and `archivedBy` to archived agent's YAML metadata

**Example**:
```
Before archive:
  CEO (id: agt_1, reportsTo: null)
  ├── Marketing (id: agt_2, reportsTo: agt_1)
  └── Finance (id: agt_3, reportsTo: agt_1)

Archive CEO (agt_1):

After:
  CEO (id: agt_1, status: archived)
  Marketing (id: agt_2, reportsTo: null)  ← orphaned
  Finance (id: agt_3, reportsTo: null)    ← orphaned
```

### 11.6 Optional Artifacts

When artifacts are enabled (Phase 2):
- `agents/<slug>/agent.yaml` - Full YAML export
- `agents/<slug>/io.schema.json` - JSON Schema
- `agents/<slug>/README.md` - Generated documentation

### 11.7 Well-Known Descriptor

Agent Builder itself is NOT in the `agents` table. It is advertised via:
```
GET /global/agent-builder/.well-known/agent.json
```

Returns descriptor with transports, tasks, capabilities (see §25.1).

## 12. Security & IAM

### 12.1 Authentication
- **JWT**: with `org_id` and `user_id` for web UI
- **Service tokens**: for external A2A orchestrators

### 12.2 Scopes
- `agent:plan` - Can generate agent plans
- `agent:build` - Can create/update agents (implies plan)
- `agent:activate` - Can move agents from draft to active
- `agent:manage` - Admin scope for managing all agents in org
- `agent:delete` - Admin scope for hard delete (Phase 2+)

### 12.3 RBAC Rules

**Plan endpoint** (`POST /plan`):
- Any user with `agent:plan` or `agent:build` scope

**Build endpoint** (`POST /build`):
- Any user with `agent:build` scope
- Creates agent with `createdBy` set to current user

**Edit agent** (`GET /agents/:id`, update via plan/build):
- Agent creator (where YAML `metadata.createdBy` matches current user)
- Org admins with `agent:manage` scope

**Activate agent** (`PATCH /agents/:id/activate`):
- Agent creator
- Org admins with `agent:activate` or `agent:manage` scope

**Archive agent** (`PATCH /agents/:id/archive`):
- Agent creator only
- Org admins with `agent:manage` scope

**Restore agent** (`PATCH /agents/:id/restore`):
- Agent creator only
- Org admins with `agent:manage` scope

**View archived agents** (`GET /agents?include_archived=true`):
- Creators can see their own archived agents
- Org admins with `agent:manage` can see all archived agents

**Hard delete** (`DELETE /agents/:id`) - Phase 2+:
- System admins only with `agent:delete` scope

### 12.4 Org-Scoped Checks
- All endpoints require `org_id` in JWT or query params
- Users can only access agents in their org
- `organization_slug` validation on all operations

### 12.5 Input Limits
- Max payload size: 256 KB
- Max prompt length: 5000 characters
- Context mission: ≤ 1000 chars
- Constraints: max 20 items, ≤ 200 chars each
- Plan structure: max 20 sections
- Deliverable structure: max 50 fields
- Function description: ≤ 2000 chars

### 12.6 Secrets & Sensitive Data
- Auth tokens stored in .env, referenced by variable name in YAML
- API endpoints logged but auth headers redacted
- Function code visible to creator/admins only
- Audit logs track all CRUD operations with user IDs

## 13. Observability

### 13.1 Events
**agent.plan.completed**
```json
{
  "planId": "pln_123",
  "orgSlug": "acme",
  "agentSlug": "email-triage",
  "userId": "usr_456",
  "traceId": "tr_789",
  "warnings": [],
  "suggestionsCount": 2,
  "timestamp": "2025-10-23T10:30:00Z"
}
```

**agent.created**
```json
{
  "agentId": "agt_789",
  "orgSlug": "acme",
  "agentSlug": "email-triage",
  "agentType": "context",
  "createdBy": "usr_456",
  "planId": "pln_123",
  "status": "draft",
  "artifactsEmitted": false,
  "traceId": "tr_789",
  "timestamp": "2025-10-23T10:35:00Z"
}
```

**agent.updated**
```json
{
  "agentId": "agt_789",
  "orgSlug": "acme",
  "agentSlug": "email-triage",
  "updatedBy": "usr_456",
  "planId": "pln_234",
  "fieldsChanged": ["context", "planStructure"],
  "traceId": "tr_890",
  "timestamp": "2025-10-23T11:00:00Z"
}
```

**agent.activated**
```json
{
  "agentId": "agt_789",
  "orgSlug": "acme",
  "agentSlug": "email-triage",
  "activatedBy": "usr_456",
  "previousStatus": "draft",
  "traceId": "tr_901",
  "timestamp": "2025-10-23T11:05:00Z"
}
```

**agent.archived**
```json
{
  "agentId": "agt_789",
  "orgSlug": "acme",
  "agentSlug": "email-triage",
  "archivedBy": "usr_456",
  "agentType": "orchestrator",
  "orphanedAgents": ["agt_111", "agt_222"],
  "traceId": "tr_912",
  "timestamp": "2025-10-23T12:00:00Z"
}
```

**agent.restored**
```json
{
  "agentId": "agt_789",
  "orgSlug": "acme",
  "agentSlug": "email-triage",
  "restoredBy": "usr_456",
  "traceId": "tr_923",
  "timestamp": "2025-10-23T12:30:00Z"
}
```

**agent.builder.approval.required** (Phase 2)
```json
{
  "approvalId": "app_456",
  "planId": "pln_123",
  "orgSlug": "acme",
  "agentSlug": "sensitive-agent",
  "riskFlags": ["production-data-access"],
  "requestedBy": "usr_456",
  "traceId": "tr_934",
  "timestamp": "2025-10-23T13:00:00Z"
}
```

### 13.2 Audit Logs
All agent operations logged with:
- `userId` (who performed the action)
- `agentId` (which agent)
- `action` (plan, create, update, activate, archive, restore, delete)
- `changedFields` (for updates)
- `previousValues` (for updates)
- `validationResults` (errors/warnings)
- `traceId` (for correlation)
- `timestamp`

### 13.3 Metrics
- `agent_builder.plan.count` (by org, type)
- `agent_builder.plan.duration` (P50, P95, P99)
- `agent_builder.build.count` (by org, type, status: created|updated)
- `agent_builder.build.duration`
- `agent_builder.validation.error_rate` (by error type)
- `agent_builder.ai.generation.duration` (for context/function code generation)
- `agent_builder.agents.active_count` (by org, type)
- `agent_builder.agents.draft_count` (by org)
- `agent_builder.agents.archived_count` (by org)
- `agent_builder.archive.cascade_count` (orphaned agents when archiving orchestrators)

## 14. Performance & Limits
- Plan SLA: P50 < 1s, P95 < 3s with moderate drafts.
- Build SLA: P50 < 2s DB‑only; artifacts may push to async.
- Rate limits: org‑scoped, e.g., 60 plan/min, 10 build/min, configurable.
- Payload limits: e.g., 256KB body; schema node caps.

## 15. Rollout Plan

**Phase 1: Core Agent Builder** (MVP)
- Prompt-driven UI for creating/editing agents
- 6 agent types: Context, Function, API, External, Tool, Orchestrator
- Draft/active/archived lifecycle
- HTTP API: plan, build, activate, archive, restore endpoints
- DB-only (no file artifacts)
- Events and audit logs
- Permission model: creator + admin scopes
- AI generation: context, plan structure, deliverable structure, function code

**Phase 2: Advanced Features**
- Optional file artifacts (YAML export, JSON schemas, README)
- PR/export workflows
- Approval flows for high-risk agents
- Hard delete (admin-only)
- Orchestrator delegation capabilities (chains, concurrent sub-orchestrations)
- Bulk operations (archive multiple, transfer ownership)

**Phase 3: External Integration**
- Full A2A support with service tokens
- Async job queue for long-running builds
- Webhooks for external systems
- API versioning and migration tools
- Agent templates/marketplace

## 16. Risks & Mitigations
- Over‑generation of YAML or schemas → strict validation + suggestions.
- Privilege escalation via build → RBAC + approvals for sensitive scopes.
- Artifact write failures → DB commit first; surface artifact errors separately; retry/backoff.
- Backwards compatibility → unversioned transport with metadata evolution; contract tests.

## 17. Acceptance Criteria
- Plan endpoint returns a valid AgentPlan with defaults, suggestions, diff, and no fatal errors for minimal drafts.
- Build endpoint creates a new agent row with expected fields when given a valid plan.
- A2A tasks mirror HTTP behavior and honor IAM/rate limits.
- Events and audit logs are emitted for plan and build.
- Optional artifacts can be enabled and produce expected files or PR/export reports.

## 18. Implementation Notes (Tech)

### 18.1 Backend (NestJS / apps/api)

**HTTP Layer**:
- Create `AgentBuilderController` at `/global/agent-builder`
- Endpoints: `POST /plan`, `POST /build`, `GET /agents/:id`, `PATCH /agents/:id/activate`, `PATCH /agents/:id/archive`, `PATCH /agents/:id/restore`, `DELETE /agents/:id` (Phase 2), `GET /agents`
- Guards: JWT auth + scope guards (`agent:plan`, `agent:build`, `agent:manage`)
- Permission checks: creator vs admin logic in guards

**Module Wiring**:
- `AgentBuilderModule` imports: `AgentsModule`, `ValidationModule`, `EventModule`, `LLMModule` (for AI generation), `ArtifactModule?` (Phase 2)
- Exports: `AgentBuilderService` for A2A use

**DTOs**:
```typescript
AgentDraftDto {
  prompt: string;
  agentId?: string;
  context?: ContextDto;
  planStructure?: string[];
  deliverableStructure?: string[];
  type?: AgentType;
  reportsTo?: string;
}

AgentPlanDto {
  planId: string;
  slug: string;
  displayName: string;
  type: AgentType;
  context: ContextDto;
  planStructure: string[];
  deliverableStructure: string[];
  validation: ValidationResultDto;
  suggestions: string[];
}

AgentBuildRequestDto {
  planId: string;
  agentId?: string;
  reportsTo?: string;
  typeConfig?: FunctionConfig | ApiConfig | ExternalConfig | ToolConfig;
  activateImmediately?: boolean;
}

AgentBuildResultDto {
  agentId: string;
  status: 'created' | 'updated';
  agentStatus: 'draft' | 'active';
  slug: string;
  artifacts?: ArtifactsDto;
  warnings?: string[];
}
```

**Services**:

1. **AgentBuilderService** (orchestrator)
   - `plan(draft: AgentDraftDto, userId: string): Promise<AgentPlanDto>`
   - `build(request: AgentBuildRequestDto, userId: string): Promise<AgentBuildResultDto>`
   - `activate(agentId: string, userId: string): Promise<void>`
   - `archive(agentId: string, userId: string): Promise<void>`
   - `restore(agentId: string, userId: string): Promise<void>`
   - Handles permission checks, emits events, calls sub-services

2. **AgentAIGenerator** (AI integration)
   - `generateFromPrompt(prompt: string): Promise<{ context, planStructure, deliverableStructure, type }>`
   - `generateFunctionCode(description: string): Promise<string>`
   - `generateYAML(plan: AgentPlan, typeConfig): Promise<string>`
   - `generateIOSchema(deliverableStructure: string[]): Promise<JSONSchema>`
   - Uses LLM provider (OpenAI/Anthropic) with structured output

3. **AgentPlanValidator**
   - `validate(plan: AgentPlan): ValidationResult`
   - Checks: slug uniqueness, org exists, field length limits, structure limits
   - JSON Schema validation (Ajv)
   - Business rules (e.g., can't report to archived agent)

4. **AgentArchiveService**
   - `archiveAgent(agentId: string, userId: string): Promise<void>`
   - Handles orchestrator cascade: find direct reports, update their `reportsTo`
   - Updates YAML metadata (`archivedAt`, `archivedBy`)
   - Sets `status='archived'`

5. **AgentBuilderAuditService**
   - `logOperation(action, agentId, userId, changes): Promise<void>`
   - Writes to audit log table or event stream

6. **AgentArtifactService** (Phase 2, optional)
   - `emitArtifacts(agent): Promise<ArtifactResult>`
   - Writes YAML files, generates README, creates PR

**Repositories/Data**:
- Extend `AgentsService` (TypeORM/Supabase client)
- Methods:
  - `create(agent: CreateAgentDto): Promise<Agent>`
  - `update(agentId: string, changes: Partial<Agent>): Promise<Agent>`
  - `findById(agentId: string): Promise<Agent | null>`
  - `findByOrg(orgSlug: string, filters: { includeArchived?, status?, type? }): Promise<Agent[]>`
  - `updateYAMLMetadata(agentId: string, metadata: Partial<YAMLMetadata>): Promise<void>`
  - `findDirectReports(agentId: string): Promise<Agent[]>` (for cascade)

**A2A Gateway** (Phase 3):
- Register tasks `agent_builder.plan` and `agent_builder.build`
- WebSocket/Socket.IO handlers call same `AgentBuilderService` methods
- Service tokens validated via middleware

**Config**:
```typescript
// config/agent-builder.config.ts
export default () => ({
  agentBuilder: {
    rateLimits: {
      plan: { perMinute: 60, perOrg: true },
      build: { perMinute: 10, perOrg: true },
    },
    artifacts: {
      enabled: process.env.AGENT_BUILDER_ARTIFACTS_ENABLED === 'true',
    },
    ai: {
      provider: process.env.AGENT_BUILDER_AI_PROVIDER || 'openai',
      model: process.env.AGENT_BUILDER_AI_MODEL || 'gpt-4',
    },
  },
});
```

**Migration**:
```sql
-- apps/api/supabase/migrations/YYYYMMDD_agent_builder_status_constraint.sql
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_status_check;
ALTER TABLE agents
  ADD CONSTRAINT agents_status_check
  CHECK (status IN ('draft', 'active', 'archived'));

ALTER TABLE agents ALTER COLUMN status SET DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
```

**Testing**:
- Unit tests: `AgentAIGenerator`, `AgentPlanValidator`, `AgentArchiveService` (cascade logic)
- Integration tests: Controller endpoints (Jest + Supertest)
- E2E tests: Full create/edit/archive flows
- Contract tests: A2A task compatibility (Phase 3)

### 18.2 Frontend (Vue / apps/web)

**Routes**:
```typescript
// routes/agent-builder.ts
{
  path: '/agent-builder',
  children: [
    { path: 'create', component: AgentBuilderCreate },
    { path: 'edit/:agentId', component: AgentBuilderEdit },
    { path: 'list', component: AgentList },
  ],
  meta: { requiresAuth: true, scopes: ['agent:plan'] }
}
```

**Components**:

1. **AgentBuilderCreate.vue** / **AgentBuilderEdit.vue**
   - Shared form component
   - Sections:
     - Step 1: Prompt textarea + "Generate Plan" button
     - Step 2: Editable Context (mission, constraints, escalation)
     - Step 3: Editable Plan Structure (bulleted list)
     - Step 4: Editable Deliverable Structure (bulleted list)
     - Step 5: Type dropdown + Reports To dropdown
     - Step 6: Conditional type-specific config (Function desc, API endpoint, etc.)
   - Actions: "Regenerate Plan", "Create Agent" / "Update Agent"

2. **AgentList.vue**
   - Displays agents with status badges (Draft, Active, Archived)
   - Filter: status, type
   - Checkbox: "Show archived" (permission-based visibility)
   - Actions per agent: Edit, Activate, Archive, Restore (based on permissions)

3. **AgentCard.vue**
   - Agent display component with type icon, status, reports-to
   - Click to view/edit

**State Management**:
```typescript
// stores/agentBuilder.ts (Pinia)
export const useAgentBuilderStore = defineStore('agentBuilder', {
  state: () => ({
    currentDraft: null as AgentDraft | null,
    currentPlan: null as AgentPlan | null,
    isGenerating: false,
    isBuilding: false,
    validationErrors: [] as ValidationError[],
    suggestions: [] as string[],
  }),
  actions: {
    async generatePlan(prompt: string) { /* calls POST /plan */ },
    async regeneratePlan(draft: AgentDraft) { /* calls POST /plan with edits */ },
    async buildAgent(request: BuildRequest) { /* calls POST /build */ },
    async loadAgent(agentId: string) { /* calls GET /agents/:id */ },
    async activateAgent(agentId: string) { /* calls PATCH /agents/:id/activate */ },
    async archiveAgent(agentId: string) { /* calls PATCH /agents/:id/archive */ },
    async restoreAgent(agentId: string) { /* calls PATCH /agents/:id/restore */ },
  },
});
```

**Form Controls**:
- **Context editor**: Textarea with sections (mission, constraints list, escalation)
- **Structure editors**: Drag-and-drop bulleted list (VueDraggable)
- **Type dropdown**: 6 options with icons
- **Reports To dropdown**: Fetches active agents from org, hierarchical display
- **Type-specific configs**:
  - Function: Textarea for description
  - API: URL input + auth config form
  - External: URL input for agent card + auth
  - Tool: Dropdown of MCPs

**Error UX**:
- Toast notifications for API errors
- Inline validation errors mapped to fields
- Warning banner for suggestions

**Testing**:
- Component tests (Vitest): AgentBuilderCreate, AgentList
- E2E tests (Cypress): Create agent flow, edit agent flow, archive/restore flows

### 18.3 A2A & External Runner (Phase 3)

**Well-Known Descriptor**:
```typescript
// controllers/agent-builder-well-known.controller.ts
@Get('/global/agent-builder/.well-known/agent.json')
getAgentCard() {
  return {
    name: "Agent Builder",
    slug: "agent-builder",
    transports: ["agent-builder"],
    tasks: ["agent_builder.plan", "agent_builder.build"],
    wellKnown: ["/global/agent-builder/plan", "/global/agent-builder/build"],
    // ... see §25.1
  };
}
```

**Event Emission**:
- EventEmitter for internal events
- Socket.IO broadcast for real-time updates
- Webhook integration (Phase 3) for external systems

**Service Token Validation**:
```typescript
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-service-token'];
    // Validate service token, extract org/permissions
    return this.validateServiceToken(token);
  }
}
```

## 19. Error Handling & Responses
- **Envelope**: `{ "error": { "code": string, "message": string, "details"?: any, "traceId": string } }`
- **HTTP Codes**:
  - `400` `AGENT_BUILDER_VALIDATION_ERROR`: schema/business rule failures; include `details.fields`.
  - `401`/`403` `AGENT_BUILDER_FORBIDDEN`: missing/insufficient scope; include `details.requiredScopes`.
  - `409` `AGENT_BUILDER_DUPLICATE_BUILD`: hash/planId already persisted; return existing `agentId`.
  - `422` `AGENT_BUILDER_APPROVAL_REQUIRED`: build requires approval (see §20); include `details.approvalId`.
  - `429` `AGENT_BUILDER_RATE_LIMIT`: include `Retry-After`.
  - `500` `AGENT_BUILDER_INTERNAL`: generic failure with support traceId.
- **A2A Failures**: respond with same envelope; set `x-error-code` header and reject message.
- **Logging**: all errors log with traceId, orgId, userId, planId.
- **Negative Example** (HTTP 400):
```json
{
  "error": {
    "code": "AGENT_BUILDER_VALIDATION_ERROR",
    "message": "Invalid agent draft",
    "details": {
      "fields": {
        "org.slug": "Unknown organization 'acme-inc'",
        "io.inputSchema": "Object has 120 properties; max allowed is 50"
      }
    },
    "traceId": "8c2b..."
  }
}
```

## 20. Approval & Governance
- **When**: triggered for orgs/roles requiring human review, high-risk capabilities (prod data access), or artifact emission.
- **Flow**:
  1. `build` detects policy → return `422` with `approvalId`.
  2. Approval stored in `agent_builder_approvals` table (`id`, `planId`, `orgId`, `agentName`, `riskFlags`, `status`, `requestedBy`, `approverId`, timestamps).
  3. Approver reviews diff, YAML, warnings; choose `approve` or `reject`.
  4. On approve, system replays build with same `planId`; on reject, closes with reason.
- **UI**: admin dashboard listing pending approvals; notifications via email/Slack optional.
- **Audit**: approval events logged with user IDs and reason codes.
- **Overrides**: super-admins can bypass approval via scope `agent:build:override`.

## 21. Validation Limits & Constraints
- **Payload**: max size 256 KB; drafts exceeding reject with 400.
- **Text Fields**: name ≤ 80 chars, description ≤ 500, mission ≤ 1000.
- **Schema Limits**:
  - JSON Schema depth ≤ 6 levels; max properties per object 50; arrays max items 50 (per schema definition).
  - YAML total lines ≤ 400; enforce sanitized keys (denylist `system`, `mount`, `exec` etc.).
- **Tools/Providers**: max 10 each; must exist in registry; unknown values downgraded with warning or rejected (configurable).
- **Concurrency**: one active plan per `planId`; building invalidates plan after 24 hours (TTL).
- **Diff Generation**: cap diff size to 200 lines; truncate with warning.

## 22. Event Schemas
- **agent.plan.completed**
  - Fields: `planId`, `orgId`, `agentSlug`, `requestedBy`, `traceId`, `warnings[]`, `defaultsAppliedCount`, `timestamp`.
- **agent.builder.approval.required**
  - Fields: `approvalId`, `planId`, `orgId`, `agentSlug`, `riskFlags[]`, `requestedBy`, `traceId`, `timestamp`.
- **agent.created**
  - Fields: `agentId`, `orgId`, `agentSlug`, `createdBy`, `planId`, `artifactsEmitted` (bool), `traceId`, `timestamp`.
- **Emission**: via EventEmitter + Socket.IO gateway; forward to analytics/observability pipeline (e.g., Segment, Datadog).
- **Schema Registry**: store JSON Schemas under `schemas/events/agent-builder/*.json`; enforce via CI contract tests.

## 23. Open Questions
- Should build require approval for certain org roles by default?
- Artifact strategy: which artifact types first (file, PR, export)?
- Where should the YAML be authoritative long-term (DB vs files)? Proposal: DB truth; files optional.

## 24. References
- High-level: obsidian/efforts/Matt/current/agent-builder/high-level.md

## 25. Examples

### 25.1 Well‑Known Descriptor (Agent Builder)
```json
{
  "name": "Agent Builder",
  "slug": "agent-builder",
  "labels": ["system", "builder"],
  "transports": ["agent-builder"],
  "tasks": ["agent_builder.plan", "agent_builder.build"],
  "wellKnown": ["/global/agent-builder/plan", "/global/agent-builder/build"],
  "meta": {
    "description": "Service-style A2A agent for drafting and creating agents.",
    "iam": { "scopes": ["agent:plan", "agent:build"] },
    "global": true
  }
}
```

### 25.2 Example: Create Agent - Initial Prompt Request
```http
POST /global/agent-builder/plan
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "prompt": "I need an agent that triages incoming support emails, assigns priority levels, and suggests appropriate tags based on content. It should handle PII carefully and escalate urgent issues."
}
```

Response:
```json
{
  "planId": "pln_01HZE...",
  "slug": "email-triage-agent",
  "displayName": "Email Triage Agent",
  "type": "context",
  "context": {
    "mission": "Triage incoming support emails by analyzing content, assigning priority levels, and suggesting tags",
    "constraints": [
      "Handle PII carefully and redact sensitive information",
      "No external API calls without user permission",
      "Validate email structure before processing"
    ],
    "escalation": "Route urgent or high-priority issues to on-call support immediately"
  },
  "planStructure": [
    "Email analysis",
    "Priority assessment",
    "Tag recommendations",
    "Escalation check"
  ],
  "deliverableStructure": [
    "Priority level (low, medium, high, urgent)",
    "Recommended tags",
    "Issue summary",
    "Suggested next steps",
    "Escalation flag"
  ],
  "validation": {
    "errors": [],
    "warnings": []
  },
  "suggestions": [
    "Consider adding sentiment analysis to improve priority detection",
    "Add tag normalization to ensure consistency"
  ],
  "planSchemaVersion": "v1"
}
```

### 25.3 Example: Build Agent (Create)
```http
POST /global/agent-builder/build
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "planId": "pln_01HZE...",
  "reportsTo": "agt_support_lead_123",
  "activateImmediately": false
}
```

Response:
```json
{
  "agentId": "agt_9f3a...",
  "status": "created",
  "agentStatus": "draft",
  "slug": "email-triage-agent",
  "artifacts": null,
  "warnings": []
}
```

### 25.4 Example: Function Type Agent
```http
POST /global/agent-builder/build
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "planId": "pln_func_123...",
  "typeConfig": {
    "functionDescription": "Generate product images using DALL-E API. Takes product description and style parameters, calls OpenAI image generation API with configured key, returns base64-encoded image data."
  },
  "activateImmediately": true
}
```

Response:
```json
{
  "agentId": "agt_img_gen_456...",
  "status": "created",
  "agentStatus": "active",
  "slug": "product-image-generator",
  "artifacts": null,
  "warnings": ["Generated function code should be thoroughly tested before production use"]
}
```

Generated `function_code` column (example):
```javascript
async function generateProductImage({ description, style, size = '1024x1024' }) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: `${description} in ${style} style`,
      size: size,
      n: 1
    })
  });

  const data = await response.json();
  return {
    imageUrl: data.data[0].url,
    deliverableType: 'image'
  };
}
```

### 25.5 Example: API Type Agent (n8n Integration)
```http
POST /global/agent-builder/build
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "planId": "pln_api_789...",
  "typeConfig": {
    "endpoint": "https://n8n.example.com/webhook/marketing-campaign",
    "auth": {
      "type": "bearer",
      "tokenEnvVar": "N8N_WEBHOOK_TOKEN"
    }
  }
}
```

Generated YAML (partial):
```yaml
metadata:
  type: api
  createdBy: usr_123
  reportsTo: agt_marketing_lead

configuration:
  api:
    endpoint: https://n8n.example.com/webhook/marketing-campaign
    method: POST
    headers:
      Content-Type: application/json
      Authorization: Bearer ${N8N_WEBHOOK_TOKEN}
    body:
      taskId: "{{taskId}}"
      conversationId: "{{conversationId}}"
      userId: "{{userId}}"
      userMessage: "{{userMessage}}"
      provider: "{{provider}}"
      model: "{{model}}"
```

### 25.6 Example: Edit Existing Agent
```http
GET /global/agent-builder/agents/agt_9f3a...
Authorization: Bearer <JWT>
```

Response:
```json
{
  "id": "agt_9f3a...",
  "slug": "email-triage-agent",
  "displayName": "Email Triage Agent",
  "type": "context",
  "status": "draft",
  "context": {
    "mission": "Triage incoming support emails...",
    "constraints": ["Handle PII carefully...", "No external API calls..."],
    "escalation": "Route urgent issues..."
  },
  "planStructure": ["Email analysis", "Priority assessment", ...],
  "deliverableStructure": ["Priority level", "Recommended tags", ...],
  "reportsTo": "agt_support_lead_123",
  "createdBy": "usr_456"
}
```

User edits context, then re-plans:
```http
POST /global/agent-builder/plan
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "agentId": "agt_9f3a...",
  "context": {
    "mission": "Triage incoming support emails with enhanced sentiment analysis",
    "constraints": [
      "Handle PII carefully and redact sensitive information",
      "No external API calls without user permission",
      "Validate email structure before processing",
      "Use sentiment analysis to improve priority detection"
    ],
    "escalation": "Route urgent or high-priority issues to on-call support immediately"
  },
  "planStructure": ["Email analysis", "Sentiment analysis", "Priority assessment", "Tag recommendations", "Escalation check"]
}
```

Then update:
```http
POST /global/agent-builder/build
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "planId": "pln_updated_...",
  "agentId": "agt_9f3a..."
}
```

Response:
```json
{
  "agentId": "agt_9f3a...",
  "status": "updated",
  "agentStatus": "draft",
  "slug": "email-triage-agent",
  "warnings": []
}
```

### 25.7 Example: Archive & Restore Flow
```http
PATCH /global/agent-builder/agents/agt_9f3a.../archive
Authorization: Bearer <JWT>
```

Response: 200 OK

Agent YAML updated with:
```yaml
metadata:
  status: archived  # Also in status column
  archivedAt: "2025-10-23T14:30:00Z"
  archivedBy: "usr_456"
```

If agent was an orchestrator, direct reports' `reportsTo` updated to orphaned or reassigned.

Later, restore:
```http
PATCH /global/agent-builder/agents/agt_9f3a.../restore
Authorization: Bearer <JWT>
```

Response: 200 OK

YAML metadata `archivedAt` and `archivedBy` removed, `status` set back to `active`.

### 25.8 Example: Validation Error
```http
POST /global/agent-builder/plan
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "prompt": "Create an agent",
  "context": {
    "mission": "This is a very long mission statement that exceeds the maximum allowed length of 1000 characters... [continues for 1200 chars]"
  },
  "planStructure": ["Step 1", "Step 2", ... "Step 25"],  // exceeds max 20
  "deliverableStructure": ["Field 1", "Field 2", ... "Field 60"]  // exceeds max 50
}
```

Response (400):
```json
{
  "error": {
    "code": "AGENT_BUILDER_VALIDATION_ERROR",
    "message": "Invalid agent draft",
    "details": {
      "fields": {
        "context.mission": "Mission statement exceeds maximum length of 1000 characters (got 1200)",
        "planStructure": "Plan structure has 25 sections; max allowed is 20",
        "deliverableStructure": "Deliverable structure has 60 fields; max allowed is 50"
      }
    },
    "traceId": "tr_8c2b..."
  }
}
```

### 25.9 Example: Permission Denied
```http
PATCH /global/agent-builder/agents/agt_other_user.../archive
Authorization: Bearer <JWT for user_789>
```

Response (403):
```json
{
  "error": {
    "code": "AGENT_BUILDER_FORBIDDEN",
    "message": "Insufficient permissions to archive this agent",
    "details": {
      "requiredScopes": ["agent:manage"],
      "reason": "Only the agent creator or org admins can archive agents"
    },
    "traceId": "tr_abc..."
  }
}
```
