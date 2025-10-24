# Orchestration System PRD

## Overview

Implement a complete orchestration system that enables complex, multi-agent workflows with human-in-the-loop approvals, sub-orchestrations, and full lifecycle management. The system will support both programmatic orchestrator agents and saved orchestration definitions that can be invoked by orchestrators or run standalone.

## Goals

1. **Complete Orchestration Lifecycle**: Plan creation → human approval → execution → checkpoints → completion
2. **Sub-Orchestration Support**: Orchestrators can spawn other orchestrations (nested workflows)
3. **Human-in-the-Loop**: Pause for human approval at plan stage and during execution checkpoints
4. **Agent-to-Agent Protocol**: All sub-agent calls use A2A transport (JSON-RPC 2.0)
5. **Real-time Updates**: SSE streaming and webhook progress updates
6. **Saved Orchestrations**: Reusable orchestration templates that can be invoked by orchestrators
7. **Complete Agent Suite**: Implement missing agent types to demonstrate all capabilities

## Architecture

### Core Components

#### 1. Orchestration Runner Service
- Extends `BaseAgentRunner` (follows agent runner pattern)
- Manages orchestration lifecycle states
- Creates conversations for each step
- Coordinates step execution and dependencies
- Processes human checkpoints
- Emits progress events for SSE streaming

#### 2. Orchestration Definitions
- **Saved Orchestrations**: JSON/YAML templates defining step sequences
- Owned by orchestrator agents (e.g., finance-manager owns kpi-tracking)
- Stored in database with versioning and owner tracking
- Reference agents by slug, define dependencies, specify checkpoints

#### 3. Steps Have Conversations (Key Architecture)
- **Each step creates a conversation** with its target agent
- Conversations track tasks, plans, and deliverables (all existing infrastructure)
- Step outputs = deliverables from the conversation
- Step inputs = passed as context to the conversation
- **Benefits**:
  - Reuse all existing conversation/task/plan/deliverable infrastructure
  - No duplicate state management
  - UI already works (can view step conversations)
  - Versioning automatic (deliverables already version)

#### 4. Human Checkpoint System
- Checkpoints are step metadata (`checkpoint_after`)
- Humans can: continue, retry (with modifications), or abort
- Checkpoint decisions stored in `human_approvals` table (linked to `conversation_id` + `task_id`)
- Orchestrator returns a `TaskResponseDto` with `status: awaiting_approval` when a checkpoint is hit, ensuring the A2A loop pauses cleanly
- Humans resume orchestration by submitting a NEW `TaskRequestDto` (same conversation/task), embedding `approvalId`, `decision`, and optional modifications in the payload
- `OrchestrationCheckpointService` orchestrates approval creation/resolution, emits `orchestration.checkpoint.requested/resolved` events, and updates run + step state via repositories
- No direct REST mutation of orchestration state—everything flows through A2A task execution

**Resume Payload Example:**
```json
{
  "jsonrpc": "2.0",
  "id": "resume-approval-1",
  "method": "agent.execute",
  "params": {
    "agentSlug": "finance-manager",
    "mode": "BUILD",
    "conversationId": "conv-123",
    "payload": {
      "action": "resume_after_approval",
      "approvalId": "approvals-uuid",
      "decision": "continue",
      "notes": "Looks good" 
    }
  }
}
```
- Future: Advanced checkpoint control (rewind, restart sub-orchestrations)

#### 5. Orchestration Ownership Model
- Orchestrations belong to their manager/orchestrator agent
- **finance-manager** owns: kpi-tracking, revenue-analysis, expense-report
- **image-orchestrator** owns: image-comparison
- **ceo-agent** owns: cross-functional orchestrations that delegate to managers
- Access control: only owner can invoke their orchestrations

### Orchestration Lifecycle

```
1. REQUEST → Orchestrator receives request
2. PLANNING → Generate orchestration plan (sequence of steps)
3. APPROVAL_PENDING → Wait for human approval of plan
4. APPROVED → Plan approved, ready to execute
5. RUNNING → Execute steps sequentially/parallel as defined
6. CHECKPOINT → Pause for human decision (optional)
7. CONTINUE → Resume after checkpoint approval
8. COMPLETED → All steps successful
9. FAILED → Step failed, awaiting retry/abort decision
10. ABORTED → Manually aborted by user
```

### A2A Transport Integration

All sub-agent calls use the full A2A JSON-RPC 2.0 protocol:

**Request Format:**
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "agent.execute",
  "params": {
    "organizationSlug": "my-org",
    "agentSlug": "supabase-agent",
    "mode": "BUILD",
    "userMessage": "Fetch monthly revenue from database",
    "conversationId": "conv-123",
    "sessionId": "session-456",
    "orchestrationRunId": "orch-run-789"
  }
}
```

**Response Format:**
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "status": "success",
    "mode": "BUILD",
    "content": {
      "deliverable": { "content": "SELECT ..." }
    },
    "metadata": {
      "provider": "anthropic",
      "model": "claude-sonnet-4"
    }
  }
}
```

**Error Format:**
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "error": {
    "code": -32603,
    "message": "Agent execution failed",
    "data": { "reason": "..." }
  }
}
```

### Progress Updates

#### Webhook Updates (POST /webhooks/status)
```json
{
  "taskId": "task-123",
  "status": "in_progress",
  "step": "executing_sql",
  "message": "Running SQL query",
  "percent": 60,
  "timestamp": "2025-01-11T10:30:00Z",
  "orchestrationRunId": "orch-run-789",
  "currentStepIndex": 2,
  "totalSteps": 3
}
```

#### SSE Events
- `orchestration.started` - Orchestration begins
- `orchestration.plan.created` - Plan generated, awaiting approval
- `orchestration.plan.approved` - Plan approved, execution starting
- `orchestration.step.started` - Step execution begins
- `orchestration.step.progress` - Step progress update
- `orchestration.step.completed` - Step finished successfully
- `orchestration.checkpoint` - Waiting for human decision
- `orchestration.completed` - All steps completed
- `orchestration.failed` - Orchestration failed

## New Agents to Implement

### 1. marketing-swarm (API Agent)
**Type**: `api`
**Purpose**: Execute n8n marketing workflow
**Configuration**:
```yaml
metadata:
  name: marketing-swarm
  displayName: Marketing Swarm
  type: api

configuration:
  api:
    endpoint: "http://localhost:5678/webhook/marketing-swarm"
    method: POST
    headers:
      Content-Type: "application/json"
    authentication:
      type: none
    response_mapping:
      status_field: "status"
      result_field: "results"

  execution_capabilities:
    supports_converse: false
    supports_plan: false
    supports_build: true
```

**Workflow Steps** (in n8n):
1. Generate web post content
2. Generate SEO content
3. Generate social media posts
4. Return all content as structured result

**Integration**: Webhook progress updates during n8n execution

---

### 2. supabase-agent (Tool Agent)
**Type**: `tool`
**Purpose**: Interact with Supabase database using multiple MCP tools
**Configuration**:
```yaml
metadata:
  name: supabase-agent
  displayName: Supabase Database Agent
  type: tool

configuration:
  mcp:
    server: supabase
    tools:
      - supabase_query          # Execute SELECT queries
      - supabase_insert         # Insert data
      - supabase_update         # Update data
      - supabase_delete         # Delete data
      - supabase_rpc            # Call stored procedures
      - supabase_schema_introspect  # Get schema information

  security:
    allowed_tables: ["revenue", "expenses", "kpis", "metrics"]
    denied_operations: ["DROP", "TRUNCATE", "ALTER"]

  execution_capabilities:
    supports_converse: true  # Can discuss data/schema
    supports_plan: false
    supports_build: true     # Executes queries and returns results
```

**Capabilities**:
- Introspects database schema to understand table structure
- Builds appropriate SQL queries based on requirements
- Executes queries and returns results
- All in one agent using multiple MCP tools

**Example Usage**:
```
User: "Get monthly revenue for Q4 2024, grouped by month"

Agent Process:
1. Uses supabase_schema_introspect to understand 'revenue' table structure
2. Builds SQL query based on schema
3. Uses supabase_query to execute:
   SELECT
     DATE_TRUNC('month', date) as month,
     SUM(amount) as total_revenue
   FROM revenue
   WHERE date >= '2024-10-01' AND date < '2025-01-01'
   GROUP BY month
   ORDER BY month;
4. Returns query results as JSON
```

---

### 3. summarizer (Context Agent)
**Type**: `context`
**Purpose**: Analyze data and create summaries/reports
**Configuration**:
```yaml
metadata:
  name: summarizer
  displayName: Data Summarizer
  type: context

configuration:
  prompt_prefix: |
    You are a business analyst who creates clear, actionable summaries.
    Analyze data and highlight key insights, trends, and recommendations.

  execution_capabilities:
    supports_converse: true
    supports_plan: false
    supports_build: true

  deliverables:
    type: report
    format: markdown
```

**Example Usage**:
```
Input: { "q4_revenue": [Oct: 150k, Nov: 175k, Dec: 200k] }
Output:
  # Q4 2024 Revenue Summary

  ## Key Metrics
  - Total Revenue: $525,000
  - Average Monthly: $175,000
  - Growth: 33% from Oct to Dec

  ## Insights
  - Strong upward trend throughout quarter
  - December showed exceptional performance (+14% MoM)

  ## Recommendations
  - Investigate December success factors
  - Apply learnings to Q1 planning
```

---

### 4. image-generator-openai (Function Agent)
**Type**: `function`
**Purpose**: Generate images using OpenAI GPT-Image-1 (latest, released April 2025)

**Architecture Requirement**: ⚠️ **SELF-CONTAINED FUNCTION AGENTS**
- ALL logic MUST be in the JavaScript `function_code` column
- NO internal service dependencies (e.g., ImageGenerationService)
- Function code makes DIRECT HTTP calls to external APIs using `axios` or `fetch`
- VM sandbox MUST provide: `require('axios')`, `Buffer`, `crypto`, filtered `process.env`
- Adding new providers = new database row, ZERO code deployment

**Configuration**:
```yaml
metadata:
  name: image-generator-openai
  displayName: OpenAI Image Generator
  type: function

configuration:
  function:
    timeout_ms: 120000
    code: |
      // FULL IMPLEMENTATION - Makes direct API call, creates deliverable
      async function handler(input, ctx) {
        const axios = ctx.require('axios');
        const crypto = ctx.require('crypto');

        const prompt = input.prompt || input.userMessage || '';
        if (!prompt.trim()) throw new Error('prompt required');

        const size = input.size || '1024x1024';
        const quality = input.quality === 'hd' ? 'hd' : 'standard';
        const count = Math.max(1, Math.min(input.count || 1, 4));

        // Direct API call to OpenAI
        const response = await axios.post(
          'https://api.openai.com/v1/images/generations',
          {
            model: 'gpt-image-1',
            prompt, size, quality, n: count,
            response_format: 'b64_json',
            user: ctx.userId
          },
          {
            headers: {
              'Authorization': `Bearer ${ctx.process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 120000
          }
        );

        // Process images, create assets, create deliverable
        const images = response.data?.data || [];
        const attachments = [];

        for (let i = 0; i < images.length; i++) {
          const buffer = Buffer.from(images[i].b64_json, 'base64');
          const asset = await ctx.assets.saveBuffer({
            buffer,
            mime: 'image/png',
            filename: `openai-${Date.now()}-${i}.png`,
            subpath: 'generated'
          });

          attachments.push({
            assetId: asset.id,
            url: `/assets/${asset.id}`,
            mime: 'image/png',
            hash: crypto.createHash('sha256').update(buffer).digest('hex'),
            altText: prompt,
            provider: 'openai'
          });
        }

        // Create deliverable using infrastructure service
        const deliverable = await ctx.deliverables.create({
          title: input.title || 'OpenAI Image Set',
          content: `Generated ${attachments.length} image(s) via OpenAI`,
          format: 'image/png',
          type: 'image',
          attachments: { images: attachments },
          metadata: { provider: 'openai', model: 'gpt-image-1', prompt, size, quality }
        });

        return { success: true, deliverable, images: attachments };
      }
      module.exports = handler;

  execution_capabilities:
    supports_converse: false
    supports_plan: false
    supports_build: true
```

**Pricing**: $0.01 (low), $0.04 (standard), $0.17 (hd)

**Implementation Notes**:
- Function code stored in `agents.function_code` column (longtext)
- Sandbox whitelist: `['axios', 'crypto', 'url']` via `ctx.require()`
- Infrastructure services (`ctx.deliverables`, `ctx.assets`) provided for database operations ONLY
- NO business logic in services - all provider-specific code in function

---

### 5. image-generator-google (Function Agent)
**Type**: `function`
**Purpose**: Generate images using Google Imagen 4 Fast (latest, released 2025)

**Configuration**:
```yaml
metadata:
  name: image-generator-google
  displayName: Google Image Generator
  type: function

configuration:
  function:
    timeout_ms: 120000
    code: |
      // FULL IMPLEMENTATION - Self-contained Google Imagen agent
      async function handler(input, ctx) {
        const axios = ctx.require('axios');
        const crypto = ctx.require('crypto');

        const prompt = input.prompt || input.userMessage || '';
        if (!prompt.trim()) throw new Error('prompt required');

        const count = Math.max(1, Math.min(input.count || 1, 4));
        const projectId = ctx.process.env.GOOGLE_PROJECT_ID;
        const accessToken = ctx.process.env.GOOGLE_ACCESS_TOKEN;

        if (!projectId || !accessToken) {
          throw new Error('GOOGLE_PROJECT_ID and GOOGLE_ACCESS_TOKEN required');
        }

        // Direct API call to Google Imagen 4 Fast
        const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-fast-generate-001:predict`;

        const response = await axios.post(
          endpoint,
          {
            instances: [{ prompt }],
            parameters: { sampleCount: count }
          },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            timeout: 120000
          }
        );

        // Process predictions
        const predictions = response.data?.predictions || [];
        const attachments = [];

        for (let i = 0; i < predictions.length; i++) {
          const pred = predictions[i];
          const base64 = pred.bytesBase64Encoded || pred.imageBytes || pred.data;
          if (!base64) continue;

          const buffer = Buffer.from(base64, 'base64');
          const mime = pred.mimeType || 'image/png';

          const asset = await ctx.assets.saveBuffer({
            buffer,
            mime,
            filename: `google-${Date.now()}-${i}.${mime.split('/')[1]}`,
            subpath: 'generated'
          });

          attachments.push({
            assetId: asset.id,
            url: `/assets/${asset.id}`,
            mime,
            hash: crypto.createHash('sha256').update(buffer).digest('hex'),
            altText: prompt,
            provider: 'google'
          });
        }

        // Create deliverable
        const deliverable = await ctx.deliverables.create({
          title: input.title || 'Imagen Image Set',
          content: `Generated ${attachments.length} image(s) via Google Imagen 4`,
          format: attachments[0]?.mime || 'image/png',
          type: 'image',
          attachments: { images: attachments },
          metadata: { provider: 'google', model: 'imagen-4.0-fast', prompt }
        });

        return { success: true, deliverable, images: attachments };
      }
      module.exports = handler;

  execution_capabilities:
    supports_converse: false
    supports_plan: false
    supports_build: true
```

**Pricing**: $0.04/image (all variants: standard, fast, ultra)

**Note**: Same self-contained architecture as OpenAI agent - all logic in function code

---

### 6. image-orchestrator (Orchestrator Agent)
**Type**: `orchestrator`
**Purpose**: Compare image generation results from multiple providers
**Configuration**:
```yaml
metadata:
  name: image-orchestrator
  displayName: Image Orchestrator
  type: orchestrator

configuration:
  orchestration:
    available_orchestrations:
      - image-comparison

    available_agents:
      - image-generator-openai
      - image-generator-google

  execution_capabilities:
    supports_converse: true
    supports_plan: true
    supports_build: true
    supports_orchestration: true
```

**Capabilities**:
- Generates images using both OpenAI and Google
- Compares quality, style, text rendering
- Recommends best option based on criteria

---

### 7. finance-manager (Orchestrator Agent)
**Type**: `orchestrator`
**Purpose**: Coordinate financial analysis and reporting workflows
**Configuration**:
```yaml
metadata:
  name: finance-manager
  displayName: Finance Manager
  type: orchestrator

configuration:
  orchestration:
    available_orchestrations:
      - kpi-tracking
      - revenue-analysis
      - expense-report

    available_agents:
      - supabase-agent
      - summarizer

  execution_capabilities:
    supports_converse: true
    supports_plan: true
    supports_build: true
    supports_orchestration: true
```

**Capabilities**:
- Invokes saved orchestrations (like kpi-tracking)
- Coordinates multiple financial analyses
- Aggregates results from sub-orchestrations
- Creates comprehensive financial reports

---

## Saved Orchestrations

### 1. KPI Tracking Orchestration

**Owner**: finance-manager

### 2. Image Comparison Orchestration

**Owner**: image-orchestrator

---

## Saved Orchestration: KPI Tracking

### Definition
```yaml
metadata:
  name: kpi-tracking
  displayName: KPI Tracking Orchestration
  version: 1.0.0
  description: Fetch and analyze KPI metrics from database

orchestration:
  steps:
    - id: fetch-kpi-data
      name: Fetch KPI Data
      agent: supabase-agent
      mode: BUILD
      input:
        userMessage: |
          Fetch KPI metrics for: {{ kpi_names }}
          Time range: {{ start_date }} to {{ end_date }}
          Group by: {{ grouping }}

          Use schema introspection to understand table structure,
          then build and execute the appropriate query.
      checkpoint_after:
        question: "Review KPI query results before summarizing?"
        required: false
        options:
          - action: continue
            label: "Looks good, proceed to summary"
          - action: retry
            label: "Retry with different parameters"
            allows_modification: true
          - action: abort
            label: "Stop orchestration"
      output_mapping:
        query_results: "$.content.deliverable.content"

    - id: summarize-results
      name: Summarize KPIs
      agent: summarizer
      mode: BUILD
      depends_on: [fetch-kpi-data]
      input:
        userMessage: |
          Analyze these KPI results and provide:
          - Key metrics summary
          - Trends and patterns
          - Recommendations
        context:
          data: "{{ steps.fetch-kpi-data.query_results }}"
          kpis: "{{ kpi_names }}"
      output_mapping:
        summary: "$.content.deliverable.content"

  parameters:
    - name: kpi_names
      type: string[]
      required: true
      description: "Names of KPIs to track"

    - name: start_date
      type: date
      required: true
      description: "Start date for KPI tracking"

    - name: end_date
      type: date
      required: true
      description: "End date for KPI tracking"

    - name: grouping
      type: string
      required: false
      default: "day"
      enum: ["day", "week", "month"]
      description: "Time grouping for results"

  error_handling:
    on_step_failure:
      retry_count: 2
      notify_human: true
      allow_skip: false
```

### Example Invocation

**From finance-manager orchestrator:**
```typescript
const result = await this.orchestrationService.executeOrchestration({
  orchestrationName: 'kpi-tracking',
  parameters: {
    kpi_names: ['revenue', 'expenses', 'profit_margin'],
    start_date: '2024-10-01',
    end_date: '2024-12-31',
    grouping: 'month'
  },
  conversationId: 'conv-123',
  parentOrchestrationRunId: 'orch-parent-456'
});
```

**Execution Flow:**
1. **Orchestration Starts**: Create orchestration_run
2. **Step 1 - fetch-kpi-data**:
   - Creates conversation with supabase-agent (conversation_id: conv-step1)
   - Agent introspects schema, builds & executes query
   - Returns deliverable with query results
   - **Checkpoint**: "Review KPI query results?" (optional)
     - Human can: continue, retry with changes, or abort
3. **Step 2 - summarize-results**:
   - Creates conversation with summarizer (conversation_id: conv-step2)
   - Receives Step 1's deliverable as input
   - Analyzes data and creates summary
   - Returns deliverable with KPI summary
4. **Completion**: Orchestration aggregates results, returns to finance-manager

**Key Architectural Point**: Each step creates its own conversation with the agent. The conversation tracks tasks, can produce plans, and creates deliverables - all existing infrastructure is reused!

**Progress Updates** (via webhook and SSE):
- "Orchestration started: kpi-tracking"
- "Step 1/2: Fetching KPI data (conversation: conv-step1)"
- "Step 1 completed: Query executed, 90 rows returned"
- "Checkpoint: Review KPI query results?"
- "Human approved, continuing..."
- "Step 2/2: Summarizing results (conversation: conv-step2)"
- "Step 2 completed: Summary generated"
- "Orchestration completed successfully"

---

## Saved Orchestration: Image Comparison

### Definition
```yaml
metadata:
  name: image-comparison
  displayName: Image Comparison Orchestration
  version: 1.0.0
  description: Generate images using both OpenAI and Google, then compare results
  owner: image-orchestrator

orchestration:
  steps:
    - id: generate-openai
      name: Generate with OpenAI
      agent: image-generator-openai
      mode: BUILD
      input:
        userMessage: "{{ prompt }}"
      output_mapping:
        openai_image_url: "$.content.deliverable.content"

    - id: generate-google
      name: Generate with Google
      agent: image-generator-google
      mode: BUILD
      input:
        userMessage: "{{ prompt }}"
      output_mapping:
        google_image_base64: "$.content.deliverable.content"

    - id: compare-results
      name: Compare Images
      agent: image-orchestrator
      mode: CONVERSE
      depends_on: [generate-openai, generate-google]
      input:
        userMessage: |
          Compare these two generated images and provide:
          - Quality assessment for each
          - Text rendering accuracy
          - Style and aesthetic comparison
          - Recommendation for best option
        context:
          prompt: "{{ prompt }}"
          openai_image: "{{ steps.generate-openai.openai_image_url }}"
          google_image: "{{ steps.generate-google.google_image_base64 }}"
      output_mapping:
        comparison: "$.content.message"

  parameters:
    - name: prompt
      type: string
      required: true
      description: "Image generation prompt"

  error_handling:
    on_step_failure:
      - retry_count: 1
      - notify_human: false
      - allow_skip: true
```

### Example Invocation

**From image-orchestrator:**
```typescript
const result = await this.orchestrationService.executeOrchestration({
  orchestrationName: 'image-comparison',
  parameters: {
    prompt: 'A futuristic city with flying cars at sunset'
  },
  conversationId: 'conv-456'
});
```

**Execution Flow:**
1. **Plan Creation**: Generate plan with 3 steps
2. **Step 1 & 2 (Parallel)**: Generate images from both providers simultaneously
3. **Step 3**: Analyze and compare results
4. **Completion**: Return comparison analysis

**Progress Updates** (via webhook and SSE):
- "Orchestration started: image-comparison"
- "Step 1/3: Generating with OpenAI" (parallel)
- "Step 2/3: Generating with Google" (parallel)
- "Steps 1-2 completed: Both images generated"
- "Step 3/3: Comparing results"
- "Step 3 completed: Comparison analysis ready"
- "Orchestration completed successfully"

---

## Agent Perfection Strategy

### Overview

As we build and refine agents, we need a strategy for iterating on agent configurations while maintaining system stability. This strategy evolves based on the project phase.

### Phase-Based Approach

#### Phase 1: Early Development (Current → Agent Runners Complete)
**Strategy**: Delete-and-recreate migrations

**When to use**: Now through Phase 5 of implementation (first 8-10 weeks)

**Migration Template**:
```sql
-- Migration: YYYYMMDDNNNN_update_{agent_slug}_v{version}.sql
-- Example: 202510150001_update_supabase_agent_v1_1.sql

BEGIN;

-- 1. Validation: Check for active dependencies
DO $$
DECLARE
  active_tasks INT;
BEGIN
  SELECT COUNT(*) INTO active_tasks
  FROM tasks t
  JOIN agents a ON t.agent_id = a.id
  WHERE a.slug = 'supabase-agent'
    AND a.organization_slug = 'global'
    AND t.status IN ('pending', 'running');

  IF active_tasks > 0 THEN
    RAISE NOTICE 'Warning: % active tasks will lose agent reference', active_tasks;
    -- Optional: RAISE EXCEPTION to prevent deploy during active work
  END IF;
END $$;

-- 2. Backup old version (optional, for rollback)
-- Note: Requires agent_archive table (see Future Enhancement section)
INSERT INTO public.agent_archive (agent_data, archived_at)
SELECT row_to_json(agents.*), NOW()
FROM public.agents
WHERE slug = 'supabase-agent'
  AND organization_slug = 'global';

-- 3. Delete old version
DELETE FROM public.agents
WHERE slug = 'supabase-agent'
  AND organization_slug = 'global';

-- 4. Insert perfected version
INSERT INTO public.agents (
  organization_slug,
  slug,
  display_name,
  description,
  agent_type,
  mode_profile,
  version,
  status,
  yaml,
  config
) VALUES (
  'global',
  'supabase-agent',
  'Supabase Database Agent',
  'Interact with Supabase database using multiple MCP tools',
  'tool',
  'full_cycle',
  '1.1.0', -- Always increment version!
  'active',
  $config$...perfect YAML config...$config$,
  $config$...perfect JSON config...$config$::jsonb
);

COMMIT;
```

**Benefits**:
- ✅ Fast iteration during development
- ✅ Simple and predictable
- ✅ Atomic transactions (all-or-nothing)
- ✅ Clear version tracking

**Trade-offs**:
- ⚠️ Destroys agent history
- ⚠️ May break references from active tasks/conversations
- ⚠️ Not suitable for production with active users

---

#### Phase 2: Pre-Production Testing (Phase 6-7)
**Strategy**: Upsert with version tracking

**When to use**: When you have test data worth preserving

**Migration Template**:
```sql
-- Migration: 202510200001_update_supabase_agent_v2.sql

BEGIN;

-- Upsert pattern with version check
INSERT INTO public.agents (
  organization_slug,
  slug,
  display_name,
  version,
  agent_type,
  config,
  updated_at
) VALUES (
  'global',
  'supabase-agent',
  'Supabase Database Agent',
  '2.0.0', -- Major version bump
  'tool',
  $config$...improved config...$config$::jsonb,
  NOW()
)
ON CONFLICT (organization_slug, slug)
DO UPDATE SET
  config = EXCLUDED.config,
  version = EXCLUDED.version,
  updated_at = EXCLUDED.updated_at,
  yaml = EXCLUDED.yaml
WHERE
  -- Only update if newer version (semantic versioning)
  agents.version < EXCLUDED.version;

COMMIT;
```

**Benefits**:
- ✅ Preserves conversations/tasks linked to agent
- ✅ Version tracking (can audit "what version ran this task?")
- ✅ Safer for testing environments with valuable data
- ✅ Supports semantic versioning

**Trade-offs**:
- ⚠️ More complex than delete-and-recreate
- ⚠️ Requires careful version comparison logic

---

#### Phase 3: Production (Post-Launch)
**Strategy**: Versioned agents as separate entities

**When to use**: When you need zero-downtime deployments and rollback capability

**Migration Template**:
```sql
-- Migration: 202511010001_add_supabase_agent_v3.sql

BEGIN;

-- Step 1: Create NEW version alongside old version
INSERT INTO public.agents (
  organization_slug,
  slug, -- Different slug for new version
  display_name,
  version,
  agent_type,
  config,
  status
) VALUES (
  'global',
  'supabase-agent-v3', -- Versioned slug
  'Supabase Database Agent v3',
  '3.0.0',
  'tool',
  $config$...new config with breaking changes...$config$::jsonb,
  'beta' -- Not active yet, available for testing
);

-- Step 2: (Later migration) Promote v3 to primary
UPDATE public.agents
SET status = 'deprecated'
WHERE slug = 'supabase-agent'
  AND organization_slug = 'global';

UPDATE public.agents
SET slug = 'supabase-agent', -- Take over primary slug
    status = 'active'
WHERE slug = 'supabase-agent-v3'
  AND organization_slug = 'global';

-- Step 3: (Optional) Archive old version
UPDATE public.agents
SET slug = 'supabase-agent-v2-archived',
    status = 'archived'
WHERE slug = 'supabase-agent-v2'
  AND organization_slug = 'global';

COMMIT;
```

**Benefits**:
- ✅ Zero downtime (old version keeps working)
- ✅ A/B testing capability (can route some traffic to v3)
- ✅ Easy rollback (just flip status flags)
- ✅ Full audit trail of agent evolution
- ✅ Can run multiple versions simultaneously

**Trade-offs**:
- ⚠️ More complex orchestration logic
- ⚠️ Requires careful slug management
- ⚠️ Database stores multiple versions (higher storage)

---

### Migration Naming Convention

**Format**: `YYYYMMDDNNNN_operation_agent_slug_version.sql`

**Examples**:
- `202510150001_create_supabase_agent_v1.sql` - Initial creation
- `202510180001_update_supabase_agent_v1_1.sql` - Patch update
- `202510200001_update_supabase_agent_v2.sql` - Major update
- `202510250001_deprecate_supabase_agent_v1.sql` - Deprecation
- `202511010001_create_marketing_swarm_v1.sql` - New agent

**Semantic Versioning**:
- `1.0.0` → `1.0.1` - Bug fix, config tweak
- `1.0.1` → `1.1.0` - New capability, backward compatible
- `1.1.0` → `2.0.0` - Breaking change, new architecture

---

### Validation Best Practices

**Include validation in every agent migration**:

```sql
-- Validate configuration structure
DO $$
DECLARE
  agent_config jsonb;
BEGIN
  SELECT config INTO agent_config
  FROM agents
  WHERE slug = 'supabase-agent'
    AND organization_slug = 'global';

  -- Check required fields
  IF NOT (agent_config ? 'configuration') THEN
    RAISE EXCEPTION 'Missing configuration field';
  END IF;

  -- Validate agent-type-specific fields
  IF agent_config->>'type' = 'tool' THEN
    IF NOT (agent_config->'configuration' ? 'mcp') THEN
      RAISE EXCEPTION 'Tool agent missing MCP configuration';
    END IF;

    IF jsonb_array_length(
      agent_config->'configuration'->'mcp'->'tools'
    ) < 1 THEN
      RAISE EXCEPTION 'Tool agent has no MCP tools configured';
    END IF;
  END IF;

  RAISE NOTICE 'Agent configuration validated successfully';
END $$;
```

---

### Future Enhancement: Agent Archive & Version Tables

For comprehensive version tracking and backup capability (not needed for Phase 1-5):

```sql
-- Optional: Archive table for rollback capability
-- Referenced in Phase 1 migration template (Step 2)
CREATE TABLE IF NOT EXISTS public.agent_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_data JSONB NOT NULL, -- Full agent record as JSON
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by UUID,
  reason TEXT
);

CREATE INDEX idx_agent_archive_archived_at ON public.agent_archive(archived_at);
CREATE INDEX idx_agent_archive_slug ON public.agent_archive((agent_data->>'slug'));

COMMENT ON TABLE public.agent_archive IS 'Backup of deleted agents for rollback and audit';

---

-- Version history table for production-grade tracking
CREATE TABLE IF NOT EXISTS public.agent_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  config JSONB NOT NULL,
  yaml TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  notes TEXT,
  migration_file TEXT,

  UNIQUE(agent_id, version)
);

CREATE INDEX idx_agent_versions_agent_id ON public.agent_versions(agent_id);
CREATE INDEX idx_agent_versions_created_at ON public.agent_versions(created_at DESC);

COMMENT ON TABLE public.agent_versions IS 'Full history of agent configuration changes';

-- Automatically track version history on agent updates
CREATE OR REPLACE FUNCTION public.record_agent_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.agent_versions (
    agent_id,
    version,
    config,
    yaml,
    notes,
    created_at
  ) VALUES (
    NEW.id,
    NEW.version,
    NEW.config,
    NEW.yaml,
    'Automatic version tracking',
    NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_version_history
  AFTER UPDATE ON public.agents
  FOR EACH ROW
  WHEN (OLD.version IS DISTINCT FROM NEW.version)
  EXECUTE FUNCTION public.record_agent_version();
```

**Benefits**:
- **agent_archive**: Simple rollback by restoring JSON snapshot
- **agent_versions**: Full history of all config changes linked to agent_id
- Link tasks/conversations to specific agent version
- Time-travel debugging ("what config was active when this task ran?")
- Audit trail for compliance
- Automatic tracking via trigger

---

### Recommended Strategy Timeline

| Phase | Weeks | Strategy | Rationale |
|-------|-------|----------|-----------|
| **Phase 1-3** (Core + Streaming) | 1-4 | Delete-and-recreate | Fast iteration, no production data |
| **Phase 4-5** (Agents + E2E) | 5-10 | Delete-and-recreate | Still building, agents changing rapidly |
| **Phase 6-7** (Sub-orch + UI) | 11-15 | Upsert with versioning | Test data worth preserving |
| **Phase 8-10** (Production prep) | 16-20+ | Versioned entities | Zero downtime, rollback capability |

---

## Database Schema Updates

### orchestration_definitions
```sql
CREATE TABLE orchestration_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_agent_slug TEXT NOT NULL, -- The manager/orchestrator who owns this orchestration
  organization_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  description TEXT,
  definition JSONB NOT NULL, -- The orchestration YAML/JSON
  status TEXT NOT NULL DEFAULT 'active', -- active, deprecated, archived
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,

  UNIQUE(owner_agent_slug, organization_slug, name, version)
);

CREATE INDEX idx_orchestration_defs_owner ON orchestration_definitions(owner_agent_slug, organization_slug);
CREATE INDEX idx_orchestration_defs_org_name ON orchestration_definitions(organization_slug, name);
```

### orchestration_runs
```sql
CREATE TABLE orchestration_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orchestration_definition_id UUID REFERENCES orchestration_definitions(id),
  orchestration_name TEXT NOT NULL,
  conversation_id UUID REFERENCES conversations(id),
  parent_orchestration_run_id UUID REFERENCES orchestration_runs(id), -- For sub-orchestrations
  status TEXT NOT NULL, -- planning, approval_pending, running, checkpoint, completed, failed, aborted
  current_step_id TEXT,
  parameters JSONB, -- Input parameters
  plan JSONB, -- Generated execution plan
  results JSONB, -- Final results
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_orchestration_runs_conv ON orchestration_runs(conversation_id);
CREATE INDEX idx_orchestration_runs_parent ON orchestration_runs(parent_orchestration_run_id);
CREATE INDEX idx_orchestration_runs_status ON orchestration_runs(status);
```

### orchestration_steps
```sql
CREATE TABLE orchestration_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orchestration_run_id UUID NOT NULL REFERENCES orchestration_runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL, -- From orchestration definition
  step_index INTEGER NOT NULL,
  agent_slug TEXT NOT NULL,
  mode TEXT NOT NULL, -- CONVERSE, PLAN, BUILD

  -- KEY: Each step has a conversation
  conversation_id UUID REFERENCES conversations(id),

  -- Quick access to conversation artifacts
  plan_id UUID, -- From conversation (if step mode=PLAN)
  deliverable_id UUID, -- From conversation (if step mode=BUILD)

  -- Step metadata
  depends_on TEXT[], -- Step IDs this depends on
  status TEXT NOT NULL, -- pending, running, completed, failed, invalidated
  attempt_number INTEGER DEFAULT 1, -- Track retries

  -- Checkpoint decision (if step has checkpoint_after)
  checkpoint_decision JSONB, -- {decision: 'continue'|'retry'|'abort', modifications: {...}}
  checkpoint_decided_by UUID,
  checkpoint_decided_at TIMESTAMPTZ,

  -- Allow invalidation when rewinding (future feature)
  invalidated_at TIMESTAMPTZ,
  invalidated_reason TEXT,

  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(orchestration_run_id, step_id, attempt_number)
);

CREATE INDEX idx_orchestration_steps_run ON orchestration_steps(orchestration_run_id);
CREATE INDEX idx_orchestration_steps_conversation ON orchestration_steps(conversation_id);
CREATE INDEX idx_orchestration_steps_status ON orchestration_steps(status);
CREATE INDEX idx_orchestration_steps_deliverable ON orchestration_steps(deliverable_id);
```

### human_approvals (existing table, extended for orchestrations)
```sql
-- This table already exists, just documenting orchestration usage
ALTER TABLE human_approvals ADD COLUMN IF NOT EXISTS orchestration_run_id UUID REFERENCES orchestration_runs(id);
ALTER TABLE human_approvals ADD COLUMN IF NOT EXISTS orchestration_step_id UUID REFERENCES orchestration_steps(id);

CREATE INDEX IF NOT EXISTS idx_human_approvals_orch_run ON human_approvals(orchestration_run_id);
```

## Implementation Plan

### Phase 1: Core Orchestration Infrastructure (Week 1-2)
**Goal**: Build the orchestration execution engine

1. **Database Schema**
   - Create orchestration_definitions, orchestration_runs, orchestration_steps tables
   - Extend human_approvals table for orchestration checkpoints
   - Add migrations

2. **Orchestration Definition Service**
   - CRUD operations for orchestration definitions
   - Validation of orchestration YAML/JSON
   - Version management

3. **Orchestration Runner Service**
   - Extend BaseAgentRunner
   - Implement orchestration lifecycle states
   - Step execution with dependency resolution
   - A2A transport integration for sub-agent calls

4. **Orchestration State Service**
   - Track orchestration run state
   - Manage step execution order
   - Handle step output → input mapping
   - Store intermediate results

**Deliverables**:
- Database tables and migrations
- OrchestrationDefinitionService with CRUD
- OrchestrationRunnerService (extends BaseAgentRunner)
- OrchestrationStateService
- Unit tests for core services

---

### Phase 2: Human-in-the-Loop (Week 3)
**Goal**: Enable human approvals and checkpoints

1. **Checkpoint Service**
   - Create checkpoint requests
   - Link to human_approvals table
   - Process human decisions
   - Resume orchestration after approval

2. **Approval Workflow**
   - Plan approval flow
   - Execution checkpoint flow
   - Approval UI endpoints

3. **Notification System**
   - Webhook notifications for approval requests
   - SSE events for checkpoint status

**Deliverables**:
- OrchestrationCheckpointService
- Approval request/response endpoints
- Webhook/SSE integration for approvals
- Tests for approval workflows

---

### Phase 3: Progress Updates & Streaming (Week 3)
**Goal**: Real-time orchestration visibility

1. **Webhook Progress Updates**
   - Emit events to POST /webhooks/status
   - Include orchestration context in updates
   - Step progress tracking

2. **SSE Event Integration**
   - Orchestration-specific SSE events
   - Real-time step updates
   - Checkpoint notifications

3. **Orchestration Status Endpoint**
   - GET /orchestrations/:runId/status
   - Real-time status and progress
   - Step-by-step execution history

**Deliverables**:
- Webhook integration in OrchestrationRunner
- SSE events for orchestration lifecycle
- Status endpoint with full history
- Progress tracking tests

---

### Phase 4: New Agents Implementation (Week 4-5)
**Goal**: Build all 7 agents (all 5 agent types represented)

#### 4.1 summarizer (Context Agent)
- Create agent definition YAML
- Configure prompt for data analysis and summarization
- Test summary generation with sample data
- **Tests**: Unit tests with various data formats

#### 4.2 marketing-swarm (API Agent)
- Create agent definition YAML
- Configure n8n webhook endpoint
- Test workflow execution
- Validate webhook progress updates
- **Tests**: Integration tests with n8n workflow

#### 4.3 supabase-agent (Tool Agent)
- Create agent definition YAML
- Configure MCP supabase server with multiple tools:
  - supabase_query, supabase_insert, supabase_update, supabase_delete
  - supabase_rpc, supabase_schema_introspect
- Implement SQL validation (block dangerous operations)
- Test schema introspection + query building + execution
- **Tests**: Integration tests with Supabase

#### 4.4 image-generator-openai (Function Agent)
- Create agent definition YAML
- Implement GPT-Image-1 API integration (latest model, April 2025)
- Configure pricing tiers (low/standard/hd)
- Test image generation
- **Tests**: Integration tests with OpenAI API

#### 4.5 image-generator-google (Function Agent)
- Create agent definition YAML
- Implement Imagen 4 Fast API integration (latest model, 2025)
- Configure authentication with Google Cloud
- Test image generation
- **Tests**: Integration tests with Google API

#### 4.6 image-orchestrator (Orchestrator Agent)
- Create agent definition YAML
- Configure available orchestrations (image-comparison)
- Configure available agents (image-generator-openai, image-generator-google)
- Test orchestration invocation
- **Tests**: E2E tests with image-comparison orchestration

#### 4.7 finance-manager (Orchestrator Agent)
- Create agent definition YAML
- Configure available orchestrations (kpi-tracking)
- Configure available agents (supabase-agent, summarizer)
- Test sub-orchestration invocation
- **Tests**: E2E tests with kpi-tracking

**Deliverables**:
- 7 agent definitions (YAML)
- Agent seed scripts
- Unit + integration tests for each agent
- Documentation for each agent

---

### Phase 5: KPI Tracking Orchestration (Week 6)
**Goal**: Implement and test the complete KPI tracking flow

1. **Orchestration Definition**
   - Create kpi-tracking YAML definition
   - Define steps, dependencies, parameters
   - Add optional checkpoint

2. **End-to-End Testing**
   - Test complete flow: supabase-agent → summarizer
   - Test with finance-manager as parent
   - Test checkpoint approval flow
   - Test error handling and retry

3. **Demo Scenario**
   - "Track Q4 revenue, expenses, and profit margin"
   - Human approval of SQL query (checkpoint)
   - Generate comprehensive financial summary

4. **Documentation**
   - User guide for creating orchestrations
   - API documentation for orchestration endpoints
   - Examples of orchestration definitions

**Deliverables**:
- kpi-tracking orchestration definition
- E2E test suite
- Demo script and data
- Complete documentation

---

### Phase 6: Sub-Orchestration Support (Week 7)
**Goal**: Enable orchestrators to spawn sub-orchestrations

1. **Sub-Orchestration Invocation**
   - finance-manager → kpi-tracking flow
   - Pass parameters from parent to child
   - Return results from child to parent
   - Handle nested orchestration runs

2. **Orchestration Context**
   - Track parent-child relationships
   - Propagate conversationId and sessionId
   - Aggregate results across sub-orchestrations

3. **Testing**
   - finance-manager invokes kpi-tracking
   - Multiple sub-orchestrations in parallel
   - Error propagation from child to parent

**Deliverables**:
- Sub-orchestration invocation logic
- Parent-child tracking
- Tests for nested orchestrations
- finance-manager → kpi-tracking demo

---

### Phase 7: UI for Human Approvals (Week 8)
**Goal**: Build UI for managing orchestrations and approvals

1. **Orchestration Dashboard**
   - List running orchestrations
   - View orchestration status and progress
   - Drill into step-by-step execution

2. **Approval Interface**
   - List pending approvals
   - View plan before approval
   - Approve/reject with comments
   - View checkpoint questions and options

3. **Orchestration History**
   - View completed orchestrations
   - See all steps and results
   - Replay orchestration with different parameters

**Deliverables**:
- Orchestration dashboard UI
- Approval interface UI
- History and replay UI
- User testing and feedback

---

### Phase 8: Error Handling & Recovery (Week 9)
**Goal**: Robust error handling and recovery mechanisms

1. **Step Retry Logic**
   - Automatic retry on transient failures
   - Exponential backoff
   - Max retry configuration

2. **Error Recovery**
   - Pause on failure
   - Human decision: retry, skip, abort
   - Resume from failed step

3. **Rollback Support**
   - Mark steps as reversible
   - Automatic rollback on failure (optional)
   - Manual rollback trigger

4. **Testing**
   - Simulate failures at each step
   - Test retry logic
   - Test human intervention flows

**Deliverables**:
- Retry and error recovery logic
- Rollback mechanisms
- Comprehensive error tests
- Error handling documentation

---

### Phase 9: Performance & Optimization (Week 10)
**Goal**: Optimize orchestration performance

1. **Parallel Step Execution**
   - Execute independent steps in parallel
   - Dependency graph analysis
   - Resource pooling for concurrent steps

2. **Caching**
   - Cache step outputs for replay
   - Skip redundant step executions
   - Cache orchestration definitions

3. **Monitoring**
   - Orchestration execution metrics
   - Step duration tracking
   - Bottleneck identification

4. **Load Testing**
   - Multiple concurrent orchestrations
   - Large orchestrations (10+ steps)
   - Sub-orchestration stress testing

**Deliverables**:
- Parallel execution engine
- Caching layer
- Performance metrics
- Load test results and optimizations

---

### Phase 10: Documentation & Polish (Week 11-12)
**Goal**: Production-ready orchestration system

1. **Documentation**
   - Architecture overview
   - API reference
   - Orchestration definition guide
   - Best practices for creating orchestrations
   - Troubleshooting guide

2. **Examples**
   - Marketing campaign orchestration
   - Content pipeline orchestration
   - Data analysis orchestration
   - More financial orchestrations

3. **Polish**
   - Error message improvements
   - Validation enhancements
   - UI polish
   - Performance tuning

4. **Production Readiness**
   - Security audit
   - Load testing
   - Backup and recovery procedures
   - Monitoring and alerting

**Deliverables**:
- Complete documentation site
- Example orchestrations library
- Production deployment checklist
- Security and performance audit results

---

## Success Metrics

1. **Functional Completeness**
   - ✅ All 7 agents implemented and tested (1 context, 1 api, 1 tool, 2 function, 2 orchestrator)
   - ✅ kpi-tracking orchestration working end-to-end (2 steps)
   - ✅ image-comparison orchestration working (3 steps with parallel execution)
   - ✅ finance-manager can invoke kpi-tracking
   - ✅ image-orchestrator can invoke image-comparison
   - ✅ Human checkpoints working (continue/retry/abort)
   - ✅ SSE streaming and webhook updates working
   - ✅ Each step has its own conversation with task/plan/deliverable tracking

2. **Performance**
   - Orchestration startup time < 500ms
   - Step execution overhead < 100ms
   - Support 10+ concurrent orchestrations
   - Support orchestrations with 20+ steps

3. **Reliability**
   - 99.9% orchestration completion rate
   - Automatic recovery from transient failures
   - Zero data loss on orchestration failures

4. **Developer Experience**
   - Easy to create new orchestration definitions
   - Clear error messages and debugging info
   - Comprehensive documentation and examples
   - Simple API for invoking orchestrations

## Future Enhancements

### 1. Advanced Checkpoint Control (High Priority)
**Goal**: Give humans full control over orchestration flow at any level

**Capabilities**:
- **Rewind**: `go_back_to` earlier step, invalidate later steps
- **Restart**: Reset to step 0, start over
- **Multi-level intervention**: Control checkpoints at step, sub-orchestration, and orchestration levels
- **Cascading invalidation**: Restarting parent invalidates all children
- **Modification on retry**: Change parameters, prompts, or context when retrying

**Use Cases**:
- "The KPI query results look wrong - go back to the data fetch step"
- "This sub-orchestration failed - restart it from the beginning"
- "The entire quarterly review needs different parameters - start over"

**Database Changes**:
- `orchestration_steps.invalidated_at` - Track when steps are invalidated
- `orchestration_steps.attempt_number` - Track retries (already in schema)
- Checkpoint options include `go_back_to` and `restart` actions

**Complexity**: This is a key capability but requires careful thought around state consistency, UI complexity, and cascading effects.

---

## Testing Strategy

### Overview

This project uses a **two-agent development model** where one agent builds features and another agent (the testing specialist) handles comprehensive testing and quality assurance. Human involvement is minimized until both agents agree the system is ready for validation.

### Development Model

**Agent 1 (Builder)**: Fast-moving feature development
- Implements services, controllers, migrations
- Does NOT write or run tests (not reliable at testing)
- Focuses purely on velocity and functionality

**Agent 2 (Tester - Testing Specialist)**: Complete quality ownership
- Reviews all code changes
- Writes ALL tests (unit, integration, contract, E2E)
- Runs all tests after each builder commit
- Fixes bugs and quality issues found during testing
- Gates progress to next phase

**Human (Final Validator)**: Only tests when tester agent approves
- First involvement: Week 8-10 (Phase 5 complete)
- Tests happy path and UX only
- Final "ship it" decision

**Key Principle**: Builder never touches tests. Tester owns 100% of test infrastructure and execution.

**Development Cadence**: Builder is methodical and deep-thinking, taking time to architect solutions properly. This gives tester sufficient time to write comprehensive tests, run them, and fix bugs before builder completes the next feature. The workflow is naturally paced for high quality.

---

### Test Environment Configuration

#### Environment Variables (Already Provisioned)

**Root `.env` file** contains:
- `SUPABASE_TEST_USER` - Test account username
- `SUPABASE_TEST_PASSWORD` - Test account password
- `OPENAI_API_KEY` - OpenAI API key for image-generator-openai agent
- `GOOGLE_API_KEY` - Google API key for image-generator-google agent
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**`apps/n8n/.env` file** contains:
- `N8N_API_KEY` - n8n API key for marketing-swarm agent
- `N8N_BASE_URL` - n8n instance URL

#### Test Authentication Pattern (Standard)

**All integration/E2E tests MUST authenticate using this pattern**:

```typescript
// Test setup - authenticate as test user
beforeAll(async () => {
  const authResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      username: process.env.SUPABASE_TEST_USER,
      password: process.env.SUPABASE_TEST_PASSWORD
    });

  authToken = authResponse.body.access_token;
});

// Use authToken in subsequent requests
const response = await request(app.getHttpServer())
  .get('/orchestrations')
  .set('Authorization', `Bearer ${authToken}`);
```

#### Agent Testing with Real Services

**Context Agents** (summarizer):
- Use OPENAI_API_KEY for LLM calls
- Mock LLM responses in contract tests
- Use real API in integration tests (with rate limiting)

**API Agents** (marketing-swarm):
- Load N8N_API_KEY from `apps/n8n/.env`
- Use N8N_BASE_URL for workflow execution
- Mock n8n responses in contract tests

**Tool Agents** (supabase-agent):
- Use SUPABASE_SERVICE_ROLE_KEY for database operations
- Test database operations use `public.test_*` tables
- Clean up test data in `afterEach` hooks

**Function Agents** (image-generator-openai, image-generator-google):
- Use OPENAI_API_KEY and GOOGLE_API_KEY respectively
- Mock image generation in contract tests (no API calls)
- Use real APIs in integration tests (budget: 10 images/day)

**Orchestrator Agents** (image-orchestrator, finance-manager):
- Compose other agents, use their respective keys
- E2E tests use real agent network
- Mock agent responses for unit tests

#### Test Data Management

**Database Fixtures**:
- `global` organization created by seed script
- Test agents seeded during Phase 0 environment setup
- Test orchestration definitions seeded during Phase 4-5

**Test Isolation**:
- Each test suite creates unique test data with UUID prefixes
- `afterEach` hooks clean up test data
- Integration tests use transactions (rollback after test)

#### CI Environment Variables

All environment variables from root `.env` are available in CI (GitHub Actions secrets).
Tests run in CI will have identical configuration to local development.

---

### Testing Tiers

#### Tier 1: Unit Tests (Tester Only)
**Who**: Tester agent exclusively
**When**: After each builder commit
**Block deployment**: YES

**What we test**:
- Service methods in isolation
- State transitions (orchestration status, step status)
- Dependency resolution logic
- Edge cases (circular dependencies, missing agents, invalid config)
- Error handling

**Example**:
```typescript
describe('OrchestrationStateService', () => {
  it('resolves step dependencies correctly', () => {
    const steps = [
      { id: 'step1', depends_on: [] },
      { id: 'step2', depends_on: ['step1'] },
      { id: 'step3', depends_on: ['step1', 'step2'] }
    ];
    const order = service.resolveExecutionOrder(steps);
    expect(order).toEqual(['step1', 'step2', 'step3']);
  });

  it('detects circular dependencies', () => {
    const steps = [
      { id: 'step1', depends_on: ['step2'] },
      { id: 'step2', depends_on: ['step1'] }
    ];
    expect(() => service.resolveExecutionOrder(steps))
      .toThrow('Circular dependency detected');
  });
});
```

**Coverage targets**:
- Core services: 80%+ coverage
- Complex logic: 95%+ coverage
- Simple DTOs/interfaces: Skip

---

#### Tier 2: Integration Tests (Tester Drives)
**Who**: Tester agent
**When**: End of each phase (1-2 week cycles)
**Block deployment**: YES for phase boundaries

**What we test**:
- Service interactions (OrchestrationRunner → ConversationsService → TasksService)
- Database operations (repositories + transactions)
- Agent runner registry resolution
- Plans → Deliverables → Versioning flow
- SSE event emission

**Example**:
```typescript
describe('OrchestrationRunner Integration', () => {
  let module: TestingModule;
  let orchestrationRunner: OrchestrationRunnerService;
  let conversationsService: ConversationsService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [/* real modules */]
    }).compile();
    // Real services, test database
  });

  it('creates a conversation for each step', async () => {
    const orchestration = createTestOrchestration({
      steps: [
        { id: 'fetch', agent: 'supabase-agent', mode: 'BUILD' },
        { id: 'summarize', agent: 'summarizer', mode: 'BUILD' }
      ]
    });

    const result = await orchestrationRunner.execute(orchestration);

    expect(result.steps[0].conversation_id).toBeDefined();
    expect(result.steps[1].conversation_id).toBeDefined();

    const conv1 = await conversationsService.findById(
      result.steps[0].conversation_id
    );
    expect(conv1.agent_slug).toBe('supabase-agent');
  });
});
```

---

#### Tier 3: Contract Tests (Tester Drives)
**Who**: Tester agent
**When**: Phase 1-2 (before agents built)
**Block deployment**: YES for agent interactions

**What we test**:
- A2A JSON-RPC protocol compliance
- Request/response format validation
- Error format standardization
- Agent capability contracts

**Example**:
```typescript
describe('A2A Protocol Contract', () => {
  it('supabase-agent accepts valid BUILD request', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 'test-123',
      method: 'agent.execute',
      params: {
        organizationSlug: 'global',
        agentSlug: 'supabase-agent',
        mode: 'BUILD',
        userMessage: 'Fetch monthly revenue',
        conversationId: 'conv-456'
      }
    };

    const response = await a2aController.execute(request);

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'test-123',
      result: {
        status: 'success',
        mode: 'BUILD',
        content: {
          deliverable: expect.any(Object)
        }
      }
    });
  });

  it('returns standard error for invalid agent', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 'test-789',
      method: 'agent.execute',
      params: {
        agentSlug: 'nonexistent-agent',
        mode: 'BUILD'
      }
    };

    const response = await a2aController.execute(request);

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'test-789',
      error: {
        code: -32603,
        message: expect.stringContaining('agent')
      }
    });
  });
});
```

---

#### Tier 4: E2E Orchestration Tests (Tester Drives)
**Who**: Tester agent
**When**: Phase 5 (after agents + orchestrations built)
**Block deployment**: YES for production

**What we test**:
- Complete orchestration flows end-to-end
- Real database, real agents, real LLM calls (or mocked)
- Human checkpoint flow (pause → decision → resume)
- SSE streaming events
- Webhook progress updates
- Error recovery and retry logic

**Example**:
```typescript
describe('KPI Tracking Orchestration E2E', () => {
  it('completes full flow: supabase-agent → summarizer', async () => {
    const result = await orchestrationService.execute({
      orchestrationName: 'kpi-tracking',
      parameters: {
        kpi_names: ['revenue', 'expenses'],
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        grouping: 'month'
      },
      conversationId: 'test-conv-123'
    });

    // Verify orchestration completed
    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(2);

    // Verify step 1: supabase-agent executed
    const step1 = result.steps[0];
    expect(step1.agent_slug).toBe('supabase-agent');
    expect(step1.status).toBe('completed');
    expect(step1.conversation_id).toBeDefined();
    expect(step1.deliverable_id).toBeDefined();

    // Verify step 2: summarizer received step 1 output
    const step2 = result.steps[1];
    expect(step2.agent_slug).toBe('summarizer');
    expect(step2.status).toBe('completed');
    expect(step2.conversation_id).toBeDefined();

    // Verify deliverable exists
    const deliverable = await deliverablesService.findById(
      step2.deliverable_id
    );
    expect(deliverable.content).toContain('revenue');
    expect(deliverable.content).toContain('expenses');
  });

  it('handles human checkpoint approval', async () => {
    const orchestration = createTestOrchestration({
      steps: [
        {
          id: 'fetch',
          agent: 'supabase-agent',
          checkpoint_after: {
            question: 'Review query results?',
            options: [
              { action: 'continue' },
              { action: 'retry' },
              { action: 'abort' }
            ]
          }
        }
      ]
    });

    // Start orchestration
    const run = await orchestrationService.execute(orchestration);

    // Should pause at checkpoint
    expect(run.status).toBe('checkpoint');
    expect(run.current_step_id).toBe('fetch');

    // Simulate human approval
    await orchestrationService.handleCheckpointDecision({
      orchestrationRunId: run.id,
      stepId: 'fetch',
      decision: 'continue'
    });

    // Should resume and complete
    const updated = await orchestrationService.getRunStatus(run.id);
    expect(updated.status).toBe('completed');
  });

  it('retries failed step with exponential backoff', async () => {
    // Mock agent to fail twice, succeed on third attempt
    jest.spyOn(supabaseAgent, 'execute')
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ status: 'success', data: [] });

    const result = await orchestrationService.execute({
      orchestrationName: 'kpi-tracking',
      parameters: { /* ... */ }
    });

    expect(result.status).toBe('completed');
    expect(result.steps[0].attempt_number).toBe(3);
    expect(supabaseAgent.execute).toHaveBeenCalledTimes(3);
  });
});
```

---

#### Tier 5: Smoke Tests (Automated Gate)
**Who**: Runs automatically pre-deploy
**When**: Every deployment to staging/production
**Block deployment**: YES

**What we test**:
- All 7 agents exist in database
- All agents have valid config (required fields present)
- Can instantiate each agent runner from registry
- Database migrations applied successfully
- Critical services can be initialized

**Implementation**:
```bash
# Run smoke tests
npm run agents:smoke

# Validates:
# ✅ Database connection
# ✅ All agents present
# ✅ Agent config valid
# ✅ Runners instantiate
# ✅ No missing migrations
```

---

#### Tier 6: Human Validation (Final Gate)
**Who**: Human (you)
**When**: Only when tester agent says "Ready for human validation"
**Block deployment**: Final gate

**What you test**:
1. **Happy Path**: Run kpi-tracking orchestration manually
   - Submit request via API or UI
   - Verify progress updates appear in real-time
   - Check final deliverable is correct

2. **Checkpoint UX**: Test human approval flow
   - Does the checkpoint question make sense?
   - Are the options clear (continue/retry/abort)?
   - Does the system resume correctly after approval?

3. **SSE Streaming**: Watch progress events in browser
   - Do updates appear in real-time?
   - Are progress percentages accurate?
   - Do error messages display correctly?

4. **Error Messages**: Trigger a few errors
   - Are they helpful and actionable?
   - Do they suggest next steps?

**What you DON'T test**:
- ❌ Edge cases (tester covers)
- ❌ Error recovery (tester covers)
- ❌ Unit-level logic (builder + tester cover)
- ❌ Performance (load testing is automated)

---

### Testing Workflow by Phase

#### Phase 1-3: Core Infrastructure (Weeks 1-4)
```
Builder: Writes OrchestrationRunnerService
  ↓
Builder: Commits code (no tests)
  ↓
Tester: Reviews code
  ↓
Tester: Writes unit tests (happy path + edge cases)
  ↓
Tester: Runs tests → 3 failures found
  ↓
Tester: Analyzes failures, creates bug report
  ↓
Builder: Fixes 3 bugs
  ↓
Tester: Writes integration tests
  ↓
Tester: Runs all tests → 1 integration test fails
  ↓
Tester: Fixes the integration bug directly
  ↓
Tester: All tests passing ✅
  ↓
Tester: "Core engine ready for agents"
```

**Human involvement**: NONE

**Note**: Tester may fix bugs directly if faster than round-tripping to builder.

---

#### Phase 4: Agents (Weeks 5-10)
```
Builder: Implements summarizer agent
  ↓
Builder: Commits code (no tests)
  ↓
Tester: Writes contract tests for summarizer
  ↓
Tester: Runs tests → 2 failures
  ↓
Tester: Fixes both bugs
  ↓
Tester: Tests pass ✅
  ↓
Builder: Implements marketing-swarm
  ↓
Builder: Commits code (no tests)
  ↓
Tester: Writes contract + integration tests
  ↓
Tester: Runs tests → passes ✅
  ↓
... repeat for all 7 agents ...
  ↓
Tester: "All 7 agents passing contracts" ✅
```

**Human involvement**: NONE

**Note**: Builder just writes code and moves on. Tester handles everything else.

---

#### Phase 5: E2E Orchestrations (Weeks 11-12)
```
Builder: Implements kpi-tracking orchestration
  ↓
Builder: Commits code (no tests)
  ↓
Tester: Writes E2E test for kpi-tracking
  ↓
Tester: Runs test → fails (3 bugs found)
  ↓
Tester: Fixes all 3 bugs directly
  ↓
Tester: Re-runs test → passes ✅
  ↓
Builder: Implements image-comparison orchestration
  ↓
Builder: Commits code (no tests)
  ↓
Tester: Writes E2E test for image-comparison
  ↓
Tester: Runs test → passes ✅
  ↓
Tester: Runs full test suite (unit + integration + E2E)
  ↓
Tester: All 100+ tests passing ✅
  ↓
Tester: "Ready for human validation" 🚦
  ↓
HUMAN: Tests happy path (15-30 minutes)
  ↓
HUMAN: "Ship Phase 5" or "Issues found"
```

**Human involvement**: FIRST TIME (Week 12)

**Note**: Tester fixes most bugs directly to maintain velocity. Only complex architectural issues go back to builder.

---

### Quality Gates

#### Gate 1: Phase 1-3 Complete
**Criteria**:
- ✅ 80%+ unit test coverage on core services
- ✅ Integration tests pass for OrchestrationRunner
- ✅ Database migrations applied
- ✅ Can create/read orchestration_definitions
- ✅ Zero critical bugs

**Tester Decision**: "Core engine ready for agents"

---

#### Gate 2: Phase 4 Complete
**Criteria**:
- ✅ All 7 agents have contract tests
- ✅ All agents pass smoke tests
- ✅ Agent runner registry resolves all types
- ✅ Mock orchestrations can instantiate agents
- ✅ Zero critical bugs

**Tester Decision**: "All agents ready for orchestration"

---

#### Gate 3: Phase 5 Complete
**Criteria**:
- ✅ kpi-tracking E2E test passes
- ✅ image-comparison E2E test passes
- ✅ Checkpoint system tested
- ✅ SSE events tested
- ✅ Webhook progress updates tested
- ✅ Zero critical bugs

**Tester Decision**: "Ready for human validation" → **HUMAN TESTS**

---

#### Gate 4: Production Ready
**Criteria**:
- ✅ All Phase 6-10 tests passing
- ✅ Error recovery tested
- ✅ Load testing passed (10+ concurrent orchestrations)
- ✅ Human approved

**Human Decision**: "Ship it"

---

### Test Infrastructure

#### Required Tooling

**Already have**:
- Jest test framework
- NestJS Testing Module
- Mock-based unit testing

**Need to add** (Phase 1):
```typescript
// Test database helpers
export function setupTestDatabase() {
  // Use test Supabase instance or in-memory DB
}

export function cleanupTestDatabase() {
  // Truncate tables between tests
}

// Test agent factory
export function createMockAgent(type: AgentType, overrides = {}) {
  return {
    organization_slug: 'test-org',
    slug: `test-${type}-agent`,
    agent_type: type,
    config: { /* valid config */ },
    ...overrides
  };
}

// Orchestration test helpers
export function createTestOrchestration(definition: Partial<Orchestration>) {
  return {
    name: 'test-orchestration',
    steps: [],
    parameters: [],
    ...definition
  };
}

// SSE test helpers
export function captureSSEEvents(eventEmitter: EventEmitter2) {
  const events = [];
  eventEmitter.on('orchestration.**', (event) => events.push(event));
  return events;
}
```

**Need to add** (Phase 5):
- Test data fixtures for agents
- Testcontainers for real Supabase (optional)
- Async test helpers for streaming
- Checkpoint simulation utilities

---

### Code Quality & Standards Enforcement

**Tester Agent Responsibility**: Enforce all coding standards, architectural patterns, and codebase rules.

#### Standards Enforced

**1. Transport Types Usage**
- ✅ All DTOs must implement interfaces from `@orchestrator-ai/transport-types`
- ✅ Use `TaskResponse`, `TaskResponsePayload` for agent responses
- ✅ Re-export shared types: `export { TaskResponse, TaskResponsePayload }`
- ❌ No duplicate type definitions that exist in transport-types

**Example (Correct)**:
```typescript
import { TaskResponse, TaskResponsePayload } from '@orchestrator-ai/transport-types';

export { TaskResponse, TaskResponsePayload };

export class TaskResponseDto implements TaskResponse {
  // Implementation
}
```

---

**2. File Structure & Organization**
```
src/
├── module-name/
│   ├── dto/              # Data transfer objects
│   │   └── index.ts      # Re-export all DTOs
│   ├── interfaces/       # TypeScript interfaces
│   ├── services/         # Business logic
│   ├── controllers/      # API endpoints
│   ├── repositories/     # Database access
│   ├── types/            # Type definitions
│   └── module-name.module.ts
```

**Rules**:
- ✅ DTOs in `dto/` folder with index.ts export
- ✅ Services in `services/` folder
- ✅ Repositories in `repositories/` folder
- ✅ Controllers at module root or in `controllers/`
- ❌ No mixing concerns (e.g., business logic in controllers)

---

**3. Naming Conventions**

**Files**:
- Services: `orchestration-runner.service.ts`
- DTOs: `task-response.dto.ts`
- Controllers: `agent2agent.controller.ts`
- Repositories: `agents.repository.ts`
- Interfaces: `agent-definition.interface.ts`

**Classes**:
- Services: `OrchestrationRunnerService`
- DTOs: `TaskResponseDto`
- Controllers: `Agent2AgentController`
- Interfaces: `AgentDefinition`

**Methods**:
- Use camelCase: `executeOrchestration()`, `handleCheckpoint()`
- Prefix boolean getters: `isValid()`, `hasCompleted()`

---

**4. NestJS Patterns**

**Dependency Injection**:
```typescript
@Injectable()
export class OrchestrationRunnerService {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly tasksService: TasksService,
    @Inject(forwardRef(() => PlansService))
    private readonly plansService: PlansService,
  ) {}
}
```

**Module Structure**:
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Agent, OrchestrationRun])],
  controllers: [OrchestrationController],
  providers: [
    OrchestrationRunnerService,
    OrchestrationStateService,
  ],
  exports: [OrchestrationRunnerService],
})
export class OrchestrationModule {}
```

---

**5. Error Handling**

**Use proper error classes**:
```typescript
// Good
throw new BadRequestException('Invalid orchestration definition');
throw new NotFoundException(`Agent ${slug} not found`);

// Bad
throw new Error('Something went wrong');
```

**Service-level error handling**:
```typescript
async executeOrchestration(id: string) {
  try {
    // Business logic
  } catch (error) {
    this.logger.error(`Orchestration ${id} failed: ${error.message}`);
    throw new InternalServerErrorException(
      `Failed to execute orchestration: ${error.message}`
    );
  }
}
```

---

**6. Database Patterns**

**Repository pattern** (TypeORM):
```typescript
@Injectable()
export class OrchestrationRunsRepository {
  constructor(
    @InjectRepository(OrchestrationRun)
    private readonly repo: Repository<OrchestrationRun>,
  ) {}

  async findById(id: string): Promise<OrchestrationRun | null> {
    return this.repo.findOne({ where: { id } });
  }
}
```

**Service uses repository**:
```typescript
@Injectable()
export class OrchestrationService {
  constructor(
    private readonly orchestrationRunsRepo: OrchestrationRunsRepository,
  ) {}
}
```

---

**7. TypeScript Best Practices**

**Strong typing**:
```typescript
// Good
interface OrchestrationStep {
  id: string;
  agent_slug: string;
  mode: AgentTaskMode;
  depends_on: string[];
}

// Bad
const step: any = { ... };
```

**Avoid any**:
```typescript
// Good
function processResult(result: TaskResponseDto): void

// Bad
function processResult(result: any): void
```

---

**8. Import Organization**

**Order**:
1. External libraries (NestJS, TypeORM)
2. Transport types (`@orchestrator-ai/transport-types`)
3. Internal modules (relative imports)
4. Interfaces and types
5. DTOs

**Example**:
```typescript
// 1. External
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

// 2. Transport types
import { TaskResponse } from '@orchestrator-ai/transport-types';

// 3. Internal modules
import { ConversationsService } from '../conversations/conversations.service';

// 4. Interfaces
import { AgentDefinition } from './interfaces/agent-definition.interface';

// 5. DTOs
import { TaskResponseDto } from './dto/task-response.dto';
```

---

### Code Review Checklist

**Tester reviews every builder commit for**:

**Architecture**:
- [ ] Follows NestJS module structure
- [ ] Services in correct folders
- [ ] DTOs properly organized
- [ ] Repository pattern used for database

**Transport Types**:
- [ ] Uses `@orchestrator-ai/transport-types` where applicable
- [ ] No duplicate type definitions
- [ ] Properly implements interfaces

**Code Quality**:
- [ ] No `any` types (use proper interfaces)
- [ ] Error handling with NestJS exceptions
- [ ] Proper dependency injection
- [ ] Follows naming conventions

**Testing**:
- [ ] Code is testable (no tight coupling)
- [ ] Services use dependency injection
- [ ] Methods have single responsibility

**If violations found**:
1. Tester documents violations
2. Tester fixes simple violations (naming, imports)
3. Builder re-does complex violations (architectural issues)

---

### Responsibilities Matrix

| Responsibility | Builder Agent | Tester Agent | Human |
|-----------|--------------|-------------|-------|
| **Writing Code** | ✅ All features | ⚠️ Bug fixes only | ❌ Never |
| **Code Standards** | ❌ Never | ✅ Enforces all | ⚠️ Final review |
| **Architecture Review** | ❌ Never | ✅ All code | ⚠️ Major decisions |
| **Unit Tests** | ❌ Never | ✅ Writes all | ❌ Never |
| **Integration Tests** | ❌ Never | ✅ Writes all | ❌ Never |
| **Contract Tests** | ❌ Never | ✅ Writes all | ❌ Never |
| **E2E Tests** | ❌ Never | ✅ Writes all | ❌ Never |
| **Smoke Tests** | ❌ Never | ✅ Maintains | ❌ Never |
| **Running Tests** | ❌ Never | ✅ All tests | ⚠️ Manual only |
| **Bug Fixes** | ⚠️ Major issues | ✅ Most bugs | ⚠️ Critical only |
| **Quality Gates** | ❌ Never | ✅ All gates | ✅ Final gate |

**Key**: Builder writes features. Tester enforces standards, tests everything, and fixes most bugs. Human only involved at final gates.

---

### Success Metrics

**Velocity**:
- Builder moves 3x faster (zero test writing or debugging)
- Tester handles 100% of quality assurance independently
- Human involvement delayed until Week 8-10 (vs Week 1 traditionally)
- Phases can be completed in parallel (core + agents)

**Quality**:
- <5 human-found bugs per phase
- Zero production incidents from orchestration engine
- 100% of integration points tested before human sees system

**Coverage**:
- 80%+ unit test coverage
- 100% of agent types have contract tests
- 100% of orchestrations have E2E tests
- All quality gates passed before human validation

---

## Future Enhancements

### 1. Advanced Checkpoint Control (High Priority)
- If/else branches based on step outputs
- Switch statements for routing
- Dynamic step selection

### 3. Loops and Iteration
- Iterate over collections
- While loops with conditions
- Map/reduce patterns

### 4. External Orchestrations
- Invoke orchestrations from other systems
- REST API for orchestration management
- Webhook callbacks for completion

### 5. Visual Orchestration Builder
- Drag-and-drop orchestration designer
- Visual dependency graph
- Real-time execution visualization

### 6. Orchestration Marketplace
- Share orchestrations across organizations
- Community-contributed orchestrations
- Version control and forking

### 7. Organic Hierarchy Growth
**Goal**: Start simple, grow complexity as needed

**Small Business** (flat, no orchestrators):
- Individual agents work independently
- No coordination needed

**Mid-Sized Business** (manager layer):
- Add `finance-manager` (orchestrator)
- Add `marketing-manager` (orchestrator)
- Managers coordinate their domain teams

**Large Enterprise** (executive layer):
- Add `vp-marketing` (orchestrator) - manages marketing-manager
- Add `cfo-agent` (orchestrator) - manages finance-manager
- Add `ceo-agent` (orchestrator) - manages VPs
- Cross-functional orchestrations flow through hierarchy

## Conclusion

This orchestration system will be the cornerstone of the agent platform, enabling complex multi-agent workflows with human oversight.

**Key Architectural Decisions**:
1. **Orchestrator as Agent Type**: Orchestrators are managers that coordinate teams, not just a capability flag
2. **Steps Have Conversations**: Each step creates a conversation with its agent, reusing all existing infrastructure for tasks, plans, and deliverables
3. **Orchestration Ownership**: Orchestrations belong to their manager agent (finance-manager owns kpi-tracking)
4. **Single Tool Agent**: One supabase-agent with multiple MCP tools, not separate builder + executor
5. **Latest Image Models**: GPT-Image-1 (OpenAI, $0.01-$0.17) and Imagen 4 (Google, $0.04)

**Two Capstone Examples**:
1. **KPI Tracking**: Sequential 2-step flow (supabase-agent → summarizer) demonstrating data pipeline
2. **Image Comparison**: Parallel 3-step flow (both image generators → orchestrator analysis) demonstrating multi-provider coordination

By implementing all agent types (1 context, 1 api, 1 tool, 2 function, 2 orchestrator) and proving the orchestration pattern works with the "steps have conversations" architecture, we'll have a complete, production-ready agent platform capable of handling sophisticated business workflows with full human-in-the-loop control.
