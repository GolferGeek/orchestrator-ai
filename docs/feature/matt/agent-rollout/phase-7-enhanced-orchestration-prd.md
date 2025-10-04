# Phase 6: Orchestration System

## Overview
Implement full orchestration capabilities allowing orchestrator agents to coordinate multiple specialist agents through multi-step workflows with planning, execution, monitoring, and nested sub-orchestrations.

## Goals
- Enable orchestrators to delegate tasks to specialist agents
- Support workflow planning and approval
- Execute multi-step orchestrations with status tracking
- Save successful orchestrations as reusable recipes/capabilities
- Support nested sub-orchestrations (orchestrators calling orchestrators)
- Provide rich UI for orchestration monitoring and control

## Prerequisites
- ✅ Phase 0-4 complete (cleanup, context agents, conversation-only, API agents, migration)
- ✅ Phase 5 complete (image generation & deliverables working)
- ✅ All agent types working (context, conversation-only, API, function, image)
- ✅ Agent hierarchy system working (orchestrators know their teams)
- ✅ Database schema supports all agent types

## Scope

### In Scope
1. **Orchestrator Agent Execution**
   - Create orchestration plans (multi-step workflows)
   - Approve/edit plans before execution
   - Execute orchestration runs (step-by-step)
   - Monitor real-time progress
   - Handle errors and retries

2. **Orchestration Planning**
   - Conversation-based plan generation
   - Manual plan editing
   - Plan approval workflow
   - Plan versioning

3. **Orchestration Execution**
   - Step-by-step execution
   - Delegate to specialist agents
   - Aggregate results
   - Handle async operations
   - Error handling and recovery

4. **Recipes/Capabilities**
   - Save orchestrations as reusable recipes
   - Parameterize recipes (template variables)
   - Recipe library per orchestrator
   - Instantiate recipe with user parameters

5. **Nested Sub-Orchestrations**
   - Orchestrators can delegate to other orchestrators
   - Hierarchical execution (CEO → Marketing → Specialists)
   - Parent-child run relationships
   - Aggregate nested results

6. **Orchestration UI Panel**
   - Replace deliverables panel for orchestrators
   - Show plan structure
   - Show run progress
   - Show step statuses
   - Show results from each specialist
   - Drill down into sub-orchestrations

7. **Backend Services**
   - Agent2AgentOrchestratorService
   - Agent2AgentRecipesService
   - OrchestrationPlansRepository
   - OrchestrationRunsRepository

8. **Frontend Services**
   - agent2AgentOrchestrationService
   - agent2AgentRecipesService

### Out of Scope
- Visual workflow designer (text-based plans for now)
- Parallel step execution (sequential only in v1)
- Conditional branching (linear workflows only)
- Human-in-the-loop mid-orchestration (approval before run only)
- Advanced scheduling/cron
- Workflow marketplace

## Success Criteria

### User Can:
1. ✅ Select Hiverarchy orchestrator
2. ✅ Converse: "Create a blog post about AI with social media promotion"
3. ✅ Orchestrator generates workflow plan:
   - Step 1: content_strategist → strategy
   - Step 2: blog_post_writer → blog post
   - Step 3: social_media_manager → social posts
4. ✅ View plan in orchestration panel
5. ✅ Edit plan (add/remove/reorder steps)
6. ✅ Approve plan → starts orchestration run
7. ✅ Watch real-time progress:
   - Step 1 running... completed ✅
   - Step 2 running... completed ✅
   - Step 3 running... completed ✅
8. ✅ View aggregated results from all specialists
9. ✅ Save successful orchestration as recipe
10. ✅ Reuse recipe with new parameters

### Nested Orchestration:
11. ✅ CEO orchestrator delegates to Marketing orchestrator
12. ✅ Marketing orchestrator delegates to specialists
13. ✅ Results bubble up to CEO
14. ✅ UI shows full nested structure

### Technical Requirements:
1. ✅ Orchestration plans stored in database
2. ✅ Orchestration runs tracked with status
3. ✅ Each step links to specialist task
4. ✅ Results aggregated and stored
5. ✅ Recipes stored and reusable
6. ✅ Sub-orchestrations supported (recursive)
7. ✅ Real-time updates via WebSocket

## Data Model

### Orchestration Plan
```typescript
{
  id: 'plan-123',
  conversation_id: 'conv-456',
  orchestrator_slug: 'hiverarchy_orchestrator',
  organization_slug: 'my-org',
  plan_type: 'adhoc' | 'recipe-based',
  recipe_id: null, // or 'recipe-789'

  summary: 'Create blog post with social media',

  steps: [
    {
      step_number: 1,
      type: 'agent', // or 'sub-orchestration'
      agent_slug: 'content_strategist',
      input_template: '{{user_topic}}',
      output_name: 'strategy',
      description: 'Create content strategy'
    },
    {
      step_number: 2,
      type: 'agent',
      agent_slug: 'blog_post_writer',
      input_template: 'Write blog post based on: {{steps.1.output}}',
      output_name: 'blog_post',
      description: 'Write blog post'
    },
    {
      step_number: 3,
      type: 'agent',
      agent_slug: 'social_media_manager',
      input_template: 'Create social posts for: {{steps.2.output}}',
      output_name: 'social_posts',
      description: 'Create social media posts'
    }
  ],

  parameters: {
    user_topic: 'AI trends in 2025'
  },

  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed',
  created_by: 'user-789',
  approved_by: null,
  created_at: '2025-10-03T10:00:00Z',
  updated_at: '2025-10-03T10:00:00Z'
}
```

### Orchestration Run
```typescript
{
  id: 'run-123',
  plan_id: 'plan-456',
  parent_run_id: null, // or 'run-parent' for sub-orchestrations

  conversation_id: 'conv-789',
  orchestrator_slug: 'hiverarchy_orchestrator',
  organization_slug: 'my-org',

  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused',
  current_step: 2,
  total_steps: 3,

  step_executions: [
    {
      step_number: 1,
      type: 'agent',
      agent_slug: 'content_strategist',
      task_id: 'task-111', // Links to specialist task
      sub_run_id: null,
      status: 'completed',
      started_at: '2025-10-03T10:01:00Z',
      completed_at: '2025-10-03T10:02:00Z',
      result: {
        output: 'Strategy: Focus on healthcare AI...',
        deliverable_id: 'deliv-111'
      },
      error: null
    },
    {
      step_number: 2,
      type: 'agent',
      agent_slug: 'blog_post_writer',
      task_id: 'task-222',
      sub_run_id: null,
      status: 'running',
      started_at: '2025-10-03T10:02:30Z',
      completed_at: null,
      result: null,
      error: null
    },
    {
      step_number: 3,
      type: 'agent',
      agent_slug: 'social_media_manager',
      task_id: null,
      sub_run_id: null,
      status: 'pending',
      started_at: null,
      completed_at: null,
      result: null,
      error: null
    }
  ],

  started_at: '2025-10-03T10:01:00Z',
  completed_at: null,
  created_at: '2025-10-03T10:00:00Z',
  updated_at: '2025-10-03T10:02:30Z'
}
```

### Orchestration Recipe
```typescript
{
  id: 'recipe-123',
  orchestrator_slug: 'hiverarchy_orchestrator',
  organization_slug: 'my-org', // or null for system recipes

  name: 'Blog Post Production Pipeline',
  description: 'Full workflow from idea to published post with social',

  parameters: [
    {
      name: 'topic',
      description: 'Blog post topic',
      type: 'string',
      required: true
    },
    {
      name: 'target_audience',
      description: 'Target audience',
      type: 'string',
      required: false,
      default: 'general'
    }
  ],

  template_steps: [
    {
      step_number: 1,
      type: 'agent',
      agent_slug: 'content_strategist',
      input_template: 'Create strategy for {{topic}} targeting {{target_audience}}',
      output_name: 'strategy',
      description: 'Create content strategy'
    },
    {
      step_number: 2,
      type: 'agent',
      agent_slug: 'blog_post_writer',
      input_template: 'Write blog post based on: {{steps.1.output}}',
      output_name: 'blog_post',
      description: 'Write blog post'
    },
    {
      step_number: 3,
      type: 'agent',
      agent_slug: 'social_media_manager',
      input_template: 'Create social posts for: {{steps.2.output}}',
      output_name: 'social_posts',
      description: 'Create social media posts'
    }
  ],

  is_system: false, // true for built-in recipes
  visibility: 'private' | 'organization' | 'public',

  created_by: 'user-789',
  created_at: '2025-10-03T10:00:00Z',
  updated_at: '2025-10-03T10:00:00Z'
}
```

### Sub-Orchestration Example
```typescript
{
  id: 'run-ceo',
  plan_id: 'plan-ceo',
  parent_run_id: null,
  orchestrator_slug: 'ceo_orchestrator',

  step_executions: [
    {
      step_number: 1,
      type: 'sub-orchestration', // ← Nested orchestration
      orchestrator_slug: 'legal_orchestrator',
      sub_run_id: 'run-legal', // ← Links to child run
      status: 'completed',
      result: {
        output: 'Legal review complete',
        sub_orchestration_summary: {
          steps_completed: 3,
          deliverables: ['deliv-1', 'deliv-2']
        }
      }
    },
    {
      step_number: 2,
      type: 'sub-orchestration',
      orchestrator_slug: 'marketing_orchestrator',
      sub_run_id: 'run-marketing',
      status: 'running',
      result: null
    }
  ]
}
```

## Implementation Tasks

### Key Architectural Decision: Mode-Based Routing for Orchestration

**Same pattern as Context Agents (Phase 1):**
- ❌ **NO separate Orchestration controller** with its own endpoints
- ✅ **Tasks API handles orchestration** via mode-based routing

**Orchestration modes through Tasks API:**
```typescript
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'orchestrate',  // NEW mode for orchestrator agents
  message: 'Create a blog post with social media promotion',
  action?: 'plan' | 'execute' | 'refine' | 'pause' | 'resume'
}
```

**Tasks Service Mode Routing:**
```typescript
switch (mode) {
  case 'plan':        → PlansAdapter → PlansService
  case 'build':       → DeliverablesAdapter → DeliverablesService
  case 'orchestrate': → OrchestrationAdapter → OrchestrationService  // NEW
  case 'converse':    → No artifacts
}
```

**Orchestration Actions:**
- `action: 'plan'` → Generate orchestration plan (multi-step workflow)
- `action: 'execute'` → Execute approved plan (run orchestration)
- `action: 'refine'` → Refine/edit existing plan
- `action: 'pause'` → Pause running orchestration
- `action: 'resume'` → Resume paused orchestration

**Benefits:**
- ✅ Consistent with Phase 1 architecture
- ✅ Single entry point (Tasks API)
- ✅ Mode determines behavior (plan, build, orchestrate)
- ✅ Orchestration is internal implementation detail
- ✅ Clean A2A protocol compliance

**Read endpoints for UI:**
```typescript
GET /api/agent2agent/conversations/:id/orchestration/plan
GET /api/agent2agent/conversations/:id/orchestration/runs
GET /api/agent2agent/conversations/:id/orchestration/runs/:runId
GET /api/agent2agent/conversations/:id/orchestration/recipes
```

### Phase 6.1: Database Schema (2 days)

1. **Create orchestration_plans table**
```sql
CREATE TABLE orchestration_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  orchestrator_slug TEXT NOT NULL,
  organization_slug TEXT,
  plan_type TEXT NOT NULL, -- 'adhoc' | 'recipe-based'
  recipe_id UUID REFERENCES orchestration_recipes(id),
  summary TEXT,
  steps JSONB NOT NULL,
  parameters JSONB,
  status TEXT NOT NULL,
  created_by UUID,
  approved_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

2. **Create orchestration_runs table**
```sql
CREATE TABLE orchestration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES orchestration_plans(id),
  parent_run_id UUID REFERENCES orchestration_runs(id),
  conversation_id UUID NOT NULL,
  orchestrator_slug TEXT NOT NULL,
  organization_slug TEXT,
  status TEXT NOT NULL,
  current_step INTEGER,
  total_steps INTEGER,
  step_executions JSONB NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

3. **Create orchestration_recipes table**
```sql
CREATE TABLE orchestration_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestrator_slug TEXT NOT NULL,
  organization_slug TEXT,
  name TEXT NOT NULL,
  description TEXT,
  parameters JSONB,
  template_steps JSONB NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  visibility TEXT NOT NULL, -- 'private' | 'organization' | 'public'
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Phase 6.2: Backend Services (5 days)

4. **Create OrchestrationPlansRepository**
   - createPlan()
   - getPlan(id)
   - updatePlan(id, updates)
   - listPlans(conversationId)
   - approvePlan(id, userId)

5. **Create OrchestrationRunsRepository**
   - createRun(planId)
   - getRun(id)
   - updateRunStatus(id, status)
   - updateStepStatus(runId, stepNumber, status, result)
   - listRuns(conversationId)

6. **Create OrchestrationRecipesRepository**
   - createRecipe(recipe)
   - getRecipe(id)
   - listRecipes(orchestratorSlug)
   - updateRecipe(id, updates)
   - deleteRecipe(id)

7. **Create Agent2AgentOrchestratorService**
```typescript
@Injectable()
export class Agent2AgentOrchestratorService {
  // Plan management
  async createPlanFromConversation(conversationId, userMessage): Promise<Plan>
  async createPlanFromRecipe(recipeId, parameters): Promise<Plan>
  async updatePlan(planId, updates): Promise<Plan>
  async approvePlan(planId, userId): Promise<Plan>

  // Run execution
  async startRun(planId): Promise<Run>
  async executeNextStep(runId): Promise<StepResult>
  async pauseRun(runId): Promise<Run>
  async resumeRun(runId): Promise<Run>
  async cancelRun(runId): Promise<Run>

  // Sub-orchestration support
  async executeSubOrchestration(runId, stepNumber): Promise<Run>

  // Status & monitoring
  async getRunStatus(runId, depth: number): Promise<Run>
  async getRunProgress(runId): Promise<Progress>
}
```

8. **Create Agent2AgentRecipesService**
```typescript
@Injectable()
export class Agent2AgentRecipesService {
  async createRecipe(recipe): Promise<Recipe>
  async listRecipes(orchestratorSlug, organizationSlug): Promise<Recipe[]>
  async getRecipe(recipeId): Promise<Recipe>
  async updateRecipe(recipeId, updates): Promise<Recipe>
  async deleteRecipe(recipeId): Promise<void>
  async saveRunAsRecipe(runId, name, description): Promise<Recipe>
}
```

9. **Update Agent2AgentController**
   - Add orchestration endpoints
   - Plan CRUD
   - Run lifecycle
   - Recipe management

### Phase 6.3: Orchestration Execution Engine (4 days)

10. **Implement step execution logic**
```typescript
async executeStep(run: Run, stepNumber: number) {
  const step = run.plan.steps[stepNumber];

  if (step.type === 'agent') {
    // Execute specialist agent
    return this.executeAgentStep(run, step);
  }

  if (step.type === 'sub-orchestration') {
    // Execute nested orchestration
    return this.executeSubOrchestrationStep(run, step);
  }
}
```

11. **Implement input templating**
   - Replace {{user_topic}} with parameters
   - Replace {{steps.1.output}} with previous step results
   - Support nested variable references

12. **Implement result aggregation**
   - Collect outputs from each step
   - Make available to subsequent steps
   - Create final orchestration result

13. **Implement error handling**
   - Step failure → pause orchestration
   - Retry logic (optional)
   - Error notifications

14. **Implement WebSocket updates**
   - Real-time step status updates
   - Progress percentage
   - Step result streaming

### Phase 6.4: Frontend Services (3 days)

15. **Create agent2AgentOrchestrationService**
```typescript
// Plans
async createPlan(conversationId, userMessage)
async createPlanFromRecipe(recipeId, parameters)
async getPlan(planId)
async updatePlan(planId, updates)
async approvePlan(planId)
async listPlans(conversationId)

// Runs
async startRun(planId)
async getRunStatus(runId)
async pauseRun(runId)
async resumeRun(runId)
async cancelRun(runId)
async listRuns(conversationId)
```

16. **Create agent2AgentRecipesService**
```typescript
async listRecipes(orchestratorSlug)
async getRecipe(recipeId)
async createRecipe(recipe)
async updateRecipe(recipeId, updates)
async deleteRecipe(recipeId)
async saveAsRecipe(runId, name, description)
```

### Phase 6.5: Frontend UI Components (5 days)

17. **Create OrchestrationPane.vue**
   - Replaces DeliverablePane for orchestrators
   - Tabs: Plans | Runs | Recipes
   - Shows current plan or run

18. **Create PlanView.vue**
   - Display plan structure
   - List of steps with agents
   - Edit button → PlanEditor
   - Approve button

19. **Create PlanEditor.vue**
   - Add/remove steps
   - Reorder steps
   - Change agent assignments
   - Edit input templates
   - Save changes

20. **Create RunView.vue**
   - Show run progress (step 2 of 5)
   - List steps with status (✅ completed, 🔄 running, ⏳ pending)
   - Expand step to see specialist result
   - Drill down into sub-orchestrations
   - Pause/Resume/Cancel buttons

21. **Create RecipeLibrary.vue**
   - List available recipes for orchestrator
   - "Use Recipe" button → parameter form
   - Create plan from recipe

22. **Create RecipeForm.vue**
   - Fill in recipe parameters
   - Preview plan before creating
   - Create plan button

23. **Update ConversationView.vue**
   - Detect orchestrator agent
   - Show OrchestrationPane instead of DeliverablesPane
   - Handle orchestration modes

### Phase 6.6: Testing & Refinement (3 days)

24. **Create test orchestrator**
   - Simple 3-step workflow
   - Test all orchestration features

25. **Test nested orchestrations**
   - CEO → Marketing → Specialists
   - Verify results bubble up

26. **Test recipe system**
   - Create recipe
   - Instantiate with parameters
   - Verify plan created correctly

27. **Load testing**
   - Multiple concurrent orchestrations
   - Long-running orchestrations
   - Error scenarios

28. **UI/UX refinement**
   - Polish OrchestrationPane
   - Smooth animations
   - Error messaging
   - Loading states

## Testing Strategy

### Automated Tests
1. **Unit Tests**
   - Agent2AgentOrchestratorService methods
   - Input templating logic
   - Result aggregation
   - Error handling

2. **Integration Tests**
   - Create plan → execute run → complete
   - Nested orchestration flow
   - Recipe instantiation

3. **E2E Tests**
   - Full orchestration from UI
   - Multi-step workflow
   - Sub-orchestration

### Manual Testing Checklist
- [ ] Create adhoc plan via conversation
- [ ] Edit plan in UI
- [ ] Approve and start run
- [ ] Watch real-time progress
- [ ] Verify step results
- [ ] Save successful run as recipe
- [ ] Create new plan from recipe
- [ ] Execute recipe-based plan
- [ ] Test nested orchestration (CEO → Marketing)
- [ ] Test error handling (specialist fails)
- [ ] Test pause/resume
- [ ] Test cancel

## Example Workflows

### Simple Orchestration
```
Hiverarchy Orchestrator: "Create blog post about AI"

Plan:
1. content_strategist: Create strategy
2. blog_post_writer: Write post
3. social_media_manager: Create social posts

Execute → Results:
- Strategy document
- Blog post
- 3 social media posts
```

### Nested Orchestration
```
CEO Orchestrator: "Launch new product"

Plan:
1. Legal Orchestrator (sub-orchestration)
   - trademark_specialist
   - compliance_specialist
2. Marketing Orchestrator (sub-orchestration)
   - content_strategist
   - blog_post_writer
   - social_media_manager
3. Engineering Orchestrator (sub-orchestration)
   - infrastructure_specialist
   - qa_specialist

Execute → Hierarchical results
```

## Risks & Mitigations

### Risk: Orchestration execution too slow
**Mitigation:** Async execution, progress updates, set user expectations

### Risk: Step failures break entire orchestration
**Mitigation:** Graceful error handling, pause on error, retry capability

### Risk: Nested orchestrations too complex to debug
**Mitigation:** Detailed logging, UI drill-down, execution history

### Risk: Recipe system too rigid
**Mitigation:** Allow editing after instantiation, flexible parameters

## Timeline Estimate
- Phase 6.1 (Database): 2 days
- Phase 6.2 (Backend Services): 5 days
- Phase 6.3 (Execution Engine): 4 days
- Phase 6.4 (Frontend Services): 3 days
- Phase 6.5 (Frontend UI): 5 days
- Phase 6.6 (Testing): 3 days
- **Total: 22 days (~1 month)**

## Dependencies
- Phases 1-5 complete ✅
- Agent hierarchy working ✅
- All agent types functional ✅

## Definition of Done
- [ ] Database schema created
- [ ] Backend services implemented
- [ ] Orchestration execution working
- [ ] Frontend services created
- [ ] OrchestrationPane UI complete
- [ ] Can create and execute simple orchestrations
- [ ] Can create and execute nested orchestrations
- [ ] Recipe system working
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Code reviewed and merged
- [ ] Deployed to production

## Future Enhancements (Post-Phase 6)
- Parallel step execution
- Conditional branching
- Human-in-the-loop approvals mid-run
- Visual workflow designer
- Orchestration analytics
- Workflow marketplace
- Version control for recipes
- A/B testing for orchestrations

## Success Metrics
- Users can create multi-step workflows
- Orchestrations complete successfully
- Recipe reuse rate
- Time saved vs manual coordination
- User satisfaction scores

## Notes
This is the culmination of all previous phases. Orchestration is the killer feature that differentiates the platform - the ability to coordinate multiple AI agents to accomplish complex tasks automatically.
