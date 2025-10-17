# Project to Orchestration Migration - Comprehensive Audit Report

**Date:** 2025-10-17
**Purpose:** Complete audit of all project/projectStep references to prepare for migration to orchestrations
**Status:** Analysis Complete - NO CHANGES MADE

---

## Executive Summary

The codebase currently has **BOTH** Projects and Orchestrations implemented:
- **Projects** = Legacy implementation (older, simpler multi-step coordination)
- **Orchestrations** = New implementation (robust, feature-rich workflow system)

**Key Finding:** Projects should be REMOVED and fully replaced with Orchestrations everywhere.

---

## 1. Complete Code Inventory

### 1.1 Backend (API) - Projects Module

#### Database Tables (Supabase)
Located in: Core Platform Schema (`public` schema)

**`projects` table:**
```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  name TEXT,
  description TEXT,
  plan_json JSONB,
  status TEXT DEFAULT 'planning',
  current_step_id TEXT,
  error_details JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  parent_project_id UUID,        -- Hierarchical support
  hierarchy_level INTEGER DEFAULT 0,
  subproject_count INTEGER DEFAULT 0
);
```

**`project_steps` table:**
```sql
CREATE TABLE public.project_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  step_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  step_name TEXT NOT NULL,
  agent_name TEXT,
  prompt TEXT,
  dependencies TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  result JSONB,
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

**Status Values:**
- Projects: `planning`, `pending_approval`, `running`, `paused_for_approval`, `paused_on_error`, `completed`, `aborted`
- Steps: `pending`, `running`, `completed`, `failed`, `pending_approval`, `skipped`

#### Backend Services & Controllers

**Files:**
1. `/apps/api/src/agent2agent/projects/projects.service.ts` (916 lines)
   - Full CRUD operations for projects
   - Hierarchical project support (parent/child relationships)
   - Project recovery operations (resume, retry, fork, abort)
   - Analytics and metrics
   - WebSocket event emission (deprecated, now uses SSE)

2. `/apps/api/src/agent2agent/projects/projects.controller.ts` (525 lines)
   - REST API endpoints under `/projects`
   - User authentication and authorization
   - All CRUD operations exposed
   - Analytics endpoints

3. `/apps/api/src/agent2agent/projects/projects.module.ts` (13 lines)
   - Module definition
   - Imports: SupabaseModule, WebSocketModule
   - Exports: ProjectsService

**Key Methods in ProjectsService:**
- `createProject()` - Create new project with optional parent
- `getUserProjects()` - Get all projects for user with pagination/filtering
- `getProject()` - Get single project by ID
- `updateProject()` - Update project fields
- `deleteProject()` - Delete project
- `getProjectSteps()` - Get all steps for a project
- `getSubprojects()` - Get child projects
- `getProjectHistory()` - Get project timeline
- `resumeProject()`, `retryProject()`, `forkProject()`, `abortProject()` - Recovery operations
- `getProjectMetrics()` - Analytics for date range
- `getProjectAnalytics()` - Performance metrics for specific project
- `getProjectHierarchyPath()` - Breadcrumb trail
- `hasProjectAccess()` - Authorization check

**API Routes:**
```
GET    /projects                    - List user projects
POST   /projects                    - Create project
GET    /projects/:id                - Get project details
PUT    /projects/:id                - Update project
DELETE /projects/:id                - Delete project
GET    /projects/:id/steps          - Get project steps
GET    /projects/:id/subprojects    - Get child projects
GET    /projects/:id/history        - Get project history
POST   /projects/:id/resume         - Resume paused project
POST   /projects/:id/retry          - Retry failed project
POST   /projects/:id/fork           - Fork project
POST   /projects/:id/abort          - Abort project
GET    /projects/analytics/metrics  - Get analytics metrics
GET    /projects/:id/hierarchy-path - Get hierarchy breadcrumb
GET    /projects/:id/analytics      - Get project analytics
```

#### Type Definitions

**File:** `/apps/api/src/agent2agent/orchestration/orchestration.types.ts` (471 lines)
- **IMPORTANT:** This file contains BOTH Project AND Orchestration types!
- Types defined:
  - `Project` interface
  - `ProjectStep` interface
  - `ProjectStatus` type
  - `ProjectStepStatus` type
  - `PlanDefinition` interface
  - Plus full Orchestration types

### 1.2 Backend (API) - Orchestrations Module

#### Database Tables
Located in: Public schema

**`orchestration_definitions` table:**
- Agent orchestration templates/recipes
- Multi-tenant (organization_slug)
- Versioning support

**`orchestration_runs` table:**
- Actual orchestration executions
- Linked to conversations
- Status tracking
- Error handling

**`orchestration_steps` table:**
- Individual step executions within runs
- Agent delegation tracking
- Result storage

**`agent_orchestrations` table:**
- Links agents to their orchestrations
- Organization-scoped
- Status management

#### Orchestration Services
Over 30+ service files including:
- `orchestration-runner.service.ts`
- `orchestration-execution.service.ts`
- `orchestration-state.service.ts`
- `orchestration-dashboard.service.ts`
- `orchestration-checkpoint.service.ts`
- `orchestration-metrics.service.ts`
- `orchestration-progress-events.service.ts`
And many more...

**Repositories:**
- `agent-orchestrations.repository.ts`
- `orchestration-runs.repository.ts`
- `orchestration-definitions.repository.ts`
- `orchestration-steps.repository.ts`

### 1.3 Frontend (Web) - Projects

#### Services

**File:** `/apps/web/src/services/projectsService.ts` (324 lines)

```typescript
export interface Project {
  id: string;
  conversationId: string;
  name?: string;
  description?: string;
  planJson?: any;
  status: 'planning' | 'running' | 'paused_for_human' | 'paused_on_error' | 'completed' | 'aborted';
  currentStepId?: string;
  errorDetails?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  // Hierarchical
  parentProjectId?: string;
  hierarchyLevel?: number;
  subprojectCount?: number;
}

export interface ProjectStep {
  id: string;
  projectId: string;
  stepId: string;
  stepIndex: number;
  stepType: 'agent_step' | 'human_approval';
  stepName: string;
  agentName?: string;
  prompt?: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  errorDetails?: any;
  startedAt?: string;
  completedAt?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}
```

**Methods in ProjectsService:**
- All CRUD operations
- Hierarchical methods (getSubprojects, getProjectTree, moveProject)
- Analytics methods
- Recovery operations

#### Views/Pages

1. **`/apps/web/src/views/ProjectsListPage.vue`** (784 lines)
   - Lists all projects for user
   - Supports flat and hierarchical view modes
   - Filtering by status (all, active, completed, paused)
   - Sorting options
   - Create/delete/pause/resume operations
   - Hierarchical visualization with indentation

2. **`/apps/web/src/views/ProjectDetailPage.vue`** (943 lines)
   - Full project details view
   - Project overview section
   - Progress statistics
   - Task/step management
   - Subprojects section
   - Project actions (chat, add task, export)
   - Hierarchy breadcrumb navigation

3. **`/apps/web/src/views/NewProjectPage.vue`** (496 lines)
   - Create new project form
   - Orchestrator selection
   - Template selection
   - Priority and target date
   - Hierarchical support (parent project selection)
   - Auto-start option

#### Components

**Files containing project references:**
- `/apps/web/src/components/ProjectDisplay.vue`
- `/apps/web/src/components/NewDeliverableDialog.vue`
- `/apps/web/src/components/TwoPaneConversationView.vue`

#### Router

**File:** `/apps/web/src/router/index.ts`

```typescript
{
  path: 'projects',
  name: 'Projects',
  component: () => import('../views/ProjectsListPage.vue'),
  meta: { requiresAuth: true }
},
{
  path: 'projects/new',
  name: 'NewProject',
  component: () => import('../views/NewProjectPage.vue'),
  meta: { requiresAuth: true }
},
{
  path: 'projects/:id',
  name: 'ProjectDetail',
  component: () => import('../views/ProjectDetailPage.vue'),
  meta: { requiresAuth: true }
},
```

### 1.4 Deliverables Connection

**File:** `/apps/api/src/agent2agent/deliverables/entities/deliverable.entity.ts`

```typescript
export class Deliverable {
  id!: string;
  userId!: string;
  conversationId?: string;
  projectStepId?: string;  // ← LINKS TO PROJECT_STEPS
  agentName?: string;
  title!: string;
  type?: DeliverableType;
  createdAt!: Date;
  updatedAt!: Date;
  currentVersion?: DeliverableVersion;
  versions?: DeliverableVersion[];
}
```

**Issue:** Deliverables currently reference `projectStepId`, not orchestration steps.

---

## 2. Current Project Domain Analysis

### 2.1 What Projects Contain

**Core Attributes:**
- `id` - UUID identifier
- `conversation_id` - Links to conversation
- `name` - Project name
- `description` - Project description
- `plan_json` - Structured plan with steps (PlanDefinition)
- `status` - Current project state
- `current_step_id` - Active step reference
- `error_details` - Error information
- `metadata` - Flexible additional data

**Hierarchical Attributes:**
- `parent_project_id` - Parent project UUID
- `hierarchy_level` - Depth in tree (0 = root)
- `subproject_count` - Number of child projects

**Timestamps:**
- `created_at`
- `updated_at`

### 2.2 What ProjectSteps Contain

**Core Attributes:**
- `id` - UUID identifier
- `project_id` - Parent project
- `step_id` - Logical step identifier
- `step_index` - Order in sequence
- `step_type` - Type of step (agent_step, human_approval)
- `step_name` - Human-readable name
- `agent_name` - Agent to execute step
- `prompt` - Instructions for step
- `dependencies` - Array of step_ids this depends on
- `status` - Current step state
- `result` - Step output
- `error_details` - Error information

**Timestamps:**
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

### 2.3 Relationships

```
User (1) ───► (many) Conversations
                │
                └──► (many) Projects
                        │
                        ├──► (many) ProjectSteps
                        │
                        └──► (many) Subprojects (self-referential)

ProjectSteps (1) ───► (many) Deliverables (via projectStepId)

Conversations (1) ───► (many) Tasks
```

### 2.4 Key Workflows

1. **Project Creation:**
   - User creates conversation with orchestrator
   - Creates project linked to conversation
   - Optional: Links to parent project (hierarchical)
   - Can use template for plan

2. **Project Execution:**
   - Project status: planning → running
   - Steps executed in dependency order
   - Each step can delegate to agent
   - Human approval steps can pause execution

3. **Project Recovery:**
   - Resume: Continue paused project
   - Retry: Restart from failed step
   - Fork: Create copy from checkpoint
   - Abort: Terminate execution

4. **Hierarchical Projects:**
   - Parent projects can have subprojects
   - Breadcrumb navigation
   - Aggregated metrics

---

## 3. Orchestrations vs Projects Comparison

| Feature | Projects | Orchestrations | Winner |
|---------|----------|----------------|--------|
| **Database Tables** | `projects`, `project_steps` | `orchestration_definitions`, `orchestration_runs`, `orchestration_steps`, `agent_orchestrations` | Orchestrations (more structured) |
| **Multi-tenancy** | No | Yes (organization_slug) | Orchestrations |
| **Versioning** | No | Yes | Orchestrations |
| **Checkpointing** | Basic | Advanced with events | Orchestrations |
| **Dashboard** | Manual construction | Built-in dashboard service | Orchestrations |
| **Metrics** | Basic analytics | Comprehensive metrics service | Orchestrations |
| **State Management** | Simple status field | Sophisticated state service | Orchestrations |
| **Progress Events** | WebSocket (deprecated) | SSE streaming + events service | Orchestrations |
| **Caching** | No | Yes (orchestration-cache.service) | Orchestrations |
| **Templates/Recipes** | Plan JSON | Orchestration definitions | Orchestrations (reusable) |
| **Human Approvals** | Basic | Dedicated repository | Orchestrations |
| **Hierarchical** | Yes (parent/child) | Not yet implemented | Projects (but could be added) |
| **Recovery Ops** | Yes (resume, retry, fork, abort) | Yes (more sophisticated) | Orchestrations |
| **Frontend Integration** | Full UI | Minimal UI | Projects (but should migrate) |
| **Testing** | Minimal | Comprehensive test suite | Orchestrations |
| **Documentation** | Basic | Extensive (orchestration-system-prd.md) | Orchestrations |

**Verdict:** Orchestrations is the superior, more mature system. Projects should be deprecated.

---

## 4. Migration Mapping

### 4.1 Table Mappings

| Projects Table | → | Orchestrations Table | Notes |
|----------------|---|---------------------|-------|
| `projects.id` | → | `orchestration_runs.id` | Direct mapping |
| `projects.conversation_id` | → | `orchestration_runs.conversation_id` | Same field |
| `projects.name` | → | `orchestration_runs.name` or `orchestration_definitions.display_name` | May need to reference definition |
| `projects.description` | → | `orchestration_definitions.description` | Move to definition |
| `projects.plan_json` | → | `orchestration_definitions.orchestration_json` | Migrate structure |
| `projects.status` | → | `orchestration_runs.status` | Map status values |
| `projects.current_step_id` | → | `orchestration_runs.current_step_id` | Same concept |
| `projects.error_details` | → | `orchestration_runs.error_details` | Same field |
| `projects.metadata` | → | `orchestration_runs.metadata` | Same field |
| `projects.parent_project_id` | → | NEW: Add to orchestration_runs | Need to implement hierarchical support |
| `projects.hierarchy_level` | → | NEW: Add to orchestration_runs | Need to implement hierarchical support |
| `projects.subproject_count` | → | NEW: Computed or cached | Need to implement hierarchical support |
| **project_steps.id** | → | **orchestration_steps.id** | Direct mapping |
| `project_steps.project_id` | → | `orchestration_steps.run_id` | Different naming |
| `project_steps.step_id` | → | `orchestration_steps.step_key` or similar | Check actual schema |
| `project_steps.step_type` | → | `orchestration_steps.step_type` | Same concept |
| `project_steps.agent_name` | → | `orchestration_steps.agent_name` | Same field |
| `project_steps.dependencies` | → | `orchestration_definitions.orchestration_json` | Dependencies in definition |
| `project_steps.status` | → | `orchestration_steps.status` | Map status values |
| `project_steps.result` | → | `orchestration_steps.result` | Same field |

### 4.2 Status Value Mappings

**Project Status:**
```typescript
// OLD (Projects)
'planning' | 'pending_approval' | 'running' | 'paused_for_approval' |
'paused_on_error' | 'completed' | 'aborted'

// NEW (Orchestrations)
'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
```

**Mapping:**
- `planning` → `pending`
- `pending_approval` → `paused` (with metadata)
- `running` → `running`
- `paused_for_approval` → `paused`
- `paused_on_error` → `failed` or `paused`
- `completed` → `completed`
- `aborted` → `cancelled`

**Step Status:**
```typescript
// OLD (ProjectSteps)
'pending' | 'running' | 'completed' | 'failed' | 'pending_approval' | 'skipped'

// NEW (OrchestrationSteps)
'pending' | 'running' | 'completed' | 'failed' | 'skipped'
```

**Mapping:**
- `pending_approval` → `pending` (with metadata)
- Others map 1:1

### 4.3 Service Method Mappings

| ProjectsService Method | → | Orchestration Equivalent | Service |
|------------------------|---|-------------------------|---------|
| `createProject()` | → | `createOrchestrationRun()` | OrchestrationRunner |
| `getUserProjects()` | → | `listUserOrchestrations()` | OrchestrationDashboard |
| `getProject()` | → | `getOrchestrationRun()` | OrchestrationRunner |
| `updateProject()` | → | `updateOrchestrationRun()` | OrchestrationRunner |
| `deleteProject()` | → | `deleteOrchestrationRun()` | OrchestrationRunner |
| `getProjectSteps()` | → | `getOrchestrationSteps()` | OrchestrationSteps |
| `resumeProject()` | → | `resumeOrchestration()` | OrchestrationRunner |
| `retryProject()` | → | `retryOrchestration()` | OrchestrationRunner |
| `abortProject()` | → | `cancelOrchestration()` | OrchestrationRunner |
| `getProjectMetrics()` | → | `getOrchestrationMetrics()` | OrchestrationMetrics |
| `getProjectAnalytics()` | → | `getOrchestrationAnalytics()` | OrchestrationDashboard |
| `getSubprojects()` | → | NEW: Implement hierarchy | Need to add |
| `getProjectHierarchyPath()` | → | NEW: Implement hierarchy | Need to add |

### 4.4 Frontend Component Mappings

| Project Component | → | Orchestration Component | Notes |
|-------------------|---|------------------------|-------|
| `ProjectsListPage.vue` | → | `OrchestrationsListPage.vue` | Create new |
| `ProjectDetailPage.vue` | → | `OrchestrationDetailPage.vue` | Create new |
| `NewProjectPage.vue` | → | `NewOrchestrationPage.vue` | Create new |
| `ProjectDisplay.vue` | → | `OrchestrationDisplay.vue` | Create new |

### 4.5 Deliverable Migration

**Current:**
```typescript
deliverable.projectStepId → project_steps.id
```

**New:**
```typescript
deliverable.orchestrationStepId → orchestration_steps.id
```

**Migration:**
1. Add new column: `orchestration_step_id UUID` to `deliverables` table
2. Create mapping: `project_steps.id → orchestration_steps.id`
3. Populate new column
4. Update all services to use new field
5. Deprecate old column
6. Eventually drop `project_step_id` column

---

## 5. Cleanup Plan

### 5.1 Order of Operations

**Phase 1: Preparation (No Breaking Changes)**
1. ✅ Complete audit (this document)
2. Add hierarchical support to Orchestrations
   - Add `parent_orchestration_run_id` to `orchestration_runs`
   - Add `hierarchy_level` to `orchestration_runs`
   - Add methods for hierarchy navigation
3. Add new `orchestration_step_id` to `deliverables` table (nullable)
4. Create frontend components for Orchestrations
   - `OrchestrationsListPage.vue`
   - `OrchestrationDetailPage.vue`
   - `NewOrchestrationPage.vue`
5. Add orchestration routes to router (parallel to projects)

**Phase 2: Migration (With Fallback)**
6. Create data migration script:
   - Migrate all `projects` → `orchestration_runs`
   - Migrate all `project_steps` → `orchestration_steps`
   - Populate `orchestration_step_id` in `deliverables`
7. Switch default UI to Orchestrations
8. Mark Projects UI as deprecated (show banner)
9. Monitor for issues
10. Fix any edge cases

**Phase 3: Cleanup (Breaking Changes)**
11. Remove Projects routes from UI
12. Remove Projects services from frontend
13. Mark backend `/projects` API as deprecated
14. Create database views for backward compatibility if needed
15. Remove frontend project components
16. Remove `projectStepId` from deliverables (after verification)
17. Drop `project_steps` table (after backup)
18. Drop `projects` table (after backup)
19. Remove Projects module from backend
20. Clean up types file (remove Project types)

### 5.2 Files to Delete

#### Backend
- `/apps/api/src/agent2agent/projects/projects.service.ts`
- `/apps/api/src/agent2agent/projects/projects.controller.ts`
- `/apps/api/src/agent2agent/projects/projects.module.ts`
- Remove Project types from `/apps/api/src/agent2agent/orchestration/orchestration.types.ts`

#### Frontend
- `/apps/web/src/services/projectsService.ts`
- `/apps/web/src/views/ProjectsListPage.vue`
- `/apps/web/src/views/ProjectDetailPage.vue`
- `/apps/web/src/views/NewProjectPage.vue`
- `/apps/web/src/components/ProjectDisplay.vue`
- Remove project routes from `/apps/web/src/router/index.ts`

#### Database
- Drop table: `project_steps`
- Drop table: `projects`
- Remove column: `deliverables.project_step_id` (after migration)

### 5.3 Files to Migrate

#### Need Major Updates
- `/apps/web/src/components/NewDeliverableDialog.vue` - Remove projectStep references
- `/apps/web/src/components/TwoPaneConversationView.vue` - Update project references
- `/apps/api/src/agent2agent/deliverables/entities/deliverable.entity.ts` - Migrate to orchestrationStepId
- `/apps/api/src/agent2agent/deliverables/deliverables.service.ts` - Update queries

#### Need Minor Updates
- `/apps/web/src/stores/analyticsStore.ts` - Update project metrics
- `/apps/web/src/services/analyticsService.ts` - Update project metrics
- Various test files referencing projects

### 5.4 Files to Rename

None - better to create new files for Orchestrations and delete old ones.

---

## 6. Database Migration Strategy

### 6.1 Add Hierarchical Support to Orchestrations

```sql
-- Add hierarchical columns to orchestration_runs
ALTER TABLE orchestration_runs
ADD COLUMN parent_orchestration_run_id UUID REFERENCES orchestration_runs(id) ON DELETE CASCADE,
ADD COLUMN hierarchy_level INTEGER DEFAULT 0,
ADD COLUMN subrun_count INTEGER DEFAULT 0;

-- Add indexes
CREATE INDEX idx_orchestration_runs_parent ON orchestration_runs(parent_orchestration_run_id);
CREATE INDEX idx_orchestration_runs_hierarchy ON orchestration_runs(hierarchy_level);

-- Add trigger to maintain subrun_count
CREATE OR REPLACE FUNCTION update_orchestration_subrun_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_orchestration_run_id IS NOT NULL THEN
    UPDATE orchestration_runs
    SET subrun_count = subrun_count + 1
    WHERE id = NEW.parent_orchestration_run_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_orchestration_run_id IS NOT NULL THEN
    UPDATE orchestration_runs
    SET subrun_count = GREATEST(subrun_count - 1, 0)
    WHERE id = OLD.parent_orchestration_run_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_orchestration_subrun_count
AFTER INSERT OR DELETE ON orchestration_runs
FOR EACH ROW EXECUTE FUNCTION update_orchestration_subrun_count();
```

### 6.2 Add Orchestration Step ID to Deliverables

```sql
-- Add new column (nullable initially)
ALTER TABLE deliverables
ADD COLUMN orchestration_step_id UUID REFERENCES orchestration_steps(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX idx_deliverables_orchestration_step ON deliverables(orchestration_step_id);

-- Later, after migration, make it NOT NULL and drop old column
-- ALTER TABLE deliverables DROP COLUMN project_step_id;
```

### 6.3 Data Migration Script

```sql
-- Create orchestration definitions from projects
INSERT INTO orchestration_definitions (
  organization_slug,
  agent_slug,
  slug,
  display_name,
  description,
  orchestration_json,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT
  NULL as organization_slug, -- Projects don't have org scope
  COALESCE(metadata->>'orchestratorName', 'ceo_orchestrator') as agent_slug,
  'migrated-project-' || id as slug,
  COALESCE(name, 'Migrated Project') as display_name,
  description,
  COALESCE(plan_json, '{}'::jsonb) as orchestration_json,
  CASE
    WHEN status IN ('completed', 'aborted') THEN 'archived'
    ELSE 'active'
  END as status,
  metadata->>'createdBy' as created_by,
  created_at,
  updated_at
FROM projects
WHERE plan_json IS NOT NULL; -- Only migrate projects with plans

-- Create orchestration runs from projects
INSERT INTO orchestration_runs (
  id, -- Keep same ID for traceability
  conversation_id,
  orchestration_definition_id, -- Need to look up
  name,
  status,
  current_step_id,
  error_details,
  metadata,
  created_at,
  updated_at,
  parent_orchestration_run_id,
  hierarchy_level
)
SELECT
  p.id,
  p.conversation_id,
  od.id as orchestration_definition_id,
  p.name,
  CASE p.status
    WHEN 'planning' THEN 'pending'
    WHEN 'pending_approval' THEN 'paused'
    WHEN 'running' THEN 'running'
    WHEN 'paused_for_approval' THEN 'paused'
    WHEN 'paused_on_error' THEN 'failed'
    WHEN 'completed' THEN 'completed'
    WHEN 'aborted' THEN 'cancelled'
    ELSE 'pending'
  END as status,
  p.current_step_id,
  p.error_details,
  jsonb_build_object(
    'migratedFrom', 'projects',
    'originalProjectId', p.id,
    'originalMetadata', p.metadata
  ) as metadata,
  p.created_at,
  p.updated_at,
  p.parent_project_id as parent_orchestration_run_id,
  p.hierarchy_level
FROM projects p
LEFT JOIN orchestration_definitions od ON od.slug = 'migrated-project-' || p.id;

-- Migrate project steps to orchestration steps
INSERT INTO orchestration_steps (
  id, -- Keep same ID for deliverables migration
  run_id,
  step_key,
  step_index,
  step_type,
  step_name,
  agent_name,
  prompt,
  status,
  result,
  error_details,
  started_at,
  completed_at,
  metadata,
  created_at,
  updated_at
)
SELECT
  ps.id,
  ps.project_id as run_id, -- Now points to orchestration_runs
  ps.step_id as step_key,
  ps.step_index,
  ps.step_type,
  ps.step_name,
  ps.agent_name,
  ps.prompt,
  CASE ps.status
    WHEN 'pending_approval' THEN 'pending'
    ELSE ps.status
  END as status,
  ps.result,
  ps.error_details,
  ps.started_at,
  ps.completed_at,
  jsonb_build_object(
    'migratedFrom', 'project_steps',
    'originalStepId', ps.id,
    'dependencies', ps.dependencies,
    'originalMetadata', ps.metadata
  ) as metadata,
  ps.created_at,
  ps.updated_at
FROM project_steps ps;

-- Update deliverables to point to orchestration steps
UPDATE deliverables
SET orchestration_step_id = project_step_id
WHERE project_step_id IS NOT NULL;

-- Verify migration
SELECT
  'projects' as table_name,
  COUNT(*) as original_count,
  (SELECT COUNT(*) FROM orchestration_runs WHERE metadata->>'migratedFrom' = 'projects') as migrated_count
FROM projects
UNION ALL
SELECT
  'project_steps' as table_name,
  COUNT(*) as original_count,
  (SELECT COUNT(*) FROM orchestration_steps WHERE metadata->>'migratedFrom' = 'project_steps') as migrated_count
FROM project_steps;
```

### 6.4 Rollback Plan

```sql
-- If migration fails, we can recreate projects from orchestration_runs
-- Keep this script ready

CREATE TABLE projects_backup AS SELECT * FROM projects;
CREATE TABLE project_steps_backup AS SELECT * FROM project_steps;

-- To rollback:
-- 1. Restore from backups
-- 2. Delete migrated orchestration data
-- 3. Investigate issues
-- 4. Fix migration script
-- 5. Try again
```

---

## 7. Risk Assessment

### 7.1 High Risk Areas

**1. Deliverables Link**
- **Risk:** Breaking existing deliverables if migration fails
- **Impact:** HIGH - Users lose access to work product
- **Mitigation:**
  - Keep both columns during transition
  - Test thoroughly with production-like data
  - Maintain backward compatibility queries

**2. Frontend State Management**
- **Risk:** Cached/stale project data in stores
- **Impact:** MEDIUM - Users see incorrect data
- **Mitigation:**
  - Clear all caches during migration
  - Force refresh on first load after migration
  - Add version checking

**3. In-Flight Projects**
- **Risk:** Active projects mid-execution during migration
- **Impact:** HIGH - Execution interruption
- **Mitigation:**
  - Schedule migration during low-usage period
  - Pause all active projects before migration
  - Provide clear communication to users

**4. Hierarchical Relationships**
- **Risk:** Parent/child links get corrupted
- **Impact:** MEDIUM - Tree navigation breaks
- **Mitigation:**
  - Validate all parent_ids exist before migration
  - Run integrity checks after migration
  - Maintain referential integrity with FK constraints

### 7.2 Medium Risk Areas

**1. Status Mapping**
- **Risk:** Status values don't map cleanly
- **Impact:** MEDIUM - Incorrect project states
- **Mitigation:**
  - Document all status mappings clearly
  - Add metadata for ambiguous cases
  - Test all status transition scenarios

**2. API Contract Changes**
- **Risk:** Breaking changes for any API consumers
- **Impact:** MEDIUM - External integrations break
- **Mitigation:**
  - Maintain deprecated `/projects` endpoints temporarily
  - Version the API
  - Provide migration guide for API users

**3. Analytics/Metrics**
- **Risk:** Historical metrics show gaps
- **Impact:** LOW-MEDIUM - Reporting issues
- **Mitigation:**
  - Migrate all historical data
  - Keep projects table read-only for 1 month
  - Add data bridging queries

### 7.3 Low Risk Areas

**1. UI Components**
- **Risk:** Visual inconsistencies
- **Impact:** LOW - Cosmetic issues
- **Mitigation:**
  - Reuse existing component patterns
  - Test on multiple screen sizes
  - Gather user feedback

**2. Documentation**
- **Risk:** Out-of-date docs
- **Impact:** LOW - Confusion for developers
- **Mitigation:**
  - Update docs before migration
  - Mark old docs as deprecated
  - Provide migration examples

### 7.4 Testing Requirements

**Unit Tests:**
- All orchestration services
- Data migration functions
- Status mapping logic
- Hierarchical operations

**Integration Tests:**
- End-to-end orchestration creation
- Step execution flow
- Deliverable linking
- Hierarchy navigation
- Recovery operations

**Data Migration Tests:**
- Sample project migration
- Verify record counts match
- Check referential integrity
- Validate status mappings
- Test rollback procedure

**UI Tests:**
- Create orchestration flow
- View orchestration details
- Hierarchical navigation
- Filter and sort operations
- Action buttons (pause, resume, etc.)

---

## 8. Recommendations

### 8.1 Immediate Actions

1. **Freeze Projects Feature** - No new features for Projects module
2. **Add Hierarchy to Orchestrations** - Critical missing feature
3. **Create Frontend Scaffolding** - Build Orchestrations UI components
4. **Test Data Migration** - Run migration on staging environment
5. **Document Migration Plan** - Share with team for review

### 8.2 Migration Timeline

**Week 1: Preparation**
- Add hierarchical support to Orchestrations (backend)
- Create frontend Orchestrations components
- Add orchestration routes (parallel to projects)
- Write comprehensive tests

**Week 2: Parallel Run**
- Deploy both UIs to production
- Default to Projects (existing)
- Make Orchestrations available as beta
- Gather user feedback
- Monitor performance

**Week 3: Migration**
- Schedule migration window
- Run data migration script
- Verify data integrity
- Switch default UI to Orchestrations
- Mark Projects as deprecated

**Week 4: Cleanup**
- Monitor for issues
- Fix any edge cases
- Remove Projects UI (but keep API)
- Update documentation

**Week 5+: Full Deprecation**
- Remove Projects API (after 30 days)
- Drop database tables (after backup)
- Remove all Projects code
- Clean up types and imports

### 8.3 Success Criteria

**Migration is successful when:**
1. ✅ All existing projects migrated to orchestrations
2. ✅ Zero data loss (100% record preservation)
3. ✅ All deliverables properly linked
4. ✅ Hierarchical relationships intact
5. ✅ No broken UI components
6. ✅ All tests passing
7. ✅ Performance equal or better
8. ✅ User feedback positive
9. ✅ No critical bugs for 2 weeks
10. ✅ Old code fully removed

---

## 9. Appendix

### 9.1 Complete File List

**Backend Files (Projects):**
```
/apps/api/src/agent2agent/projects/
├── projects.service.ts (916 lines)
├── projects.controller.ts (525 lines)
└── projects.module.ts (13 lines)

/apps/api/src/agent2agent/orchestration/
└── orchestration.types.ts (471 lines) - Contains BOTH types

/apps/api/src/agent2agent/deliverables/
├── entities/deliverable.entity.ts (references projectStepId)
├── dto/create-deliverable.dto.ts (references projectStepId)
└── deliverables.service.ts (uses projectStepId)
```

**Frontend Files (Projects):**
```
/apps/web/src/
├── services/
│   └── projectsService.ts (324 lines)
├── views/
│   ├── ProjectsListPage.vue (784 lines)
│   ├── ProjectDetailPage.vue (943 lines)
│   └── NewProjectPage.vue (496 lines)
├── components/
│   ├── ProjectDisplay.vue
│   └── NewDeliverableDialog.vue (references projectSteps)
└── router/
    └── index.ts (routes for /projects)
```

**Backend Files (Orchestrations):**
```
/apps/api/src/agent-platform/
├── controllers/
│   └── orchestrations.controller.ts
├── services/
│   ├── orchestration-runner.service.ts
│   ├── orchestration-execution.service.ts
│   ├── orchestration-state.service.ts
│   ├── orchestration-dashboard.service.ts
│   ├── orchestration-metrics.service.ts
│   ├── orchestration-checkpoint.service.ts
│   ├── orchestration-progress-events.service.ts
│   ├── orchestration-events.service.ts
│   ├── orchestration-output-mapper.service.ts
│   └── [30+ more services...]
├── repositories/
│   ├── agent-orchestrations.repository.ts
│   ├── orchestration-runs.repository.ts
│   ├── orchestration-definitions.repository.ts
│   └── orchestration-steps.repository.ts
├── entities/
│   ├── orchestration-definition.entity.ts
│   ├── orchestration-run.entity.ts
│   └── orchestration-step.entity.ts
└── types/
    ├── orchestration-definition.types.ts
    ├── orchestration-events.types.ts
    └── orchestration-dashboard.types.ts
```

### 9.2 Database Schema Comparison

**Projects Schema:**
- `projects` (11 columns, 3 hierarchical)
- `project_steps` (15 columns)
- Total: 2 tables

**Orchestrations Schema:**
- `orchestration_definitions` (13+ columns, multi-tenant)
- `orchestration_runs` (12+ columns)
- `orchestration_steps` (12+ columns)
- `agent_orchestrations` (linking table)
- `human_approvals` (dedicated table)
- Total: 5+ tables

**Deliverables:**
- Currently: `project_step_id UUID`
- Future: `orchestration_step_id UUID`

### 9.3 Key Differences

| Aspect | Projects | Orchestrations |
|--------|----------|----------------|
| **Architecture** | Simple, monolithic | Modular, service-oriented |
| **Reusability** | Each project unique | Template-based definitions |
| **Multi-tenancy** | No | Yes (organization scoped) |
| **Versioning** | No | Yes |
| **Monitoring** | Basic | Advanced dashboard |
| **Events** | Deprecated WebSockets | Modern SSE streaming |
| **Testing** | Minimal | Comprehensive |
| **Documentation** | Basic | Extensive PRDs |

---

## 10. Conclusion

This audit reveals that **Projects** is a legacy implementation that should be fully replaced by **Orchestrations**. The Orchestrations system is:
- More mature
- Better architected
- More scalable
- Better tested
- More feature-rich

**Next Steps:**
1. Review this audit with the team
2. Approve migration timeline
3. Implement hierarchical support for Orchestrations
4. Begin Phase 1 preparation
5. Execute migration plan

**Estimated Total Effort:** 4-5 weeks for complete migration and cleanup

**Risk Level:** MEDIUM (with proper preparation and testing)

**Recommendation:** PROCEED with migration, but carefully and incrementally

---

**End of Audit Report**

*Generated: 2025-10-17*
*Status: ANALYSIS COMPLETE - NO CODE CHANGES MADE*
